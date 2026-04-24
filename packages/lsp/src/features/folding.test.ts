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

  it('folds contiguous comment blocks with LF and CRLF inputs the same way', () => {
    const logicalLines = [
      '% heading',
      '% details',
      '',
      'Parent(child, parent) :-',
      '  Edge(child, "food/subclass_of", parent).',
    ];
    const expectedRanges = [
      { startLine: 0, endLine: 1, kind: 'comment' },
      { startLine: 3, endLine: 4, kind: 'region' },
    ];

    expect(computeFoldingRanges(logicalLines.join('\n'))).toEqual(expectedRanges);
    expect(computeFoldingRanges(logicalLines.join('\r\n'))).toEqual(expectedRanges);
  });

  it('folds incomplete multiline clauses only when the parser returns a valid multiline clause range', () => {
    const source = [
      'Parent(child, parent) :-',
      '  Edge(child, "food/subclass_of", parent)',
    ].join('\n');

    expect(computeFoldingRanges(source)).toEqual([
      { startLine: 0, endLine: 1, kind: 'region' },
    ]);
  });

  it('never emits single-line or inverted ranges for malformed input', () => {
    const source = [
      '% comment',
      'Parent(child, parent).',
      ':- invalid(',
    ].join('\n');

    expect(computeFoldingRanges(source)).toEqual([]);
  });

  it('keeps trailing comment block folds in source order after clause folds', () => {
    const source = [
      'Parent(child, parent) :-',
      '  Edge(child, "food/subclass_of", parent).',
      '% trailing heading',
      '% trailing details',
    ].join('\n');

    expect(computeFoldingRanges(source)).toEqual([
      { startLine: 0, endLine: 1, kind: 'region' },
      { startLine: 2, endLine: 3, kind: 'comment' },
    ]);
  });
});
