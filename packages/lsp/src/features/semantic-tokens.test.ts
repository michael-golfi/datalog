import { describe, expect, it } from 'vitest';

import {
  computeSemanticTokens,
  encodeSemanticTokens,
  SEMANTIC_TOKEN_MODIFIERS,
  SEMANTIC_TOKEN_TYPES,
} from './semantic-tokens.js';

import type { SemanticToken } from './semantic-tokens.js';

describe('computeSemanticTokens', () => {
  it('keeps the semantic token legend order stable', () => {
    expect(SEMANTIC_TOKEN_TYPES).toEqual(['comment', 'function', 'property', 'string', 'variable']);
    expect(SEMANTIC_TOKEN_MODIFIERS).toEqual(['definition']);
  });

  it('classifies predicates, builtins, variables, graph refs, strings, comments, and compound fields', () => {
    const source = [
      '% Edge(subject_id, "class/Comment").',
      'UserRule(subject_id) :-',
      '  Edge(subject_id, "food/preferred_label", "literal Edge(subject_id)"),',
      '  Related(subject_id, "class/Thing"),',
      '  Serving@(serv/id="serv/1", serv/subject=subject_id).',
    ].join('\n');

    expect(toTokenTuples(computeSemanticTokens(source))).toEqual([
      [0, 0, 36, 'comment', []],
      [1, 0, 8, 'function', ['definition']],
      [1, 9, 10, 'variable', []],
      [2, 2, 4, 'function', []],
      [2, 7, 10, 'variable', []],
      [2, 20, 20, 'property', []],
      [2, 44, 24, 'string', []],
      [3, 2, 7, 'function', []],
      [3, 10, 10, 'variable', []],
      [3, 23, 11, 'property', []],
      [4, 2, 7, 'function', []],
      [4, 11, 7, 'property', []],
      [4, 20, 6, 'property', []],
      [4, 29, 12, 'property', []],
      [4, 42, 10, 'variable', []],
    ]);
  });

  it('does not emit predicate or graph-ref tokens for comment and string lookalikes', () => {
    const source = ['% Related(subject_id, "class/Fake").', 'Text("Serving@(serv_id)").'].join(
      '\n',
    );

    const tokens = computeSemanticTokens(source);

    expect(toTokenTuples(tokens)).toEqual([
      [0, 0, 36, 'comment', []],
      [1, 0, 4, 'function', ['definition']],
      [1, 6, 17, 'string', []],
    ]);
    expect(tokens.filter((token) => token.tokenType === 'function')).toHaveLength(1);
    expect(tokens.filter((token) => token.tokenType === 'property')).toHaveLength(0);
  });

  it('encodes semantic tokens in stable LSP delta format', () => {
    const source = ['UserRule(subject_id) :-', '  Edge(subject_id, "class/Thing").'].join('\n');

    expect(encodeSemanticTokens(computeSemanticTokens(source))).toEqual([
      0, 0, 8, 1, 1, 0, 9, 10, 4, 0, 1, 2, 4, 1, 0, 0, 5, 10, 4, 0, 0, 13, 11, 2, 0,
    ]);
  });
});

function toTokenTuples(
  tokens: readonly SemanticToken[],
): Array<[number, number, number, SemanticToken['tokenType'], string[]]> {
  return tokens.map((token) => [
    token.line,
    token.startChar,
    token.length,
    token.tokenType,
    [...(token.tokenModifiers ?? [])],
  ]);
}
