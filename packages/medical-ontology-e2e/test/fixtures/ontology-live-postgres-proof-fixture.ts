import {
  DEFAULT_SELECT_FACTS_PREDICATE_CATALOG,
  applyDatalogFacts,
  executePreparedSelectFacts,
  prepareSelectFactsExecution,
  type PostgresSqlClient,
  type SelectFactsOperation,
} from '@datalog/datalog-to-sql';

import { loadCommittedOntologyFacts } from './committed-ontology-facts-fixture.js';
import { createLocalhostPostgresFixture } from './localhost-postgres-fixture.js';
import {
  cleanupTemporaryOntologyWorkspaces,
  createOntologyMigrationWorkspaceFixture,
  replayCanonicalOntologyMigrationChain,
} from './ontology-migration-chain-fixture.js';

export interface OntologyLivePostgresProofFixture {
  readonly committedFileNames: readonly string[];
  readonly sql: PostgresSqlClient;
  cleanup: () => Promise<void>;
}

export async function createOntologyLivePostgresProofFixture(): Promise<OntologyLivePostgresProofFixture> {
  const temporaryRoots: string[] = [];
  const workspaceRoot = createOntologyMigrationWorkspaceFixture(temporaryRoots);

  try {
    const committedFileNames = replayCanonicalOntologyMigrationChain(workspaceRoot);
    const facts = loadCommittedOntologyFacts({ workspaceRoot });
    const postgresFixture = await createLocalhostPostgresFixture();

    try {
      await applyDatalogFacts({
        sql: postgresFixture.sql,
        mode: 'insert-facts',
        facts,
      });
    } catch (error) {
      await postgresFixture.cleanup().catch(() => undefined);
      throw error;
    }

    return {
      committedFileNames,
      sql: postgresFixture.sql,
      cleanup: async () => {
        try {
          await postgresFixture.cleanup();
        } finally {
          cleanupTemporaryOntologyWorkspaces(temporaryRoots);
        }
      },
    };
  } catch (error) {
    cleanupTemporaryOntologyWorkspaces(temporaryRoots);
    throw error;
  }
}

export async function executeOntologyGraphQuery<Row extends Record<string, unknown>>(
  sql: PostgresSqlClient,
  operation: SelectFactsOperation,
): Promise<readonly Row[]> {
  return executePreparedSelectFacts<Row>({
    sql,
    execution: prepareSelectFactsExecution({
      operation,
      catalog: DEFAULT_SELECT_FACTS_PREDICATE_CATALOG,
    }),
  });
}
