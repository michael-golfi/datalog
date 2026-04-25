import { describe, expect, it } from 'vitest';

import { computeLineStarts } from '../syntax/line-starts.js';

import { parseDatalogLiteral } from './parse-datalog-literal.js';
import { parseStandaloneQuery } from './parse-datalog-statement.js';

function parseLiteral(source: string) {
  return parseDatalogLiteral({
    context: { source, lineStarts: computeLineStarts(source) },
    slice: { startOffset: 0, endOffset: source.length },
  });
}

describe('parseDatalogLiteral', () => {
  it('parses negated atoms without leaking the not prefix into the atom', () => {
    expect(parseLiteral('not Edge(X, "graph/likes", Y)')).toMatchObject({
      kind: 'not',
      atom: {
        kind: 'atom',
        predicate: 'Edge',
        terms: [
          { kind: 'variable', name: 'X' },
          { kind: 'constant', value: 'graph/likes' },
          { kind: 'variable', name: 'Y' },
        ],
      },
    });
  });

  it('parses equality and inequality comparisons as comparison literals', () => {
    expect(parseLiteral('X = "value"')).toMatchObject({
      kind: 'comparison',
      operator: '=',
      left: { kind: 'variable', name: 'X' },
      right: { kind: 'constant', value: 'value' },
    });
    expect(parseLiteral('X != Y')).toMatchObject({
      kind: 'comparison',
      operator: '!=',
      left: { kind: 'variable', name: 'X' },
      right: { kind: 'variable', name: 'Y' },
    });
  });

  it('parses multi-literal conjunctions through the standalone query surface', () => {
    const parsed = parseStandaloneQuery('Edge(X, "graph/likes", Y), not Blocked(Y), X != _.', computeLineStarts('Edge(X, "graph/likes", Y), not Blocked(Y), X != _.'));

    expect(parsed.body).toMatchObject([
      { kind: 'atom', predicate: 'Edge' },
      {
        kind: 'not',
        atom: { kind: 'atom', predicate: 'Blocked' },
      },
      {
        kind: 'comparison',
        operator: '!=',
      },
    ]);
  });

  it('rejects empty conjunctions in standalone queries and rule bodies', () => {
    expect(() => parseStandaloneQuery('?-   .', computeLineStarts('?-   .'))).toThrow(
      'Datalog query/rule body must contain at least one literal',
    );
  });
});
