import type {
  Cardinality,
  DefCompoundFieldSchema,
  DefCompoundSchema,
  DefPredSchema,
  ScalarDomain,
} from './datalog-schema.js';

export function defPredSchema(input: {
  readonly predicateName: string;
  readonly subjectCardinality: Cardinality;
  readonly subjectDomain: ScalarDomain;
  readonly objectCardinality: Cardinality;
  readonly objectDomain: ScalarDomain;
}): DefPredSchema {
  return {
    kind: 'predicate-schema',
    predicateName: input.predicateName,
    subjectCardinality: input.subjectCardinality,
    subjectDomain: input.subjectDomain,
    objectCardinality: input.objectCardinality,
    objectDomain: input.objectDomain,
  };
}

export function defCompoundFieldSchema(input: {
  readonly fieldName: string;
  readonly cardinality: Cardinality;
  readonly domain: ScalarDomain;
}): DefCompoundFieldSchema {
  return {
    fieldName: input.fieldName,
    cardinality: input.cardinality,
    domain: input.domain,
  };
}

export function defCompoundSchema(input: {
  readonly compoundName: string;
  readonly fields: readonly DefCompoundFieldSchema[];
  readonly mutable?: boolean;
}): DefCompoundSchema {
  return {
    kind: 'compound-schema',
    compoundName: input.compoundName,
    fields: input.fields.map((field) => ({ ...field })),
    ...(input.mutable === undefined ? {} : { mutable: input.mutable }),
  };
}

export function generateCompoundIdentity(
  schema: DefCompoundSchema,
  fieldValues: ReadonlyMap<string, string>,
): string {
  const encodedFieldPairs = [...schema.fields]
    .sort(compareCompoundFieldsByName)
    .map((field) => {
      const value = fieldValues.get(field.fieldName);

      if (value === undefined) {
        throw new Error(`Missing compound identity field value for ${field.fieldName}.`);
      }

      return `${field.fieldName}=${encodeCompoundIdentityValue(value)}`;
    });

  return `${schema.compoundName}:${encodedFieldPairs.join(',')}`;
}

function compareCompoundFieldsByName(left: DefCompoundFieldSchema, right: DefCompoundFieldSchema): number {
  if (left.fieldName < right.fieldName) {
    return -1;
  }

  if (left.fieldName > right.fieldName) {
    return 1;
  }

  return 0;
}

function encodeCompoundIdentityValue(value: string): string {
  return value.includes(':') || value.includes(',')
    ? encodeURIComponent(value)
    : value;
}
