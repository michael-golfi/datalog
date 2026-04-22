import { describe, expect, it } from 'vitest';

import { splitTopLevelArgs } from './split-top-level-args.js';

describe('splitTopLevelArgs', () => {
  it('splits nested terms without breaking on inner commas', () => {
    expect(splitTopLevelArgs('subject, pair(left, right), "a,b", wrapper(one, two)')).toEqual([
      'subject',
      'pair(left, right)',
      '"a,b"',
      'wrapper(one, two)',
    ]);
  });

  it('drops empty entries produced by whitespace', () => {
    expect(splitTopLevelArgs('first,  , second')).toEqual(['first', 'second']);
  });
});
