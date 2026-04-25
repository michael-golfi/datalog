import { GraphTranslationError } from '../contracts/graph-translation-error.js';

import type { PostgresGraphOperation } from '../contracts/postgres-graph-operation.js';

const SUPPORTED_GRAPH_OPERATION_KINDS = new Set([
  'select-vertex-by-id',
  'select-edges',
  'select-facts',
  'insert-facts',
  'delete-facts',
  'select-recursive-closure-count',
]);

/** Validate that a graph operation kind is supported by the SQL translator. */
export function validateGraphOperation(operation: PostgresGraphOperation): void {
  if (!SUPPORTED_GRAPH_OPERATION_KINDS.has(operation.kind)) {
    throw new GraphTranslationError(
      'datalog-to-sql.operation.invalid-kind',
      'Graph operations must use a supported kind.',
    );
  }

  if (operation.kind === 'select-vertex-by-id') {
    assertNonEmptyString(operation.vertexId);
    return;
  }

  if (operation.kind === 'select-facts') {
    assertArray(operation.match);
    return;
  }

  if (operation.kind === 'insert-facts' || operation.kind === 'delete-facts') {
    assertArray(operation.facts);
    return;
  }

  if (operation.kind === 'select-recursive-closure-count') {
    assertNonEmptyString(operation.rootVertexId);
    assertNonEmptyString(operation.predicateId);
  }
}

function assertNonEmptyString(value: unknown): void {
  if (typeof value === 'string' && value.trim().length > 0) {
    return;
  }

  throw new GraphTranslationError(
    'datalog-to-sql.operation.invalid-shape',
    'Graph operations must include the required fields for their kind.',
  );
}

function assertArray(value: unknown): void {
  if (Array.isArray(value)) {
    return;
  }

  throw new GraphTranslationError(
    'datalog-to-sql.operation.invalid-shape',
    'Graph operations must include the required fields for their kind.',
  );
}
