import type { PredicateCatalog } from '../contracts/predicate-catalog.js';

/** Package-local graph catalog used by the legacy select-facts adapter path. */
export const DEFAULT_GRAPH_PREDICATE_CATALOG = {
  version: 1,
  predicates: [
    {
      signature: {
        name: 'vertex',
        arity: 1,
        kind: 'edb',
        outputTypes: ['text'],
      },
      source: 'catalog',
      storage: {
        kind: 'postgres-table',
        relationName: 'vertices',
        columns: [
          {
            name: 'id',
            ordinal: 0,
            type: 'text',
          },
        ],
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
    {
      signature: {
        name: 'edge',
        arity: 3,
        kind: 'edb',
        outputTypes: ['text', 'text', 'text'],
      },
      source: 'catalog',
      storage: {
        kind: 'postgres-table',
        relationName: 'edges',
        columns: [
          {
            name: 'subject_id',
            ordinal: 0,
            type: 'text',
          },
          {
            name: 'predicate_id',
            ordinal: 1,
            type: 'text',
          },
          {
            name: 'object_id',
            ordinal: 2,
            type: 'text',
          },
        ],
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
} satisfies PredicateCatalog;
