import type { Position, Range } from '../contracts/position.js';

import { computeLineStarts } from './line-starts.js';

/** Convert an absolute source offset to a line/character position. */
export function offsetToPosition(lineStarts: readonly number[], offset: number): Position {
  let line = 0;

  while (line + 1 < lineStarts.length && (lineStarts[line + 1] ?? Number.MAX_SAFE_INTEGER) <= offset) {
    line += 1;
  }

  return {
    line,
    character: offset - (lineStarts[line] ?? 0),
  };
}

/** Convert a line/character position back to an absolute source offset. */
export function positionToOffset(lineStarts: readonly number[], position: Position): number {
  const lineStart = lineStarts[position.line] ?? lineStarts[lineStarts.length - 1] ?? 0;
  return lineStart + position.character;
}

/** Check whether a position falls within a source range, inclusive. */
export function within(position: Position, range: Range): boolean {
  const startsBefore = position.line > range.start.line
    || (position.line === range.start.line && position.character >= range.start.character);
  const endsAfter = position.line < range.end.line
    || (position.line === range.end.line && position.character <= range.end.character);

  return startsBefore && endsAfter;
}

/** Return the contiguous word range under the given cursor position, if any. */
export function getWordRangeAtPosition(
  source: string,
  position: Position,
  lineStarts: readonly number[] = computeLineStarts(source),
): Range | null {
  const offset = positionToOffset(lineStarts, position);
  const start = moveWordStart(source, offset);
  const end = moveWordEnd(source, offset);

  if (start === end) {
    return null;
  }

  return {
    start: offsetToPosition(lineStarts, start),
    end: offsetToPosition(lineStarts, end),
  };
}

function moveWordStart(source: string, offset: number): number {
  let start = offset;

  while (start > 0 && isWordCharacter(source[start - 1] ?? '')) {
    start -= 1;
  }

  return start;
}

function moveWordEnd(source: string, offset: number): number {
  let end = offset;

  while (end < source.length && isWordCharacter(source[end] ?? '')) {
    end += 1;
  }

  return end;
}

function isWordCharacter(character: string): boolean {
  return /[A-Za-z0-9_/@]/.test(character);
}
