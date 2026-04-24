import { describe, expect, it } from 'vitest';

import {
  extractDatalogFactsFromMigrations,
  type CompoundBacklinkExpander,
} from './apply-datalog-migrations.js';

describe('extractDatalogFactsFromMigrations', () => {
  it('extracts vertex and edge facts from simple Edge clauses', () => {
    expect(
      extractDatalogFactsFromMigrations([
        {
          body: 'Edge("node/alice", "graph/likes", "node/bob").\nEdge("node/bob", "graph/likes", "node/carol").\n',
        },
      ]),
    ).toEqual({
      vertexCount: 3,
      edgeCount: 2,
      vertices: [
        { kind: 'vertex', id: 'node/alice' },
        { kind: 'vertex', id: 'node/bob' },
        { kind: 'vertex', id: 'node/carol' },
      ],
      edges: [
        {
          kind: 'edge',
          subjectId: 'node/alice',
          predicateId: 'graph/likes',
          objectId: 'node/bob',
        },
        {
          kind: 'edge',
          subjectId: 'node/bob',
          predicateId: 'graph/likes',
          objectId: 'node/carol',
        },
      ],
    });
  });

  it('keeps explicit Vertex and Node facts from the parser AST seam', () => {
    expect(
      extractDatalogFactsFromMigrations([
        {
          body: 'Vertex("node/alice").\nNode("node/bob").\nEdge("node/alice", "graph/likes", "node/bob").\n',
        },
      ]),
    ).toEqual({
      vertexCount: 2,
      edgeCount: 1,
      vertices: [
        { kind: 'vertex', id: 'node/alice' },
        { kind: 'vertex', id: 'node/bob' },
      ],
      edges: [
        {
          kind: 'edge',
          subjectId: 'node/alice',
          predicateId: 'graph/likes',
          objectId: 'node/bob',
        },
      ],
    });
  });

  it('skips compound declarations, DefCompound clauses, and DefPred clauses', () => {
    const extraction = extractDatalogFactsFromMigrations([
      {
        body: [
          'DefPred("graph/likes", "1", "graph/node", "0", "graph/node").',
          'DefCompound("Serving", "serv/id", "graph/node").',
          'Serving@(serv/id="node/alice", serv/unit="unit/serving").',
          'Edge("node/alice", "graph/likes", "node/bob").',
          '',
        ].join('\n'),
      },
    ]);

    expect(extraction.vertices).toEqual([
      { kind: 'vertex', id: 'node/alice' },
      { kind: 'vertex', id: 'node/bob' },
    ]);
    expect(extraction.edges).toEqual([
      {
        kind: 'edge',
        subjectId: 'node/alice',
        predicateId: 'graph/likes',
        objectId: 'node/bob',
      },
    ]);
  });

  it('expands compound backlinks when a compoundBacklinkExpander is provided', () => {
    const expander: CompoundBacklinkExpander = (clause) => {
      if (clause.predicate === 'Serving') {
        const subjectId = clause.references[0]?.value;
        const objectId = clause.references[1]?.value;

        if (subjectId !== undefined && objectId !== undefined) {
          return { kind: 'edge', subjectId, predicateId: 'serves', objectId };
        }
      }

      return null;
    };

    const extraction = extractDatalogFactsFromMigrations(
      [
        {
          body: [
            'DefCompound("Serving", "serv/id", "serv/unit").',
            'Serving@(serv/id="node/alice", serv/unit="unit/serving").',
            'Edge("node/alice", "graph/likes", "node/bob").',
            '',
          ].join('\n'),
        },
      ],
      { compoundBacklinkExpander: expander },
    );

    expect(extraction.edges).toContainEqual({
      kind: 'edge',
      subjectId: 'node/alice',
      predicateId: 'serves',
      objectId: 'unit/serving',
    });
    expect(extraction.vertexCount).toBeGreaterThanOrEqual(3);
  });

  it('skips rule clauses', () => {
    const extraction = extractDatalogFactsFromMigrations([
      {
        body: [
          'Reachable(node_a, node_b) :-',
          '  Edge(node_a, "graph/likes", node_b).',
          'Edge("node/alice", "graph/likes", "node/bob").',
          '',
        ].join('\n'),
      },
    ]);

    expect(extraction.edgeCount).toBe(1);
    expect(extraction.edges).toEqual([
      {
        kind: 'edge',
        subjectId: 'node/alice',
        predicateId: 'graph/likes',
        objectId: 'node/bob',
      },
    ]);
  });

  it('collects unique vertex IDs from both subject and object positions', () => {
    const extraction = extractDatalogFactsFromMigrations([
      {
        body: [
          'Edge("node/alice", "graph/likes", "node/bob").',
          'Edge("node/carol", "graph/likes", "node/alice").',
          'Edge("node/alice", "graph/likes", "node/bob").',
          '',
        ].join('\n'),
      },
    ]);

    expect(extraction.vertices).toEqual([
      { kind: 'vertex', id: 'node/alice' },
      { kind: 'vertex', id: 'node/bob' },
      { kind: 'vertex', id: 'node/carol' },
    ]);
    expect(extraction.vertexCount).toBe(3);
  });

  it('returns empty arrays for an empty migration list', () => {
    expect(extractDatalogFactsFromMigrations([])).toEqual({
      vertexCount: 0,
      edgeCount: 0,
      vertices: [],
      edges: [],
    });
  });

  it('returns empty arrays for migrations with only comments', () => {
    expect(
      extractDatalogFactsFromMigrations([
        {
          body: '% Comment only\n% Another comment\n',
        },
      ]),
    ).toEqual({
      vertexCount: 0,
      edgeCount: 0,
      vertices: [],
      edges: [],
    });
  });
});
