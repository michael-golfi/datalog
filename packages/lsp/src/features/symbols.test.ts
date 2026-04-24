import { describe, expect, it } from 'vitest';

import { DATALOG_SAMPLE } from './datalog-sample.js';
import { computeDocumentSymbols } from './symbols.js';

describe('computeDocumentSymbols', () => {
  it('surfaces schema, compound, and rule symbols', () => {
    const symbols = computeDocumentSymbols(DATALOG_SAMPLE);

    expect(symbols.map((symbol) => symbol.name)).toContain('DefPred');
    expect(symbols.map((symbol) => symbol.name)).toContain('Serving@');
    expect(symbols.map((symbol) => symbol.name)).toContain('ClassAncestor');
  });

  it('groups repeated user predicate definitions by exact name and arity', () => {
    const source = [
      'Parent("alice", "bob").',
      'Parent("carol", "dave").',
      'Parent(child, parent) :-',
      '  Parent(child, "ancestor").',
      'Parent(subject, object, weight).',
    ].join('\n');

    const symbols = computeDocumentSymbols(source);
    const parent2 = symbols.find((symbol) => symbol.name === 'Parent/2');
    const parent3 = symbols.find((symbol) => symbol.name === 'Parent');

    expect(parent2).toMatchObject({
      name: 'Parent/2',
      detail: '3 definitions',
      range: {
        start: { line: 0, character: 0 },
        end: { line: 3, character: 28 },
      },
      selectionRange: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 6 },
      },
    });
    expect(parent2?.children).toHaveLength(3);
    expect(parent2?.children?.map((child) => child.name)).toEqual([
      'Parent',
      'Parent',
      'Parent',
    ]);
    expect(parent2?.children?.map((child) => child.range.start.line)).toEqual([0, 1, 2]);
    expect(parent2?.children?.every((child) => child.children === undefined)).toBe(true);

    expect(parent3).toMatchObject({
      name: 'Parent',
      detail: 'fact / arity 3',
      range: {
        start: { line: 4, character: 0 },
        end: { line: 4, character: 32 },
      },
      selectionRange: {
        start: { line: 4, character: 0 },
        end: { line: 4, character: 6 },
      },
    });
    expect(parent3?.children).toBeUndefined();
  });

  it('keeps valid symbols around malformed clauses when parsing can recover neighboring statements', () => {
    const source = [
      'Before("alpha").',
      ':- Before("missing").',
      'After(value) :-',
      '  Before(value).',
    ].join('\n');

    const symbols = computeDocumentSymbols(source);

    expect(symbols.map((symbol) => symbol.name)).toEqual(['Before', 'After']);
    expect(symbols).toEqual([
      expect.objectContaining({
        name: 'Before',
        detail: 'fact / arity 1',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 16 },
        },
      }),
      expect.objectContaining({
        name: 'After',
        detail: 'rule / arity 1',
        range: {
          start: { line: 2, character: 0 },
          end: { line: 3, character: 16 },
        },
      }),
    ]);
  });
});
