import { describe, expect, it, vi } from 'vitest';

import { defineExternalResolverDefinition } from '../contracts/external-resolver-definition.js';
import type {
  MaterializeBeforeSqlExternalResolverDefinition,
  ExternalResolverLookupRequest,
  ExternalResolverResult,
  ExternalResolverRow,
} from '../contracts/external-resolver-definition.js';
import type { PredicateCatalog, RelationColumnBinding } from '../contracts/predicate-catalog.js';
import type { PreparedSelectFactsMaterializationStep } from '../contracts/prepared-select-facts-execution.js';
import type { PostgresSqlClient } from '../runtime/create-postgres-sql-client.js';
import { DEFAULT_SELECT_FACTS_PREDICATE_CATALOG } from '../translation/default-graph-predicate-catalog.js';

import { executePreparedSelectFacts } from './execute-prepared-select-facts.js';
import { materializeExternalResolverRelations } from './materialize-external-resolver-relations.js';
import { prepareSelectFactsExecution } from './prepare-select-facts-execution.js';
import { createQueryCountTracker } from './query-count-tracker.js';

describe('materializeExternalResolverRelations', () => {
  it('batches bound keys once for one resolver request', async () => {
    const resolver = vi.fn((request: ExternalResolverLookupRequest): ExternalResolverResult<readonly ExternalResolverRow[]> => {
      expect(request.keys).toEqual([{ valuesByColumn: { person_id: 'vertex/alice' } }]);

      return {
        ok: true,
        value: [{ valuesByColumn: { person_id: 'vertex/alice', account_id: 'account-1' } }],
      };
    });

    const relations = await materializeExternalResolverRelations({
      materializationSteps: [
        createMaterializationStep({
          predicateName: 'crmAccount',
          relationName: 'prepared_crmAccount_1',
          columns: [
            { name: 'person_id', ordinal: 0, type: 'text' },
            { name: 'account_id', ordinal: 1, type: 'text' },
          ],
          keyColumns: ['person_id'],
          terms: [{ kind: 'constant', value: 'vertex/alice' }, { kind: 'variable', name: 'accountId' }],
          materializeRows: resolver,
        }),
      ],
    });

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(relations[0]?.request.keys).toEqual([{ valuesByColumn: { person_id: 'vertex/alice' } }]);
  });

  it('batches bound keys once and joins through a temp relation', async () => {
    const resolver = vi.fn((request: ExternalResolverLookupRequest): ExternalResolverResult<readonly ExternalResolverRow[]> => {
      expect(request.keys).toEqual([{ valuesByColumn: { person_id: 'vertex/alice' } }]);

      return {
        ok: true,
        value: [{ valuesByColumn: { person_id: 'vertex/alice', account_id: 'account-1' } }],
      };
    });
    const execution = prepareSelectFactsExecution({
      operation: {
        kind: 'select-facts',
        match: [
          {
            kind: 'predicate',
            predicate: 'crmAccount',
            terms: [{ kind: 'constant', value: 'vertex/alice' }, { kind: 'variable', name: 'accountId' }],
          },
        ],
      },
      catalog: createMaterializationCatalog(resolver),
    });
    const sql = createTrackedSqlClient([{ accountId: 'account-1' }]);

    const rows = await executePreparedSelectFacts<{ accountId: string }>({
      sql: sql.tracker.sql,
      execution,
    });

    expect(rows).toEqual([{ accountId: 'account-1' }]);
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(sql.tracker.getQueryCount()).toBe(3);
    expect(sql.queries).toEqual([
      'create temporary table "prepared_crmAccount_1" ("person_id" text, "account_id" text) on commit drop;',
      'insert into "prepared_crmAccount_1" ("person_id", "account_id") values ($1, $2);',
      execution.finalSqlQuery.text,
    ]);
  });

  it('rejects empty provider results before final SQL', async () => {
    const execution = prepareSelectFactsExecution({
      operation: {
        kind: 'select-facts',
        match: [
          {
            kind: 'predicate',
            predicate: 'crmAccount',
            terms: [{ kind: 'constant', value: 'vertex/alice' }, { kind: 'variable', name: 'accountId' }],
          },
        ],
      },
      catalog: createMaterializationCatalog(() => ({ ok: true, value: [] })),
    });
    const sql = createTrackedSqlClient([{ accountId: 'account-1' }]);

    await expect(executePreparedSelectFacts({ sql: sql.tracker.sql, execution })).rejects.toThrowError(
      expect.objectContaining({
        name: 'GraphTranslationError',
        code: 'EXTERNAL_PROVIDER_FAILURE',
        message:
          'Materialized external predicate crmAccount/2 returned no rows for 1 bound key tuple(s).',
      }),
    );
    expect(sql.tracker.getQueryCount()).toBe(1);
  });

  it('rejects duplicate provider keys before final SQL', async () => {
    const execution = prepareSelectFactsExecution({
      operation: {
        kind: 'select-facts',
        match: [
          {
            kind: 'predicate',
            predicate: 'crmAccount',
            terms: [{ kind: 'constant', value: 'vertex/alice' }, { kind: 'variable', name: 'accountId' }],
          },
        ],
      },
      catalog: createMaterializationCatalog(() => ({
        ok: true,
        value: [
          { valuesByColumn: { person_id: 'vertex/alice', account_id: 'account-1' } },
          { valuesByColumn: { person_id: 'vertex/alice', account_id: 'account-2' } },
        ],
      })),
    });
    const sql = createTrackedSqlClient([{ accountId: 'account-1' }]);

    await expect(executePreparedSelectFacts({ sql: sql.tracker.sql, execution })).rejects.toThrowError(
      expect.objectContaining({
        name: 'GraphTranslationError',
        code: 'EXTERNAL_DUPLICATE_KEY',
        message:
          'Materialized external predicate crmAccount/2 returned duplicate provider rows for key columns person_id.',
      }),
    );
    expect(sql.tracker.getQueryCount()).toBe(1);
  });

  it('rejects provider row-shape mismatches before final SQL', async () => {
    const execution = prepareSelectFactsExecution({
      operation: {
        kind: 'select-facts',
        match: [
          {
            kind: 'predicate',
            predicate: 'crmAccount',
            terms: [{ kind: 'constant', value: 'vertex/alice' }, { kind: 'variable', name: 'accountId' }],
          },
        ],
      },
      catalog: createMaterializationCatalog(() => ({
        ok: true,
        value: [{ valuesByColumn: { person_id: 'vertex/alice' } }],
      })),
    });
    const sql = createTrackedSqlClient([{ accountId: 'account-1' }]);

    await expect(executePreparedSelectFacts({ sql: sql.tracker.sql, execution })).rejects.toThrowError(
      expect.objectContaining({
        name: 'GraphTranslationError',
        code: 'EXTERNAL_ROW_SHAPE_MISMATCH',
        message:
          'Materialized external predicate crmAccount/2 returned a row-shape mismatch: expected 2 columns but received 1.',
      }),
    );
    expect(sql.tracker.getQueryCount()).toBe(1);
  });
});

