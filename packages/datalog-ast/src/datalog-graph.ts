import type { DatalogTerm } from './datalog-language.js';

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
export type DatalogFactPatternMatch = readonly [DatalogFactPattern, ...DatalogFactPattern[]];

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
export type DatalogFactSet = readonly [DatalogFact, ...DatalogFact[]];
