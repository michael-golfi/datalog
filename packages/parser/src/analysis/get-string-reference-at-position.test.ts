import { describe, expect, it } from 'vitest';

import { getStringReferenceAtPosition } from './get-string-reference-at-position.js';

describe('getStringReferenceAtPosition', () => {
  it('finds a string reference at a source position', () => {
    const source = 'Edge("node/alice", "graph/likes", "node/bob").';

    expect(getStringReferenceAtPosition(source, { line: 0, character: 25 })).toMatchObject({
      value: 'graph/likes',
      role: 'graph-predicate',
    });
    expect(getStringReferenceAtPosition(source, { line: 0, character: 0 })).toBeNull();
  });
});
