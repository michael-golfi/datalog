import { describe, expect, it } from 'vitest';

import { translateFactDelete } from './translate-fact-delete.js';

import type { GraphTranslationError } from '../contracts/graph-translation-error.js';

describe('translateFactDelete', () => {
  it('groups multiple vertex facts into a single delete CTE with stable placeholder ordering', () => {
    expect(
      translateFactDelete({
        kind: 'delete-facts',
        facts: [
          {
            kind: 'vertex',
            id: 'vertex/alice',
          },
          {
            kind: 'vertex',
            id: 'vertex/bob',
          },
        ],
      }),
    ).toEqual({
      operation: 'delete',
      text: 'with deleted_vertices as (delete from vertices where id in ($1, $2) returning id) select 1;',
      values: ['vertex/alice', 'vertex/bob'],
    });
  });

  it('groups multiple edge facts into one edge delete CTE with OR clauses in input order', () => {
    expect(
      translateFactDelete({
        kind: 'delete-facts',
        facts: [
          {
            kind: 'edge',
            subjectId: 'vertex/alice',
            predicateId: 'graph/likes',
            objectId: 'vertex/bob',
          },
          {
            kind: 'edge',
            subjectId: 'vertex/bob',
            predicateId: 'graph/likes',
            objectId: 'vertex/carol',
          },
        ],
      }),
    ).toEqual({
      operation: 'delete',
      text: 'with deleted_edges as (delete from edges where (subject_id = $1 and predicate_id = $2 and object_id = $3) or (subject_id = $4 and predicate_id = $5 and object_id = $6) returning subject_id, predicate_id, object_id) select 1;',
      values: [
        'vertex/alice',
        'graph/likes',
        'vertex/bob',
        'vertex/bob',
        'graph/likes',
        'vertex/carol',
      ],
    });
  });

  it('combines vertex and edge facts into a single delete mutation surface with stable placeholder ordering', () => {
    expect(
      translateFactDelete({
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
          {
            kind: 'vertex',
            id: 'vertex/bob',
          },
        ],
      }),
    ).toEqual({
      operation: 'delete',
      text: 'with deleted_vertices as (delete from vertices where id in ($1, $2) returning id), deleted_edges as (delete from edges where (subject_id = $3 and predicate_id = $4 and object_id = $5) returning subject_id, predicate_id, object_id) select 1;',
      values: ['vertex/alice', 'vertex/bob', 'vertex/alice', 'graph/likes', 'vertex/bob'],
    });
  });

  it('throws a structured error when delete facts are empty', () => {
    expect(() =>
      translateFactDelete({
        kind: 'delete-facts',
        facts: [] as unknown as Parameters<typeof translateFactDelete>[0]['facts'],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.delete.invalid-fact',
        message: 'Delete facts require at least one fact.',
      }),
    );
  });
});
