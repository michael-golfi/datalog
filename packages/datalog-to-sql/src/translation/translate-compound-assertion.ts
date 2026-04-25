import {
  edgeFact,
  generateCompoundIdentity,
  vertexFact,
  type DatalogAtomArgument,
  type DatalogFact,
  type DatalogNamedTerm,
} from '@datalog/ast';

import { GraphTranslationError } from '../contracts/graph-translation-error.js';

import type {
  InsertCompoundAssertionOperation,
  InsertFactsOperation,
} from '../contracts/postgres-graph-operation.js';

/** Lower a compound assertion fact into graph vertex and edge inserts. */
export function translateCompoundAssertion(
  operation: InsertCompoundAssertionOperation,
): InsertFactsOperation {
  if (operation.assertion.atom.predicate !== operation.schema.compoundName) {
    throw new GraphTranslationError(
      'datalog-to-sql.compound-assertion.schema-mismatch',
      `Compound assertion ${operation.assertion.atom.predicate} does not match schema ${operation.schema.compoundName}.`,
    );
  }

  const fieldTerms = collectCompoundFieldTerms(operation.assertion.atom.terms);
  assertKnownCompoundFields(operation, fieldTerms);
  const compoundId = resolveCompoundId(operation, fieldTerms);
  const hubVertex = vertexFact(compoundId);
  const fieldEdges: DatalogFact[] = [];

  for (const field of operation.schema.fields) {
    const term = fieldTerms.get(field.fieldName);

    if (term === undefined) {
      continue;
    }

    fieldEdges.push(edgeFact({
      subjectId: compoundId,
      predicateId: field.fieldName,
      objectId: stringifyCompoundTermValue(term, field.fieldName),
    }));
  }

  return {
    kind: 'insert-facts',
    facts: [hubVertex, ...fieldEdges],
  };
}

function collectCompoundFieldTerms(
  terms: readonly DatalogAtomArgument[],
): ReadonlyMap<string, DatalogNamedTerm['term']> {
  const fieldTerms = new Map<string, DatalogNamedTerm['term']>();

  for (const term of terms) {
    if (term.kind !== 'named') {
      throw new GraphTranslationError(
        'datalog-to-sql.compound-assertion.invalid-term',
        'Compound assertions must use named field assignments.',
      );
    }

    if (fieldTerms.has(term.name)) {
      throw new GraphTranslationError(
        'datalog-to-sql.compound-assertion.duplicate-field',
        `Compound assertions must not repeat field ${term.name}.`,
      );
    }

    fieldTerms.set(term.name, term.term);
  }

  return fieldTerms;
}

function resolveCompoundId(
  operation: InsertCompoundAssertionOperation,
  fieldTerms: ReadonlyMap<string, DatalogNamedTerm['term']>,
): string {
  const cidTerm = fieldTerms.get('cid');

  if (cidTerm === undefined) {
    throw new GraphTranslationError(
      'datalog-to-sql.compound-assertion.missing-cid',
      'Compound assertions must include a cid binding.',
    );
  }

  if (cidTerm.kind === 'constant') {
    return stringifyScalarValue(cidTerm.value);
  }

  if (cidTerm.kind === 'variable') {
    return generateCompoundIdentity(
      operation.schema,
      collectIdentityFieldValues(operation.schema.fields, fieldTerms),
    );
  }

  throw new GraphTranslationError(
    'datalog-to-sql.compound-assertion.invalid-cid',
    'Compound assertion cid must be a constant or variable term.',
  );
}

function collectIdentityFieldValues(
  fields: InsertCompoundAssertionOperation['schema']['fields'],
  fieldTerms: ReadonlyMap<string, DatalogNamedTerm['term']>,
): ReadonlyMap<string, string> {
  const fieldValues = new Map<string, string>();

  for (const field of fields) {
    const term = fieldTerms.get(field.fieldName);

    if (term === undefined) {
      continue;
    }

    fieldValues.set(field.fieldName, stringifyCompoundTermValue(term, field.fieldName));
  }

  return fieldValues;
}

function assertKnownCompoundFields(
  operation: InsertCompoundAssertionOperation,
  fieldTerms: ReadonlyMap<string, DatalogNamedTerm['term']>,
): void {
  const knownFields = new Set(operation.schema.fields.map((field) => field.fieldName));

  for (const fieldName of fieldTerms.keys()) {
    if (fieldName === 'cid' || knownFields.has(fieldName)) {
      continue;
    }

    throw new GraphTranslationError(
      'datalog-to-sql.compound-assertion.unknown-field',
      `Compound assertion field ${fieldName} is not declared in schema ${operation.schema.compoundName}.`,
    );
  }
}

function stringifyCompoundTermValue(term: DatalogNamedTerm['term'], fieldName: string): string {
  if (term.kind !== 'constant') {
    throw new GraphTranslationError(
      'datalog-to-sql.compound-assertion.invalid-term',
      `Compound assertion field ${fieldName} must use a constant value.`,
    );
  }

  return stringifyScalarValue(term.value);
}

function stringifyScalarValue(value: string | number | boolean | null): string {
  return String(value);
}
