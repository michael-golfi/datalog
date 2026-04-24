import { describe, expect, it } from 'vitest';

import { parseDocument } from './parse-document.js';

interface PredicateSymbolLike {
  readonly identity: {
    readonly kind: string;
    readonly name: string;
    readonly arity: number;
  };
  readonly occurrences: ReadonlyArray<{
    readonly kind: string;
    readonly range: {
      readonly start: { readonly line: number; readonly character: number };
      readonly end: { readonly line: number; readonly character: number };
    };
  }>;
}

interface GraphNodeSymbolLike {
  readonly id: string;
  readonly references: ReadonlyArray<{
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
  }>;
}

interface CompoundFieldSymbolLike {
  readonly predicateName: string;
  readonly fieldName: string;
  readonly references: ReadonlyArray<{
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
  }>;
}

interface DatalogSymbolsLike {
  readonly predicates: readonly PredicateSymbolLike[];
  readonly graphNodes: readonly GraphNodeSymbolLike[];
  readonly compoundFields: readonly CompoundFieldSymbolLike[];
}

function getDatalogSymbols(source: string): DatalogSymbolsLike {
  const parsed = parseDocument(source) as { readonly datalogSymbols?: DatalogSymbolsLike };

  expect(parsed.datalogSymbols).toBeDefined();
  return parsed.datalogSymbols as DatalogSymbolsLike;
}

function getPredicateSymbol(
  symbols: DatalogSymbolsLike,
  kind: PredicateSymbolLike['identity']['kind'],
  name: string,
  arity: number,
): PredicateSymbolLike | undefined {
  return symbols.predicates.find((predicate) => (
    predicate.identity.kind === kind
    && predicate.identity.name === name
    && predicate.identity.arity === arity
  ));
}

describe('collectDatalogSymbols', () => {
  it('collects deterministic predicate, graph node, and compound field symbol identities', () => {
    const source = [
      '% ignored ParentInComment(value).',
      'parent("node/alice", "node/bob").',
      'parent("node/alice", "node/bob", "node/carla").',
      'ancestor(X, Y) :- parent(X, Y), Edge("node/alice", "graph/likes", "node/bob").',
      'parent(X, Y) :- Edge("node/alice", "graph/likes", "node/\\"quoted\\""), Serving@(serv/id="node/alice", serv/unit="unit/serving").',
      'DefPred("graph/likes", "1", "graph/node", "0", "graph/node").',
      'Edge("predicate(text with LooksLikePredicate(value))", "graph/likes", "node/bob").',
      'broken(',
    ].join('\r\n');

    const symbols = getDatalogSymbols(source);
    const userParent2 = getPredicateSymbol(symbols, 'user-predicate', 'parent', 2);
    const userParent3 = getPredicateSymbol(symbols, 'user-predicate', 'parent', 3);
    const builtinEdge3 = getPredicateSymbol(symbols, 'builtin-predicate', 'Edge', 3);
    const builtinDefPred5 = getPredicateSymbol(symbols, 'builtin-predicate', 'DefPred', 5);
    const looksLikePredicate = symbols.predicates.find((predicate) => predicate.identity.name === 'LooksLikePredicate');
    const quotedNode = symbols.graphNodes.find((graphNode) => graphNode.id === 'node/\\"quoted\\"');
    const servingIdField = symbols.compoundFields.find((field) => (
      field.predicateName === 'Serving' && field.fieldName === 'serv/id'
    ));
    const servingUnitField = symbols.compoundFields.find((field) => (
      field.predicateName === 'Serving' && field.fieldName === 'serv/unit'
    ));

    expect(userParent2?.occurrences).toEqual([
      {
        kind: 'head',
        range: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: 6 },
        },
      },
      {
        kind: 'body',
        range: {
          start: { line: 3, character: 18 },
          end: { line: 3, character: 24 },
        },
      },
      {
        kind: 'head',
        range: {
          start: { line: 4, character: 0 },
          end: { line: 4, character: 6 },
        },
      },
    ]);
    expect(userParent3?.occurrences).toEqual([
      {
        kind: 'head',
        range: {
          start: { line: 2, character: 0 },
          end: { line: 2, character: 6 },
        },
      },
    ]);
    expect(builtinEdge3?.occurrences).toEqual([
      {
        kind: 'body',
        range: {
          start: { line: 3, character: 32 },
          end: { line: 3, character: 36 },
        },
      },
      {
        kind: 'body',
        range: {
          start: { line: 4, character: 16 },
          end: { line: 4, character: 20 },
        },
      },
      {
        kind: 'head',
        range: {
          start: { line: 6, character: 0 },
          end: { line: 6, character: 4 },
        },
      },
    ]);
    expect(builtinDefPred5?.occurrences).toEqual([
      {
        kind: 'head',
        range: {
          start: { line: 5, character: 0 },
          end: { line: 5, character: 7 },
        },
      },
    ]);
    expect(looksLikePredicate).toBeUndefined();
    expect(quotedNode?.references).toEqual([
      {
        start: { line: 4, character: 51 },
        end: { line: 4, character: 66 },
      },
    ]);
    expect(servingIdField?.references).toEqual([
      {
        start: { line: 4, character: 79 },
        end: { line: 4, character: 86 },
      },
    ]);
    expect(servingUnitField?.references).toEqual([
      {
        start: { line: 4, character: 101 },
        end: { line: 4, character: 110 },
      },
    ]);
  });

  it('handles CRLF ranges and preserves valid symbol facts across partial parses', () => {
    const source = 'linked(X, Y) :- parent(X, Y).\r\nparent("node/alice", "node/bob").\r\nincomplete(';

    const symbols = getDatalogSymbols(source);
    const linked = getPredicateSymbol(symbols, 'user-predicate', 'linked', 2);
    const parent = getPredicateSymbol(symbols, 'user-predicate', 'parent', 2);
    const alice = symbols.graphNodes.find((graphNode) => graphNode.id === 'node/alice');

    expect(linked?.occurrences).toEqual([
      {
        kind: 'head',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 6 },
        },
      },
    ]);
    expect(parent?.occurrences).toEqual([
      {
        kind: 'body',
        range: {
          start: { line: 0, character: 16 },
          end: { line: 0, character: 22 },
        },
      },
      {
        kind: 'head',
        range: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: 6 },
        },
      },
    ]);
    expect(alice?.references).toEqual([
      {
        start: { line: 1, character: 8 },
        end: { line: 1, character: 18 },
      },
    ]);
  });
});
