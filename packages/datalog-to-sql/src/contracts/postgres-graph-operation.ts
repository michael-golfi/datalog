import type {
  DatalogFactPatternMatch,
  DatalogFactSet,
} from '@datalog/ast';

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

export interface SelectFactsOperation {
  readonly kind: 'select-facts';
  readonly match: DatalogFactPatternMatch;
}

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

export type PostgresGraphOperation =
  | SelectVertexByIdOperation
  | SelectEdgesOperation
  | SelectFactsOperation
  | InsertFactsOperation
  | DeleteFactsOperation
  | SelectRecursiveClosureCountOperation;
