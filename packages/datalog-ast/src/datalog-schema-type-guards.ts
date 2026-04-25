import type {
  Cardinality,
  DatalogSchema,
  DefCompoundFieldSchema,
  DefCompoundSchema,
  DefPredSchema,
  ScalarDomain,
} from './datalog-schema.js';

const CARDINALITIES: readonly Cardinality[] = ['0', '1', '?', '+', '*'];
const SCALAR_DOMAINS: readonly ScalarDomain[] = ['node', 'text', 'int8', 'numeric', 'bool', 'jsonb', 'date', 'timestamp'];

export function isCardinality(value: unknown): value is Cardinality {
  return typeof value === 'string' && CARDINALITIES.includes(value as Cardinality);
}

export function isScalarDomain(value: unknown): value is ScalarDomain {
  return typeof value === 'string' && SCALAR_DOMAINS.includes(value as ScalarDomain);
}

export function isDefPredSchema(value: unknown): value is DefPredSchema {
  return isRecord(value)
    && value.kind === 'predicate-schema'
    && typeof value.predicateName === 'string'
    && isCardinality(value.subjectCardinality)
    && isScalarDomain(value.subjectDomain)
    && isCardinality(value.objectCardinality)
    && isScalarDomain(value.objectDomain);
}

export function isDefCompoundFieldSchema(value: unknown): value is DefCompoundFieldSchema {
  return isRecord(value)
    && typeof value.fieldName === 'string'
    && isCardinality(value.cardinality)
    && isScalarDomain(value.domain);
}

export function isDefCompoundSchema(value: unknown): value is DefCompoundSchema {
  return isRecord(value)
    && value.kind === 'compound-schema'
    && typeof value.compoundName === 'string'
    && isReadonlyArrayOf(value.fields, isDefCompoundFieldSchema)
    && isOptionalBoolean(value.mutable);
}

export function isDatalogSchema(value: unknown): value is DatalogSchema {
  return isDefPredSchema(value) || isDefCompoundSchema(value);
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}

function isReadonlyArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is readonly T[] {
  return Array.isArray(value) && value.every((item) => guard(item));
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean';
}
