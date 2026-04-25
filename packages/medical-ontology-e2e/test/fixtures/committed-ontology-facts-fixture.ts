import { loadDatalogMigrationProjectFiles } from '@datalog/datalog-migrate';

import {
  extractOntologyFactsFromMigrations,
  type OntologyEdgeFact,
  type OntologyFact,
} from './ontology-migration-fact-extraction-fixture.js';

export function loadCommittedOntologyFacts(options: {
  readonly workspaceRoot?: string;
} = {}): readonly [OntologyFact, ...OntologyFact[]] {
  const projectFiles = loadDatalogMigrationProjectFiles(options);
  const extraction = extractOntologyFactsFromMigrations(projectFiles.committedMigrations);
  const edgeFacts: OntologyEdgeFact[] = [...extraction.edges];
  const facts = [...extraction.vertices, ...edgeFacts];

  if (facts.length === 0) {
    throw new Error('Expected committed ontology migrations to contain at least one Edge fact.');
  }

  return facts as [OntologyFact, ...OntologyFact[]];
}
