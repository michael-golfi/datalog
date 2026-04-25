import { parseDocument } from '@datalog/parser';
import { describe, expect, it } from 'vitest';

import type { SemanticToken } from './semantic-tokens.js';
import {
  collectCommentSpans,
  collectVariableTokens,
  dedupeSemanticTokens,
  rangeToOffsetSpan,
  sortSemanticTokens,
} from './semantic-token-helpers.js';

describe('collectCommentSpans', () => {
  it('collects a single inline percent comment span', () => {
    expect(collectCommentSpans('% comment')).toEqual([
      { startOffset: 0, endOffset: 9 },
    ]);
  });

  it('collects consecutive comment lines as distinct spans', () => {
    expect(collectCommentSpans('% comment\n% more')).toEqual([
      { startOffset: 0, endOffset: 9 },
      { startOffset: 10, endOffset: 16 },
    ]);
  });

  it('returns no spans when the source contains no comments', () => {
    expect(collectCommentSpans('Edge("literal % sign", "class/Thing").')).toEqual([]);
  });
});

describe('collectVariableTokens', () => {
  it('collects lowercase and underscore variables while skipping predicate names and string contents', () => {
    const source = [
      'rule(_, lower_case) :-',
      '  Edge(lower_case, "food/text", "literal _ ignored"),',
      '  local_predicate(lower_case).',
    ].join('\n');
    const parsedDocument = parseDocument(source);
    const occupiedSpans = parsedDocument.clauses.flatMap((clause) => [
      ...clause.occurrences.map((occurrence) => rangeToOffsetSpan(occurrence.range, parsedDocument.lineStarts)),
      ...clause.references.map((reference) => rangeToOffsetSpan(reference.range, parsedDocument.lineStarts)),
      ...clause.compoundFieldOccurrences.map((occurrence) => rangeToOffsetSpan(occurrence.range, parsedDocument.lineStarts)),
    ]);

    expect(toTokenTuples(collectVariableTokens({
      source,
      lineStarts: parsedDocument.lineStarts,
      occupiedSpans,
    }))).toEqual([
      [0, 5, 1, 'variable'],
      [0, 8, 10, 'variable'],
      [1, 7, 10, 'variable'],
      [2, 18, 10, 'variable'],
    ]);
  });

  it('does not emit tokens from uppercase identifiers under the current lowercase-variable convention', () => {
    const source = 'Rule(X).';
    const parsedDocument = parseDocument(source);

    expect(collectVariableTokens({
      source,
      lineStarts: parsedDocument.lineStarts,
      occupiedSpans: parsedDocument.clauses.flatMap((clause) => clause.occurrences.map((occurrence) => rangeToOffsetSpan(occurrence.range, parsedDocument.lineStarts))),
    })).toEqual([]);
  });
});

describe('sortSemanticTokens', () => {
  it('orders tokens by line and then start offset', () => {
    const tokens: SemanticToken[] = [
      { line: 2, startChar: 4, length: 3, tokenType: 'variable' },
      { line: 0, startChar: 8, length: 4, tokenType: 'function' },
      { line: 0, startChar: 2, length: 1, tokenType: 'comment' },
      { line: 1, startChar: 0, length: 5, tokenType: 'property' },
    ];

    expect(sortSemanticTokens(tokens)).toEqual([
      { line: 0, startChar: 2, length: 1, tokenType: 'comment' },
      { line: 0, startChar: 8, length: 4, tokenType: 'function' },
      { line: 1, startChar: 0, length: 5, tokenType: 'property' },
      { line: 2, startChar: 4, length: 3, tokenType: 'variable' },
    ]);
  });
});

describe('dedupeSemanticTokens', () => {
  it('removes duplicate overlapping token entries while preserving unique tokens', () => {
    const duplicateToken: SemanticToken = {
      line: 1,
      startChar: 2,
      length: 10,
      tokenType: 'variable',
    };

    expect(dedupeSemanticTokens([
      duplicateToken,
      { ...duplicateToken },
      { line: 1, startChar: 20, length: 4, tokenType: 'string' },
    ])).toEqual([
      duplicateToken,
      { line: 1, startChar: 20, length: 4, tokenType: 'string' },
    ]);
  });
});

function toTokenTuples(tokens: readonly SemanticToken[]): Array<[
  number,
  number,
  number,
  SemanticToken['tokenType'],
]> {
  return tokens.map((token) => [
    token.line,
    token.startChar,
    token.length,
    token.tokenType,
  ]);
}
