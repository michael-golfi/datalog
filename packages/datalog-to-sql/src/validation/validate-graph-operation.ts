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
  if (SUPPORTED_GRAPH_OPERATION_KINDS.has(operation.kind)) {
    return;
  }

  throw new GraphTranslationError(
    'datalog-to-sql.operation.invalid-kind',
    'Graph operations must use a supported kind.',
  );
}
