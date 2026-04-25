import { describe, expect, it } from 'vitest';

import {
  findTopLevelComparisonOperator,
  findTopLevelRuleDivider,
  splitTopLevelConjunction,
} from './top-level-scan.js';

describe('top-level-scan', () => {
  it('finds the rule divider only at the top level', () => {
    expect(findTopLevelRuleDivider('Reachable(X) :- Edge(X, ":-", Y), Note("a :- b")')).toBe(13);
  });

  it('finds top-level comparison operators but ignores operators inside atoms and strings', () => {
    expect(findTopLevelComparisonOperator('Compare(X, "a=b")')).toBeNull();
    expect(findTopLevelComparisonOperator('X != Wrapped("a=b")')).toEqual({ operator: '!=', index: 2 });
  });

  it('splits conjunctions on top-level commas only', () => {
    expect(splitTopLevelConjunction('Edge(X, pair(left, right), "a,b"), not Blocked(X), X = "ok"')).toEqual([
      'Edge(X, pair(left, right), "a,b")',
      'not Blocked(X)',
      'X = "ok"',
    ]);
  });
});
