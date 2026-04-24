import {
  comparison,
  negatedAtom,
  type DatalogComparisonOperator,
  type DatalogLiteral,
} from '@datalog/ast';

import type { ParseContext, SourceSlice } from './parse-context.js';
import { parseDatalogAtom } from './parse-datalog-atom.js';
import { parseDatalogTerm } from './parse-datalog-term.js';
import { createSourceLocation } from './source-location.js';
import { findTopLevelComparisonOperator } from './top-level-scan.js';

const NEGATION_PREFIX = 'not ';

/** Parse a Datalog literal from an absolute source slice. */
export function parseDatalogLiteral(input: {
  readonly context: ParseContext;
  readonly slice: SourceSlice;
}): DatalogLiteral {
  const literalSlice = toTrimmedSlice(input);

  if (isNegatedLiteral(input.context.source, literalSlice)) {
    return parseNegatedLiteral(input.context, literalSlice);
  }

  return parseNonNegatedLiteral(input.context, literalSlice);
}

function toTrimmedSlice(input: {
  readonly context: ParseContext;
  readonly slice: SourceSlice;
}): SourceSlice {
  const raw = input.context.source.slice(input.slice.startOffset, input.slice.endOffset);
  const trimmedStart = input.slice.startOffset + raw.search(/\S|$/);
  const trimmedEnd = trimmedStart + raw.trim().length;
  return { startOffset: trimmedStart, endOffset: trimmedEnd };
}

function isNegatedLiteral(source: string, slice: SourceSlice): boolean {
  return source.slice(slice.startOffset, slice.endOffset).startsWith(NEGATION_PREFIX);
}

function parseNegatedLiteral(context: ParseContext, slice: SourceSlice): DatalogLiteral {
  const atomNode = parseDatalogAtom({
    context,
    slice: {
      startOffset: slice.startOffset + NEGATION_PREFIX.length,
      endOffset: slice.endOffset,
    },
  });

  return negatedAtom(atomNode, { location: createLiteralLocation(context, slice) });
}

function parseNonNegatedLiteral(context: ParseContext, slice: SourceSlice): DatalogLiteral {
  const text = context.source.slice(slice.startOffset, slice.endOffset);
  const comparisonOperator = findTopLevelComparisonOperator(text);

  if (comparisonOperator === null) {
    return parseDatalogAtom({ context, slice });
  }

  const leftEnd = slice.startOffset + comparisonOperator.index;
  const rightStart = leftEnd + comparisonOperator.operator.length;

  return comparison({
    operator: comparisonOperator.operator as DatalogComparisonOperator,
    left: parseDatalogTerm({
      context,
      slice: { startOffset: slice.startOffset, endOffset: leftEnd },
    }),
    right: parseDatalogTerm({
      context,
      slice: { startOffset: rightStart, endOffset: slice.endOffset },
    }),
    location: createLiteralLocation(context, slice),
  });
}

function createLiteralLocation(context: ParseContext, slice: SourceSlice) {
  return createSourceLocation({
    lineStarts: context.lineStarts,
    startOffset: slice.startOffset,
    endOffset: slice.endOffset,
  });
}
