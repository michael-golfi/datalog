import { describe, expect, it } from 'vitest';

import { parseDocument } from './parse-document.js';

describe('parseDocument', () => {
  it('parses clauses, schemas, compounds, and derived predicates from a real document', () => {
    const source = `% Schema
DefPred("graph/likes", "1", "graph/node", "0", "graph/node").
Edge("node/alice", "graph/likes", "node/bob").
Serving@(serv/id="node/alice", serv/unit="unit/serving").
Reachable(node_a, node_b) :-
  Edge(node_a, "graph/likes", node_b).
`;

    const parsed = parseDocument(source);

    expect(parsed.clauses).toHaveLength(4);
    expect(parsed.clauses[2]).toMatchObject({
      predicate: 'Serving',
      isCompound: true,
      compoundFields: ['serv/id', 'serv/unit'],
    });
    expect(parsed.clauses[3]).toMatchObject({
      predicate: 'Reachable',
      isRule: true,
      arity: 2,
    });
    expect(parsed.predicateSchemas.get('graph/likes')).toMatchObject({
      subjectCardinality: '1',
      subjectType: 'graph/node',
      objectCardinality: '0',
      objectType: 'graph/node',
    });
    expect(parsed.graphPredicateIds).toEqual(['graph/likes']);
    expect(parsed.nodeIds).toEqual(['graph/likes', 'graph/node', 'node/alice', 'node/bob', 'unit/serving']);
    expect([...parsed.compoundPredicates.get('Serving') ?? []]).toEqual(['serv/id', 'serv/unit']);
    expect(parsed.derivedPredicates.get('Reachable')).toHaveLength(1);
  });
});
