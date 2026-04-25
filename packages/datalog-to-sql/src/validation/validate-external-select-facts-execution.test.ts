import { queryStatement } from '@datalog/ast';
import { describe, expect, it } from 'vitest';

import type { GraphTranslationError } from '../contracts/graph-translation-error.js';
import { defineExternalResolverDefinition } from '../contracts/external-resolver-definition.js';
import type { LogicalPlan, LogicalPlanNode, OutputColumn } from '../contracts/logical-plan.js';
import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';
import type { PredicateCatalog } from '../contracts/predicate-catalog.js';
import { DEFAULT_SELECT_FACTS_PREDICATE_CATALOG } from '../translation/default-graph-predicate-catalog.js';
import { prepareSelectFactsExecution } from '../execution/prepare-select-facts-execution.js';

import { validateExternalSelectFactsExecution } from './validate-external-select-facts-execution.js';

const EXTERNAL_VALIDATION_TEST_CATALOG = {
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

describe('validateExternalSelectFactsExecution', () => {
  it('accepts positive non-recursive external queries with earlier-bound materialization keys and projected hydration keys', () => {
    expect(() =>
      prepareSelectFactsExecution({
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
        catalog: EXTERNAL_VALIDATION_TEST_CATALOG,
      }),
    ).not.toThrow();
  });

  it('rejects negated query literals when the query references an external predicate', () => {
    expect(() =>
      prepareSelectFactsExecution({
        operation: queryStatement({
          body: [
            {
              kind: 'atom',
              predicate: 'Vertex',
              terms: [{ kind: 'variable', name: 'person' }],
            },
            {
              kind: 'not',
              atom: {
                kind: 'atom',
                predicate: 'crmAccount',
                terms: [
                  { kind: 'variable', name: 'person' },
                  { kind: 'variable', name: 'accountId' },
                ],
              },
            },
          ],
        }),
        catalog: EXTERNAL_VALIDATION_TEST_CATALOG,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'EXTERNAL_SELECT_FACTS_UNSUPPORTED_NEGATION',
        message:
          'External predicates are only supported in positive select-facts queries; negated query literals are not supported.',
      }),
    );
  });

  it('rejects materialized external predicates whose key columns are not bound by an earlier pattern', () => {
    expect(() =>
      prepareSelectFactsExecution({
        operation: queryStatement({
          body: [
            {
              kind: 'atom',
              predicate: 'crmAccount',
              terms: [
                { kind: 'variable', name: 'person' },
                { kind: 'variable', name: 'accountId' },
              ],
            },
          ],
        }),
        catalog: EXTERNAL_VALIDATION_TEST_CATALOG,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'EXTERNAL_SELECT_FACTS_UNBOUND_MATERIALIZATION_KEY',
        message:
          'Materialized external predicate crmAccount/2 at match index 1 requires key column person_id to be bound by a constant or by a variable introduced by an earlier pattern.',
      }),
    );
  });

  it('rejects hydration when its key is not projected in the final result set', () => {
    expect(() =>
      prepareSelectFactsExecution({
        operation: queryStatement({
          body: [
            {
              kind: 'atom',
              predicate: 'Vertex',
              terms: [{ kind: 'variable', name: 'person' }],
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
        catalog: EXTERNAL_VALIDATION_TEST_CATALOG,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'EXTERNAL_SELECT_FACTS_UNPROJECTED_HYDRATION_KEY',
        message:
          'Hydrated external predicate crmAccountHydration/2 at match index 2 requires key column account_id to be projected in the final result set.',
      }),
    );
  });

  it('rejects aggregate logical plans for external predicates', () => {
    expect(() =>
      validateExternalSelectFactsExecution({
        operation: createExternalSelectFactsOperation(),
        catalog: EXTERNAL_VALIDATION_TEST_CATALOG,
        logicalPlan: createAggregateLogicalPlan(),
      }),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'EXTERNAL_SELECT_FACTS_UNSUPPORTED_AGGREGATE',
        message: 'External predicates are not supported in aggregate select-facts plans.',
      }),
    );
  });

  it('rejects recursive logical plans for external predicates', () => {
    expect(() =>
      validateExternalSelectFactsExecution({
        operation: createExternalSelectFactsOperation(),
        catalog: EXTERNAL_VALIDATION_TEST_CATALOG,
        logicalPlan: createRecursiveLogicalPlan(),
      }),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'EXTERNAL_SELECT_FACTS_UNSUPPORTED_RECURSION',
        message: 'External predicates are not supported in recursive select-facts plans.',
      }),
    );
  });

  it('rejects mutation logical plans for external predicates', () => {
    expect(() =>
      validateExternalSelectFactsExecution({
        operation: createExternalSelectFactsOperation(),
        catalog: EXTERNAL_VALIDATION_TEST_CATALOG,
        logicalPlan: createMutationLogicalPlan(),
      }),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'EXTERNAL_SELECT_FACTS_UNSUPPORTED_MUTATION',
        message: 'External predicates are only supported in select-facts query plans; mutation plans are not supported.',
      }),
    );
  });
});

function createExternalSelectFactsOperation(): SelectFactsOperation {
  return {
    kind: 'select-facts',
    match: [
      {
        kind: 'predicate',
        predicate: 'crmAccount',
        terms: [
          { kind: 'variable', name: 'person' },
          { kind: 'variable', name: 'accountId' },
        ],
      },
    ],
  };
}

function createAggregateLogicalPlan(): LogicalPlan {
  const output = createOutputColumns();
  const aggregateNode = {
    kind: 'aggregate',
    id: 'aggregate_1',
    inputNodeId: 'scan_1',
    output,
    groupBy: [{ kind: 'column', nodeId: 'scan_1', columnId: 'person' }],
    aggregates: [{ name: 'count', functionName: 'count', args: [], type: 'int8' }],
  } satisfies LogicalPlanNode;

  return createLogicalPlan({
    rootNodeId: aggregateNode.id,
    nodes: {
      [aggregateNode.id]: aggregateNode,
    },
    output,
  });
}

function createRecursiveLogicalPlan(): LogicalPlan {
  const output = createOutputColumns();
  const recursiveNode = {
    kind: 'work-relation-scan',
    id: 'recursive_1',
    relationName: 'work_recursive_1',
    role: 'all',
    output,
  } satisfies LogicalPlanNode;

  return createLogicalPlan({
    rootNodeId: recursiveNode.id,
    nodes: {
      [recursiveNode.id]: recursiveNode,
    },
    output,
  });
}

function createMutationLogicalPlan(): LogicalPlan {
  const output = createOutputColumns();

  return {
    ...createLogicalPlan({
      rootNodeId: 'scan_1',
      nodes: {},
      output,
    }),
    mode: 'mutation',
  };
}

function createLogicalPlan(input: {
  readonly rootNodeId: string;
  readonly nodes: Readonly<Record<string, LogicalPlanNode>>;
  readonly output: readonly OutputColumn[];
}): LogicalPlan {
  return {
    kind: 'logical-plan',
    mode: 'query',
    catalog: EXTERNAL_VALIDATION_TEST_CATALOG,
    rootNodeId: input.rootNodeId,
    nodes: input.nodes,
    output: input.output,
    parameters: [],
  };
}

function createOutputColumns(): readonly OutputColumn[] {
  return [
    { id: 'person', name: 'person', type: 'text' },
    { id: 'accountId', name: 'accountId', type: 'text' },
  ];
}
