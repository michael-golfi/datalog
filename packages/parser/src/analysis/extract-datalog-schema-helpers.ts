import {
  defCompoundFieldSchema,
  defCompoundSchema,
  type Cardinality,
  type DefCompoundSchema,
  type ScalarDomain,
} from '@datalog/ast';

import type { ParsedClause } from '../contracts/parsed-document.js';

const CARDINALITIES = new Set<Cardinality>(['0', '1', '?', '+', '*']);

const DOMAIN_ALIASES: Readonly<Record<string, ScalarDomain>> = {
  'graph/node': 'node',
  'liquid/node': 'node',
  'graph/string': 'text',
  'liquid/string': 'text',
  'graph/int': 'int8',
  'liquid/int': 'int8',
  'graph/bool': 'bool',
  'liquid/bool': 'bool',
  'graph/numeric': 'numeric',
  'liquid/numeric': 'numeric',
  'graph/date': 'date',
  'liquid/date': 'date',
  'graph/timestamp': 'timestamp',
  'liquid/timestamp': 'timestamp',
  'graph/jsonb': 'jsonb',
  'liquid/jsonb': 'jsonb',
  node: 'node',
  text: 'text',
  int8: 'int8',
  numeric: 'numeric',
  bool: 'bool',
  date: 'date',
  timestamp: 'timestamp',
  jsonb: 'jsonb',
};

export interface CompoundSchemaEntry {
  readonly range: ParsedClause['references'][number]['range'];
  readonly schema: DefCompoundSchema;
}

export interface NormalizedDefPredSchema {
  readonly subjectCardinality: Cardinality;
  readonly subjectDomain: ScalarDomain;
  readonly objectCardinality: Cardinality;
  readonly objectDomain: ScalarDomain;
}

export type DefPredReferences = readonly [
  ParsedClause['references'][number],
  ParsedClause['references'][number],
  ParsedClause['references'][number],
  ParsedClause['references'][number],
  ParsedClause['references'][number],
];

type DefCompoundReferences = readonly [
  ParsedClause['references'][number],
  ParsedClause['references'][number],
  ParsedClause['references'][number],
  ParsedClause['references'][number],
];

/** Return the normalized DefPred references when the clause matches that schema shape. */
export function getDefPredReferences(clause: ParsedClause): DefPredReferences | null {
  if (clause.predicate !== 'DefPred' || clause.references.length < 5) {
    return null;
  }

  const [predicateName, subjectCardinality, subjectDomain, objectCardinality, objectDomain] = clause.references;

  if (
    predicateName === undefined
    || subjectCardinality === undefined
    || subjectDomain === undefined
    || objectCardinality === undefined
    || objectDomain === undefined
  ) {
    return null;
  }

  return [predicateName, subjectCardinality, subjectDomain, objectCardinality, objectDomain];
}

/** Normalize DefPred cardinality and domain values into AST schema primitives. */
export function normalizeDefPredSchema(references: DefPredReferences): NormalizedDefPredSchema | null {
  const [, subjectCardinality, subjectDomain, objectCardinality, objectDomain] = references;
  const normalizedSubjectCardinality = normalizeCardinality(subjectCardinality.value);
  const normalizedSubjectDomain = normalizeScalarDomain(subjectDomain.value);
  const normalizedObjectCardinality = normalizeCardinality(objectCardinality.value);
  const normalizedObjectDomain = normalizeScalarDomain(objectDomain.value);

  if (
    normalizedSubjectCardinality === null
    || normalizedSubjectDomain === null
    || normalizedObjectCardinality === null
    || normalizedObjectDomain === null
  ) {
    return null;
  }

  return {
    subjectCardinality: normalizedSubjectCardinality,
    subjectDomain: normalizedSubjectDomain,
    objectCardinality: normalizedObjectCardinality,
    objectDomain: normalizedObjectDomain,
  };
}

/** Build the next compound schema entry for a valid DefCompound clause, if any. */
export function createDefCompoundSchemaEntry(
  clause: ParsedClause,
  schemasByCompoundName: ReadonlyMap<string, CompoundSchemaEntry>,
): CompoundSchemaEntry | null {
  const references = getDefCompoundReferences(clause);

  if (references === null) {
    return null;
  }

  const [compoundName, fieldName, cardinality, domain] = references;
  const normalizedFieldSchema = normalizeDefCompoundField(fieldName.value, cardinality.value, domain.value);

  if (normalizedFieldSchema === null) {
    return null;
  }

  const existing = schemasByCompoundName.get(compoundName.value) ?? createEmptyCompoundSchemaEntry(compoundName.value, compoundName.range);

  return {
    range: existing.range,
    schema: defCompoundSchema({
      compoundName: compoundName.value,
      fields: upsertCompoundField(existing.schema.fields, normalizedFieldSchema),
    }),
  };
}

function getDefCompoundReferences(clause: ParsedClause): DefCompoundReferences | null {
  if (clause.predicate !== 'DefCompound' || clause.references.length < 4) {
    return null;
  }

  const [compoundName, fieldName, cardinality, domain] = clause.references;

  if (compoundName === undefined || fieldName === undefined || cardinality === undefined || domain === undefined) {
    return null;
  }

  return [compoundName, fieldName, cardinality, domain];
}

function normalizeDefCompoundField(
  fieldName: string,
  cardinality: string,
  domain: string,
): ReturnType<typeof defCompoundFieldSchema> | null {
  const normalizedCardinality = normalizeCardinality(cardinality);
  const normalizedDomain = normalizeScalarDomain(domain);

  if (normalizedCardinality === null || normalizedDomain === null) {
    return null;
  }

  return defCompoundFieldSchema({
    fieldName,
    cardinality: normalizedCardinality,
    domain: normalizedDomain,
  });
}

function createEmptyCompoundSchemaEntry(compoundName: string, range: ParsedClause['references'][number]['range']): CompoundSchemaEntry {
  return {
    range,
    schema: defCompoundSchema({
      compoundName,
      fields: [],
    }),
  };
}

function upsertCompoundField(
  fields: ReadonlyArray<DefCompoundSchema['fields'][number]>,
  nextField: DefCompoundSchema['fields'][number],
): ReadonlyArray<DefCompoundSchema['fields'][number]> {
  const nextFields = [...fields];
  const fieldIndex = nextFields.findIndex((field) => field.fieldName === nextField.fieldName);

  if (fieldIndex >= 0) {
    nextFields[fieldIndex] = nextField;
    return nextFields;
  }

  nextFields.push(nextField);
  return nextFields;
}

function normalizeCardinality(value: string): Cardinality | null {
  return CARDINALITIES.has(value as Cardinality) ? value as Cardinality : null;
}

function normalizeScalarDomain(value: string): ScalarDomain | null {
  return DOMAIN_ALIASES[value] ?? null;
}
