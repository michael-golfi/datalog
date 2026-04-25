import type { DatalogFact } from '@datalog/ast';
import { describe, expect, it } from 'vitest';

import type { GraphTranslationError } from '../contracts/graph-translation-error.js';

import { validateDatalogFacts } from './validate-datalog-facts.js';

describe('validateDatalogFacts', () => {
  it('throws a structured error when insert facts are empty', () => {
    expect(() => validateDatalogFacts([], 'insert')).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.insert.invalid-fact',
        message: 'Insert facts require at least one fact.',
      }),
    );
  });

  it('throws a structured error when a vertex fact is missing its id', () => {
    expect(() =>
      validateDatalogFacts([
        {
          kind: 'vertex',
        } as unknown as DatalogFact,
      ], 'delete'),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.delete.invalid-fact',
        message: 'Delete facts must use non-empty identifiers.',
      }),
    );
  });

  it('throws a structured error when an edge fact is missing a required identifier', () => {
    expect(() =>
      validateDatalogFacts([
        {
          kind: 'edge',
          subjectId: 'vertex/alice',
          predicateId: 'graph/likes',
        } as unknown as DatalogFact,
      ], 'insert'),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.insert.invalid-fact',
        message: 'Insert facts must use non-empty identifiers.',
      }),
    );
  });

  it('accepts well-formed vertex and edge facts', () => {
    expect(() =>
      validateDatalogFacts([
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
      ], 'insert'),
    ).not.toThrow();
  });
});
