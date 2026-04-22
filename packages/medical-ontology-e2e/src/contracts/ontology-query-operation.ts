export interface OntologyVariableTerm {
  readonly kind: 'variable';
  readonly name: string;
}

export interface OntologyConstantTerm {
  readonly kind: 'constant';
  readonly value: string;
}

export type OntologyTerm = OntologyVariableTerm | OntologyConstantTerm;

export interface OntologyEdgeFactPattern {
  readonly kind: 'edge';
  readonly subject: OntologyTerm;
  readonly predicate: OntologyTerm;
  readonly object: OntologyTerm;
}

export interface OntologySelectFactsOperation {
  readonly kind: 'select-facts';
  readonly match: readonly [OntologyEdgeFactPattern, ...OntologyEdgeFactPattern[]];
}

export type OntologyQueryOperation = OntologySelectFactsOperation;
