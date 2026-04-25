import type { Cardinality, DefCompoundFieldSchema, DefCompoundSchema, DatalogTerm, ScalarDomain } from '@datalog/ast';
import { getCompoundSchemaDeclaration } from '@datalog/parser';
import type { parseDocument } from '@datalog/parser';

import type { LanguageServerDiagnostic } from '../contracts/language-feature-types.js';
import type { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';

type ParsedClause = ReturnType<typeof parseDocument>['clauses'][number];

/** Create compound fact diagnostics from parser-backed schema declarations. */
export function createCompoundSchemaDiagnostics(options: {
  readonly clause: ParsedClause;
  readonly statement: { readonly kind: string; readonly atom?: { readonly predicate: string; readonly terms: readonly unknown[] } } | undefined;
  readonly parsedDocument: ReturnType<typeof parseDocument>;
  readonly workspaceIndex?: DatalogWorkspaceIndex;
}): LanguageServerDiagnostic[] {
  if (!options.clause.isCompound || options.statement?.kind !== 'fact' || options.statement.atom?.predicate !== options.clause.predicate) {
    return [];
  }

  const schema = resolveCompoundSchema({
    parsedDocument: options.parsedDocument,
    compoundName: options.clause.predicate,
    ...(options.workspaceIndex ? { workspaceIndex: options.workspaceIndex } : {}),
  });
  if (!schema) {
    return [];
  }

  const termOccurrencesByField = collectFieldTermOccurrences(options.clause, options.statement.atom.terms);

  return [
    ...createFieldDomainDiagnostics(options.clause, schema, termOccurrencesByField),
    ...createAllFieldCardinalityDiagnostics(options.clause, schema, termOccurrencesByField),
  ];
}

function resolveCompoundSchema(options: {
  readonly parsedDocument: ReturnType<typeof parseDocument>;
  readonly workspaceIndex?: DatalogWorkspaceIndex;
  readonly compoundName: string;
}): DefCompoundSchema | undefined {
  const localSchema = getCompoundSchemaDeclaration(options.parsedDocument.schemaDeclarations, options.compoundName)?.schema;
  if (localSchema?.kind === 'compound-schema') {
    return localSchema;
  }

  return options.workspaceIndex?.getCompoundSchemaTargets(options.compoundName)[0]?.schema;
}

function collectFieldTermOccurrences(
  clause: ParsedClause,
  terms: readonly unknown[],
): Map<string, Array<{ readonly range: ParsedClause['range']; readonly term: DatalogTerm }>> {
  const occurrencesByField = new Map<string, Array<{ readonly range: ParsedClause['range']; readonly term: DatalogTerm }>>();

  for (const candidate of terms) {
    if (!isNamedTerm(candidate)) {
      continue;
    }

    const occurrences = occurrencesByField.get(candidate.name) ?? [];
    occurrences.push({
      range: candidate.location?.range ?? candidate.term.location?.range ?? clause.range,
      term: candidate.term,
    });
    occurrencesByField.set(candidate.name, occurrences);
  }

  return occurrencesByField;
}

function createFieldDomainDiagnostics(
  clause: ParsedClause,
  schema: DefCompoundSchema,
  termOccurrencesByField: ReadonlyMap<string, ReadonlyArray<{ readonly range: ParsedClause['range']; readonly term: DatalogTerm }>>,
): LanguageServerDiagnostic[] {
  return schema.fields.flatMap((fieldSchema) => createSingleFieldDomainDiagnostics({
    predicateName: clause.predicate,
    fieldSchema,
    occurrences: termOccurrencesByField.get(fieldSchema.fieldName) ?? [],
  }));
}

function createSingleFieldDomainDiagnostics(options: {
  readonly predicateName: string;
  readonly fieldSchema: DefCompoundFieldSchema;
  readonly occurrences: ReadonlyArray<{ readonly range: ParsedClause['range']; readonly term: DatalogTerm }>;
}): LanguageServerDiagnostic[] {
  return options.occurrences
    .filter((occurrence) => !isTermCompatibleWithDomain(occurrence.term, options.fieldSchema.domain))
    .map((occurrence) => ({
      range: occurrence.range,
      severity: 'error' as const,
      source: 'datalog',
      message: `${options.predicateName}@ field ${options.fieldSchema.fieldName} expects domain \`${options.fieldSchema.domain}\`, found \`${describeTermDomain(occurrence.term)}\`.`,
    }));
}

function createAllFieldCardinalityDiagnostics(
  clause: ParsedClause,
  schema: DefCompoundSchema,
  termOccurrencesByField: ReadonlyMap<string, ReadonlyArray<{ readonly range: ParsedClause['range']; readonly term: DatalogTerm }>>,
): LanguageServerDiagnostic[] {
  return schema.fields.flatMap((fieldSchema) => createFieldCardinalityDiagnostics({
    predicateName: clause.predicate,
    clauseRange: clause.predicateRange,
    fieldSchema,
    occurrences: termOccurrencesByField.get(fieldSchema.fieldName) ?? [],
  }));
}

function createFieldCardinalityDiagnostics(options: {
  readonly predicateName: string;
  readonly clauseRange: ParsedClause['predicateRange'];
  readonly fieldSchema: DefCompoundFieldSchema;
  readonly occurrences: ReadonlyArray<{ readonly range: ParsedClause['range']; readonly term: DatalogTerm }>;
}): LanguageServerDiagnostic[] {
  if (requiresAtLeastOneValue(options.fieldSchema.cardinality) && options.occurrences.length === 0) {
    return [{
      range: options.clauseRange,
      severity: 'error',
      source: 'datalog',
      message: `${options.predicateName}@ field ${options.fieldSchema.fieldName} requires at least one value (cardinality \`${options.fieldSchema.cardinality}\`).`,
    }];
  }

  if (allowsMultipleValues(options.fieldSchema.cardinality) || options.occurrences.length <= 1) {
    return [];
  }

  return options.occurrences.slice(1).map((occurrence) => ({
    range: occurrence.range,
    severity: 'error' as const,
    source: 'datalog',
    message: `${options.predicateName}@ field ${options.fieldSchema.fieldName} allows at most one value (cardinality \`${options.fieldSchema.cardinality}\`).`,
  }));
}

function requiresAtLeastOneValue(cardinality: Cardinality): boolean {
  return cardinality === '1' || cardinality === '+';
}

function allowsMultipleValues(cardinality: Cardinality): boolean {
  return cardinality === '0' || cardinality === '+' || cardinality === '*';
}

function isTermCompatibleWithDomain(term: DatalogTerm, domain: ScalarDomain): boolean {
  if (term.kind === 'variable' || term.kind === 'wildcard') {
    return true;
  }

  const valueKind = getConstantValueKind(term.value);
  if (valueKind === 'string') {
    return acceptsStringDomain(domain);
  }

  if (valueKind === 'number') {
    return domain === 'numeric' || (domain === 'int8' && Number.isInteger(term.value));
  }

  return valueKind === 'boolean' && domain === 'bool';
}

function acceptsStringDomain(domain: ScalarDomain): boolean {
  return domain === 'node'
    || domain === 'text'
    || domain === 'jsonb'
    || domain === 'date'
    || domain === 'timestamp';
}

function getConstantValueKind(value: string | number | boolean | null): 'string' | 'number' | 'boolean' | 'null' {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return 'string';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  return 'boolean';
}

function describeTermDomain(term: DatalogTerm): string {
  if (term.kind === 'variable') {
    return 'variable';
  }

  if (term.kind === 'wildcard') {
    return 'wildcard';
  }

  const valueKind = getConstantValueKind(term.value);
  if (valueKind === 'string') {
    return 'text';
  }

  if (valueKind === 'number') {
    return Number.isInteger(term.value) ? 'int8' : 'numeric';
  }

  return valueKind === 'boolean' ? 'bool' : 'null';
}

function isNamedTerm(value: unknown): value is {
  readonly kind: 'named';
  readonly name: string;
  readonly term: DatalogTerm;
  readonly location?: { readonly range?: ParsedClause['range'] };
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return 'kind' in value && value.kind === 'named' && 'name' in value && typeof value.name === 'string' && 'term' in value;
}
