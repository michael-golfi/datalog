import type {
  DatalogAtomArgument,
  DatalogConstantTerm,
  DatalogFactStatement,
  DatalogSchema,
  DefCompoundSchema,
  DefPredSchema,
  EdgeFact,
  ScalarDomain,
} from '@datalog/ast';
import { type ParsedClause, type parseDatalogProgram } from '@datalog/parser';

import { DatalogMigrationSchemaError } from './extract-datalog-schema-from-migrations.js';

import type { CompoundBacklinkExpander } from './apply-datalog-migrations.js';

export interface DatalogMigrationSchemaMaps {
  readonly predicateSchemas: ReadonlyMap<string, DefPredSchema>;
  readonly compoundSchemas: ReadonlyMap<string, DefCompoundSchema>;
}

type ParsedProgramStatement = ReturnType<typeof parseDatalogProgram>['statements'][number];

/** Validate committed fact statements against the declared predicate and compound schemas. */
export function validateDatalogMigrationFactStatements(input: {
  readonly statements: readonly ParsedProgramStatement[];
  readonly clauses: readonly ParsedClause[];
  readonly schemaMaps: DatalogMigrationSchemaMaps;
}): void {
  for (const [index, statement] of input.statements.entries()) {
    const clause = input.clauses[index];

    if (statement.kind !== 'fact' || clause === undefined) {
      continue;
    }

    if (isEdgeFactStatement(statement)) {
      validateEdgeFactStatement(statement, input.schemaMaps.predicateSchemas);
      continue;
    }

    if (!clause.isCompound || clause.predicate === 'DefCompound') {
      continue;
    }

    validateCompoundFactStatement({ statement, clause, compoundSchemas: input.schemaMaps.compoundSchemas });
  }
}

/** Expand committed compound assertions into backlink edges after schema validation. */
export function extractCompoundBacklinksFromClauses(input: {
  readonly clauses: readonly ParsedClause[];
  readonly schemas: readonly DatalogSchema[];
  readonly compoundSchemas: ReadonlyMap<string, DefCompoundSchema>;
  readonly compoundBacklinkExpander?: CompoundBacklinkExpander;
}): readonly EdgeFact[] {
  if (input.compoundBacklinkExpander === undefined) {
    return [];
  }

  const edges: EdgeFact[] = [];

  for (const clause of input.clauses) {
    const compoundBacklink = tryExpandCompoundBacklink({
      clause,
      schemas: input.schemas,
      compoundSchemas: input.compoundSchemas,
      compoundBacklinkExpander: input.compoundBacklinkExpander,
    });

    if (compoundBacklink === null || compoundBacklink === undefined) {
      continue;
    }

    edges.push(compoundBacklink);
  }

  return edges;
}

function tryExpandCompoundBacklink(input: {
  readonly clause: ParsedClause;
  readonly schemas: readonly DatalogSchema[];
  readonly compoundSchemas: ReadonlyMap<string, DefCompoundSchema>;
  readonly compoundBacklinkExpander: CompoundBacklinkExpander;
}): EdgeFact | null | undefined {
  if (!input.clause.isCompound || input.clause.predicate === 'DefCompound') {
    return undefined;
  }

  const schema = input.compoundSchemas.get(input.clause.predicate);

  if (schema === undefined) {
    throwMissingSchemaError({
      message: `Compound facts must declare a DefCompound schema for predicate ${input.clause.predicate}.`,
      predicate: input.clause.predicate,
    });
  }

  return input.compoundBacklinkExpander({
    clause: input.clause,
    schema,
    schemas: input.schemas,
  });
}

function validateEdgeFactStatement(
  statement: DatalogFactStatement,
  predicateSchemas: ReadonlyMap<string, DefPredSchema>,
): void {
  const [, predicate, object] = statement.atom.terms;
  const predicateId = getQuotedGraphId(predicate);

  if (predicateId === undefined) {
    return;
  }

  const schema = predicateSchemas.get(predicateId);

  if (schema === undefined) {
    throwMissingSchemaError({
      message: `Edge facts must declare a DefPred schema for predicate ${predicateId}.`,
      predicate: predicateId,
    });
  }

  assertConstantTermMatchesDomain(statement.atom.terms[0], schema.subjectDomain, `${predicateId} subject`);
  assertConstantTermMatchesDomain(object, schema.objectDomain, `${predicateId} object`);
}

