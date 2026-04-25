import { queryStatement } from '@datalog/ast';
import { describe, expect, it } from 'vitest';

import { createSelectFactsOperationFromDatalogQuery } from './create-select-facts-operation-from-datalog-query.js';
import { DEFAULT_SELECT_FACTS_PREDICATE_CATALOG } from './default-graph-predicate-catalog.js';
import { translateDatalogFactQuery } from './translate-datalog-fact-query.js';

describe('translateDatalogFactQuery', () => {
  it('orchestrates logical-plan compilation and PostgreSQL rendering for the catalog-driven select-facts path', () => {
    expect(
      translateDatalogFactQuery({
        operation: {
          kind: 'select-facts',
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
        },
        catalog: DEFAULT_SELECT_FACTS_PREDICATE_CATALOG,
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

    const operation = createSelectFactsOperationFromDatalogQuery(query, DEFAULT_SELECT_FACTS_PREDICATE_CATALOG);

    expect(operation).toEqual({
      kind: 'select-facts',
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

    expect(translateDatalogFactQuery({ operation: query, catalog: DEFAULT_SELECT_FACTS_PREDICATE_CATALOG })).toEqual({
      operation: 'select',
      text: 'select distinct scan_1.id as "person", scan_2.object_id as "friend" from vertices scan_1 join edges scan_2 on scan_1.id = scan_2.subject_id and scan_2.predicate_id = $1;',
      values: ['graph/likes'],
    });
  });
});
