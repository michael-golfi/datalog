import { describe, expect, it } from 'vitest';

import { computeFoldingRanges } from './folding.js';

describe('computeFoldingRanges', () => {
  it('creates comment and multiline clause folding ranges', () => {
    const source = [
      '% heading',
      '% details',
      'Parent(child, parent) :-',
      '  Edge(child, "food/subclass_of", parent).',
    ].join('\n');
    const ranges = computeFoldingRanges(source);

    expect(ranges).toContainEqual({ startLine: 0, endLine: 1, kind: 'comment' });
    expect(ranges).toContainEqual({ startLine: 2, endLine: 3, kind: 'region' });
  });
});
