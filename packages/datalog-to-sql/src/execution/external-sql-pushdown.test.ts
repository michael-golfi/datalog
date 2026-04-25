import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyDatalogFacts } from './apply-datalog-facts.js';
import { executePreparedSelectFacts } from './execute-prepared-select-facts.js';
import { prepareSelectFactsExecution } from './prepare-select-facts-execution.js';
import { createQueryCountTracker } from './query-count-tracker.js';
import { DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT } from '../benchmarks/recursive-closure-benchmark-contract.js';
import { defineExternalResolverDefinition } from '../contracts/external-resolver-definition.js';
import { createPostgresSqlClient, type PostgresSqlClient } from '../runtime/create-postgres-sql-client.js';
import {
  initializeGraphSchema,
  startRecursiveClosurePostgresRuntime,
  waitForPostgres,
} from '../runtime/recursive-closure-postgres-runtime.js';
import { DEFAULT_SELECT_FACTS_PREDICATE_CATALOG } from '../translation/default-graph-predicate-catalog.js';

import type { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type { PredicateCatalog } from '../contracts/predicate-catalog.js';

const EXTERNAL_ACCOUNT_TABLE = 'external_sql_pushdown_accounts';
const EXTERNAL_ACCOUNT_VIEW = 'external_sql_pushdown_accounts_view';
const LOCAL_POSTGRES_CONNECTION_STRING = 'postgresql://postgres@127.0.0.1:5432/postgres';

describe('external SQL pushdown', () => {
  let sql: PostgresSqlClient;
  let cleanupRuntime: () => Promise<void> = async () => undefined;

  beforeAll(async () => {
    const runtimeClient = await createExecutionTestSqlClient();
    sql = runtimeClient.sql;
    cleanupRuntime = runtimeClient.cleanup;
    await initializeGraphSchema(sql);
  });

  afterAll(async () => {
    await dropExternalAccountFixtures(sql);
    await sql.end({ timeout: 1 });
    await cleanupRuntime();
  });

  it('joins a SQL-backed external relation in one SQL statement with zero provider invocations', async () => {
    await initializeGraphSchema(sql);
    await recreateExternalAccountView(sql);

    await applyDatalogFacts({
      sql,
      mode: 'insert-facts',
      facts: [
        { kind: 'vertex', id: 'vertex/alice' },
        { kind: 'vertex', id: 'vertex/bob' },
      ],
    });

    await sql.unsafe(
      `insert into ${EXTERNAL_ACCOUNT_TABLE} (person_id, account_id) values ($1, $2);`,
      ['vertex/alice', 'account-1'],
    );

    const preparedExecution = prepareSelectFactsExecution({
      catalog: createSqlPushdownCatalog(),
      operation: {
        kind: 'select-facts',
        predicateCatalog: createSqlPushdownCatalog(),
        match: [
          {
            kind: 'vertex',
            id: { kind: 'variable', name: 'person' },
          },
          {
            kind: 'predicate',
            predicate: 'crmAccount',
            terms: [
              { kind: 'variable', name: 'person' },
              { kind: 'variable', name: 'accountId' },
            ],
          },
        ],
      },
    });

    expect(preparedExecution.materializationSteps).toEqual([]);
    expect(preparedExecution.finalSqlQuery).toEqual({
      operation: 'select',
      text: `select distinct scan_1.id as "person", scan_2.account_id as "accountId" from vertices scan_1 join ${EXTERNAL_ACCOUNT_VIEW} scan_2 on scan_1.id = scan_2.person_id;`,
      values: [],
    });

    const tracker = createQueryCountTracker(sql);
    const rows = await executePreparedSelectFacts<{ person: string; accountId: string }>({
      sql: tracker.sql,
      execution: preparedExecution,
    });

    expect(rows).toEqual([{ person: 'vertex/alice', accountId: 'account-1' }]);
    expect(tracker.getQueryCount()).toBe(1);
  });

  it('rejects non-SQL storage for sql_pushdown external predicates', () => {
    const invalidCatalog = {
      version: 1,
      predicates: [
        ...DEFAULT_SELECT_FACTS_PREDICATE_CATALOG.predicates,
        {
          signature: {
            name: 'crmAccount',
            arity: 2,
            kind: 'edb',
            outputTypes: ['text', 'text'],
          },
          source: 'catalog',
          storage: {
            kind: 'work-table',
            relationName: 'prepared_crmAccount_2',
            columns: [
              { name: 'person_id', ordinal: 0, type: 'text' },
              { name: 'account_id', ordinal: 1, type: 'text' },
            ],
            scope: 'statement',
          },
          execution: {
            kind: 'external-resolver',
            resolver: defineExternalResolverDefinition({
              version: 1,
              provider: 'crm-sql',
              mode: 'sql_pushdown',
              keyColumns: ['person_id'],
              requestScopedDedupe: 'by-key',
              expectedRowShape: 'values-by-column',
            }),
          },
          constraints: [],
          indexes: [],
          capabilities: {
            readable: true,
            writable: false,
            supportsPredicatePushdown: true,
            supportsJoinPushdown: true,
            supportsAggregationPushdown: false,
            supportsRecursionSeedPushdown: false,
            supportsDeltaScan: false,
          },
        },
      ],
      aliases: DEFAULT_SELECT_FACTS_PREDICATE_CATALOG.aliases,
    } as unknown as PredicateCatalog;

    expect(() => {
      prepareSelectFactsExecution({
        catalog: invalidCatalog,
        operation: {
          kind: 'select-facts',
          predicateCatalog: invalidCatalog,
          match: [
            {
              kind: 'vertex',
              id: { kind: 'variable', name: 'person' },
            },
            {
              kind: 'predicate',
              predicate: 'crmAccount',
              terms: [
                { kind: 'variable', name: 'person' },
                { kind: 'variable', name: 'accountId' },
              ],
            },
          ],
        },
      });
    }).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'UNSUPPORTED_GRAPH_PREDICATE',
        message: 'sql_pushdown external predicate crmAccount/2 requires postgres-table or postgres-view storage.',
      }),
    );
  });
});

