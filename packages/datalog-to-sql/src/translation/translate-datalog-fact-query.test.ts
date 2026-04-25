import { defCompoundFieldSchema, defCompoundSchema, defPredSchema, queryStatement } from '@datalog/ast';
import { describe, expect, it } from 'vitest';

import { createSelectFactsOperationFromDatalogQuery } from './create-select-facts-operation-from-datalog-query.js';
import { buildPredicateCatalogFromSchema } from './build-predicate-catalog-from-schema.js';
import { translateDatalogFactQuery } from './translate-datalog-fact-query.js';

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

describe('translateDatalogFactQuery', () => {
  it('orchestrates logical-plan compilation and PostgreSQL rendering for the catalog-driven select-facts path', () => {
    expect(
      translateDatalogFactQuery({
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
      operation: 'select',
      text: 'select distinct scan_1.id as "person", scan_2.object_id as "friend" from vertices scan_1 join edges scan_2 on scan_1.id = scan_2.subject_id and scan_2.predicate_id = $1;',
      values: ['graph/likes'],
    });
  });

  it('creates a select-facts operation from shared query AST without changing generated SQL', () => {
    const query = queryStatement({
      body: [
        {
          kind: 'atom',
          predicate: 'Vertex',
          terms: [
            {
              kind: 'variable',
              name: 'person',
            },
          ],
        },
        {
          kind: 'atom',
          predicate: 'Edge',
          terms: [
            {
              kind: 'variable',
              name: 'person',
            },
            {
              kind: 'constant',
              value: 'graph/likes',
            },
            {
              kind: 'variable',
              name: 'friend',
            },
          ],
        },
      ],
    });

    const operation = createSelectFactsOperationFromDatalogQuery(query, GRAPH_PREDICATE_CATALOG);

    expect(operation).toEqual({
      kind: 'select-facts',
      predicateCatalog: GRAPH_PREDICATE_CATALOG,
      match: [
        {
          kind: 'predicate',
          predicate: 'vertex',
          terms: [
            {
              kind: 'variable',
              name: 'person',
            },
          ],
        },
        {
          kind: 'predicate',
          predicate: 'edge',
          terms: [
            {
              kind: 'variable',
              name: 'person',
            },
            {
              kind: 'constant',
              value: 'graph/likes',
            },
            {
              kind: 'variable',
              name: 'friend',
            },
          ],
        },
      ],
    });

    expect(translateDatalogFactQuery(query, GRAPH_PREDICATE_CATALOG)).toEqual({
      operation: 'select',
      text: 'select distinct scan_1.id as "person", scan_2.object_id as "friend" from vertices scan_1 join edges scan_2 on scan_1.id = scan_2.subject_id and scan_2.predicate_id = $1;',
      values: ['graph/likes'],
    });
  });

  it('renders generic predicate scans from a schema-built compound catalog without the default graph catalog path', () => {
    const predicateCatalog = buildPredicateCatalogFromSchema([
      defCompoundSchema({
        compoundName: 'Indication',
        fields: [
          defCompoundFieldSchema({
            fieldName: 'clinical/medication',
            cardinality: '1',
            domain: 'node',
          }),
          defCompoundFieldSchema({
            fieldName: 'clinical/code',
            cardinality: '?',
            domain: 'text',
          }),
        ],
      }),
    ]);

    expect(translateDatalogFactQuery({
      kind: 'select-facts',
      predicateCatalog,
      match: [
        {
          kind: 'predicate',
          predicate: 'Indication',
          terms: [
            {
              kind: 'variable',
              name: 'medication',
            },
            {
              kind: 'constant',
              value: 'rxnorm:123',
            },
          ],
        },
      ],
    })).toEqual({
      operation: 'select',
      text: `select distinct scan_1."clinical/medication" as "medication" from (select field_1.object_id as "clinical/medication", field_2.object_id as "clinical/code" from vertices hub join edges field_1 on field_1.subject_id = hub.id and field_1.predicate_id = 'clinical/medication' left join edges field_2 on field_2.subject_id = hub.id and field_2.predicate_id = 'clinical/code' where hub.id like 'Indication:%') scan_1 where scan_1."clinical/code" = $1;`,
      values: ['rxnorm:123'],
    });
  });
});
