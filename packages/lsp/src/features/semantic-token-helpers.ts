import { offsetToPosition, positionToOffset } from '@datalog/parser';

import type { SemanticToken } from './semantic-tokens.js';

export interface SourceSpan {
  readonly startOffset: number;
  readonly endOffset: number;
}

/** Collect inline `%` comment spans while respecting quoted strings. */
export function collectCommentSpans(source: string): SourceSpan[] {
  const commentSpans: SourceSpan[] = [];
  let inString = false;
  let commentStart: number | null = null;

  for (let index = 0; index < source.length; index += 1) {
    ({ commentStart, inString } = scanCommentCharacter({ source, index, commentSpans, commentStart, inString }));
  }

  if (commentStart !== null) {
    appendTrailingCommentSpan(commentSpans, commentStart, source.length);
  }

  return commentSpans;
}

/** Collect variable tokens that are not already occupied by parser-backed spans. */
export function collectVariableTokens(input: {
  readonly source: string;
  readonly lineStarts: readonly number[];
  readonly occupiedSpans: readonly SourceSpan[];
}): SemanticToken[] {
  const tokens: SemanticToken[] = [];

  for (let index = 0; index < input.source.length; index += 1) {
    const tokenBounds = getVariableTokenBounds(input.source, index);
    if (!tokenBounds) {
      continue;
    }

    const span = { startOffset: tokenBounds.startOffset, endOffset: tokenBounds.endOffset } satisfies SourceSpan;
    if (shouldSkipVariableSpan(input.source, span, input.occupiedSpans)) {
      index = tokenBounds.endOffset - 1;
      continue;
    }

    tokens.push(createOffsetToken({ lineStarts: input.lineStarts, startOffset: span.startOffset, endOffset: span.endOffset, tokenType: 'variable' }));
    index = tokenBounds.endOffset - 1;
  }

  return tokens;
}

/** Sort semantic tokens into the stable order expected by the LSP encoder. */
export function sortSemanticTokens(tokens: readonly SemanticToken[]): SemanticToken[] {
  return [...tokens].sort((left, right) => compareSemanticTokens(left, right));
}

/** Drop duplicate semantic tokens emitted from overlapping parser facts. */
export function dedupeSemanticTokens(tokens: readonly SemanticToken[]): SemanticToken[] {
  const seen = new Set<string>();
  const deduped: SemanticToken[] = [];

  for (const token of tokens) {
    const key = `${token.line}:${token.startChar}:${token.length}:${token.tokenType}:${encodeModifiers(token.tokenModifiers ?? [])}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(token);
  }

  return deduped;
}

/** Convert an offset span to a line/column token entry. */
export function createOffsetToken(input: {
  readonly lineStarts: readonly number[];
  readonly startOffset: number;
  readonly endOffset: number;
  readonly tokenType: SemanticToken['tokenType'];
  readonly tokenModifiers?: SemanticToken['tokenModifiers'];
}): SemanticToken {
  const start = offsetToPosition(input.lineStarts, input.startOffset);
  const end = offsetToPosition(input.lineStarts, input.endOffset);
  return {
    line: start.line,
    startChar: start.character,
    length: end.character - start.character,
    tokenType: input.tokenType,
    ...(input.tokenModifiers === undefined ? {} : { tokenModifiers: input.tokenModifiers }),
  };
}

/** Convert an LSP range into absolute source offsets. */
export function rangeToOffsetSpan(
  range: {
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
  },
  lineStarts: readonly number[],
): SourceSpan {
  return { startOffset: positionToOffset(lineStarts, range.start), endOffset: positionToOffset(lineStarts, range.end) };
}

/** Check whether a span overlaps any existing occupied spans. */
export function spansOverlapAny(span: SourceSpan, otherSpans: readonly SourceSpan[]): boolean {
  return otherSpans.some((otherSpan) => span.startOffset < otherSpan.endOffset && otherSpan.startOffset < span.endOffset);
}

/** Encode semantic token modifiers into the LSP bitmask representation. */
export function encodeModifiers(modifiers: readonly string[]): number {
  return modifiers.reduce((mask, modifier) => (modifier === 'definition' ? mask | 1 : mask), 0);
}

const semanticTokenOrder: Record<SemanticToken['tokenType'], number> = {
  comment: 0,
  function: 1,
  property: 2,
  string: 3,
  variable: 4,
};

function flushCommentSpan(options: {
  readonly commentSpans: SourceSpan[];
  readonly commentStart: number;
  readonly index: number;
  readonly character: string;
}): number | null {
  if (options.character !== '\n') {
    return options.commentStart;
  }

  options.commentSpans.push({ startOffset: options.commentStart, endOffset: options.index });
  return null;
}

function appendTrailingCommentSpan(
  commentSpans: SourceSpan[],
  commentStart: number,
  sourceLength: number,
): void {
  commentSpans.push({ startOffset: commentStart, endOffset: sourceLength });
}

function scanCommentCharacter(options: {
  readonly source: string;
  readonly index: number;
  readonly commentSpans: SourceSpan[];
  readonly commentStart: number | null;
  readonly inString: boolean;
}): { readonly commentStart: number | null; readonly inString: boolean } {
  const character = options.source[options.index] ?? '';
  if (options.commentStart !== null) {
    return { commentStart: flushCommentSpan({ commentSpans: options.commentSpans, commentStart: options.commentStart, index: options.index, character }), inString: options.inString };
  }

  if (isUnescapedQuote(options.source, options.index)) {
    return { commentStart: null, inString: !options.inString };
  }

  return { commentStart: !options.inString && character === '%' ? options.index : null, inString: options.inString };
}

function getVariableTokenBounds(source: string, startOffset: number): SourceSpan | null {
  const character = source[startOffset];
  if (!isVariableIdentifierStart(character) || isVariableIdentifierContinuation(source[startOffset - 1])) {
    return null;
  }

  let endOffset = startOffset + 1;
  while (isVariableIdentifierContinuation(source[endOffset])) {
    endOffset += 1;
  }

  return { startOffset, endOffset };
}

function shouldSkipVariableSpan(
  source: string,
  span: SourceSpan,
  occupiedSpans: readonly SourceSpan[],
): boolean {
  if (spansOverlapAny(span, occupiedSpans)) {
    return true;
  }

  if (source[span.startOffset - 1] === '/' || source[span.endOffset] === '/') {
    return true;
  }

  return isPredicateCall(source, span.endOffset) || source[span.endOffset] === '=';
}

function compareSemanticTokens(left: SemanticToken, right: SemanticToken): number {
  return left.line - right.line
    || left.startChar - right.startChar
    || left.length - right.length
    || semanticTokenOrder[left.tokenType] - semanticTokenOrder[right.tokenType]
    || encodeModifiers(left.tokenModifiers ?? []) - encodeModifiers(right.tokenModifiers ?? []);
}

function isPredicateCall(source: string, endOffset: number): boolean {
  let index = endOffset;
  while (source[index] === ' ' || source[index] === '\t') {
    index += 1;
  }

  if (source[index] === '@') {
    index += 1;
    while (source[index] === ' ' || source[index] === '\t') {
      index += 1;
    }
  }

  return source[index] === '(';
}

function isVariableIdentifierStart(character: string | undefined): boolean {
  return character !== undefined && /[a-z_]/.test(character);
}

function isVariableIdentifierContinuation(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_]/.test(character);
}

function isUnescapedQuote(text: string, index: number): boolean {
  return text[index] === '"' && text[index - 1] !== '\\';
}
