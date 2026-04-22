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

export interface DatalogVariableTerm {
  readonly kind: 'variable';
  readonly name: string;
}

export interface DatalogConstantTerm {
  readonly kind: 'constant';
  readonly value: string;
}

export type DatalogTerm = DatalogVariableTerm | DatalogConstantTerm;

export interface VertexFactPattern {
  readonly kind: 'vertex';
  readonly id: DatalogTerm;
}

export interface EdgeFactPattern {
  readonly kind: 'edge';
  readonly subject: DatalogTerm;
  readonly predicate: DatalogTerm;
  readonly object: DatalogTerm;
}

export type DatalogFactPattern = VertexFactPattern | EdgeFactPattern;

export interface SelectFactsOperation {
  readonly kind: 'select-facts';
  readonly match: readonly [DatalogFactPattern, ...DatalogFactPattern[]];
}

export interface VertexFact {
  readonly kind: 'vertex';
  readonly id: string;
}

export interface EdgeFact {
  readonly kind: 'edge';
  readonly subjectId: string;
  readonly predicateId: string;
  readonly objectId: string;
}

export type DatalogFact = VertexFact | EdgeFact;

export interface InsertFactsOperation {
  readonly kind: 'insert-facts';
  readonly facts: readonly [DatalogFact, ...DatalogFact[]];
}

export interface DeleteFactsOperation {
  readonly kind: 'delete-facts';
  readonly facts: readonly [DatalogFact, ...DatalogFact[]];
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
