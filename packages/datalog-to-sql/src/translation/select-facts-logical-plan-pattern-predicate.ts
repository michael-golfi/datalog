import { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';
import type { PredicateBinding, PredicateCatalog, RelationColumnBinding } from '../contracts/predicate-catalog.js';

import type { PatternTermBinding } from './select-facts-logical-plan-pattern-binding.js';

/** Resolve the predicate binding for one select-facts pattern kind. */
export function getSelectFactsPredicateBinding(
  pattern: SelectFactsOperation['match'][number],
  catalog: PredicateCatalog,
): PredicateBinding {
  const predicateName = getSelectFactsPatternPredicateName(pattern);
  const arity = getSelectFactsPatternTerms(pattern).length;
  const aliasedPredicateName = catalog.aliases?.[predicateName] ?? predicateName;
  const predicate = catalog.predicates.find((candidate) => {
    return candidate.signature.name === aliasedPredicateName && candidate.signature.arity === arity;
  });

  if (predicate !== undefined) {
    return predicate;
  }

  throw new GraphTranslationError(
    'UNSUPPORTED_GRAPH_PREDICATE',
    `Unsupported graph predicate ${aliasedPredicateName}/${arity}.`,
  );
}

/** Pair a select-facts pattern's terms with the bound relation columns by ordinal. */
export function getPatternBindings(
  pattern: SelectFactsOperation['match'][number],
  columns: readonly RelationColumnBinding[],
): readonly PatternTermBinding[] {
  return getSelectFactsPatternTerms(pattern).map((term, ordinal) => ({
    term,
    column: getColumnByOrdinal(columns, ordinal, getSelectFactsPatternPredicateName(pattern)),
  }));
}

function getSelectFactsPatternPredicateName(pattern: SelectFactsOperation['match'][number]): string {
  if (pattern.kind === 'predicate') {
    return pattern.predicate;
  }

  return pattern.kind;
}

function getSelectFactsPatternTerms(pattern: SelectFactsOperation['match'][number]) {
  if (pattern.kind === 'predicate') {
    return pattern.terms;
  }

  if (pattern.kind === 'vertex') {
    return [pattern.id] as const;
  }

  return [pattern.subject, pattern.predicate, pattern.object] as const;
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
