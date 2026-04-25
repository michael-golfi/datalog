import type {
  DatalogFactStatement,
  DatalogFactPatternMatch,
  DatalogFactSet,
  DatalogPredicateName,
  DatalogTerm,
  DefCompoundSchema,
} from '@datalog/ast';
import type { PredicateCatalog } from './predicate-catalog.js';

export interface SelectVertexByIdOperation {
  readonly kind: 'select-vertex-by-id';
  readonly vertexId: string;
}

export interface SelectEdgesOperation {
  readonly kind: 'select-edges';
  readonly where?: {
    readonly subjectId?: string;
    readonly predicateId?: string;
    readonly objectId?: string;
  };
}

export interface SelectPredicatePattern {
  readonly kind: 'predicate';
  readonly predicate: DatalogPredicateName;
  readonly terms: readonly [DatalogTerm, ...DatalogTerm[]];
}

export type SelectFactPattern = DatalogFactPatternMatch[number] | SelectPredicatePattern;

export interface SelectFactsOperation {
  readonly kind: 'select-facts';
  readonly predicateCatalog: PredicateCatalog;
  readonly match: readonly [SelectFactPattern, ...SelectFactPattern[]];
}

export interface InsertFactsOperation {
  readonly kind: 'insert-facts';
  readonly facts: DatalogFactSet;
}

export interface InsertCompoundAssertionOperation {
  readonly kind: 'insert-compound-assertion';
  readonly schema: DefCompoundSchema;
  readonly assertion: DatalogFactStatement;
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

export type PostgresGraphOperation =
  | SelectVertexByIdOperation
  | SelectEdgesOperation
  | SelectFactsOperation
  | InsertFactsOperation
  | InsertCompoundAssertionOperation
  | DeleteFactsOperation
  | SelectRecursiveClosureCountOperation;
