import { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type { GraphTranslationResult } from '../contracts/graph-translation-result.js';
import type { PostgresGraphOperation } from '../contracts/postgres-graph-operation.js';
import type { TranslatedSqlQuery } from '../contracts/translated-sql-query.js';
import { translateDatalogFactQuery } from './translate-datalog-fact-query.js';
import { translateCompoundAssertion } from './translate-compound-assertion.js';
import { translateFactDelete } from './translate-fact-delete.js';
import { translateFactInsert } from './translate-fact-insert.js';
import { validateGraphOperation } from '../validation/validate-graph-operation.js';
import { validateSelectFactsOperation } from '../validation/validate-select-facts-operation.js';

/** Translate a supported graph operation into a SQL query or mutation. */
export function translateGraphOperation(operation: PostgresGraphOperation): GraphTranslationResult {
  try {
    validateGraphOperation(operation);
    return translateKnownOperation(operation);
  } catch (error) {
    if (error instanceof GraphTranslationError) {
      return {
        ok: false,
        error,
      };
    }

    throw error;
  }
}

function translateKnownOperation(operation: PostgresGraphOperation): GraphTranslationResult {
  if (operation.kind === 'select-vertex-by-id') {
    return { ok: true, value: createSelectVertexByIdQuery(operation.vertexId) };
  }

  if (operation.kind === 'select-edges') {
    return { ok: true, value: translateSelectEdges(operation) };
  }

  if (operation.kind === 'select-facts') {
    validateSelectFactsOperation(operation);
    return { ok: true, value: translateDatalogFactQuery(operation) };
  }

  if (operation.kind === 'insert-facts') {
    return { ok: true, value: translateFactInsert(operation) };
  }

  if (operation.kind === 'insert-compound-assertion') {
    return { ok: true, value: translateFactInsert(translateCompoundAssertion(operation)) };
  }

  if (operation.kind === 'select-recursive-closure-count') {
    return { ok: true, value: createRecursiveClosureCountQuery(operation) };
  }

  return { ok: true, value: translateFactDelete(operation) };
}

function createSelectVertexByIdQuery(vertexId: string): TranslatedSqlQuery {
  return {
    operation: 'select',
    text: 'select * from vertices where id = $1;',
    values: [vertexId],
  };
}

function createRecursiveClosureCountQuery(
  operation: Extract<PostgresGraphOperation, { kind: 'select-recursive-closure-count' }>,
): TranslatedSqlQuery {
  return {
    operation: 'select',
    text: [
      'with recursive closure as (',
      '  select e.object_id as descendant_id, 1 as depth',
      '  from edges e',
      '  where e.subject_id = $1',
      '    and e.predicate_id = $2',
      '  union all',
      '  select e.object_id as descendant_id, closure.depth + 1 as depth',
      '  from closure',
      '  join edges e on e.subject_id = closure.descendant_id',
      '  where e.predicate_id = $2',
      ')',
      'select count(*)::bigint as closure_size from closure;',
    ].join('\n'),
    values: [operation.rootVertexId, operation.predicateId],
  };
}

function translateSelectEdges(operation: Extract<PostgresGraphOperation, { kind: 'select-edges' }>) {
  const filters = operation.where ?? {};
  const clauses: string[] = [];
  const values: string[] = [];

  if (filters.subjectId !== undefined) {
    values.push(filters.subjectId);
    clauses.push(`subject_id = $${values.length}`);
  }

  if (filters.predicateId !== undefined) {
    values.push(filters.predicateId);
    clauses.push(`predicate_id = $${values.length}`);
  }

  if (filters.objectId !== undefined) {
    values.push(filters.objectId);
    clauses.push(`object_id = $${values.length}`);
  }

  if (clauses.length === 0) {
    return {
      operation: 'select' as const,
      text: 'select * from edges;',
      values,
    };
  }

  return {
    operation: 'select' as const,
    text: `select * from edges where ${clauses.join(' and ')};`,
    values,
  };
}
