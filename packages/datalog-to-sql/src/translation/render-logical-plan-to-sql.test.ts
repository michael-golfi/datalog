import { describe, expect, it } from 'vitest';

import { compileSelectFactsLogicalPlan } from './compile-select-facts-logical-plan.js';
import { DEFAULT_GRAPH_PREDICATE_CATALOG } from './default-graph-predicate-catalog.js';
import { renderLogicalPlanToSql } from './render-logical-plan-to-sql.js';

import type { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type { PredicateCatalog } from '../contracts/predicate-catalog.js';

describe('renderLogicalPlanToSql', () => {
  it('renders the shared logical plan for the likes query with explicit joins and parameters', () => {
    const plan = compileSelectFactsLogicalPlan(
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
      },
      DEFAULT_GRAPH_PREDICATE_CATALOG,
    );

    expect(renderLogicalPlanToSql(plan)).toEqual({
      operation: 'select',
      text: 'select distinct scan_1.id as "person", scan_2.object_id as "friend" from vertices scan_1 join edges scan_2 on scan_1.id = scan_2.subject_id and scan_2.predicate_id = $1;',
      values: ['graph/likes'],
    });
  });

  it('renders a filter-only logical plan as a select distinct with a where clause', () => {
    const plan = compileSelectFactsLogicalPlan(
      {
        kind: 'select-facts',
        match: [
          {
            kind: 'vertex',
            id: {
              kind: 'constant',
              value: 'vertex/alice',
            },
          },
        ],
      },
      DEFAULT_GRAPH_PREDICATE_CATALOG,
    );

    expect(renderLogicalPlanToSql(plan)).toEqual({
      operation: 'select',
      text: 'select distinct 1 from vertices scan_1 where scan_1.id = $1;',
      values: ['vertex/alice'],
    });
  });

  it('throws the structured graph translation error for unsupported predicate catalog lookups', () => {
    const plan = compileSelectFactsLogicalPlan(
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
      DEFAULT_GRAPH_PREDICATE_CATALOG,
    );

    const edgePredicate = DEFAULT_GRAPH_PREDICATE_CATALOG.predicates.find((predicate) => {
      return predicate.signature.name === 'edge' && predicate.signature.arity === 3;
    });

    if (edgePredicate === undefined) {
      throw new Error('Expected edge/3 predicate fixture to exist.');
    }

    const incompleteCatalog = {
      version: 1,
      predicates: [edgePredicate],
    } satisfies PredicateCatalog;

    const planWithIncompleteCatalog = {
      ...plan,
      catalog: incompleteCatalog,
    };

    expect(() => renderLogicalPlanToSql(planWithIncompleteCatalog)).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'UNSUPPORTED_GRAPH_PREDICATE',
        message: 'Unsupported graph predicate vertex/1.',
      }),
    );
  });
});
