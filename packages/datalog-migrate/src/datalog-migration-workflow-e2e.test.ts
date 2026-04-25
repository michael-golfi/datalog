import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_SELECT_FACTS_PREDICATE_CATALOG,
  applyDatalogFacts,
  createPostgresSqlClient,
  executePreparedSelectFacts,
  initializeGraphSchema,
  prepareSelectFactsExecution,
  type SelectFactsOperation,
  waitForPostgres,
} from '@datalog/datalog-to-sql';

import { applyDatalogMigrations } from './apply-datalog-migrations.js';
import { commitCurrentMigration } from './commit-current-datalog-migration.js';
import { loadDatalogMigrationProjectFiles } from './load-datalog-migration-project-files.js';
import { readAppliedMigrationStateFromDatabase } from './read-applied-migration-state.js';
import { ensureLocalWorkflowDatabaseExists, localPostgresConnectionString } from './datalog-migration-workflow-test-database.test.js';
import { loadCommittedWorkflowFacts } from './datalog-migration-workflow-test-facts.test.js';
import {
  cleanupTemporaryWorkspaceRoots,
  createDatalogMigrationWorkflowWorkspaceFixture,
  getCurrentMigrationBody,
  invalidCurrentMigrationBody,
} from './datalog-migration-workflow-test-fixture.test.js';
import { readMigrationStatus } from './status-datalog-migration.js';
import { uncommitLatestDatalogMigration } from './uncommit-datalog-migration.js';

const temporaryRoots: string[] = [];

