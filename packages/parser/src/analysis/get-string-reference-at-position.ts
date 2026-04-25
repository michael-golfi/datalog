import { parseDocument } from './parse-document.js';
import { within } from '../syntax/position-tools.js';

import type { ParsedReference } from '../contracts/parsed-document.js';
import type { Position } from '../contracts/position.js';

/** Find the string reference that covers the given source position, if any. */
export function getStringReferenceAtPosition(
  source: string,
  position: Position,
): ParsedReference | null {
  const parsed = parseDocument(source);

  for (const clause of parsed.clauses) {
    const reference = clause.references.find((candidate) => within(position, candidate.range));

    if (reference) {
      return reference;
    }
  }

  return null;
}
