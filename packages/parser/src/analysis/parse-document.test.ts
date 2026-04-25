import { describe, expect, it } from 'vitest';

import { parseDocument } from './parse-document.js';

describe('parseDocument', () => {
  it('parses clauses, schemas, compounds, and derived predicates from a real document', () => {
    const source = `% Schema
DefPred("graph/likes", "1", "graph/node", "0", "graph/node").
DefCompound("Serving", "serv/id", "1", "liquid/node").
DefCompound("Serving", "serv/unit", "?", "liquid/string").
Edge("node/alice", "graph/likes", "node/bob").
Serving@(serv/id="node/alice", serv/unit="unit/serving").
Reachable(node_a, node_b) :-
  Edge(node_a, "graph/likes", node_b).
`;

    const parsed = parseDocument(source);

    expect(parsed.clauses).toHaveLength(6);
    expect(parsed.clauses[4]).toMatchObject({
      predicate: 'Serving',
      isCompound: true,
      compoundFields: ['serv/id', 'serv/unit'],
    });
    expect(parsed.clauses[5]).toMatchObject({
      predicate: 'Reachable',
      isRule: true,
      arity: 2,
    });
    expect(parsed.schemaDeclarations).toEqual([
      {
        schema: {
          kind: 'predicate-schema',
          predicateName: 'graph/likes',
          subjectCardinality: '1',
          subjectDomain: 'node',
          objectCardinality: '0',
          objectDomain: 'node',
        },
        range: parsed.clauses[0]?.references[0]?.range,
      },
      {
        schema: {
          kind: 'compound-schema',
          compoundName: 'Serving',
          fields: [
            { fieldName: 'serv/id', cardinality: '1', domain: 'node' },
            { fieldName: 'serv/unit', cardinality: '?', domain: 'text' },
          ],
        },
        range: parsed.clauses[1]?.references[0]?.range,
      },
    ]);
    expect(parsed.graphPredicateIds).toEqual(['graph/likes']);
    expect(parsed.nodeIds).toEqual([
      'graph/likes',
      'liquid/node',
      'liquid/string',
      'node/alice',
      'node/bob',
      'serv/id',
      'serv/unit',
      'unit/serving',
    ]);
    expect(parsed.derivedPredicates.get('Reachable')).toHaveLength(1);
  });
});
