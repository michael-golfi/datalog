import { parseDocument } from '@datalog/parser';

import type { LanguageServerFoldingRange } from '../contracts/language-feature-types.js';

/** Compute folding ranges for comment blocks and multiline clauses. */
export function computeFoldingRanges(source: string): LanguageServerFoldingRange[] {
  const commentRanges = collectCommentRanges(source);
  const clauseRanges = parseDocument(source)
    .clauses.map((clause) =>
      createFoldingRange({
        startLine: clause.range.start.line,
        endLine: clause.range.end.line,
        kind: 'region',
      }),
    )
    .filter((range): range is LanguageServerFoldingRange => range !== null);

  return [...commentRanges, ...clauseRanges].sort(compareFoldingRanges);
}

function collectCommentRanges(source: string): LanguageServerFoldingRange[] {
  const ranges: LanguageServerFoldingRange[] = [];
  const lines = source.split('\n');
  let commentStart: number | null = null;

  for (const [index, line] of lines.entries()) {
    const isComment = line.trim().startsWith('%');

    if (isComment) {
      commentStart ??= index;
      continue;
    }

    pushCommentRange(ranges, commentStart, index - 1);

    commentStart = null;
  }

  pushCommentRange(ranges, commentStart, lines.length - 1);

  return ranges;
}

function pushCommentRange(
  ranges: LanguageServerFoldingRange[],
  startLine: number | null,
  endLine: number,
): void {
  const range = createCommentRange(startLine, endLine);
  if (range) {
    ranges.push(range);
  }
}

function createCommentRange(
  startLine: number | null,
  endLine: number,
): LanguageServerFoldingRange | null {
  if (typeof startLine !== 'number') {
    return null;
  }

  return createFoldingRange({ startLine, endLine, kind: 'comment' });
}

function createFoldingRange(range: LanguageServerFoldingRange): LanguageServerFoldingRange | null {
  if (range.startLine < 0 || range.endLine <= range.startLine) {
    return null;
  }

  return range;
}

function compareFoldingRanges(
  left: LanguageServerFoldingRange,
  right: LanguageServerFoldingRange,
): number {
  if (left.startLine !== right.startLine) {
    return left.startLine - right.startLine;
  }

  if (left.endLine !== right.endLine) {
    return left.endLine - right.endLine;
  }

  if (left.kind === right.kind) {
    return 0;
  }

  return left.kind === 'comment' ? -1 : 1;
}
