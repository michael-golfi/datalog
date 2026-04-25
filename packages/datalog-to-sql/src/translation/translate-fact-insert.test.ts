import { describe, expect, it } from 'vitest';

import type { GraphTranslationError } from '../contracts/graph-translation-error.js';

import { translateFactInsert } from './translate-fact-insert.js';

describe('translateFactInsert', () => {
  it('groups multiple vertex facts into a single insert CTE with stable placeholder ordering', () => {
    expect(
      translateFactInsert({
        kind: 'insert-facts',
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
      operation: 'insert',
      text: 'with inserted_vertices as (insert into vertices (id) values ($1), ($2) on conflict do nothing returning id) select 1;',
      values: ['vertex/alice', 'vertex/bob'],
    });
  });

  it('groups multiple edge facts into one edge insert CTE with sequential parameters', () => {
    expect(
      translateFactInsert({
        kind: 'insert-facts',
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
      operation: 'insert',
      text: 'with inserted_edges as (insert into edges (subject_id, predicate_id, object_id) values ($1, $2, $3), ($4, $5, $6) on conflict do nothing returning subject_id, predicate_id, object_id) select 1;',
      values: ['vertex/alice', 'graph/likes', 'vertex/bob', 'vertex/bob', 'graph/likes', 'vertex/carol'],
    });
  });

  it('combines vertex and edge facts into a single mutation surface with stable placeholder ordering', () => {
    expect(
      translateFactInsert({
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
          {
            kind: 'vertex',
            id: 'vertex/bob',
          },
        ],
      }),
    ).toEqual({
      operation: 'insert',
      text: 'with inserted_vertices as (insert into vertices (id) values ($1), ($2) on conflict do nothing returning id), inserted_edges as (insert into edges (subject_id, predicate_id, object_id) values ($3, $4, $5) on conflict do nothing returning subject_id, predicate_id, object_id) select 1;',
      values: ['vertex/alice', 'vertex/bob', 'vertex/alice', 'graph/likes', 'vertex/bob'],
    });
  });

  it('throws a structured error when insert facts are empty', () => {
    expect(() =>
      translateFactInsert({
        kind: 'insert-facts',
        facts: [] as unknown as Parameters<typeof translateFactInsert>[0]['facts'],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.insert.invalid-fact',
        message: 'Insert facts require at least one fact.',
      }),
    );
  });
});
