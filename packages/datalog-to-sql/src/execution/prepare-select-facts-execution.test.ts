import { describe, expect, it, vi } from 'vitest';

import { queryStatement } from '@datalog/ast';

import { executeTranslatedSql } from './execute-translated-sql.js';
import { prepareSelectFactsExecution } from './prepare-select-facts-execution.js';
import { defineExternalResolverDefinition } from '../contracts/external-resolver-definition.js';
import { DEFAULT_SELECT_FACTS_PREDICATE_CATALOG } from '../translation/default-graph-predicate-catalog.js';

import type { PredicateCatalog } from '../contracts/predicate-catalog.js';
import type { PostgresSqlClient } from '../runtime/create-postgres-sql-client.js';

const PREPARED_EXECUTION_TEST_CATALOG = {
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
          materializeRows: () => ({ ok: true, value: [] }),
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
          hydrateRows: () => ({ ok: true, value: [] }),
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
} satisfies PredicateCatalog;

describe('prepareSelectFactsExecution', () => {
  it('builds prepared execution with materialization steps, final SQL, and hydration instructions', () => {
    const preparedExecution = prepareSelectFactsExecution({
      operation: queryStatement({
        body: [
          {
            kind: 'atom',
            predicate: 'Vertex',
            terms: [{ kind: 'variable', name: 'person' }],
          },
          {
            kind: 'atom',
            predicate: 'crmAccount',
            terms: [
              { kind: 'variable', name: 'person' },
              { kind: 'variable', name: 'accountId' },
            ],
          },
          {
            kind: 'atom',
            predicate: 'crmAccountHydration',
            terms: [
              { kind: 'variable', name: 'accountId' },
              { kind: 'variable', name: 'accountProfile' },
            ],
          },
        ],
      }),
      catalog: PREPARED_EXECUTION_TEST_CATALOG,
    });

    expect(preparedExecution.materializationSteps).toEqual([
      expect.objectContaining({
        kind: 'materialize-external-predicate',
        predicateName: 'crmAccount',
        relationName: 'prepared_crmAccount_2',
        keyColumns: ['person_id'],
      }),
    ]);
    expect(preparedExecution.finalSqlQuery).toEqual({
      operation: 'select',
      text: 'select distinct scan_1.id as "person", scan_2.account_id as "accountId" from vertices scan_1 join "prepared_crmAccount_2" scan_2 on scan_1.id = scan_2.person_id;',
      values: [],
    });
    expect(preparedExecution.hydrationInstructions).toEqual([
      expect.objectContaining({
        kind: 'hydrate-external-predicate',
        predicateName: 'crmAccountHydration',
        keyColumns: ['account_id'],
        projectedKeyBindings: [{ keyColumn: 'account_id', outputFieldName: 'accountId' }],
        hydratedFieldName: 'accountProfile',
      }),
    ]);
  });

  it('forwards widened parameter values through the final SQL query execution', async () => {
    const sqlUnsafe = vi.fn().mockResolvedValue([{ id: 'vertex/alice' }]);
    const sql = { unsafe: sqlUnsafe } as unknown as PostgresSqlClient;
    const preparedExecution = prepareSelectFactsExecution({
      operation: {
        kind: 'select-facts',
        predicateCatalog: DEFAULT_SELECT_FACTS_PREDICATE_CATALOG,
        match: [
          {
            kind: 'vertex',
            id: {
              kind: 'constant',
              value: 'vertex/alice',
            },
          },
        ],
      },
      catalog: DEFAULT_SELECT_FACTS_PREDICATE_CATALOG,
    });

    const query = {
      ...preparedExecution.finalSqlQuery,
      values: [new Date('2024-01-02T03:04:05.000Z'), new Uint8Array([1, 2, 3]), ['vertex/alice']],
    } as const;

    await expect(executeTranslatedSql(sql, query)).resolves.toEqual([{ id: 'vertex/alice' }]);
    expect(sqlUnsafe).toHaveBeenCalledWith(
      preparedExecution.finalSqlQuery.text,
      [new Date('2024-01-02T03:04:05.000Z'), new Uint8Array([1, 2, 3]), ['vertex/alice']],
    );
  });
});
