import { describe, expect, it } from 'vitest';

import type { DatalogFactPattern } from '@datalog/ast';

import { validateSelectFactsOperation } from './validate-select-facts-operation.js';

import type { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type { PredicateCatalog } from '../contracts/predicate-catalog.js';


const EMPTY_PREDICATE_CATALOG = {
  version: 1,
  predicates: [],
} satisfies PredicateCatalog;

describe('validateSelectFactsOperation', () => {
  it('throws a structured error for blank variable names', () => {
    expect(() =>
      validateSelectFactsOperation({
        kind: 'select-facts',
        predicateCatalog: EMPTY_PREDICATE_CATALOG,
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
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.query.invalid-term',
        message: 'Query variables must use non-empty names.',
      }),
    );
  });

  it('throws a structured error when an edge pattern is missing its predicate binding', () => {
    expect(() =>
      validateSelectFactsOperation({
        kind: 'select-facts',
        predicateCatalog: EMPTY_PREDICATE_CATALOG,
        match: [
          {
            kind: 'edge',
            subject: {
              kind: 'variable',
              name: 'person',
            },
            object: {
              kind: 'variable',
              name: 'friend',
            },
          } as unknown as DatalogFactPattern,
        ],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.query.invalid-term',
        message: 'Query fact patterns must include all required terms.',
      }),
    );
  });

  it('throws a structured error for blank constant values', () => {
    expect(() =>
      validateSelectFactsOperation({
        kind: 'select-facts',
        predicateCatalog: EMPTY_PREDICATE_CATALOG,
        match: [
          {
            kind: 'edge',
            subject: {
              kind: 'variable',
              name: 'person',
            },
            predicate: {
              kind: 'constant',
              value: '   ',
            },
            object: {
              kind: 'variable',
              name: 'friend',
            },
          },
        ],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.query.invalid-term',
        message: 'Query constants must use non-empty string values.',
      }),
    );
  });

  it('accepts valid select-facts operations with variables, constants, and wildcards', () => {
    expect(() =>
      validateSelectFactsOperation({
        kind: 'select-facts',
        predicateCatalog: EMPTY_PREDICATE_CATALOG,
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
              kind: 'wildcard',
            },
          },
        ],
      }),
    ).not.toThrow();
  });

  it('accepts generic predicate patterns when all terms are valid', () => {
    expect(() =>
      validateSelectFactsOperation({
        kind: 'select-facts',
        predicateCatalog: EMPTY_PREDICATE_CATALOG,
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
                kind: 'wildcard',
              },
            ],
          },
        ],
      }),
    ).not.toThrow();
  });
});
