import { describe, expect, it } from 'vitest';

import {
  createDatalogVirtualFilename,
  createVirtualDatalogSource,
  extractDatalogSource,
  offsetToLoc,
  remapDatalogMessages,
} from './datalog-source.js';

describe('datalog source helpers', () => {
  it('wraps and unwraps virtual datalog source text', () => {
    const source = 'Edge("a", "b", "c").';
    expect(extractDatalogSource(createVirtualDatalogSource(source))).toBe(source);
  });

  it('creates a stable virtual filename suffix', () => {
    expect(createDatalogVirtualFilename('/tmp/file.dl')).toBe('/tmp/file.dl.__datalog__');
  });

  it('remaps processed message line numbers back to the original datalog file', () => {
    expect(
      remapDatalogMessages([[{ line: 3, column: 0, ruleId: 'x', message: 'oops', severity: 2 }]]),
    ).toEqual([{ line: 2, column: 0, ruleId: 'x', message: 'oops', severity: 2 }]);
  });

  it('calculates line and column offsets from source text', () => {
    expect(offsetToLoc('foo\nbar', 5)).toEqual({ line: 2, column: 1 });
  });
});
