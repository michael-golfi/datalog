import { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';
import type { PredicateBinding, PredicateCatalog, RelationColumnBinding } from '../contracts/predicate-catalog.js';

import type { PatternTermBinding } from './select-facts-logical-plan-pattern-binding.js';

/** Resolve the predicate binding for one select-facts pattern kind. */
export function getSelectFactsPredicateBinding(
  kind: SelectFactsOperation['match'][number]['kind'],
  catalog: PredicateCatalog,
): PredicateBinding {
  const predicateName = catalog.aliases?.[kind] ?? kind;
  const arity = kind === 'vertex' ? 1 : 3;
  const predicate = catalog.predicates.find((candidate) => {
    return candidate.signature.name === predicateName && candidate.signature.arity === arity;
  });

  if (predicate !== undefined) {
    return predicate;
  }

  throw new GraphTranslationError('UNSUPPORTED_GRAPH_PREDICATE', `Unsupported graph predicate ${predicateName}/${arity}.`);
}

/** Pair a select-facts pattern's terms with the bound relation columns by ordinal. */
export function getPatternBindings(
  pattern: SelectFactsOperation['match'][number],
  columns: readonly RelationColumnBinding[],
): readonly PatternTermBinding[] {
  if (pattern.kind === 'vertex') {
    return [
      {
        term: pattern.id,
        column: getColumnByOrdinal(columns, 0, pattern.kind),
      },
    ];
  }

  return [
    {
      term: pattern.subject,
      column: getColumnByOrdinal(columns, 0, pattern.kind),
    },
    {
      term: pattern.predicate,
      column: getColumnByOrdinal(columns, 1, pattern.kind),
    },
    {
      term: pattern.object,
      column: getColumnByOrdinal(columns, 2, pattern.kind),
    },
  ];
}

function getColumnByOrdinal(
  columns: readonly RelationColumnBinding[],
  ordinal: number,
  predicateName: string,
): RelationColumnBinding {
  const column = columns.find((candidate) => candidate.ordinal === ordinal);

  if (column !== undefined) {
    return column;
  }

  throw new Error(`Missing column ordinal ${ordinal} for ${predicateName}.`);
}
