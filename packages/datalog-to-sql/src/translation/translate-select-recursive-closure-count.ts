import { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type { SelectRecursiveClosureCountOperation } from '../contracts/postgres-graph-operation.js';
import type { TranslatedSqlQuery } from '../contracts/translated-sql-query.js';

/** Translate the recursive-closure benchmark query onto the edges table. */
export function translateSelectRecursiveClosureCount(
  operation: SelectRecursiveClosureCountOperation,
): TranslatedSqlQuery {
  assertNonEmptyIdentifier(operation.rootVertexId);
  assertNonEmptyIdentifier(operation.predicateId);

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

function assertNonEmptyIdentifier(value: string): void {
  if (value.trim().length > 0) {
    return;
  }

  throw new GraphTranslationError(
    'datalog-to-sql.operation.invalid-shape',
    'Recursive closure queries must use non-empty identifiers.',
  );
}