function createMaterializationCatalog(
  materializeRows: MaterializeBeforeSqlExternalResolverDefinition['materializeRows'],
): PredicateCatalog {
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
          resolver: createResolver({ keyColumns: ['person_id'], materializeRows }),
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
  } satisfies PredicateCatalog;
}

function createMaterializationStep(input: {
  readonly predicateName: string;
  readonly relationName: string;
  readonly columns: readonly RelationColumnBinding[];
  readonly keyColumns: readonly [string, ...string[]];
  readonly terms: PreparedSelectFactsMaterializationStep['terms'];
  readonly materializeRows: MaterializeBeforeSqlExternalResolverDefinition['materializeRows'];
}): PreparedSelectFactsMaterializationStep {
  return {
    kind: 'materialize-external-predicate',
    patternIndex: 0,
    predicateName: input.predicateName,
    relationName: input.relationName,
    columns: input.columns,
    keyColumns: input.keyColumns,
    terms: input.terms,
    resolver: createResolver({ keyColumns: input.keyColumns, materializeRows: input.materializeRows }),
  };
}

function createResolver(input: {
  readonly keyColumns: readonly [string, ...string[]];
  readonly materializeRows: MaterializeBeforeSqlExternalResolverDefinition['materializeRows'];
}): MaterializeBeforeSqlExternalResolverDefinition {
  const resolver = defineExternalResolverDefinition({
    version: 1,
    provider: 'crm-api',
    mode: 'materialize_before_sql',
    keyColumns: input.keyColumns,
    requestScopedDedupe: 'by-key',
    expectedRowShape: 'values-by-column',
    materializeRows: input.materializeRows,
  });

  if (resolver.mode !== 'materialize_before_sql') {
    throw new Error('Expected a materialize_before_sql resolver fixture.');
  }

  return resolver;
}

function createTrackedSqlClient(selectRows: ReadonlyArray<Record<string, unknown>>): {
  readonly tracker: ReturnType<typeof createQueryCountTracker>;
  readonly queries: string[];
} {
  const queries: string[] = [];
  const trackerState: {
    tracker?: ReturnType<typeof createQueryCountTracker>;
  } = {};
  const sql = {
    unsafe: vi.fn(async (query: string) => {
      queries.push(query);

      if (query.startsWith('select')) {
        return selectRows;
      }

      return [];
    }),
    begin: vi.fn(async (callback: (transactionSql: PostgresSqlClient) => Promise<readonly unknown[]>) => {
      if (trackerState.tracker === undefined) {
        throw new Error('Expected tracked SQL client to be initialized before begin().');
      }

      return callback(trackerState.tracker.sql);
    }),
  } as unknown as PostgresSqlClient;

  const tracker = createQueryCountTracker(sql);
  trackerState.tracker = tracker;

  return {
    tracker,
    queries,
  };
}
