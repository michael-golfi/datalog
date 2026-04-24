import { BUILTIN_PREDICATE_NAMES, parseDocument } from '@datalog/parser';

import { collectCommentSpans, collectVariableTokens, createOffsetToken, dedupeSemanticTokens, encodeModifiers, rangeToOffsetSpan, spansOverlapAny, sortSemanticTokens } from './semantic-token-helpers.js';

export const SEMANTIC_TOKEN_TYPES = [
  'comment',
  'function',
  'property',
  'string',
  'variable',
] as const;

export const SEMANTIC_TOKEN_MODIFIERS = ['definition'] as const;

export interface SemanticToken {
  readonly line: number;
  readonly startChar: number;
  readonly length: number;
  readonly tokenType: (typeof SEMANTIC_TOKEN_TYPES)[number];
  readonly tokenModifiers?: ReadonlyArray<(typeof SEMANTIC_TOKEN_MODIFIERS)[number]>;
}

/** Compute semantic tokens for comments, predicates, and string references. */
export function computeSemanticTokens(source: string): SemanticToken[] {
  const parsedDocument = parseDocument(source);
  const tokens: SemanticToken[] = [];
  const commentSpans = collectCommentSpans(source);
  const occupiedSpans = [...commentSpans];

  for (const commentSpan of commentSpans) {
    tokens.push(createOffsetToken({ lineStarts: parsedDocument.lineStarts, startOffset: commentSpan.startOffset, endOffset: commentSpan.endOffset, tokenType: 'comment' }));
  }

  for (const clause of parsedDocument.clauses) {
    addOccurrenceTokens({ clause, lineStarts: parsedDocument.lineStarts, tokens, occupiedSpans });
    addFieldTokens({ clause, lineStarts: parsedDocument.lineStarts, tokens, occupiedSpans });
    addReferenceTokens({ clause, lineStarts: parsedDocument.lineStarts, tokens, occupiedSpans, commentSpans });
  }

  tokens.push(...collectVariableTokens({ source, lineStarts: parsedDocument.lineStarts, occupiedSpans }));
  return sortSemanticTokens(dedupeSemanticTokens(tokens));
}

/** Encode semantic tokens into the delta-based LSP wire format. */
export function encodeSemanticTokens(tokens: readonly SemanticToken[]): number[] {
  const encoded: number[] = [];
  let previousLine = 0;
  let previousCharacter = 0;

  for (const token of tokens) {
    const deltaLine = token.line - previousLine;
    const deltaStart = deltaLine === 0 ? token.startChar - previousCharacter : token.startChar;
    encoded.push(deltaLine, deltaStart, token.length, SEMANTIC_TOKEN_TYPES.indexOf(token.tokenType), encodeModifiers(token.tokenModifiers ?? []));
    previousLine = token.line;
    previousCharacter = token.startChar;
  }

  return encoded;
}

function addOccurrenceTokens(input: {
  readonly clause: ReturnType<typeof parseDocument>['clauses'][number];
  readonly lineStarts: readonly number[];
  readonly tokens: SemanticToken[];
  readonly occupiedSpans: Array<ReturnType<typeof rangeToOffsetSpan>>;
}): void {
  for (const occurrence of input.clause.occurrences) {
    const tokenModifiers = occurrence.kind === 'head' && !BUILTIN_PREDICATE_NAMES.has(occurrence.name)
      ? ['definition'] satisfies Array<(typeof SEMANTIC_TOKEN_MODIFIERS)[number]>
      : [];

    input.tokens.push({
      line: occurrence.range.start.line,
      startChar: occurrence.range.start.character,
      length: occurrence.range.end.character - occurrence.range.start.character,
      tokenType: 'function',
      ...(tokenModifiers.length === 0 ? {} : { tokenModifiers }),
    });
    input.occupiedSpans.push(rangeToOffsetSpan(occurrence.range, input.lineStarts));
  }
}

function addFieldTokens(input: {
  readonly clause: ReturnType<typeof parseDocument>['clauses'][number];
  readonly lineStarts: readonly number[];
  readonly tokens: SemanticToken[];
  readonly occupiedSpans: Array<ReturnType<typeof rangeToOffsetSpan>>;
}): void {
  for (const fieldOccurrence of input.clause.compoundFieldOccurrences) {
    input.tokens.push({
      line: fieldOccurrence.range.start.line,
      startChar: fieldOccurrence.range.start.character,
      length: fieldOccurrence.range.end.character - fieldOccurrence.range.start.character,
      tokenType: 'property',
    });
    input.occupiedSpans.push(rangeToOffsetSpan(fieldOccurrence.range, input.lineStarts));
  }
}

function addReferenceTokens(input: {
  readonly clause: ReturnType<typeof parseDocument>['clauses'][number];
  readonly lineStarts: readonly number[];
  readonly tokens: SemanticToken[];
  readonly occupiedSpans: Array<ReturnType<typeof rangeToOffsetSpan>>;
  readonly commentSpans: ReturnType<typeof collectCommentSpans>;
}): void {
  for (const reference of input.clause.references) {
    const referenceSpan = rangeToOffsetSpan(reference.range, input.lineStarts);
    if (spansOverlapAny(referenceSpan, input.commentSpans)) {
      continue;
    }

    input.tokens.push({
      line: reference.range.start.line,
      startChar: reference.range.start.character,
      length: reference.range.end.character - reference.range.start.character,
      tokenType: reference.role === 'label' ? 'string' : 'property',
    });
    input.occupiedSpans.push(referenceSpan);
  }
}
