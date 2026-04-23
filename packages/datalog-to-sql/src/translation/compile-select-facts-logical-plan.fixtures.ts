import type { PredicateCatalog } from '../contracts/predicate-catalog.js';

export const graphPredicateCatalog = {
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
        relationName: 'graph_vertices',
        columns: [{ name: 'id', ordinal: 0, type: 'text' }],
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
        relationName: 'graph_edges',
        columns: [
          { name: 'subject_id', ordinal: 0, type: 'text' },
          { name: 'predicate_id', ordinal: 1, type: 'text' },
          { name: 'object_id', ordinal: 2, type: 'text' },
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

/** Create a catalog fixture that omits the vertex predicate for error-path tests. */
export function createCatalogMissingVertexPredicate(): PredicateCatalog {
  const edgePredicate = graphPredicateCatalog.predicates.find((predicate) => {
    return predicate.signature.name === 'edge' && predicate.signature.arity === 3;
  });

  if (edgePredicate === undefined) {
    throw new Error('Expected edge/3 predicate fixture to exist.');
  }

  return {
    version: 1,
    predicates: [edgePredicate],
  };
}
