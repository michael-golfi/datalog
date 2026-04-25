import { describe, expect, it } from 'vitest';

import { validateGraphOperation } from './validate-graph-operation.js';

import type { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type { PostgresGraphOperation } from '../contracts/postgres-graph-operation.js';

describe('validateGraphOperation', () => {
  it('throws a structured error for unsupported operation kinds', () => {
    expect(() =>
      validateGraphOperation({ kind: 'bogus' } as unknown as PostgresGraphOperation),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.operation.invalid-kind',
        message: 'Graph operations must use a supported kind.',
      }),
    );
  });

  it.each([
    { kind: 'select-vertex-by-id' },
    { kind: 'select-facts' },
    { kind: 'insert-facts' },
    { kind: 'delete-facts' },
    { kind: 'select-recursive-closure-count', rootVertexId: 'vertex/root' },
    { kind: 'select-recursive-closure-count', predicateId: 'graph/reachable' },
  ])('throws a structured error when %j is missing required fields', (operation) => {
    expect(() =>
      validateGraphOperation(operation as unknown as PostgresGraphOperation),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.operation.invalid-shape',
        message: 'Graph operations must include the required fields for their kind.',
      }),
    );
  });

  it.each<PostgresGraphOperation>([
    {
      kind: 'select-vertex-by-id',
      vertexId: 'vertex/alice',
    },
    {
      kind: 'select-edges',
      where: {
        predicateId: 'graph/likes',
      },
    },
    {
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
    },
    {
      kind: 'insert-facts',
      facts: [
        {
          kind: 'vertex',
          id: 'vertex/alice',
        },
      ],
    },
    {
      kind: 'delete-facts',
      facts: [
        {
          kind: 'edge',
          subjectId: 'vertex/alice',
          predicateId: 'graph/likes',
          objectId: 'vertex/bob',
        },
      ],
    },
    {
      kind: 'select-recursive-closure-count',
      rootVertexId: 'vertex/root',
      predicateId: 'graph/reachable',
    },
    {
      kind: 'insert-facts',
      facts: [],
    } as unknown as PostgresGraphOperation,
    {
      kind: 'delete-facts',
      facts: [],
    } as unknown as PostgresGraphOperation,
  ])('accepts valid %s operations', (operation) => {
    expect(() => validateGraphOperation(operation)).not.toThrow();
  });
});
