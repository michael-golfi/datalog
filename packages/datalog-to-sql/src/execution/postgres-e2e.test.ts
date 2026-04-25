import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  defineExternalResolverDefinition,
  type ExternalResolverHydrateRequest,
  type ExternalResolverLookupRequest,
  type HydrateRowsHandler,
  type MaterializeRowsHandler,
} from '../contracts/external-resolver-definition.js';
import type { PredicateCatalog } from '../contracts/predicate-catalog.js';
import { applyDatalogFacts } from './apply-datalog-facts.js';
import { createPostgresSqlClient, type PostgresSqlClient } from '../runtime/create-postgres-sql-client.js';
import { executePreparedSelectFacts } from './execute-prepared-select-facts.js';
import { prepareSelectFactsExecution } from './prepare-select-facts-execution.js';
import { DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT } from '../benchmarks/recursive-closure-benchmark-contract.js';
import {
  initializeGraphSchema,
  startRecursiveClosurePostgresRuntime,
  waitForPostgres,
} from '../runtime/recursive-closure-postgres-runtime.js';
import { DEFAULT_SELECT_FACTS_PREDICATE_CATALOG } from '../translation/default-graph-predicate-catalog.js';

describe('postgres e2e validation', () => {
  let sql!: PostgresSqlClient;
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

  it('executes translated fact inserts, reads, and deletes end to end', async () => {
    await initializeGraphSchema(sql);

    await applyDatalogFacts({
      sql,
      mode: 'insert-facts',
      facts: [
        { kind: 'vertex', id: 'vertex/alice' },
        { kind: 'vertex', id: 'vertex/bob' },
        {
          kind: 'edge',
          subjectId: 'vertex/alice',
          predicateId: 'graph/likes',
          objectId: 'vertex/bob',
        },
      ],
    });

    const preparedExecution = prepareSelectFactsExecution({
      catalog: DEFAULT_SELECT_FACTS_PREDICATE_CATALOG,
      operation: {
        kind: 'select-facts',
        match: [
          { kind: 'vertex', id: { kind: 'variable', name: 'person' } },
          {
            kind: 'edge',
            subject: { kind: 'variable', name: 'person' },
            predicate: { kind: 'constant', value: 'graph/likes' },
            object: { kind: 'constant', value: 'vertex/bob' },
          },
        ],
      },
    });
    const tracker = createExecutionQueryTracker(sql);

    const selected = await executePreparedSelectFacts<{ person: string }>({
      sql: tracker.sql,
      execution: preparedExecution,
    });

    expect(tracker.getQueryCount()).toBe(1);
    expect(selected[0]?.person).toBe('vertex/alice');

    await applyDatalogFacts({
      sql,
      mode: 'delete-facts',
      facts: [
        {
          kind: 'edge',
          subjectId: 'vertex/alice',
          predicateId: 'graph/likes',
          objectId: 'vertex/bob',
        },
      ],
    });

    const edgeCount = await sql<Array<{ count: string }>>`select count(*)::text as count from edges`;
    expect(edgeCount[0]?.count).toBe('0');
  });

  it('executes graph predicates through the unified prepared-execution path with one SQL statement and zero provider calls', async () => {
    await initializeGraphSchema(sql);
    await applyDatalogFacts({
      sql,
      mode: 'insert-facts',
      facts: [
        { kind: 'vertex', id: 'vertex/alice' },
        { kind: 'vertex', id: 'vertex/bob' },
        {
          kind: 'edge',
          subjectId: 'vertex/alice',
          predicateId: 'graph/likes',
          objectId: 'vertex/bob',
        },
      ],
    });

    const preparedExecution = prepareSelectFactsExecution({
      catalog: DEFAULT_SELECT_FACTS_PREDICATE_CATALOG,
      operation: {
        kind: 'select-facts',
        match: [
          { kind: 'vertex', id: { kind: 'variable', name: 'person' } },
          {
            kind: 'edge',
            subject: { kind: 'variable', name: 'person' },
            predicate: { kind: 'constant', value: 'graph/likes' },
            object: { kind: 'constant', value: 'vertex/bob' },
          },
        ],
      },
    });
    const tracker = createExecutionQueryTracker(sql);

    const rows = await executePreparedSelectFacts<{ person: string }>({
      sql: tracker.sql,
      execution: preparedExecution,
    });

    expect(rows).toEqual([{ person: 'vertex/alice' }]);
    expect(tracker.getQueryCount()).toBe(1);
  });

  it('executes SQL pushdown through the unified prepared-execution path with one SQL statement and zero provider calls', async () => {
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
      'insert into external_sql_pushdown_accounts (person_id, account_id) values ($1, $2);',
      ['vertex/alice', 'account-1'],
    );

    const preparedExecution = prepareSelectFactsExecution({
      catalog: createSqlPushdownCatalog(),
      operation: {
        kind: 'select-facts',
        match: [
          { kind: 'vertex', id: { kind: 'variable', name: 'person' } },
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
    const tracker = createExecutionQueryTracker(sql);

    const rows = await executePreparedSelectFacts<{ person: string; accountId: string }>({
      sql: tracker.sql,
      execution: preparedExecution,
    });

    expect(rows).toEqual([{ person: 'vertex/alice', accountId: 'account-1' }]);
    expect(tracker.getQueryCount()).toBe(1);
  });

  it('executes materialization through the unified prepared-execution path with exact SQL and provider counts', async () => {
    const materializeRows = vi.fn<MaterializeRowsHandler>((request: ExternalResolverLookupRequest) => ({
      ok: true as const,
      value: request.keys.map((key) => ({
        valuesByColumn: {
          person_id: key.valuesByColumn.person_id ?? null,
          account_id: 'account-1',
        },
      })),
    }));

    await initializeGraphSchema(sql);
    await applyDatalogFacts({
      sql,
      mode: 'insert-facts',
      facts: [
        { kind: 'vertex', id: 'vertex/alice' },
        {
          kind: 'edge',
          subjectId: 'vertex/alice',
          predicateId: 'graph/account',
          objectId: 'account-1',
        },
      ],
    });

    const preparedExecution = prepareSelectFactsExecution({
      catalog: createMaterializationCatalog(materializeRows),
      operation: {
        kind: 'select-facts',
        match: [
          {
            kind: 'predicate',
            predicate: 'crmAccount',
            terms: [
              { kind: 'constant', value: 'vertex/alice' },
              { kind: 'variable', name: 'accountId' },
            ],
          },
          {
            kind: 'edge',
            subject: { kind: 'constant', value: 'vertex/alice' },
            predicate: { kind: 'constant', value: 'graph/account' },
            object: { kind: 'variable', name: 'accountId' },
          },
        ],
      },
    });
    const tracker = createExecutionQueryTracker(sql);

    const rows = await executePreparedSelectFacts<{ accountId: string }>({
      sql: tracker.sql,
      execution: preparedExecution,
    });

    expect(rows).toEqual([{ accountId: 'account-1' }]);
    expect(tracker.getQueryCount()).toBe(3);
    expect(materializeRows).toHaveBeenCalledTimes(1);
  });

  it('executes hydration through the unified prepared-execution path with exact SQL and provider counts', async () => {
    const hydrateRows = vi.fn<HydrateRowsHandler>((request: ExternalResolverHydrateRequest) => ({
      ok: true as const,
      value: request.rows.map((row) => ({
        valuesByColumn: {
          account_id: row.valuesByColumn.account_id ?? null,
          account_profile: `profile:${String(row.valuesByColumn.account_id)}`,
        },
      })),
    }));

    await initializeGraphSchema(sql);
    await applyDatalogFacts({
      sql,
      mode: 'insert-facts',
      facts: [
        { kind: 'vertex', id: 'vertex/alice' },
        {
          kind: 'edge',
          subjectId: 'vertex/alice',
          predicateId: 'graph/account',
          objectId: 'account-1',
        },
      ],
    });

    const preparedExecution = prepareSelectFactsExecution({
      catalog: createHydrationCatalog(hydrateRows),
      operation: {
        kind: 'select-facts',
        match: [
          { kind: 'vertex', id: { kind: 'variable', name: 'person' } },
          {
            kind: 'edge',
            subject: { kind: 'variable', name: 'person' },
            predicate: { kind: 'constant', value: 'graph/account' },
            object: { kind: 'variable', name: 'accountId' },
          },
          {
            kind: 'predicate',
            predicate: 'crmAccountHydration',
            terms: [
              { kind: 'variable', name: 'accountId' },
              { kind: 'variable', name: 'accountProfile' },
            ],
          },
        ],
      },
    });
    const tracker = createExecutionQueryTracker(sql);

    const rows = await executePreparedSelectFacts<{
      person: string;
      accountId: string;
      accountProfile: string;
    }>({
      sql: tracker.sql,
      execution: preparedExecution,
    });

    expect(rows).toEqual([
      {
        person: 'vertex/alice',
        accountId: 'account-1',
        accountProfile: 'profile:account-1',
      },
    ]);
    expect(tracker.getQueryCount()).toBe(1);
    expect(hydrateRows).toHaveBeenCalledTimes(1);
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
          relationName: 'external_sql_pushdown_accounts_view',
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

function createMaterializationCatalog(materializeRows: MaterializeRowsHandler): PredicateCatalog {
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
        columns: [
          { name: 'person_id', ordinal: 0, type: 'text' },
          { name: 'account_id', ordinal: 1, type: 'text' },
        ],
        execution: {
          kind: 'external-resolver',
          resolver: defineExternalResolverDefinition({
            version: 1,
            provider: 'crm-api',
            mode: 'materialize_before_sql',
            keyColumns: ['person_id'],
            requestScopedDedupe: 'by-key',
            expectedRowShape: 'values-by-column',
            materializeRows,
          }),
        },
        constraints: [],
        indexes: [],
        capabilities: {
          readable: true,
          writable: false,
          supportsPredicatePushdown: false,
          supportsJoinPushdown: false,
          supportsAggregationPushdown: false,
          supportsRecursionSeedPushdown: false,
          supportsDeltaScan: false,
        },
      },
    ],
    aliases: DEFAULT_SELECT_FACTS_PREDICATE_CATALOG.aliases,
  };
}

function createHydrationCatalog(hydrateRows: HydrateRowsHandler): PredicateCatalog {
  return {
    version: 1,
    predicates: [
      ...DEFAULT_SELECT_FACTS_PREDICATE_CATALOG.predicates,
      {
        signature: {
          name: 'crmAccountHydration',
          arity: 2,
          kind: 'edb',
          outputTypes: ['text', 'jsonb'],
        },
        source: 'catalog',
        columns: [
          { name: 'account_id', ordinal: 0, type: 'text' },
          { name: 'account_profile', ordinal: 1, type: 'jsonb' },
        ],
        execution: {
          kind: 'external-resolver',
          resolver: defineExternalResolverDefinition({
            version: 1,
            provider: 'crm-api',
            mode: 'post_query_hydrate',
            keyColumns: ['account_id'],
            requestScopedDedupe: 'by-key',
            expectedRowShape: 'values-by-column',
            hydratedFieldName: 'accountProfile',
            hydrateRows,
          }),
        },
        constraints: [],
        indexes: [],
        capabilities: {
          readable: true,
          writable: false,
          supportsPredicatePushdown: false,
          supportsJoinPushdown: false,
          supportsAggregationPushdown: false,
          supportsRecursionSeedPushdown: false,
          supportsDeltaScan: false,
        },
      },
    ],
    aliases: DEFAULT_SELECT_FACTS_PREDICATE_CATALOG.aliases,
  };
}

async function recreateExternalAccountView(sql: PostgresSqlClient): Promise<void> {
  await dropExternalAccountFixtures(sql);
  await sql.unsafe(
    'create table external_sql_pushdown_accounts (person_id text not null, account_id text not null);',
  );
  await sql.unsafe(
    'create view external_sql_pushdown_accounts_view as select person_id, account_id from external_sql_pushdown_accounts;',
  );
}

async function dropExternalAccountFixtures(sql: PostgresSqlClient): Promise<void> {
  await sql.unsafe('drop view if exists external_sql_pushdown_accounts_view;');
  await sql.unsafe('drop table if exists external_sql_pushdown_accounts;');
}

async function createExecutionTestSqlClient(): Promise<{
  readonly sql: PostgresSqlClient;
  readonly cleanup: () => Promise<void>;
}> {
  const localSql = await tryCreateLocalIsolatedSqlClient('datalog_to_sql_postgres_e2e');

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
  const adminConnectionString = 'postgresql://postgres@127.0.0.1:5432/postgres';
  const adminSql = createPostgresSqlClient(adminConnectionString);
  const databaseName = createLocalDatabaseName(databaseNamePrefix);

  try {
    await adminSql`select 1`;
    await adminSql.unsafe(`create database ${databaseName}`);

    return {
      sql: createPostgresSqlClient(createDatabaseConnectionString(adminConnectionString, databaseName)),
      cleanup: async () => {
        await dropLocalTestDatabase(adminConnectionString, databaseName);
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

function createDatabaseConnectionString(adminConnectionString: string, databaseName: string): string {
  const connectionUrl = new URL(adminConnectionString);
  connectionUrl.pathname = `/${databaseName}`;
  return connectionUrl.toString();
}

async function dropLocalTestDatabase(adminConnectionString: string, databaseName: string): Promise<void> {
  const adminSql = createPostgresSqlClient(adminConnectionString);

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

function createExecutionQueryTracker(sql: PostgresSqlClient): {
  readonly sql: PostgresSqlClient;
  readonly getQueryCount: () => number;
} {
  let queryCount = 0;

  function wrapClient(client: PostgresSqlClient): PostgresSqlClient {
    return new Proxy(client, {
      get(target, property, receiver) {
        if (property === 'unsafe') {
          const unsafe = Reflect.get(target, property, receiver);

          if (typeof unsafe !== 'function') {
            throw new TypeError('Expected postgres client unsafe property to be a function.');
          }

          return new Proxy(unsafe, {
            apply(targetUnsafe, _thisArg, args) {
              queryCount += 1;
              return Reflect.apply(targetUnsafe, target, args);
            },
          });
        }

        if (property === 'begin') {
          const begin = Reflect.get(target, property, receiver);

          if (typeof begin !== 'function') {
            throw new TypeError('Expected postgres client begin property to be a function.');
          }

          return async (callback: (transactionSql: PostgresSqlClient) => Promise<unknown>) => {
            return Reflect.apply(begin, target, [
              async (transactionSql: PostgresSqlClient) => callback(wrapClient(transactionSql)),
            ]);
          };
        }

        return Reflect.get(target, property, receiver);
      },
    });
  }

  return {
    sql: wrapClient(sql),
    getQueryCount: () => queryCount,
  };
}