function validateCompoundFactStatement(input: {
  readonly statement: DatalogFactStatement;
  readonly clause: ParsedClause;
  readonly compoundSchemas: ReadonlyMap<string, DefCompoundSchema>;
}): void {
  const schema = input.compoundSchemas.get(input.clause.predicate);

  if (schema === undefined) {
    throwMissingSchemaError({
      message: `Compound facts must declare a DefCompound schema for predicate ${input.clause.predicate}.`,
      predicate: input.clause.predicate,
    });
  }

  assertCompoundFieldCardinalities(schema, collectCompoundFieldCounts(input.statement, schema));
}

function assertCompoundFieldCardinalities(
  schema: DefCompoundSchema,
  fieldCounts: ReadonlyMap<string, number>,
): void {
  for (const field of schema.fields) {
    const count = fieldCounts.get(field.fieldName) ?? 0;

    assertCompoundFieldIsPresent({ schema, fieldName: field.fieldName, cardinality: field.cardinality, count });
    assertCompoundFieldCountAllowed({ schema, fieldName: field.fieldName, cardinality: field.cardinality, count });
  }
}

function assertCompoundFieldIsPresent(input: {
  readonly schema: DefCompoundSchema;
  readonly fieldName: string;
  readonly cardinality: DefCompoundSchema['fields'][number]['cardinality'];
  readonly count: number;
}): void {
  if ((input.cardinality === '1' || input.cardinality === '+') && input.count === 0) {
    throwInvalidFactError(`Compound fact ${input.schema.compoundName}@ is missing required field ${input.fieldName}.`);
  }
}

function assertCompoundFieldCountAllowed(input: {
  readonly schema: DefCompoundSchema;
  readonly fieldName: string;
  readonly cardinality: DefCompoundSchema['fields'][number]['cardinality'];
  readonly count: number;
}): void {
  if ((input.cardinality === '1' || input.cardinality === '?') && input.count > 1) {
    throwInvalidFactError(
      `Compound fact ${input.schema.compoundName}@ repeats field ${input.fieldName} more than its ${input.cardinality} cardinality allows.`,
    );
  }
}

function collectCompoundFieldCounts(
  statement: DatalogFactStatement,
  schema: DefCompoundSchema,
): ReadonlyMap<string, number> {
  const fieldCounts = new Map<string, number>();
  const fieldsByName = new Map(schema.fields.map((field) => [field.fieldName, field]));

  for (const term of statement.atom.terms) {
    if (term.kind !== 'named') {
      continue;
    }

    if (term.name === 'cid') {
      assertConstantTermMatchesDomain(term.term, 'node', `${schema.compoundName} cid`);
      continue;
    }

    const fieldSchema = fieldsByName.get(term.name);

    if (fieldSchema === undefined) {
      throwInvalidFactError(`Compound fact ${schema.compoundName}@ uses undeclared field ${term.name}.`);
    }

    fieldCounts.set(term.name, (fieldCounts.get(term.name) ?? 0) + 1);
    assertConstantTermMatchesDomain(term.term, fieldSchema.domain, `${schema.compoundName} field ${fieldSchema.fieldName}`);
  }

  return fieldCounts;
}

function isEdgeFactStatement(statement: DatalogFactStatement): boolean {
  return statement.atom.predicate === 'Edge' && statement.atom.terms.length === 3;
}

function getQuotedGraphId(term: DatalogAtomArgument | undefined): string | undefined {
  if (term === undefined || term.kind === 'named' || term.kind !== 'constant' || typeof term.value !== 'string') {
    return undefined;
  }

  return term.value;
}

function assertConstantTermMatchesDomain(term: DatalogAtomArgument | undefined, domain: ScalarDomain, label: string): void {
  if (term === undefined || term.kind === 'named' || term.kind !== 'constant') {
    throwInvalidFactError(`${label} must be a constant.`);
  }

  if (!matchesScalarDomain(term, domain)) {
    throwInvalidFactError(`${label} must match the ${domain} domain.`);
  }
}

function matchesScalarDomain(term: DatalogConstantTerm, domain: ScalarDomain): boolean {
  if (domain === 'int8' || domain === 'numeric') {
    return typeof term.value === 'number';
  }

  if (domain === 'bool') {
    return typeof term.value === 'boolean';
  }

  return typeof term.value === 'string';
}

function throwInvalidFactError(message: string): never {
  throw new DatalogMigrationSchemaError({
    code: 'datalog-migrate.invalid-fact',
    message,
    details: { migrationIndex: -1, predicate: 'fact' },
  });
}

function throwMissingSchemaError(input: {
  readonly message: string;
  readonly predicate: string;
}): never {
  throw new DatalogMigrationSchemaError({
    code: 'datalog-migrate.missing-schema',
    message: input.message,
    details: { migrationIndex: -1, predicate: input.predicate },
  });
}
