import { offsetToPosition } from './position-tools.js';
import {
  findMatchingStructuralCloseParen,
  forEachTopLevelStructuralCharacter,
} from './scan-structural-text.js';

import type { Statement } from './split-statements.js';
import type { ParsedCompoundFieldOccurrence } from '../contracts/parsed-document.js';

const FIELD_PATTERN = /([a-z][a-z0-9_/-]*)=/g;

interface ExtractCompoundFieldOccurrencesInput {
  readonly statement: Statement;
  readonly lineStarts: readonly number[];
}

/** Extract unique `field=` names from a compound fact or projection argument list. */
export function extractCompoundFields(text: string): string[] {
  const fields = new Set<string>();
  const occurrences = collectFieldMatches(text);

  for (const occurrence of occurrences) {
    fields.add(occurrence.name);
  }

  return [...fields];
}

/** Extract ranged compound-field occurrences from top-level compound predicate calls. */
export function extractCompoundFieldOccurrences(
  input: ExtractCompoundFieldOccurrencesInput,
): ParsedCompoundFieldOccurrence[] {
  const occurrences: ParsedCompoundFieldOccurrence[] = [];
  forEachTopLevelStructuralCharacter(input.statement.text, (index) => {
    const match = getCompoundPredicateMatch(input.statement.text, index);

    if (!match) {
      return undefined;
    }

    const callStart = input.statement.startOffset + match.openParenIndex + 1;
    const fieldMatches = collectFieldMatches(match.argumentText);

    for (const fieldMatch of fieldMatches) {
      const fieldName = fieldMatch.name;

      const start = callStart + fieldMatch.index;
      occurrences.push({
        predicateName: match.predicateName,
        name: fieldName,
        range: {
          start: offsetToPosition(input.lineStarts, start),
          end: offsetToPosition(input.lineStarts, start + fieldName.length),
        },
      });
    }

    return match.nextIndex;
  });

  return occurrences;
}

function collectFieldMatches(
  text: string,
): Array<{ readonly name: string; readonly index: number }> {
  const matches: Array<{ readonly name: string; readonly index: number }> = [];

  forEachTopLevelStructuralCharacter(text, (index) => {
    const character = text[index];

    if (!isIdentifierStart(character)) {
      return undefined;
    }

    const fieldMatch = readFieldAssignment(text, index);

    if (fieldMatch === null) {
      return undefined;
    }

    matches.push(fieldMatch);
    return fieldMatch.index + fieldMatch.name.length;
  });

  return matches;
}

function getCompoundPredicateMatch(
  text: string,
  startIndex: number,
): {
  readonly predicateName: string;
  readonly openParenIndex: number;
  readonly argumentText: string;
  readonly nextIndex: number;
} | null {
  const identifier = readIdentifier(text, startIndex);

  if (!identifier) {
    return null;
  }

  const openParenIndex = getCompoundCallOpenParenIndex(text, identifier.endIndex);

  if (openParenIndex < 0) {
    return null;
  }

  const { argumentText, nextIndex } = getCallArguments(text, openParenIndex);

  return {
    predicateName: identifier.name,
    openParenIndex,
    argumentText,
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

function getCompoundCallOpenParenIndex(text: string, endIndex: number): number {
  if (text[endIndex] !== '@') {
    return -1;
  }

  return skipToOpenParen(text, endIndex + 1);
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

function isIdentifierStart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z_]/.test(character);
}

function isIdentifierContinuation(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_]/.test(character);
}

function readFieldAssignment(
  text: string,
  startIndex: number,
): { readonly name: string; readonly index: number } | null {
  FIELD_PATTERN.lastIndex = startIndex;
  const match = FIELD_PATTERN.exec(text);

  if (match?.index !== startIndex) {
    return null;
  }

  const name = match[1];

  if (name === undefined) {
    return null;
  }

  return {
    name,
    index: startIndex,
  };
}
