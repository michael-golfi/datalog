import { queryStatement } from '@datalog/ast';
import { describe, expect, it } from 'vitest';

import type { GraphTranslationError } from '../contracts/graph-translation-error.js';
import { defineExternalResolverDefinition } from '../contracts/external-resolver-definition.js';
import type { PredicateCatalog } from '../contracts/predicate-catalog.js';

import { createSelectFactsOperationFromDatalogQuery } from './create-select-facts-operation-from-datalog-query.js';
import { DEFAULT_SELECT_FACTS_PREDICATE_CATALOG } from './default-graph-predicate-catalog.js';

const SELECT_FACTS_CATALOG_WITH_EXTERNAL_PREDICATE = {
  version: 1,
  predicates: [
    ...DEFAULT_SELECT_FACTS_PREDICATE_CATALOG.predicates,
    {
      signature: {
        name: 'crmAccount',
        arity: 2,
        kind: 'edb',
        outputTypes: ['text', 'text'],
      },
      source: 'catalog',
      columns: [
        { name: 'account_id', ordinal: 0, type: 'text' },
        { name: 'account_name', ordinal: 1, type: 'text' },
      ],
      execution: {
        kind: 'external-resolver',
        resolver: defineExternalResolverDefinition({
          version: 1,
          provider: 'crm-api',
          mode: 'materialize_before_sql',
          keyColumns: ['account_id'],
          requestScopedDedupe: 'by-key',
          expectedRowShape: 'values-by-column',
          materializeRows: () => ({ ok: true, value: [] }),
        }),
      },
      constraints: [],
      indexes: [],
      capabilities: {
        readable: true,
        writable: false,
        supportsPredicatePushdown: false,
        supportsJoinPushdown: false,
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

describe('createSelectFactsOperationFromDatalogQuery', () => {
  it('catalog-driven graph predicates compile through the explicit catalog path', () => {
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
      ],
    });

    expect(createSelectFactsOperationFromDatalogQuery(query, SELECT_FACTS_CATALOG_WITH_EXTERNAL_PREDICATE)).toEqual({
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
      ],
    });
  });

  it('preserves repeated variable bindings across multiple catalog-driven graph patterns', () => {
    const query = queryStatement({
      body: [
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
        {
          kind: 'atom',
          predicate: 'Edge',
          terms: [
            {
              kind: 'variable',
              name: 'friend',
            },
            {
              kind: 'constant',
              value: 'graph/works-with',
            },
            {
              kind: 'variable',
              name: 'person',
            },
          ],
        },
      ],
    });

    expect(createSelectFactsOperationFromDatalogQuery(query, SELECT_FACTS_CATALOG_WITH_EXTERNAL_PREDICATE)).toEqual({
      kind: 'select-facts',
      match: [
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
        {
          kind: 'predicate',
          predicate: 'edge',
          terms: [
            {
              kind: 'variable',
              name: 'friend',
            },
            {
              kind: 'constant',
              value: 'graph/works-with',
            },
            {
              kind: 'variable',
              name: 'person',
            },
          ],
        },
      ],
    });
  });

  it('catalog-driven external predicates compile into select-facts operations', () => {
    const query = queryStatement({
      body: [
        {
          kind: 'atom',
          predicate: 'crmAccount',
          terms: [
            {
              kind: 'variable',
              name: 'accountId',
            },
            {
              kind: 'variable',
              name: 'accountName',
            },
          ],
        },
      ],
    });

    expect(createSelectFactsOperationFromDatalogQuery(query, SELECT_FACTS_CATALOG_WITH_EXTERNAL_PREDICATE)).toEqual({
      kind: 'select-facts',
      match: [
        {
          kind: 'predicate',
          predicate: 'crmAccount',
          terms: [
            {
              kind: 'variable',
              name: 'accountId',
            },
            {
              kind: 'variable',
              name: 'accountName',
            },
          ],
        },
      ],
    });
  });

  it('throws a structured error for predicates outside the graph atom surface', () => {
    const query = queryStatement({
      body: [
        {
          kind: 'atom',
          predicate: 'Likes',
          terms: [
            {
              kind: 'variable',
              name: 'person',
            },
            {
              kind: 'variable',
              name: 'friend',
            },
          ],
        },
      ],
    });

    expect(() => createSelectFactsOperationFromDatalogQuery(query, SELECT_FACTS_CATALOG_WITH_EXTERNAL_PREDICATE)).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'UNSUPPORTED_GRAPH_PREDICATE',
        message: 'Unsupported graph predicate Likes/2.',
      }),
    );
  });

  it('throws a structured error when the query body is empty', () => {
    expect(() =>
      createSelectFactsOperationFromDatalogQuery({
        kind: 'query',
        body: [] as unknown as Parameters<typeof createSelectFactsOperationFromDatalogQuery>[0]['body'],
      }, SELECT_FACTS_CATALOG_WITH_EXTERNAL_PREDICATE),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.query.empty-body',
        message: 'Select-facts queries require at least one atom.',
      }),
    );
  });

  it('throws a structured error when the query contains a non-atom literal', () => {
    const query = queryStatement({
      body: [
        {
          kind: 'comparison',
          operator: '=',
          left: {
            kind: 'variable',
            name: 'person',
          },
          right: {
            kind: 'constant',
            value: 'vertex/alice',
          },
        },
      ] as unknown as Parameters<typeof queryStatement>[0]['body'],
    });

    expect(() => createSelectFactsOperationFromDatalogQuery(query, SELECT_FACTS_CATALOG_WITH_EXTERNAL_PREDICATE)).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.query.unsupported-literal',
        message: 'Select-facts queries only support positive atom literals.',
      }),
    );
  });

  it('throws a structured error when a graph atom uses named terms', () => {
    const query = queryStatement({
      body: [
        {
          kind: 'atom',
          predicate: 'Vertex',
          terms: [
            {
              kind: 'named',
              name: 'id',
              term: {
                kind: 'variable',
                name: 'person',
              },
            },
          ],
        },
      ] as unknown as Parameters<typeof queryStatement>[0]['body'],
    });

    expect(() => createSelectFactsOperationFromDatalogQuery(query, SELECT_FACTS_CATALOG_WITH_EXTERNAL_PREDICATE)).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.query.unsupported-term',
        message: 'Select-facts queries do not support named terms.',
      }),
    );
  });
});
