import { describe, expect, it } from 'vitest';

import { computeLineStarts } from '../syntax/line-starts.js';

import { parseDatalogTerm } from './parse-datalog-term.js';

function parseTerm(source: string) {
  return parseDatalogTerm({
    context: { source, lineStarts: computeLineStarts(source) },
    slice: { startOffset: 0, endOffset: source.length },
  });
}

describe('parseDatalogTerm', () => {
  it('parses uppercase identifiers as variables while preserving the source span', () => {
    expect(parseTerm('X')).toMatchObject({
      kind: 'variable',
      name: 'X',
      location: {
        startOffset: 0,
        endOffset: 1,
      },
    });
    expect(parseTerm('NodeA')).toMatchObject({
      kind: 'variable',
      name: 'NodeA',
    });
  });

  it('parses quoted strings and lowercase primitive constants', () => {
    expect(parseTerm('"hello"')).toMatchObject({ kind: 'constant', value: 'hello' });
    expect(parseTerm('true')).toMatchObject({ kind: 'constant', value: true });
    expect(parseTerm('null')).toMatchObject({ kind: 'constant', value: null });
  });

  it('parses underscores as wildcards', () => {
    expect(parseTerm('_')).toMatchObject({ kind: 'wildcard' });
  });

  it('rejects empty or whitespace-only input instead of producing an empty-name variable', () => {
    expect(() => parseTerm('')).toThrow('Expected Datalog term');
    expect(() => parseTerm('   \t\n')).toThrow('Expected Datalog term');
  });
});
