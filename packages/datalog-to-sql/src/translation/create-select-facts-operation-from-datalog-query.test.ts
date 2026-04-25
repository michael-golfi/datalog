import { describe, expect, it } from 'vitest';

import { queryStatement } from '@datalog/ast';

import { createSelectFactsOperationFromDatalogQuery } from './create-select-facts-operation-from-datalog-query.js';

import type { GraphTranslationError } from '../contracts/graph-translation-error.js';

describe('createSelectFactsOperationFromDatalogQuery', () => {
  it('maps a single Vertex atom into a select-facts vertex pattern', () => {
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

    expect(createSelectFactsOperationFromDatalogQuery(query)).toEqual({
      kind: 'select-facts',
      match: [
        {
          kind: 'vertex',
          id: {
            kind: 'variable',
            name: 'person',
          },
        },
      ],
    });
  });

  it('preserves repeated variable bindings across multiple graph patterns', () => {
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

    expect(createSelectFactsOperationFromDatalogQuery(query)).toEqual({
      kind: 'select-facts',
      match: [
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
        {
          kind: 'edge',
          subject: {
            kind: 'variable',
            name: 'friend',
          },
          predicate: {
            kind: 'constant',
            value: 'graph/works-with',
          },
          object: {
            kind: 'variable',
            name: 'person',
          },
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

    expect(() => createSelectFactsOperationFromDatalogQuery(query)).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.query.unsupported-atom',
        message:
          'Select-facts queries only support Edge/3 and Vertex/1 graph atoms, received Likes/2.',
      }),
    );
  });

  it('throws a structured error when the query body is empty', () => {
    expect(() =>
      createSelectFactsOperationFromDatalogQuery({
        kind: 'query',
        body: [] as unknown as Parameters<
          typeof createSelectFactsOperationFromDatalogQuery
        >[0]['body'],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.query.empty-body',
        message: 'Select-facts queries require at least one graph atom.',
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

    expect(() => createSelectFactsOperationFromDatalogQuery(query)).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.query.unsupported-literal',
        message: 'Select-facts queries only support graph atom literals.',
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

    expect(() => createSelectFactsOperationFromDatalogQuery(query)).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.query.unsupported-term',
        message: 'Select-facts queries do not support named graph terms.',
      }),
    );
  });
});
