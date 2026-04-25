import { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type { PostgresGraphOperation } from '../contracts/postgres-graph-operation.js';

const SUPPORTED_GRAPH_OPERATION_KINDS = new Set([
  'select-vertex-by-id',
  'select-edges',
  'select-facts',
  'insert-facts',
  'insert-compound-assertion',
  'delete-facts',
  'select-recursive-closure-count',
]);

/** Validate that a graph operation kind is supported by the SQL translator. */
export function validateGraphOperation(operation: PostgresGraphOperation): void {
  assertSupportedGraphOperationKind(operation.kind);
  validateKnownGraphOperation(operation);
}

function validateKnownGraphOperation(operation: PostgresGraphOperation): void {
  switch (operation.kind) {
    case 'select-vertex-by-id':
      validateSelectVertexByIdOperation(operation);
      return;
    case 'select-facts':
      validateSelectFactsOperation(operation);
      return;
    case 'select-edges':
      return;
    case 'insert-compound-assertion':
      validateInsertCompoundAssertionOperation(operation);
      return;
    case 'insert-facts':
    case 'delete-facts':
      validateFactMutationOperation(operation);
      return;
    case 'select-recursive-closure-count':
      validateSelectRecursiveClosureCountOperation(operation);
      return;
  }
}

function assertSupportedGraphOperationKind(kind: PostgresGraphOperation['kind']): void {
  if (SUPPORTED_GRAPH_OPERATION_KINDS.has(kind)) {
    return;
  }

  throw new GraphTranslationError(
    'datalog-to-sql.operation.invalid-kind',
    'Graph operations must use a supported kind.',
  );
}

function validateSelectVertexByIdOperation(
  operation: Extract<PostgresGraphOperation, { kind: 'select-vertex-by-id' }>,
): void {
  assertNonEmptyString(operation.vertexId);
}

function validateSelectFactsOperation(
  operation: Extract<PostgresGraphOperation, { kind: 'select-facts' }>,
): void {
  assertArray(operation.match);
  assertPredicateCatalog(operation.predicateCatalog);
}

function validateInsertCompoundAssertionOperation(
  operation: Extract<PostgresGraphOperation, { kind: 'insert-compound-assertion' }>,
): void {
  assertCompoundSchema(operation.schema);
  assertFactStatement(operation.assertion);
}

function validateFactMutationOperation(
  operation: Extract<PostgresGraphOperation, { kind: 'insert-facts' | 'delete-facts' }>,
): void {
  assertArray(operation.facts);
}

function validateSelectRecursiveClosureCountOperation(
  operation: Extract<PostgresGraphOperation, { kind: 'select-recursive-closure-count' }>,
): void {
  assertNonEmptyString(operation.rootVertexId);
  assertNonEmptyString(operation.predicateId);
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

function assertPredicateCatalog(value: unknown): void {
  if (
    typeof value === 'object'
    && value !== null
    && 'version' in value
    && 'predicates' in value
    && (value as { readonly version?: unknown }).version === 1
    && Array.isArray((value as { readonly predicates?: unknown }).predicates)
  ) {
    return;
  }

  throw new GraphTranslationError(
    'datalog-to-sql.operation.invalid-shape',
    'Graph operations must include the required fields for their kind.',
  );
}

function assertCompoundSchema(value: unknown): void {
  if (
    typeof value === 'object'
    && value !== null
    && (value as { readonly kind?: unknown }).kind === 'compound-schema'
    && typeof (value as { readonly compoundName?: unknown }).compoundName === 'string'
    && Array.isArray((value as { readonly fields?: unknown }).fields)
  ) {
    return;
  }

  throw new GraphTranslationError(
    'datalog-to-sql.operation.invalid-shape',
    'Graph operations must include the required fields for their kind.',
  );
}

function assertFactStatement(value: unknown): void {
  if (
    typeof value === 'object'
    && value !== null
    && (value as { readonly kind?: unknown }).kind === 'fact'
    && typeof (value as { readonly atom?: unknown }).atom === 'object'
    && (value as { readonly atom?: { readonly kind?: unknown } }).atom?.kind === 'atom'
  ) {
    return;
  }

  throw new GraphTranslationError(
    'datalog-to-sql.operation.invalid-shape',
    'Graph operations must include the required fields for their kind.',
  );
}
