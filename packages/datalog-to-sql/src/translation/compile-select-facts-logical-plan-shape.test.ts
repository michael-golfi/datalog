import { describe, expect, it } from 'vitest';

import { compileSelectFactsLogicalPlan } from './compile-select-facts-logical-plan.js';
import { graphPredicateCatalog } from './compile-select-facts-logical-plan.fixtures.js';

describe('compileSelectFactsLogicalPlan shape', () => {
  it('compiles the likes query into the shared logical-plan node graph', () => {
    const plan = compileSelectFactsLogicalPlan(
      {
        kind: 'select-facts',
        match: [
          { kind: 'vertex', id: { kind: 'variable', name: 'person' } },
          {
            kind: 'edge',
            subject: { kind: 'variable', name: 'person' },
            predicate: { kind: 'constant', value: 'graph/likes' },
            object: { kind: 'variable', name: 'friend' },
          },
        ],
      },
      graphPredicateCatalog,
    );

    expect(plan.kind).toBe('logical-plan');
    expect(plan.catalog.version).toBe(1);
    expect(plan.rootNodeId).toBe('distinct_1');
    expect(plan.nodes[plan.rootNodeId]).toEqual({
      kind: 'distinct',
      id: 'distinct_1',
      inputNodeId: 'project_1',
      output: [
        { id: 'person', name: 'person', type: 'text' },
        { id: 'friend', name: 'friend', type: 'text' },
      ],
      keyColumns: ['person', 'friend'],
    });

    expect(plan.nodes).toMatchObject({
      scan_1: { kind: 'scan', id: 'scan_1', predicate: 'vertex', output: [{ id: 'scan_1.id', name: 'id', type: 'text' }] },
      scan_2: {
        kind: 'scan',
        id: 'scan_2',
        predicate: 'edge',
        output: [
          { id: 'scan_2.subject_id', name: 'subject_id', type: 'text' },
          { id: 'scan_2.predicate_id', name: 'predicate_id', type: 'text' },
          { id: 'scan_2.object_id', name: 'object_id', type: 'text' },
        ],
      },
      filter_2: {
        kind: 'filter',
        id: 'filter_2',
        inputNodeId: 'scan_2',
        predicate: {
          kind: 'comparison',
          operator: '=',
          left: { kind: 'column', nodeId: 'scan_2', columnId: 'scan_2.predicate_id' },
          right: { kind: 'literal', value: 'graph/likes', type: 'text' },
        },
      },
      join_1: {
        kind: 'join',
        id: 'join_1',
        joinKind: 'inner',
        leftNodeId: 'scan_1',
        rightNodeId: 'filter_2',
        conditions: [
          {
            kind: 'equi',
            left: { kind: 'column', nodeId: 'scan_1', columnId: 'scan_1.id' },
            right: { kind: 'column', nodeId: 'filter_2', columnId: 'scan_2.subject_id' },
          },
        ],
      },
      project_1: {
        kind: 'project',
        id: 'project_1',
        inputNodeId: 'join_1',
        output: [
          { id: 'person', name: 'person', type: 'text' },
          { id: 'friend', name: 'friend', type: 'text' },
        ],
        projections: [
          { name: 'person', expression: { kind: 'column', nodeId: 'join_1', columnId: 'scan_1.id' }, type: 'text' },
          { name: 'friend', expression: { kind: 'column', nodeId: 'join_1', columnId: 'scan_2.object_id' }, type: 'text' },
        ],
      },
    });
  });
});
