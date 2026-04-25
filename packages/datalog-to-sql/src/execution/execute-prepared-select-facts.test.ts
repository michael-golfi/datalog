import { describe, expect, it, vi } from 'vitest';

import { executePreparedSelectFacts } from './execute-prepared-select-facts.js';
import { defineExternalResolverDefinition } from '../contracts/external-resolver-definition.js';
import { compileSelectFactsLogicalPlan } from '../translation/compile-select-facts-logical-plan.js';
import { DEFAULT_SELECT_FACTS_PREDICATE_CATALOG } from '../translation/default-graph-predicate-catalog.js';
import { renderLogicalPlanToSql } from '../translation/render-logical-plan-to-sql.js';

import type {
  MaterializeBeforeSqlExternalResolverDefinition,
  PostQueryHydrateExternalResolverDefinition,
} from '../contracts/external-resolver-definition.js';
import type { PredicateCatalog } from '../contracts/predicate-catalog.js';
import type { PreparedSelectFactsExecution } from '../contracts/prepared-select-facts-execution.js';
import type { PostgresSqlClient } from '../runtime/create-postgres-sql-client.js';


const WORK_TABLE_TEST_CATALOG = {
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

describe('executePreparedSelectFacts', () => {
  it('renders work-table scans through the shared catalog-driven SQL path', () => {
    const plan = compileSelectFactsLogicalPlan(
      {
        kind: 'select-facts',
        predicateCatalog: WORK_TABLE_TEST_CATALOG,
        match: [
          {
            kind: 'vertex',
            id: {
              kind: 'variable',
              name: 'person',
            },
          },
          {
            kind: 'predicate',
            predicate: 'crmAccount',
            terms: [
              {
                kind: 'variable',
                name: 'person',
              },
              {
                kind: 'variable',
                name: 'accountId',
              },
            ],
          },
        ],
      },
      WORK_TABLE_TEST_CATALOG,
    );

    expect(renderLogicalPlanToSql(plan)).toEqual({
      operation: 'select',
      text: 'select distinct scan_1.id as "person", scan_2.account_id as "accountId" from vertices scan_1 join "prepared_crmAccount_2" scan_2 on scan_1.id = scan_2.person_id;',
      values: [],
    });
  });

  it('executes work table setup, inserts, final SQL, and hydration in deterministic order', async () => {
    const events: string[] = [];
    const sqlUnsafe = vi.fn(async (query: string, values?: readonly unknown[]) => {
      if (query.startsWith('create temporary table')) {
        events.push(`create:${getRelationNameFromSql(query)}`);
        return [];
      }

      if (query.startsWith('insert into')) {
        events.push(`insert:${getRelationNameFromSql(query)}:${JSON.stringify(values ?? [])}`);
        return [];
      }

      if (query.startsWith('select distinct')) {
        events.push('select');
        return [{ person: 'vertex/alice', accountId: 'account-1' }];
      }

      throw new Error(`Unexpected SQL: ${query}`);
    });
    const sql = {
      unsafe: sqlUnsafe,
      begin: vi.fn(async (callback: (transactionSql: PostgresSqlClient) => Promise<readonly unknown[]>) => {
        events.push('begin');
        return callback(sql);
      }),
    } as unknown as PostgresSqlClient;
    const preparedExecution = createPreparedExecutionFixture();

    const rows = await executePreparedSelectFacts({
      sql,
      execution: preparedExecution,
      loadMaterializedRows: async (step) => {
        events.push(`materialize:${step.relationName}`);

        if (step.relationName === 'prepared_crmTag_3') {
          return {
            ok: true,
            value: [
              {
                valuesByColumn: {
                  account_id: 'account-1',
                  tag_id: 'tag-gold',
                },
              },
            ],
          };
        }

        return {
          ok: true,
          value: [
            {
              valuesByColumn: {
                person_id: 'vertex/alice',
                account_id: 'account-1',
              },
            },
          ],
        };
      },
      hydrateRows: async ({ instruction, rows: inputRows }) => {
        events.push(`hydrate:${instruction.hydratedFieldName}`);

        return inputRows.map((row) => ({
          ...row,
          accountProfile: { accountId: row.accountId, tier: 'gold' },
        }));
      },
    });

    expect(rows).toEqual([
      {
        person: 'vertex/alice',
        accountId: 'account-1',
        accountProfile: { accountId: 'account-1', tier: 'gold' },
      },
    ]);
    expect(events).toEqual([
      'begin',
      'create:prepared_crmAccount_2',
      'create:prepared_crmTag_3',
      'materialize:prepared_crmAccount_2',
      'materialize:prepared_crmTag_3',
      'insert:prepared_crmAccount_2:["vertex/alice","account-1"]',
      'insert:prepared_crmTag_3:["account-1","tag-gold"]',
      'select',
      'hydrate:accountProfile',
    ]);
    expect(sqlUnsafe).toHaveBeenNthCalledWith(
      1,
      'create temporary table "prepared_crmAccount_2" ("person_id" text, "account_id" text) on commit drop;',
    );
    expect(sqlUnsafe).toHaveBeenNthCalledWith(
      2,
      'create temporary table "prepared_crmTag_3" ("account_id" text, "tag_id" text) on commit drop;',
    );
    expect(sqlUnsafe).toHaveBeenNthCalledWith(
      3,
      'insert into "prepared_crmAccount_2" ("person_id", "account_id") values ($1, $2);',
      ['vertex/alice', 'account-1'],
    );
    expect(sqlUnsafe).toHaveBeenNthCalledWith(
      4,
      'insert into "prepared_crmTag_3" ("account_id", "tag_id") values ($1, $2);',
      ['account-1', 'tag-gold'],
    );
    expect(sqlUnsafe).toHaveBeenNthCalledWith(5, preparedExecution.finalSqlQuery.text, []);
  });
});

function createPreparedExecutionFixture(): PreparedSelectFactsExecution {
  const plan = compileSelectFactsLogicalPlan(
    {
      kind: 'select-facts',
      predicateCatalog: WORK_TABLE_TEST_CATALOG,
      match: [
        {
          kind: 'vertex',
          id: {
            kind: 'variable',
            name: 'person',
          },
        },
        {
          kind: 'predicate',
          predicate: 'crmAccount',
          terms: [
            {
              kind: 'variable',
              name: 'person',
            },
            {
              kind: 'variable',
              name: 'accountId',
            },
          ],
        },
      ],
    },
    WORK_TABLE_TEST_CATALOG,
  );

  return {
    kind: 'prepared-select-facts-execution',
    logicalPlan: plan,
    materializationSteps: [
      {
        kind: 'materialize-external-predicate',
        patternIndex: 1,
        predicateName: 'crmAccount',
        relationName: 'prepared_crmAccount_2',
        columns: [
          { name: 'person_id', ordinal: 0, type: 'text' },
          { name: 'account_id', ordinal: 1, type: 'text' },
        ],
        keyColumns: ['person_id'],
        terms: [
          {
            kind: 'constant',
            value: 'vertex/alice',
          },
          {
            kind: 'variable',
            name: 'accountId',
          },
        ],
        resolver: createMaterializeResolver('person_id'),
      },
      {
        kind: 'materialize-external-predicate',
        patternIndex: 2,
        predicateName: 'crmTag',
        relationName: 'prepared_crmTag_3',
        columns: [
          { name: 'account_id', ordinal: 0, type: 'text' },
          { name: 'tag_id', ordinal: 1, type: 'text' },
        ],
        keyColumns: ['account_id'],
        terms: [
          { kind: 'variable', name: 'accountId' },
          { kind: 'variable', name: 'tagId' },
        ],
        resolver: createMaterializeResolver('account_id'),
      },
    ],
    finalSqlQuery: renderLogicalPlanToSql(plan),
    hydrationInstructions: [
      {
        kind: 'hydrate-external-predicate',
        patternIndex: 3,
        predicateName: 'crmAccountHydration',
        columns: [
          { name: 'account_id', ordinal: 0, type: 'text' },
          { name: 'account_profile', ordinal: 1, type: 'jsonb' },
        ],
        keyColumns: ['account_id'],
        projectedKeyBindings: [{ keyColumn: 'account_id', outputFieldName: 'accountId' }],
        terms: [
          {
            kind: 'variable',
            name: 'accountId',
          },
          {
            kind: 'variable',
            name: 'accountProfile',
          },
        ],
        hydratedFieldName: 'accountProfile',
        resolver: createHydrationResolver(),
      },
    ],
  };
}

function createMaterializeResolver(keyColumn: string): MaterializeBeforeSqlExternalResolverDefinition {
  const resolver = defineExternalResolverDefinition({
    version: 1,
    provider: 'crm-api',
    mode: 'materialize_before_sql',
    keyColumns: [keyColumn],
    requestScopedDedupe: 'by-key',
    expectedRowShape: 'values-by-column',
    materializeRows: () => ({ ok: true, value: [] }),
  });

  if (resolver.mode !== 'materialize_before_sql') {
    throw new Error('Expected a materialize_before_sql resolver fixture.');
  }

  return resolver;
}

function getRelationNameFromSql(query: string): string {
  const relationName = query.match(/"([^"]+)"/)?.[1];

  if (relationName !== undefined) {
    return relationName;
  }

  throw new Error(`Expected quoted relation name in SQL: ${query}`);
}

function createHydrationResolver(): PostQueryHydrateExternalResolverDefinition {
  const resolver = defineExternalResolverDefinition({
    version: 1,
    provider: 'crm-api',
    mode: 'post_query_hydrate',
    keyColumns: ['account_id'],
    requestScopedDedupe: 'by-key',
    expectedRowShape: 'values-by-column',
    hydratedFieldName: 'accountProfile',
    hydrateRows: () => ({ ok: true, value: [] }),
  });

  if (resolver.mode !== 'post_query_hydrate') {
    throw new Error('Expected a post_query_hydrate resolver fixture.');
  }

  return resolver;
}
