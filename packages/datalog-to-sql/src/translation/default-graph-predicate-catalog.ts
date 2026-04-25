import type { PredicateCatalog } from '../contracts/predicate-catalog.js';

/** Default graph-backed catalog for the unified select-facts translation path. */
export const DEFAULT_SELECT_FACTS_PREDICATE_CATALOG = {
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
  aliases: {
    Vertex: 'vertex',
    Node: 'vertex',
    Edge: 'edge',
  },
} satisfies PredicateCatalog;
