import type { DatalogLiteral, DatalogTerm } from '@datalog/ast';

import { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';
import type { ExternalPredicateBinding, PredicateBinding, PredicateCatalog } from '../contracts/predicate-catalog.js';
import { getPredicateColumns } from '../contracts/predicate-catalog.js';

/** Resolve whether a query literal targets an external predicate binding. */
export function isExternalLiteral(literal: DatalogLiteral, catalog: PredicateCatalog): boolean {
  if (literal.kind === 'atom') {
    return isExternalPredicateName(literal.predicate, literal.terms.length, catalog);
  }

  if (literal.kind === 'not') {
    return isExternalPredicateName(literal.atom.predicate, literal.atom.terms.length, catalog);
  }

  return false;
}

/** Resolve one select-facts pattern onto its predicate binding. */
export function getPredicateBinding(
  pattern: SelectFactsOperation['match'][number],
  catalog: PredicateCatalog,
): PredicateBinding {
  const predicateName = pattern.kind === 'predicate' ? pattern.predicate : pattern.kind;
  const arity = getPatternTerms(pattern).length;
  const resolvedPredicateName = catalog.aliases?.[predicateName] ?? predicateName;
  const predicate = catalog.predicates.find((candidate) => {
    return candidate.signature.name === resolvedPredicateName && candidate.signature.arity === arity;
  });

  if (predicate !== undefined) {
    return predicate;
  }

  throw new GraphTranslationError(
    'UNSUPPORTED_GRAPH_PREDICATE',
    `Unsupported graph predicate ${resolvedPredicateName}/${arity}.`,
  );
}

/** Narrow a predicate binding to the external-resolver execution seam. */
export function isExternalPredicateBinding(predicate: PredicateBinding): predicate is ExternalPredicateBinding {
  return predicate.execution?.kind === 'external-resolver';
}

/** Return whether an external materialization key is already bound. */
export function isMaterializationKeyBound(term: DatalogTerm, earlierPatternVariables: ReadonlySet<string>): boolean {
  if (term.kind === 'constant') {
    return true;
  }

  if (term.kind === 'variable') {
    return earlierPatternVariables.has(term.name);
  }

  return false;
}

/** Record every variable introduced by one select-facts pattern. */
export function addPatternVariables(
  pattern: SelectFactsOperation['match'][number],
  variables: Set<string>,
): void {
  for (const term of getPatternTerms(pattern)) {
    if (term.kind === 'variable') {
      variables.add(term.name);
    }
  }
}

/** Resolve the term that feeds one declared external key column. */
export function getKeyColumnTerm(
  pattern: SelectFactsOperation['match'][number],
  predicate: ExternalPredicateBinding,
  keyColumn: string,
): DatalogTerm {
  const column = getPredicateColumns(predicate).find((candidate) => candidate.name === keyColumn);
  if (column === undefined) {
    throw new GraphTranslationError(
      'EXTERNAL_SELECT_FACTS_INVALID_KEY_COLUMN',
      `External predicate ${String(predicate.signature.name)}/${predicate.signature.arity} declares unknown key column ${keyColumn}.`,
    );
  }

  const term = getPatternTerms(pattern)[column.ordinal];
  if (term !== undefined) {
    return term;
  }

  throw new GraphTranslationError(
    'EXTERNAL_SELECT_FACTS_INVALID_KEY_COLUMN',
    `External predicate ${String(predicate.signature.name)}/${predicate.signature.arity} key column ${keyColumn} resolves outside the pattern arity.`,
  );
}

function isExternalPredicateName(predicateName: string, arity: number, catalog: PredicateCatalog): boolean {
  const predicate = catalog.predicates.find((candidate) => {
    return candidate.signature.name === (catalog.aliases?.[predicateName] ?? predicateName)
      && candidate.signature.arity === arity;
  });

  return predicate !== undefined && isExternalPredicateBinding(predicate);
}

function getPatternTerms(pattern: SelectFactsOperation['match'][number]): readonly DatalogTerm[] {
  if (pattern.kind === 'predicate') {
    return pattern.terms;
  }

  if (pattern.kind === 'vertex') {
    return [pattern.id] as const;
  }

  return [pattern.subject, pattern.predicate, pattern.object] as const;
}
