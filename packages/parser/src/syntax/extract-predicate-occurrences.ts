import type { ParsedPredicateOccurrence } from '../contracts/parsed-document.js';

import { offsetToPosition } from './position-tools.js';
import type { Statement } from './split-statements.js';

const CLAUSE_PATTERN = /([A-Za-z_][A-Za-z0-9_]*)(@)?\s*\(/g;

interface PredicateOccurrenceInput {
  readonly name: string;
  readonly kind: ParsedPredicateOccurrence['kind'];
  readonly start: number;
  readonly lineStarts: readonly number[];
}

/** Extract predicate head/body occurrences from a parsed statement. */
export function extractPredicateOccurrences(
  statement: Statement,
  lineStarts: readonly number[],
): ParsedPredicateOccurrence[] {
  const occurrences: ParsedPredicateOccurrence[] = [];
  const headOccurrence = getHeadOccurrence(statement, lineStarts);

  if (headOccurrence) {
    occurrences.push(headOccurrence);
  }

  occurrences.push(...getBodyOccurrences(statement, lineStarts));
  return occurrences;
}

function getHeadOccurrence(
  statement: Statement,
  lineStarts: readonly number[],
): ParsedPredicateOccurrence | null {
  const divider = statement.text.indexOf(':-');
  const headText = divider >= 0 ? statement.text.slice(0, divider) : statement.text;
  const headMatch = /^([A-Za-z_][A-Za-z0-9_]*)(@)?\s*\(/.exec(headText);

  if (!headMatch) {
    return null;
  }

  const name = headMatch[1];

  if (name === undefined) {
    return null;
  }

  return createPredicateOccurrence({
    name,
    kind: 'head',
    start: statement.startOffset + headMatch.index,
    lineStarts,
  });
}

function getBodyOccurrences(
  statement: Statement,
  lineStarts: readonly number[],
): ParsedPredicateOccurrence[] {
  const occurrences: ParsedPredicateOccurrence[] = [];
  const divider = statement.text.indexOf(':-');

  if (divider < 0) {
    return occurrences;
  }

  const bodyText = statement.text.slice(divider + 2);
  const bodyOffset = statement.startOffset + divider + 2;
  let match: RegExpExecArray | null;

  while ((match = CLAUSE_PATTERN.exec(bodyText)) !== null) {
    const name = match[1];

    if (name === undefined) {
      continue;
    }

    occurrences.push(createPredicateOccurrence({
      name,
      kind: 'body',
      start: bodyOffset + match.index,
      lineStarts,
    }));
  }

  return occurrences;
}

function createPredicateOccurrence(input: PredicateOccurrenceInput): ParsedPredicateOccurrence {
  return {
    name: input.name,
    kind: input.kind,
    range: {
      start: offsetToPosition(input.lineStarts, input.start),
      end: offsetToPosition(input.lineStarts, input.start + input.name.length),
    },
  };
}
