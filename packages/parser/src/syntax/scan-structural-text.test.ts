import { describe, expect, it } from 'vitest';

import {
  findMatchingStructuralCloseParen,
  forEachTopLevelStructuralCharacter,
} from './scan-structural-text.js';

describe('scan-structural-text', () => {
  it('visits only top-level structural characters across nested parentheses', () => {
    const indexes: number[] = [];
    const text = 'Edge(X, pair(left, right), wrapper(inner(one, two)), Z), Next';

    forEachTopLevelStructuralCharacter(text, (index) => {
      if (text[index] === ',') {
        indexes.push(index);
      }
    });

    expect(indexes).toEqual([text.indexOf(', Next')]);
  });

  it('ignores strings with structural punctuation and escaped quotes while scanning', () => {
    const indexes: number[] = [];
    const text = 'Outer("a,(b),%comment,\\"still string\\"", tail), after';

    forEachTopLevelStructuralCharacter(text, (index) => {
      if (text[index] === ',') {
        indexes.push(index);
      }
    });

    expect(indexes).toEqual([text.indexOf(', after')]);
  });

  it('skips percent comments when visiting top-level characters', () => {
    const indexes: number[] = [];
    const text = 'before, % ignore, nested(call)\nafter';

    forEachTopLevelStructuralCharacter(text, (index) => {
      if (text[index] === ',') {
        indexes.push(index);
      }
    });

    expect(indexes).toEqual([6]);
  });

  it('finds the matching closing paren while ignoring nested calls, strings, and comments', () => {
    const text = 'Outer(inner("text ) still string"), % comment )\n tail(value)) end';

    expect(findMatchingStructuralCloseParen(text, 5)).toBe(60);
  });
});
