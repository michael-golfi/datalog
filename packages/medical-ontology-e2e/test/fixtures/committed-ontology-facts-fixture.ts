import { loadDatalogMigrationProjectFiles } from '@datalog/datalog-migrate';
import {
  extractOntologyFactsFromSource,
  type OntologyEdgeFact,
  type OntologyFact,
} from './ontology-migration-fact-extraction-fixture.js';

export function loadCommittedOntologyFacts(options: {
  readonly workspaceRoot?: string;
} = {}): readonly [OntologyFact, ...OntologyFact[]] {
  const projectFiles = loadDatalogMigrationProjectFiles(options);
  const nodeIds = new Set<string>();
  const edgeFacts: OntologyEdgeFact[] = [];

  for (const migration of projectFiles.committedMigrations) {
    const extraction = extractOntologyFactsFromSource(migration.body);

    for (const vertex of extraction.vertices) {
      nodeIds.add(vertex.id);
    }

    edgeFacts.push(...extraction.edges);
  }

  const vertexFacts = [...nodeIds].map((id) => ({ kind: 'vertex', id } as const));
  const facts = [...vertexFacts, ...edgeFacts];

  if (facts.length === 0) {
    throw new Error('Expected committed ontology migrations to contain at least one Edge fact.');
  }

  return facts as [OntologyFact, ...OntologyFact[]];
}
