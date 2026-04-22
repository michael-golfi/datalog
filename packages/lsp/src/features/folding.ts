import { parseDocument } from '@datalog/parser';

import type { LanguageServerFoldingRange } from '../contracts/language-feature-types.js';

/** Compute folding ranges for comment blocks and multiline clauses. */
export function computeFoldingRanges(source: string): LanguageServerFoldingRange[] {
  const ranges: LanguageServerFoldingRange[] = [];
  const lines = source.split('\n');
  let commentStart: number | null = null;

  lines.forEach((line, index) => {
    const isComment = line.trim().startsWith('%');

    if (isComment && commentStart === null) {
      commentStart = index;
      return;
    }

    if (!isComment && commentStart !== null) {
      if (index - commentStart > 1) {
        ranges.push({ startLine: commentStart, endLine: index - 1, kind: 'comment' });
      }

      commentStart = null;
    }
  });

  const trailingCommentRange = createTrailingCommentRange(commentStart, lines.length);
  if (trailingCommentRange) {
    ranges.push(trailingCommentRange);
  }

  for (const clause of parseDocument(source).clauses) {
    if (clause.range.end.line > clause.range.start.line) {
      ranges.push({
        startLine: clause.range.start.line,
        endLine: clause.range.end.line,
        kind: 'region',
      });
    }
  }

  return ranges;
}

function createTrailingCommentRange(
  commentStart: number | null,
  lineCount: number,
): LanguageServerFoldingRange | null {
  if (typeof commentStart !== 'number' || lineCount - commentStart <= 1) {
    return null;
  }

  return { startLine: commentStart, endLine: lineCount - 1, kind: 'comment' };
}
