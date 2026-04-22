import { parseDocument } from '@datalog/parser';

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
  const tokens: SemanticToken[] = [];
  const lines = source.split('\n');

  lines.forEach((line, index) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('%')) {
      const startChar = line.indexOf('%');
      tokens.push({
        line: index,
        startChar,
        length: line.length - startChar,
        tokenType: 'comment',
      });
    }
  });

  for (const clause of parseDocument(source).clauses) {
    tokens.push({
      line: clause.predicateRange.start.line,
      startChar: clause.predicateRange.start.character,
      length: clause.predicate.length,
      tokenType: clause.isCompound ? 'property' : 'function',
      tokenModifiers: clause.occurrences.some((occurrence) => occurrence.kind === 'head') ? ['definition'] : [],
    });

    for (const reference of clause.references) {
      tokens.push({
        line: reference.range.start.line,
        startChar: reference.range.start.character,
        length: reference.range.end.character - reference.range.start.character,
        tokenType: reference.role === 'label' ? 'string' : 'variable',
      });
    }
  }

  return tokens.sort((left, right) => left.line - right.line || left.startChar - right.startChar);
}

/** Encode semantic tokens into the delta-based LSP wire format. */
export function encodeSemanticTokens(tokens: readonly SemanticToken[]): number[] {
  const encoded: number[] = [];
  let previousLine = 0;
  let previousCharacter = 0;

  for (const token of tokens) {
    const deltaLine = token.line - previousLine;
    const deltaStart = deltaLine === 0 ? token.startChar - previousCharacter : token.startChar;
    encoded.push(
      deltaLine,
      deltaStart,
      token.length,
      SEMANTIC_TOKEN_TYPES.indexOf(token.tokenType),
      encodeModifiers(token.tokenModifiers ?? []),
    );
    previousLine = token.line;
    previousCharacter = token.startChar;
  }

  return encoded;
}

function encodeModifiers(modifiers: readonly string[]): number {
  return modifiers.reduce((mask, modifier) => {
    const index = SEMANTIC_TOKEN_MODIFIERS.indexOf(modifier as (typeof SEMANTIC_TOKEN_MODIFIERS)[number]);
    return index >= 0 ? mask | (1 << index) : mask;
  }, 0);
}
