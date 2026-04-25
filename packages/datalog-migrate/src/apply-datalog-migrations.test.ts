import { describe, expect, it } from 'vitest';

import { extractDatalogFactsFromMigrations, type CompoundBacklinkExpander } from './apply-datalog-migrations.js';
import { extractDatalogSchemaFromMigrations } from './extract-datalog-schema-from-migrations.js';

describe('extractDatalogSchemaFromMigrations', () => {
  it('extracts predicate and compound schemas from committed migration bodies', () => {
    expect(extractDatalogSchemaFromMigrations([
      {
        body: [
          'DefPred("graph/likes", "1", "graph/node", "0", "graph/node").',
          'DefCompound("Serving", "serv/id", "1", "graph/node").',
          'DefCompound("Serving", "serv/unit", "?", "graph/string").',
          '',
        ].join('\n'),
      },
    ])).toEqual([
      {
        kind: 'predicate-schema',
        predicateName: 'graph/likes',
        subjectCardinality: '1',
        subjectDomain: 'node',
        objectCardinality: '0',
        objectDomain: 'node',
      },
      {
        kind: 'compound-schema',
        compoundName: 'Serving',
        fields: [
          { fieldName: 'serv/id', cardinality: '1', domain: 'node' },
          { fieldName: 'serv/unit', cardinality: '?', domain: 'text' },
        ],
      },
    ]);
  });

  it('throws a structured error for invalid schema declarations', () => {
    expect(() => extractDatalogSchemaFromMigrations([
      {
        fileName: '000001_invalid_schema.dl',
        body: 'DefPred("graph/likes", "many", "graph/node", "0", "graph/node").\n',
      },
    ])).toThrowError(expect.objectContaining({
      name: 'DatalogMigrationSchemaError',
      code: 'datalog-migrate.invalid-schema-declaration',
      details: expect.objectContaining({
        migrationFileName: '000001_invalid_schema.dl',
        migrationIndex: 0,
        predicate: 'DefPred',
      }),
    }));
  });
});

describe('extractDatalogFactsFromMigrations', () => {
  it('extracts vertex and edge facts from simple Edge clauses', () => {
    expect(
      extractDatalogFactsFromMigrations([
        {
          body: [
            'DefPred("graph/likes", "1", "graph/node", "0", "graph/node").',
            'Edge("node/alice", "graph/likes", "node/bob").',
            'Edge("node/bob", "graph/likes", "node/carol").',
            '',
          ].join('\n'),
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
          body: [
            'DefPred("graph/likes", "1", "graph/node", "0", "graph/node").',
            'Vertex("node/alice").',
            'Node("node/bob").',
            'Edge("node/alice", "graph/likes", "node/bob").',
            '',
          ].join('\n'),
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

  it('skips schema declarations while still validating declared graph facts', () => {
    const extraction = extractDatalogFactsFromMigrations([
      {
        body: [
          'DefPred("graph/likes", "1", "graph/node", "0", "graph/node").',
          'DefCompound("Serving", "serv/id", "1", "graph/node").',
          'DefCompound("Serving", "serv/unit", "?", "graph/string").',
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
    const expander: CompoundBacklinkExpander = ({ clause, schema, schemas }) => {
      if (clause.predicate === 'Serving') {
        expect(schema.compoundName).toBe('Serving');
        expect(schemas).toContainEqual(expect.objectContaining({ kind: 'compound-schema', compoundName: 'Serving' }));
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
            'DefPred("graph/likes", "1", "graph/node", "0", "graph/node").',
            'DefCompound("Serving", "serv/id", "1", "graph/node").',
            'DefCompound("Serving", "serv/unit", "?", "graph/string").',
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
          'DefPred("graph/likes", "1", "graph/node", "0", "graph/node").',
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
          'DefPred("graph/likes", "1", "graph/node", "0", "graph/node").',
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

  it('throws a structured error when an edge fact uses an undeclared predicate schema', () => {
    expect(() => extractDatalogFactsFromMigrations([
      {
        body: 'Edge("node/alice", "graph/likes", "node/bob").\n',
      },
    ])).toThrowError(expect.objectContaining({
      name: 'DatalogMigrationSchemaError',
      code: 'datalog-migrate.missing-schema',
      details: expect.objectContaining({
        predicate: 'graph/likes',
      }),
    }));
  });

  it('throws a structured error when a compound fact uses an undeclared compound schema', () => {
    expect(() => extractDatalogFactsFromMigrations([
      {
        body: 'Serving@(serv/id="node/alice").\n',
      },
    ])).toThrowError(expect.objectContaining({
      name: 'DatalogMigrationSchemaError',
      code: 'datalog-migrate.missing-schema',
      details: expect.objectContaining({
        predicate: 'Serving',
      }),
    }));
  });

  it('throws a structured error when a compound fact violates a declared field domain', () => {
    expect(() => extractDatalogFactsFromMigrations([
      {
        body: [
          'DefCompound("Measurement", "measure/value", "1", "int8").',
          'Measurement@(measure/value="not-a-number").',
          '',
        ].join('\n'),
      },
    ])).toThrowError(expect.objectContaining({
      name: 'DatalogMigrationSchemaError',
      code: 'datalog-migrate.invalid-fact',
      message: 'Measurement field measure/value must match the int8 domain.',
    }));
  });

  it('throws a structured error when a compound fact omits a required field', () => {
    expect(() => extractDatalogFactsFromMigrations([
      {
        body: [
          'DefCompound("Serving", "serv/id", "1", "graph/node").',
          'DefCompound("Serving", "serv/unit", "1", "graph/string").',
          'Serving@(serv/id="node/alice").',
          '',
        ].join('\n'),
      },
    ])).toThrowError(expect.objectContaining({
      name: 'DatalogMigrationSchemaError',
      code: 'datalog-migrate.invalid-fact',
      message: 'Compound fact Serving@ is missing required field serv/unit.',
    }));
  });
});
