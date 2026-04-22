export interface OntologyVertexFact {
  readonly kind: 'vertex';
  readonly id: string;
}

export interface OntologyEdgeFact {
  readonly kind: 'edge';
  readonly subjectId: string;
  readonly predicateId: string;
  readonly objectId: string;
}

export type OntologyDatalogFact = OntologyVertexFact | OntologyEdgeFact;
