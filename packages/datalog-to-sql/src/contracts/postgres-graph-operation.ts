import type { DatalogPredicateName, DatalogFactPatternMatch, DatalogFactSet, DatalogTerm } from '@datalog/ast';

export interface SelectFactsOperation {
  readonly kind: 'select-facts';
  readonly match: readonly [SelectFactsPattern, ...SelectFactsPattern[]];
}

export interface SelectFactsPredicatePattern {
  readonly kind: 'predicate';
  readonly predicate: DatalogPredicateName;
  readonly terms: readonly DatalogTerm[];
}

export type SelectFactsPattern = DatalogFactPatternMatch[number] | SelectFactsPredicatePattern;

export interface InsertFactsOperation {
  readonly kind: 'insert-facts';
  readonly facts: DatalogFactSet;
}

export interface DeleteFactsOperation {
  readonly kind: 'delete-facts';
  readonly facts: DatalogFactSet;
}

export interface SelectRecursiveClosureCountOperation {
  readonly kind: 'select-recursive-closure-count';
  readonly rootVertexId: string;
  readonly predicateId: string;
}
