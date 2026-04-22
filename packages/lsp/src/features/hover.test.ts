import { describe, expect, it } from 'vitest';

import { DATALOG_SAMPLE } from './datalog-sample.js';
import { computeHover } from './hover.js';

describe('computeHover', () => {
  it('describes graph predicate schema from DefPred', () => {
    const line = 'Edge("concept/chickpea_bowl", "food/has_cuisine", "cuisine/mediterranean").';
    const source = `${DATALOG_SAMPLE}\n${line}`;
    const hover = computeHover(source, {
      line: source.split('\n').length - 1,
      character: line.indexOf('food/has_cuisine') + 4,
    });

    expect(hover?.contents).toContain('Graph predicate contract');
    expect(hover?.contents).toContain('liquid/node');
  });

  it('describes nodes using self-describing graph metadata', () => {
    const line = 'Edge("concept/chickpea_bowl", "food/has_cuisine", "cuisine/mediterranean").';
    const source = `${DATALOG_SAMPLE}\n${line}`;
    const hover = computeHover(source, {
      line: source.split('\n').length - 1,
      character: line.indexOf('concept/chickpea_bowl') + 2,
    });

    expect(hover?.contents).toContain('FoodConcept');
    expect(hover?.contents).toContain('concept/chickpea_bowl');
  });
});
