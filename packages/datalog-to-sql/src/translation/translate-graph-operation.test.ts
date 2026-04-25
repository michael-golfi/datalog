import { describe, expect, it } from 'vitest';
import { atom, constantTerm, defCompoundFieldSchema, defCompoundSchema, defPredSchema, factStatement, namedTerm, variableTerm } from '@datalog/ast';

import { buildPredicateCatalogFromSchema } from './build-predicate-catalog-from-schema.js';
import { translateGraphOperation } from './translate-graph-operation.js';

const GRAPH_PREDICATE_CATALOG = buildPredicateCatalogFromSchema([
  defPredSchema({
    predicateName: 'vertex',
    subjectCardinality: '1',
    subjectDomain: 'node',
    objectCardinality: '0',
    objectDomain: 'node',
  }),
  defPredSchema({
    predicateName: 'edge',
    subjectCardinality: '0',
    subjectDomain: 'node',
    objectCardinality: '0',
    objectDomain: 'node',
  }),
]);

describe('translateGraphOperation', () => {
  it('translates a vertex lookup onto the vertices table', () => {
    expect(
      translateGraphOperation({
        kind: 'select-vertex-by-id',
        vertexId: 'vertex/alice',
      }),
    ).toEqual({
      ok: true,
      value: {
        operation: 'select',
        text: 'select * from vertices where id = $1;',
        values: ['vertex/alice'],
      },
    });
  });

  it('translates filtered edge lookups onto the edges table with stable parameter ordering', () => {
    expect(
      translateGraphOperation({
        kind: 'select-edges',
        where: {
          subjectId: 'vertex/alice',
          predicateId: 'graph/likes',
          objectId: 'vertex/bob',
        },
      }),
    ).toEqual({
      ok: true,
      value: {
        operation: 'select',
        text: 'select * from edges where subject_id = $1 and predicate_id = $2 and object_id = $3;',
        values: ['vertex/alice', 'graph/likes', 'vertex/bob'],
      },
    });
  });

  it('supports an unfiltered edge scan as the minimal scaffold for broader translation work', () => {
    expect(
      translateGraphOperation({
        kind: 'select-edges',
      }),
    ).toEqual({
      ok: true,
      value: {
        operation: 'select',
        text: 'select * from edges;',
        values: [],
      },
    });
  });

  it('translates Datalog graph queries against both vertices and edges tables with shared variable bindings', () => {
    expect(
      translateGraphOperation({
        kind: 'select-facts',
        predicateCatalog: GRAPH_PREDICATE_CATALOG,
        match: [
          {
            kind: 'vertex',
            id: {
              kind: 'variable',
              name: 'person',
            },
          },
          {
            kind: 'edge',
            subject: {
              kind: 'variable',
              name: 'person',
            },
            predicate: {
              kind: 'constant',
              value: 'graph/likes',
            },
            object: {
              kind: 'variable',
              name: 'friend',
            },
          },
        ],
      }),
    ).toEqual({
      ok: true,
      value: {
        operation: 'select',
        text: 'select distinct scan_1.id as "person", scan_2.object_id as "friend" from vertices scan_1 join edges scan_2 on scan_1.id = scan_2.subject_id and scan_2.predicate_id = $1;',
        values: ['graph/likes'],
      },
    });
  });

  it('translates fact insertion for vertices and edges in a single PostgreSQL mutation surface', () => {
    expect(
      translateGraphOperation({
        kind: 'insert-facts',
        facts: [
          {
            kind: 'vertex',
            id: 'vertex/alice',
          },
          {
            kind: 'edge',
            subjectId: 'vertex/alice',
            predicateId: 'graph/likes',
            objectId: 'vertex/bob',
          },
        ],
      }),
    ).toEqual({
      ok: true,
      value: {
        operation: 'insert',
        text: 'with inserted_vertices as (insert into vertices (id) values ($1) on conflict do nothing returning id), inserted_edges as (insert into edges (subject_id, predicate_id, object_id) values ($2, $3, $4) on conflict do nothing returning subject_id, predicate_id, object_id) select 1;',
        values: ['vertex/alice', 'vertex/alice', 'graph/likes', 'vertex/bob'],
      },
    });
  });

  it('translates vertex-only fact insertion', () => {
    expect(
      translateGraphOperation({
        kind: 'insert-facts',
        facts: [
          {
            kind: 'vertex',
            id: 'vertex/alice',
          },
        ],
      }),
    ).toEqual({
      ok: true,
      value: {
        operation: 'insert',
        text: 'with inserted_vertices as (insert into vertices (id) values ($1) on conflict do nothing returning id) select 1;',
        values: ['vertex/alice'],
      },
    });
  });

  it('translates edge-only fact insertion', () => {
    expect(
      translateGraphOperation({
        kind: 'insert-facts',
        facts: [
          {
            kind: 'edge',
            subjectId: 'vertex/alice',
            predicateId: 'graph/likes',
            objectId: 'vertex/bob',
          },
        ],
      }),
    ).toEqual({
      ok: true,
      value: {
        operation: 'insert',
        text: 'with inserted_edges as (insert into edges (subject_id, predicate_id, object_id) values ($1, $2, $3) on conflict do nothing returning subject_id, predicate_id, object_id) select 1;',
        values: ['vertex/alice', 'graph/likes', 'vertex/bob'],
      },
    });
  });

  it('routes compound assertions through the shared graph insert translation path', () => {
    expect(
      translateGraphOperation({
        kind: 'insert-compound-assertion',
        schema: defCompoundSchema({
          compoundName: 'Indication',
          fields: [
            defCompoundFieldSchema({ fieldName: 'clinical/medication', cardinality: '1', domain: 'node' }),
            defCompoundFieldSchema({ fieldName: 'clinical/code', cardinality: '?', domain: 'text' }),
          ],
        }),
        assertion: factStatement(atom('Indication', [
          namedTerm('clinical/code', constantTerm('rxnorm:123')),
          namedTerm('cid', variableTerm('Cid')),
          namedTerm('clinical/medication', constantTerm('drug/metformin')),
        ])),
      }),
    ).toEqual({
      ok: true,
      value: {
        operation: 'insert',
        text: 'with inserted_vertices as (insert into vertices (id) values ($1) on conflict do nothing returning id), inserted_edges as (insert into edges (subject_id, predicate_id, object_id) values ($2, $3, $4), ($5, $6, $7) on conflict do nothing returning subject_id, predicate_id, object_id) select 1;',
        values: [
          'Indication:clinical/code=rxnorm%3A123,clinical/medication=drug/metformin',
          'Indication:clinical/code=rxnorm%3A123,clinical/medication=drug/metformin',
          'clinical/medication',
          'drug/metformin',
          'Indication:clinical/code=rxnorm%3A123,clinical/medication=drug/metformin',
          'clinical/code',
          'rxnorm:123',
        ],
      },
    });
  });

  it('translates fact deletion for vertices and edges in a single PostgreSQL mutation surface', () => {
    expect(
      translateGraphOperation({
        kind: 'delete-facts',
        facts: [
          {
            kind: 'vertex',
            id: 'vertex/alice',
          },
          {
            kind: 'edge',
            subjectId: 'vertex/alice',
            predicateId: 'graph/likes',
            objectId: 'vertex/bob',
          },
        ],
      }),
    ).toEqual({
      ok: true,
      value: {
        operation: 'delete',
        text: 'with deleted_vertices as (delete from vertices where id in ($1) returning id), deleted_edges as (delete from edges where (subject_id = $2 and predicate_id = $3 and object_id = $4) returning subject_id, predicate_id, object_id) select 1;',
        values: ['vertex/alice', 'vertex/alice', 'graph/likes', 'vertex/bob'],
      },
    });
  });

  it('translates vertex-only fact deletion', () => {
    expect(
      translateGraphOperation({
        kind: 'delete-facts',
        facts: [
          {
            kind: 'vertex',
            id: 'vertex/alice',
          },
        ],
      }),
    ).toEqual({
      ok: true,
      value: {
        operation: 'delete',
        text: 'with deleted_vertices as (delete from vertices where id in ($1) returning id) select 1;',
        values: ['vertex/alice'],
      },
    });
  });

  it('translates edge-only fact deletion', () => {
    expect(
      translateGraphOperation({
        kind: 'delete-facts',
        facts: [
          {
            kind: 'edge',
            subjectId: 'vertex/alice',
            predicateId: 'graph/likes',
            objectId: 'vertex/bob',
          },
        ],
      }),
    ).toEqual({
      ok: true,
      value: {
        operation: 'delete',
        text: 'with deleted_edges as (delete from edges where (subject_id = $1 and predicate_id = $2 and object_id = $3) returning subject_id, predicate_id, object_id) select 1;',
        values: ['vertex/alice', 'graph/likes', 'vertex/bob'],
      },
    });
  });

  it('translates recursive closure validation through the graph translation surface', () => {
    expect(
      translateGraphOperation({
        kind: 'select-recursive-closure-count',
        rootVertexId: 'vertex/root',
        predicateId: 'graph/reachable',
      }),
    ).toEqual({
      ok: true,
      value: {
        operation: 'select',
        text: [
          'with recursive closure as (',
          '  select e.object_id as descendant_id, 1 as depth',
          '  from edges e',
          '  where e.subject_id = $1',
          '    and e.predicate_id = $2',
          '  union all',
          '  select e.object_id as descendant_id, closure.depth + 1 as depth',
          '  from closure',
          '  join edges e on e.subject_id = closure.descendant_id',
          '  where e.predicate_id = $2',
          ')',
          'select count(*)::bigint as closure_size from closure;',
        ].join('\n'),
        values: ['vertex/root', 'graph/reachable'],
      },
    });
  });

  it('returns a deterministic validation error for invalid insert facts', () => {
    expect(
      translateGraphOperation({
        kind: 'insert-facts',
        facts: [
          {
            kind: 'edge',
            subjectId: 'vertex/alice',
            predicateId: '   ',
            objectId: 'vertex/bob',
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      error: {
        code: 'datalog-to-sql.insert.invalid-fact',
        message: 'Insert facts must use non-empty identifiers.',
      },
    });
  });

  it('returns a deterministic validation error for empty insert facts', () => {
    expect(
      translateGraphOperation({
        kind: 'insert-facts',
        facts: [] as unknown as [
          {
            readonly kind: 'vertex';
            readonly id: string;
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      error: {
        code: 'datalog-to-sql.insert.invalid-fact',
        message: 'Insert facts require at least one fact.',
      },
    });
  });

  it('returns a deterministic validation error for invalid delete facts', () => {
    expect(
      translateGraphOperation({
        kind: 'delete-facts',
        facts: [
          {
            kind: 'vertex',
            id: '',
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      error: {
        code: 'datalog-to-sql.delete.invalid-fact',
        message: 'Delete facts must use non-empty identifiers.',
      },
    });
  });

  it('returns a deterministic validation error for empty delete facts', () => {
    expect(
      translateGraphOperation({
        kind: 'delete-facts',
        facts: [] as unknown as [
          {
            readonly kind: 'vertex';
            readonly id: string;
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      error: {
        code: 'datalog-to-sql.delete.invalid-fact',
        message: 'Delete facts require at least one fact.',
      },
    });
  });

  it('returns a deterministic validation error for blank query variable names', () => {
    expect(
      translateGraphOperation({
        kind: 'select-facts',
        predicateCatalog: GRAPH_PREDICATE_CATALOG,
        match: [
          {
            kind: 'vertex',
            id: {
              kind: 'variable',
              name: '   ',
            },
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      error: {
        code: 'datalog-to-sql.query.invalid-term',
        message: 'Query variables must use non-empty names.',
      },
    });
  });

  it('returns a deterministic validation error for unknown operation kinds', () => {
    expect(
      translateGraphOperation({
        kind: 'bogus',
        facts: [
          {
            kind: 'vertex',
            id: 'vertex/alice',
          },
        ],
      } as unknown as Parameters<typeof translateGraphOperation>[0]),
    ).toMatchObject({
      ok: false,
      error: {
        code: 'datalog-to-sql.operation.invalid-kind',
        message: 'Graph operations must use a supported kind.',
      },
    });
  });
});
