import { describe, expect, it } from 'vitest';

import { classifyReferenceRole } from './reference-role-classifier.js';

describe('classifyReferenceRole', () => {
  it('treats edge predicates and meta nodes as graph-aware references', () => {
    expect(classifyReferenceRole('DefPred', 0, 'graph/likes')).toBe('graph-predicate');
    expect(classifyReferenceRole('Edge', 1, 'food/instance_of')).toBe('graph-predicate');
    expect(classifyReferenceRole('Edge', 2, 'meta/domain_class')).toBe('node-id');
    expect(classifyReferenceRole('Other', 0, 'plain label')).toBe('label');
  });
});