describe('datalog migration workflow e2e', () => {
  afterEach(() => {
    cleanupTemporaryWorkspaceRoots(temporaryRoots);
  });

  it('proves commit/status/uncommit drive the expected vertices and edges lifecycle in PostgreSQL', async () => {
    const workspaceRoot = createDatalogMigrationWorkflowWorkspaceFixture(temporaryRoots);
    const sql = createPostgresSqlClient(localPostgresConnectionString);
    await ensureLocalWorkflowDatabaseExists();

    try {
      await waitForPostgres(localPostgresConnectionString);

      expect(readMigrationStatus({ workspaceRoot })).toEqual({
        committedMigrationCount: 0,
        hasCurrentChanges: true,
        latestCommittedMigrationFileName: null,
        canDeterminePendingCommittedMigrations: false,
        pendingCommittedMigrations: false,
        statusCode: 'current-uncommitted',
        statusFlags: {
          currentUncommitted: true,
          committedPresent: false,
          pendingCommittedUnknown: false,
        },
      });

      const commitResult = commitCurrentMigration({ workspaceRoot, now: new Date('2026-04-22T12:00:00Z') });

      expect(commitResult.fileName).toBe('20260422.0001.current.dl');
      expect(readMigrationStatus({ workspaceRoot })).toEqual({
        committedMigrationCount: 1,
        hasCurrentChanges: false,
        latestCommittedMigrationFileName: '20260422.0001.current.dl',
        canDeterminePendingCommittedMigrations: false,
        pendingCommittedMigrations: null,
        statusCode: 'committed-pending-unknown',
        statusFlags: {
          currentUncommitted: false,
          committedPresent: true,
          pendingCommittedUnknown: true,
        },
      });

      await initializeGraphSchema(sql);
      await applyDatalogFacts({
        sql,
        mode: 'insert-facts',
        facts: loadCommittedWorkflowFacts(workspaceRoot),
      });

      const linkedRows = await executeQuery<{ target_id: string }>(sql, {
        kind: 'select-facts',
        match: [
          {
            kind: 'edge',
            subject: { kind: 'constant', value: 'vertex/alpha' },
            predicate: { kind: 'constant', value: 'graph/links_to' },
            object: { kind: 'variable', name: 'target_id' },
          },
        ],
      });
      const edgeCount = await sql<Array<{ count: string }>>`select count(*)::text as count from edges`;
      const vertexCount = await sql<Array<{ count: string }>>`select count(*)::text as count from vertices`;
      const edgeRows = await sql<Array<{ subject_id: string; predicate_id: string; object_id: string }>>`
        select subject_id, predicate_id, object_id
        from edges
        where subject_id = 'vertex/alpha'
          and predicate_id = 'graph/links_to'
      `;
      const vertexRows = await sql<Array<{ id: string }>>`
        select id
        from vertices
        where id in ('vertex/alpha', 'vertex/beta')
        order by id asc
      `;

      expect(linkedRows[0]?.target_id).toBe('vertex/beta');
      expect(Number.parseInt(edgeCount[0]?.count ?? '0', 10)).toBeGreaterThan(0);
      expect(Number.parseInt(vertexCount[0]?.count ?? '0', 10)).toBeGreaterThan(0);
      expect(edgeRows).toContainEqual({
        subject_id: 'vertex/alpha',
        predicate_id: 'graph/links_to',
        object_id: 'vertex/beta',
      });
      expect(vertexRows).toEqual([
        { id: 'vertex/alpha' },
        { id: 'vertex/beta' },
      ]);

      const uncommitResult = uncommitLatestDatalogMigration({ workspaceRoot });

      expect(uncommitResult.removedFileName).toBe('20260422.0001.current.dl');
      expect(readMigrationStatus({ workspaceRoot })).toEqual({
        committedMigrationCount: 0,
        hasCurrentChanges: true,
        latestCommittedMigrationFileName: null,
        canDeterminePendingCommittedMigrations: false,
        pendingCommittedMigrations: false,
        statusCode: 'current-uncommitted',
        statusFlags: {
          currentUncommitted: true,
          committedPresent: false,
          pendingCommittedUnknown: false,
        },
      });
      expect(readFileSync(path.join(workspaceRoot, 'current.dl'), 'utf8')).toBe(getCurrentMigrationBody());
    } finally {
      await sql.end({ timeout: 1 });
    }
  }, 20_000);

  it('proves invalid current content is rejected before any database application occurs', async () => {
    const workspaceRoot = createDatalogMigrationWorkflowWorkspaceFixture(temporaryRoots);
    writeFileSync(path.join(workspaceRoot, 'current.dl'), invalidCurrentMigrationBody, 'utf8');
    const sql = createPostgresSqlClient(localPostgresConnectionString);
    await ensureLocalWorkflowDatabaseExists();

    try {
      await waitForPostgres(localPostgresConnectionString);
      await initializeGraphSchema(sql);

      expect(() => commitCurrentMigration({ workspaceRoot, now: new Date('2026-04-22T12:00:00Z') })).toThrow(
        'current.dl must not contain committed migration metadata lines.',
      );
      expect(loadDatalogMigrationProjectFiles({ workspaceRoot }).committedMigrationPaths).toHaveLength(0);

      const edgeCount = await sql<Array<{ count: string }>>`select count(*)::text as count from edges`;
      const vertexCount = await sql<Array<{ count: string }>>`select count(*)::text as count from vertices`;

      expect(edgeCount[0]?.count).toBe('0');
      expect(vertexCount[0]?.count).toBe('0');
    } finally {
      await sql.end({ timeout: 1 });
    }
  }, 20_000);

  it('records applied migration file names in the database ledger', async () => {
    const workspaceRoot = createDatalogMigrationWorkflowWorkspaceFixture(temporaryRoots);
    await ensureLocalWorkflowDatabaseExists();
    await waitForPostgres(localPostgresConnectionString);

    const commitResult = commitCurrentMigration({ workspaceRoot, now: new Date('2026-04-23T12:00:00Z') });
    const applyResult = await applyDatalogMigrations({
      workspaceRoot,
      connectionString: localPostgresConnectionString,
    });
    const appliedState = await readAppliedMigrationStateFromDatabase({
      connectionString: localPostgresConnectionString,
    });

    expect(applyResult.appliedMigrationCount).toBe(1);
    expect(appliedState.appliedMigrationFileNames).toContain(commitResult.fileName);
  }, 20_000);

  it('proves readMigrationStatus reports committed-applied when given DB-derived applied state after applying migrations', async () => {
    const workspaceRoot = createDatalogMigrationWorkflowWorkspaceFixture(temporaryRoots);
    await ensureLocalWorkflowDatabaseExists();
    await waitForPostgres(localPostgresConnectionString);

    commitCurrentMigration({ workspaceRoot, now: new Date('2026-04-23T12:00:00Z') });

    const statusBeforeApply = readMigrationStatus({ workspaceRoot });

    expect(statusBeforeApply.statusCode).toBe('committed-pending-unknown');
    expect(statusBeforeApply.canDeterminePendingCommittedMigrations).toBe(false);

    await applyDatalogMigrations({
      workspaceRoot,
      connectionString: localPostgresConnectionString,
    });

    const appliedState = await readAppliedMigrationStateFromDatabase({
      connectionString: localPostgresConnectionString,
    });
    const statusAfterApply = readMigrationStatus({
      workspaceRoot,
      appliedMigrationState: appliedState,
    });

    expect(statusAfterApply.statusCode).toBe('committed-applied');
    expect(statusAfterApply.committedMigrationCount).toBe(1);
    expect(statusAfterApply.canDeterminePendingCommittedMigrations).toBe(true);
    expect(statusAfterApply.pendingCommittedMigrations).toBe(false);
    expect(statusAfterApply.statusFlags.pendingCommittedUnknown).toBe(false);
  }, 20_000);
});

async function executeQuery<Row extends Record<string, unknown>>(
  sql: ReturnType<typeof createPostgresSqlClient>,
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
