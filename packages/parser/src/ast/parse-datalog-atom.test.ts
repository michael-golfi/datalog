import { describe, expect, it } from 'vitest';

import { computeLineStarts } from '../syntax/line-starts.js';

import { parseDatalogAtom } from './parse-datalog-atom.js';

function parseAtom(source: string) {
  return parseDatalogAtom({
    context: { source, lineStarts: computeLineStarts(source) },
    slice: { startOffset: 0, endOffset: source.length },
  });
}

describe('parseDatalogAtom', () => {
  it('parses simple atoms with positional arguments', () => {
    expect(parseAtom('Edge(X, "graph/likes", Y)')).toMatchObject({
      kind: 'atom',
      predicate: 'Edge',
      terms: [
        { kind: 'variable', name: 'X' },
        { kind: 'constant', value: 'graph/likes' },
        { kind: 'variable', name: 'Y' },
      ],
    });
  });

  it('parses compound atoms with named arguments introduced by equals signs', () => {
    expect(parseAtom('Serving@(id=X, unit="g")')).toMatchObject({
      kind: 'atom',
      predicate: 'Serving',
      terms: [
        {
          kind: 'named',
          name: 'id',
          term: { kind: 'variable', name: 'X' },
        },
        {
          kind: 'named',
          name: 'unit',
          term: { kind: 'constant', value: 'g' },
        },
      ],
    });
  });

  it('keeps mixed quoted and unquoted arguments in order', () => {
    expect(parseAtom('Label(X, "hello", true, _)')).toMatchObject({
      terms: [
        { kind: 'variable', name: 'X' },
        { kind: 'constant', value: 'hello' },
        { kind: 'constant', value: true },
        { kind: 'wildcard' },
      ],
    });
  });

  it('supports atoms with an empty argument list', () => {
    expect(parseAtom('Ready()')).toMatchObject({
      kind: 'atom',
      predicate: 'Ready',
      terms: [],
    });
  });
});
