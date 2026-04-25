import {
  extractCompoundFieldOccurrences,
  extractCompoundFields,
} from './extract-compound-fields.js';
import { extractPredicateOccurrences } from './extract-predicate-occurrences.js';
import {
  extractStringReferences,
  type ReferenceRoleClassifier,
} from './extract-string-references.js';
import { offsetToPosition } from './position-tools.js';
import { splitTopLevelArgs } from './split-top-level-args.js';

import type { Statement } from './split-statements.js';
import type { ParsedClause } from '../contracts/parsed-document.js';

const CLAUSE_HEAD_PATTERN = /^([A-Za-z_][A-Za-z0-9_]*)(@)?\s*\(/;

interface ParsedClauseInput {
  readonly statement: Statement;
  readonly text: string;
  readonly lineStarts: readonly number[];
  readonly predicate: string;
  readonly isCompound: boolean;
  readonly predicateStart: number;
  readonly headArguments: string;
  readonly classifyReferenceRole: ReferenceRoleClassifier;
}

interface ParenSearchState {
  depth: number;
  inString: boolean;
}

/** Parse a split statement into a structured clause plus source ranges and references. */
export function parseClause(
  statement: Statement,
  lineStarts: readonly number[],
  classifyReferenceRole: ReferenceRoleClassifier,
): ParsedClause | null {
  const text = statement.text.trim();
  const headMatch = CLAUSE_HEAD_PATTERN.exec(text);

  if (!headMatch) {
    return null;
  }

  const predicate = headMatch[1];

  if (predicate === undefined) {
    return null;
  }

  const isCompound = headMatch[2] === '@';
  const firstParenOffset = text.indexOf('(');
  const closeParenOffset = findMatchingCloseParen(text, firstParenOffset);
  const headArguments = getHeadArguments(text, firstParenOffset, closeParenOffset);
  const predicateStart = statement.startOffset + headMatch.index;

  return createParsedClause({
    statement,
    text,
    lineStarts,
    predicate,
    isCompound,
    predicateStart,
    headArguments,
    classifyReferenceRole,
  });
}

function findMatchingCloseParen(text: string, openParenOffset: number): number {
  if (openParenOffset < 0) {
    return -1;
  }

  const state: ParenSearchState = {
    depth: 0,
    inString: false,
  };

  for (let index = openParenOffset; index < text.length; index += 1) {
    const matchingCloseParen = handleParenCharacter(state, text, index);

    if (matchingCloseParen !== null) {
      return matchingCloseParen;
    }
  }

  return -1;
}

function handleParenCharacter(state: ParenSearchState, text: string, index: number): number | null {
  const character = text[index];

  if (isUnescapedQuote(text, index)) {
    state.inString = !state.inString;
  }

  if (state.inString) {
    return null;
  }

  const nextDepth = getNextParenDepth(state.depth, character);

  if (nextDepth === null) {
    return null;
  }

  state.depth = nextDepth;
  return state.depth === 0 ? index : null;
}

function isUnescapedQuote(text: string, index: number): boolean {
  return text[index] === '"' && text[index - 1] !== '\\';
}

function getHeadArguments(
  text: string,
  firstParenOffset: number,
  closeParenOffset: number,
): string {
  if (firstParenOffset < 0 || closeParenOffset <= firstParenOffset) {
    return '';
  }

  return text.slice(firstParenOffset + 1, closeParenOffset);
}

function createParsedClause(input: ParsedClauseInput): ParsedClause {
  const compoundFieldOccurrences = extractCompoundFieldOccurrences({
    statement: input.statement,
    lineStarts: input.lineStarts,
  });

  return {
    predicate: input.predicate,
    isCompound: input.isCompound,
    isRule: input.text.includes(':-'),
    arity: splitTopLevelArgs(input.headArguments).length,
    compoundFields: input.isCompound ? extractCompoundFields(input.headArguments) : [],
    compoundFieldOccurrences,
    range: {
      start: offsetToPosition(input.lineStarts, input.statement.startOffset),
      end: offsetToPosition(
        input.lineStarts,
        input.statement.startOffset + input.statement.text.length,
      ),
    },
    predicateRange: {
      start: offsetToPosition(input.lineStarts, input.predicateStart),
      end: offsetToPosition(input.lineStarts, input.predicateStart + input.predicate.length),
    },
    occurrences: extractPredicateOccurrences(input.statement, input.lineStarts),
    references: extractStringReferences({
      statement: input.statement,
      lineStarts: input.lineStarts,
      predicate: input.predicate,
      classifyReferenceRole: input.classifyReferenceRole,
    }),
  };
}

function getNextParenDepth(depth: number, character: string | undefined): number | null {
  if (character === '(') {
    return depth + 1;
  }

  if (character === ')') {
    return depth - 1;
  }

  return null;
}
