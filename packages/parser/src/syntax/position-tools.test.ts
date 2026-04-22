import { describe, expect, it } from 'vitest';

import { computeLineStarts } from './line-starts.js';
import { getWordRangeAtPosition, offsetToPosition, positionToOffset } from './position-tools.js';

describe('position helpers', () => {
  it('converts offsets and positions consistently', () => {
    const lineStarts = computeLineStarts('alpha\nbeta');

    expect(offsetToPosition(lineStarts, 7)).toEqual({ line: 1, character: 1 });
    expect(positionToOffset(lineStarts, { line: 1, character: 2 })).toBe(8);
  });

  it('returns a word range only when the cursor is on a word character', () => {
    const source = 'Edge("node/alice", "graph/likes", "node/bob").';

    expect(getWordRangeAtPosition(source, { line: 0, character: 21 })).toEqual({
      start: { line: 0, character: 20 },
      end: { line: 0, character: 31 },
    });
    expect(getWordRangeAtPosition(source, { line: 0, character: 5 })).toBeNull();
  });
});
