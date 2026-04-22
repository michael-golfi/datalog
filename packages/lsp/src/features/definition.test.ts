import { describe, expect, it } from 'vitest';

import { DATALOG_SAMPLE } from './datalog-sample.js';
import { computeDefinition } from './definition.js';

describe('computeDefinition', () => {
  it('jumps from an Edge predicate id to its DefPred declaration', () => {
    const line = 'Edge("concept/chickpea_bowl", "food/has_cuisine", "cuisine/mediterranean").';
    const source = `${DATALOG_SAMPLE}\n${line}`;
    const result = computeDefinition(source, {
      line: source.split('\n').length - 1,
      character: line.indexOf('food/has_cuisine') + 5,
    }, 'file:///workspace/test.dl');
    const expectedLine = DATALOG_SAMPLE.split('\n').findIndex((entry) => entry.includes('DefPred("food/has_cuisine"'));

    expect(result?.targetSelectionRange.start.line).toBe(expectedLine);
  });
});
