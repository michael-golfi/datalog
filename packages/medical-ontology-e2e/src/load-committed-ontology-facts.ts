import { parseDocument } from '@datalog/parser';

import { loadOntologyProjectFiles } from './load-ontology-project-files.js';

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

export type OntologyFact = OntologyVertexFact | OntologyEdgeFact;

/** Load the committed flat migration chain into a fact set suitable for SQL-backed execution tests. */
export function loadCommittedOntologyFacts(options: {
  readonly workspaceRoot?: string;
} = {}): readonly [OntologyFact, ...OntologyFact[]] {
  const projectFiles = loadOntologyProjectFiles(options);
  const nodeIds = new Set<string>();
  const edgeFacts: OntologyEdgeFact[] = [];

  for (const migration of projectFiles.committedMigrations) {
    collectMigrationEdgeFacts(migration.body, nodeIds, edgeFacts);
  }

  const vertexFacts: OntologyVertexFact[] = [...nodeIds].map((id) => ({ kind: 'vertex', id }));
  const facts = [...vertexFacts, ...edgeFacts];

  if (facts.length === 0) {
    throw new Error('Expected committed ontology migrations to contain at least one Edge fact.');
  }

  return facts as [OntologyFact, ...OntologyFact[]];
}

function collectMigrationEdgeFacts(
  source: string,
  nodeIds: Set<string>,
  edgeFacts: OntologyEdgeFact[],
): void {
  const parsed = parseDocument(source);

  for (const clause of parsed.clauses) {
    if (clause.isCompound || clause.predicate === 'DefCompound') {
      continue;
    }

    const edgeFact = parseEdgeFact(clause);
    nodeIds.add(edgeFact.subjectId);
    nodeIds.add(edgeFact.objectId);
    edgeFacts.push(edgeFact);
  }
}

function parseEdgeFact(clause: ReturnType<typeof parseDocument>['clauses'][number]): OntologyEdgeFact {
  if (clause.isRule || clause.predicate !== 'Edge') {
    throw new Error('Committed ontology migrations must only contain Edge facts outside compound declarations.');
  }

  const [subject, predicate, object] = clause.references;

  if (!subject || !predicate || !object || clause.references.length !== 3) {
    throw new Error('Committed ontology Edge facts must use quoted Edge(subject, predicate, object) clauses.');
  }

  return {
    kind: 'edge',
    subjectId: subject.value,
    predicateId: predicate.value,
    objectId: object.value,
  };
}
