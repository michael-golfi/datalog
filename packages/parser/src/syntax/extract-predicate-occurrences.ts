import { offsetToPosition } from './position-tools.js';
import {
  findMatchingStructuralCloseParen,
  forEachTopLevelStructuralCharacter,
} from './scan-structural-text.js';
import { splitTopLevelArgs } from './split-top-level-args.js';

import type { Statement } from './split-statements.js';
import type { ParsedPredicateOccurrence } from '../contracts/parsed-document.js';

interface PredicateOccurrenceInput {
  readonly name: string;
  readonly kind: ParsedPredicateOccurrence['kind'];
  readonly arity: number;
  readonly start: number;
  readonly lineStarts: readonly number[];
}

interface PredicateScanMatch {
  readonly occurrence: ParsedPredicateOccurrence;
  readonly nextIndex: number;
}

interface ScanTopLevelPredicateOccurrencesInput {
  readonly text: string;
  readonly startOffset: number;
  readonly lineStarts: readonly number[];
  readonly kind: ParsedPredicateOccurrence['kind'];
}

/** Extract predicate head/body occurrences from a parsed statement. */
export function extractPredicateOccurrences(
  statement: Statement,
  lineStarts: readonly number[],
): ParsedPredicateOccurrence[] {
  const divider = statement.text.indexOf(':-');
  const headText = divider >= 0 ? statement.text.slice(0, divider) : statement.text;
  const headOccurrence = scanTopLevelPredicateOccurrences({
    text: headText,
    startOffset: statement.startOffset,
    lineStarts,
    kind: 'head',
  })[0];
  const occurrences = headOccurrence ? [headOccurrence] : [];

  if (divider < 0) {
    return occurrences;
  }

  return occurrences.concat(
    scanTopLevelPredicateOccurrences({
      text: statement.text.slice(divider + 2),
      startOffset: statement.startOffset + divider + 2,
      lineStarts,
      kind: 'body',
    }),
  );
}

function scanTopLevelPredicateOccurrences(
  input: ScanTopLevelPredicateOccurrencesInput,
): ParsedPredicateOccurrence[] {
  const occurrences: ParsedPredicateOccurrence[] = [];
  forEachTopLevelStructuralCharacter(input.text, (index) => {
    const match = getPredicateScanMatch(input, index);

    if (!match) {
      return undefined;
    }

    occurrences.push(match.occurrence);
    return match.nextIndex;
  });

  return occurrences;
}

function getPredicateScanMatch(
  input: ScanTopLevelPredicateOccurrencesInput,
  startIndex: number,
): PredicateScanMatch | null {
  const identifier = readIdentifier(input.text, startIndex);

  if (!identifier) {
    return null;
  }

  const openParenIndex = getPredicateCallOpenParenIndex(input.text, identifier.endIndex);

  if (openParenIndex < 0) {
    return null;
  }

  const { argumentText, nextIndex } = getCallArguments(input.text, openParenIndex);

  return {
    occurrence: createPredicateOccurrence({
      name: identifier.name,
      kind: input.kind,
      arity: splitTopLevelArgs(argumentText).length,
      start: input.startOffset + startIndex,
      lineStarts: input.lineStarts,
    }),
    nextIndex,
  };
}

function readIdentifier(
  text: string,
  startIndex: number,
): { readonly name: string; readonly endIndex: number } | null {
  if (!isIdentifierStart(text[startIndex])) {
    return null;
  }

  const previousCharacter = startIndex > 0 ? text[startIndex - 1] : undefined;

  if (isIdentifierContinuation(previousCharacter)) {
    return null;
  }

  let endIndex = startIndex + 1;

  while (isIdentifierContinuation(text[endIndex])) {
    endIndex += 1;
  }

  return {
    name: text.slice(startIndex, endIndex),
    endIndex,
  };
}

function getPredicateCallOpenParenIndex(text: string, endIndex: number): number {
  const startIndex = text[endIndex] === '@' ? endIndex + 1 : endIndex;

  return skipToOpenParen(text, startIndex);
}

function skipToOpenParen(text: string, startIndex: number): number {
  let index = startIndex;

  while (text[index] === ' ' || text[index] === '\t') {
    index += 1;
  }

  return text[index] === '(' ? index : -1;
}

function getCallArguments(
  text: string,
  openParenIndex: number,
): { readonly argumentText: string; readonly nextIndex: number } {
  const closeParenIndex = findMatchingStructuralCloseParen(text, openParenIndex);

  if (closeParenIndex < 0) {
    return {
      argumentText: text.slice(openParenIndex + 1),
      nextIndex: text.length - 1,
    };
  }

  return {
    argumentText: text.slice(openParenIndex + 1, closeParenIndex),
    nextIndex: closeParenIndex,
  };
}

function createPredicateOccurrence(input: PredicateOccurrenceInput): ParsedPredicateOccurrence {
  return {
    name: input.name,
    kind: input.kind,
    arity: input.arity,
    range: {
      start: offsetToPosition(input.lineStarts, input.start),
      end: offsetToPosition(input.lineStarts, input.start + input.name.length),
    },
  };
}

function isIdentifierStart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z_]/.test(character);
}

function isIdentifierContinuation(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_]/.test(character);
}
