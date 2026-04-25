import { describe, expect, it } from 'vitest';

import type { GraphTranslationError } from '../contracts/graph-translation-error.js';

import { compileSelectFactsLogicalPlan } from './compile-select-facts-logical-plan.js';
import { createCatalogMissingVertexPredicate } from './compile-select-facts-logical-plan.fixtures.js';

describe('compileSelectFactsLogicalPlan errors', () => {
  it('throws a structured graph translation error when the graph catalog is missing a required predicate', () => {
    expect(() =>
      compileSelectFactsLogicalPlan(
        {
          kind: 'select-facts',
          predicateCatalog: createCatalogMissingVertexPredicate(),
          match: [{ kind: 'vertex', id: { kind: 'variable', name: 'person' } }],
        },
        createCatalogMissingVertexPredicate(),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'UNSUPPORTED_GRAPH_PREDICATE',
        message: 'Unsupported graph predicate vertex/1.',
      }),
    );
  });
});
