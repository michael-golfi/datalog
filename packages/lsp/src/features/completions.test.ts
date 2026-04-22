import { describe, expect, it } from 'vitest';

import { DATALOG_SAMPLE } from './datalog-sample.js';
import { computeCompletions } from './completions.js';

describe('computeCompletions', () => {
  it('suggests graph predicates inside Edge predicate position', () => {
    const source = `${DATALOG_SAMPLE}\nEdge("concept/chickpea_bowl", "food/`;
    const items = computeCompletions(source, {
      line: source.split('\n').length - 1,
      character: 'Edge("concept/chickpea_bowl", "food/'.length,
    });

    expect(items.map((item) => item.label)).toContain('food/has_cuisine');
    expect(items.map((item) => item.label)).toContain('food/preferred_label');
  });

  it('suggests rule predicates at clause start', () => {
    const source = `${DATALOG_SAMPLE}\nCla`;
    const items = computeCompletions(source, { line: source.split('\n').length - 1, character: 3 });

    expect(items.map((item) => item.label)).toContain('ClassAncestor');
    expect(items.map((item) => item.label)).not.toContain('DefPred');
  });

  it('suggests compound fields inside @ records', () => {
    const source = `${DATALOG_SAMPLE}\nServing@(serv/`;
    const items = computeCompletions(source, {
      line: source.split('\n').length - 1,
      character: 'Serving@(serv/'.length,
    });

    expect(items.map((item) => item.label)).toContain('serv/id=');
    expect(items.map((item) => item.label)).toContain('serv/subject=');
  });
});
