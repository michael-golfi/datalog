import { describe, expect, it } from 'vitest';

import { graphPredicateCatalog } from './compile-select-facts-logical-plan.fixtures.js';
import { compileSelectFactsLogicalPlan } from './compile-select-facts-logical-plan.js';

describe('compileSelectFactsLogicalPlan rebinding', () => {
  it('rebinds variable references to wrapper nodes when filters feed joins', () => {
    const plan = compileSelectFactsLogicalPlan(
      {
        kind: 'select-facts',
        predicateCatalog: graphPredicateCatalog,
        match: [
          {
            kind: 'edge',
            subject: { kind: 'variable', name: 'person' },
            predicate: { kind: 'constant', value: 'graph/likes' },
            object: { kind: 'variable', name: 'friend' },
          },
          {
            kind: 'edge',
            subject: { kind: 'variable', name: 'friend' },
            predicate: { kind: 'constant', value: 'graph/likes' },
            object: { kind: 'variable', name: 'colleague' },
          },
        ],
      },
      graphPredicateCatalog,
    );

    expect(plan.kind).toBe('logical-plan');
    expect(plan.catalog.version).toBe(1);
    expect(plan.rootNodeId).toBe('distinct_1');
    expect(plan.nodes.join_1).toMatchObject({
      kind: 'join',
      id: 'join_1',
      leftNodeId: 'filter_1',
      rightNodeId: 'filter_2',
      conditions: [
        {
          kind: 'equi',
          left: { kind: 'column', nodeId: 'filter_1', columnId: 'scan_1.object_id' },
          right: { kind: 'column', nodeId: 'filter_2', columnId: 'scan_2.subject_id' },
        },
      ],
    });

    expect(plan.nodes.project_1).toMatchObject({
      kind: 'project',
      id: 'project_1',
      inputNodeId: 'join_1',
      projections: [
        {
          name: 'person',
          expression: { kind: 'column', nodeId: 'join_1', columnId: 'scan_1.subject_id' },
          type: 'text',
        },
        {
          name: 'friend',
          expression: { kind: 'column', nodeId: 'join_1', columnId: 'scan_1.object_id' },
          type: 'text',
        },
        {
          name: 'colleague',
          expression: { kind: 'column', nodeId: 'join_1', columnId: 'scan_2.object_id' },
          type: 'text',
        },
      ],
    });
  });
});
