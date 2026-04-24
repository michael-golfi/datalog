import type { DatalogSourceLocation, Range } from '@datalog/ast';

import { offsetToPosition } from '../syntax/position-tools.js';

/** Create a shared AST location from absolute zero-based source offsets. */
export function createSourceLocation(input: {
  readonly lineStarts: readonly number[];
  readonly startOffset: number;
  readonly endOffset: number;
}): DatalogSourceLocation {
  const range: Range = {
    start: offsetToPosition(input.lineStarts, input.startOffset),
    end: offsetToPosition(input.lineStarts, input.endOffset),
  };

  return {
    startOffset: input.startOffset,
    endOffset: input.endOffset,
    range,
  };
}
