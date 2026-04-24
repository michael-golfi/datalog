import { atom, namedTerm, type DatalogAtom, type DatalogAtomArgument } from '@datalog/ast';

import { splitTopLevelArgs } from '../syntax/split-top-level-args.js';

import type { ParseContext, SourceSlice } from './parse-context.js';
import { parseDatalogTerm } from './parse-datalog-term.js';
import { createSourceLocation } from './source-location.js';
import { findTopLevelAssignment } from './top-level-scan.js';

const ATOM_PATTERN = /^([A-Za-z_][A-Za-z0-9_]*)(@)?\s*\((.*)\)$/s;

/** Parse a Datalog atom from an absolute source slice. */
export function parseDatalogAtom(input: {
  readonly context: ParseContext;
  readonly slice: SourceSlice;
}): DatalogAtom {
  const raw = input.context.source.slice(input.slice.startOffset, input.slice.endOffset);
  const trimmed = raw.trim();
  const trimmedStart = input.slice.startOffset + raw.search(/\S|$/);
  const match = ATOM_PATTERN.exec(trimmed);

  if (!match) {
    throw new Error(`Expected Datalog atom: ${trimmed}`);
  }

  const predicate = match[1];
  const isCompound = match[2] === '@';
  const argsText = match[3] ?? '';

  if (predicate === undefined) {
    throw new Error(`Missing predicate name: ${trimmed}`);
  }

  const openParenIndex = trimmed.indexOf('(');
  const argsStart = trimmedStart + openParenIndex + 1;
  const terms = parseArguments({ context: input.context, argsText, argsStart, isCompound });

  return atom(predicate, terms, {
    location: createSourceLocation({
      lineStarts: input.context.lineStarts,
      startOffset: trimmedStart,
      endOffset: trimmedStart + trimmed.length,
    }),
  });
}

function parseArguments(input: {
  readonly context: ParseContext;
  readonly argsText: string;
  readonly argsStart: number;
  readonly isCompound: boolean;
}): readonly DatalogAtomArgument[] {
  const args = splitTopLevelArgs(input.argsText);
  const terms: DatalogAtomArgument[] = [];
  let searchFrom = 0;

  for (const arg of args) {
    const relativeIndex = input.argsText.indexOf(arg, searchFrom);

    if (relativeIndex < 0) {
      throw new Error(`Unable to locate atom argument: ${arg}`);
    }

    const absoluteStart = input.argsStart + relativeIndex;
    const absoluteEnd = absoluteStart + arg.length;
    terms.push(parseArgument({
      context: input.context,
      slice: { startOffset: absoluteStart, endOffset: absoluteEnd },
      isCompound: input.isCompound,
    }));
    searchFrom = relativeIndex + arg.length;
  }

  return terms;
}

function parseArgument(input: {
  readonly context: ParseContext;
  readonly slice: SourceSlice;
  readonly isCompound: boolean;
}): DatalogAtomArgument {
  const text = input.context.source.slice(input.slice.startOffset, input.slice.endOffset).trim();

  if (!input.isCompound) {
    return parseDatalogTerm({ context: input.context, slice: input.slice });
  }

  const assignmentIndex = findTopLevelAssignment(text);

  if (assignmentIndex < 0) {
    return parseDatalogTerm({ context: input.context, slice: input.slice });
  }

  const name = text.slice(0, assignmentIndex).trim();
  const value = parseDatalogTerm({
    context: input.context,
    slice: {
      startOffset: input.slice.startOffset + assignmentIndex + 1,
      endOffset: input.slice.endOffset,
    },
  });

  return namedTerm(name, value, {
    location: createSourceLocation({
      lineStarts: input.context.lineStarts,
      startOffset: input.slice.startOffset,
      endOffset: input.slice.endOffset,
    }),
  });
}