function createSqlPushdownCatalog(): PredicateCatalog {
  return {
    version: 1,
    predicates: [
      ...DEFAULT_SELECT_FACTS_PREDICATE_CATALOG.predicates,
      {
        signature: {
          name: 'crmAccount',
          arity: 2,
          kind: 'edb',
          outputTypes: ['text', 'text'],
        },
        source: 'catalog',
        storage: {
          kind: 'postgres-view',
          relationName: EXTERNAL_ACCOUNT_VIEW,
          columns: [
            { name: 'person_id', ordinal: 0, type: 'text' },
            { name: 'account_id', ordinal: 1, type: 'text' },
          ],
        },
        execution: {
          kind: 'external-resolver',
          resolver: defineExternalResolverDefinition({
            version: 1,
            provider: 'crm-sql',
            mode: 'sql_pushdown',
            keyColumns: ['person_id'],
            requestScopedDedupe: 'by-key',
            expectedRowShape: 'values-by-column',
          }),
        },
        constraints: [],
        indexes: [],
        capabilities: {
          readable: true,
          writable: false,
          supportsPredicatePushdown: true,
          supportsJoinPushdown: true,
          supportsAggregationPushdown: false,
          supportsRecursionSeedPushdown: false,
          supportsDeltaScan: false,
        },
      },
    ],
    aliases: DEFAULT_SELECT_FACTS_PREDICATE_CATALOG.aliases,
  };
}

async function recreateExternalAccountView(
  sql: PostgresSqlClient,
): Promise<void> {
  await dropExternalAccountFixtures(sql);
  await sql.unsafe(`create table ${EXTERNAL_ACCOUNT_TABLE} (person_id text not null, account_id text not null);`);
  await sql.unsafe(
    `create view ${EXTERNAL_ACCOUNT_VIEW} as select person_id, account_id from ${EXTERNAL_ACCOUNT_TABLE};`,
  );
}

async function dropExternalAccountFixtures(
  sql: PostgresSqlClient,
): Promise<void> {
  await sql.unsafe(`drop view if exists ${EXTERNAL_ACCOUNT_VIEW};`);
  await sql.unsafe(`drop table if exists ${EXTERNAL_ACCOUNT_TABLE};`);
}

async function createExecutionTestSqlClient(): Promise<{
  readonly sql: PostgresSqlClient;
  readonly cleanup: () => Promise<void>;
}> {
  const localSql = await tryCreateLocalIsolatedSqlClient('datalog_to_sql_pushdown');

  if (localSql !== null) {
    return localSql;
  }

  const runtime = startRecursiveClosurePostgresRuntime(DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT);
  await waitForPostgres(runtime.connectionString);

  return {
    sql: createPostgresSqlClient(runtime.connectionString),
    cleanup: async () => {
      runtime.cleanup();
    },
  };
}

async function tryCreateLocalIsolatedSqlClient(databaseNamePrefix: string): Promise<{
  readonly sql: PostgresSqlClient;
  readonly cleanup: () => Promise<void>;
} | null> {
  const adminSql = createPostgresSqlClient(LOCAL_POSTGRES_CONNECTION_STRING);
  const databaseName = createLocalDatabaseName(databaseNamePrefix);

  try {
    await adminSql`select 1`;
    await adminSql.unsafe(`create database ${databaseName}`);

    return {
      sql: createPostgresSqlClient(createDatabaseConnectionString(databaseName)),
      cleanup: async () => {
        await dropLocalTestDatabase(databaseName);
      },
    };
  } catch {
    return null;
  } finally {
    await adminSql.end({ timeout: 1 }).catch(() => undefined);
  }
}

function createLocalDatabaseName(prefix: string): string {
  const workerId = (process.env.VITEST_WORKER_ID ?? `pid${process.pid}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 12) || 'unknown';

  return `${prefix}_${workerId}_${Date.now().toString(36)}`;
}

function createDatabaseConnectionString(databaseName: string): string {
  const connectionUrl = new URL(LOCAL_POSTGRES_CONNECTION_STRING);
  connectionUrl.pathname = `/${databaseName}`;
  return connectionUrl.toString();
}

async function dropLocalTestDatabase(databaseName: string): Promise<void> {
  const adminSql = createPostgresSqlClient(LOCAL_POSTGRES_CONNECTION_STRING);

  try {
    await adminSql`
      select pg_terminate_backend(pid)
      from pg_stat_activity
      where datname = ${databaseName}
        and pid <> pg_backend_pid()
    `;
    await adminSql.unsafe(`drop database if exists ${databaseName}`);
  } finally {
    await adminSql.end({ timeout: 1 }).catch(() => undefined);
  }
}
