import type { ParsedReference, ParsedReferenceRole } from '../contracts/parsed-document.js';

import { offsetToPosition } from './position-tools.js';
import type { Statement } from './split-statements.js';

export type ReferenceRoleClassifier = (
  predicate: string,
  index: number,
  value: string,
) => ParsedReferenceRole;

interface ExtractStringReferencesOptions {
  readonly statement: Statement;
  readonly lineStarts: readonly number[];
  readonly predicate: string;
  readonly classifyReferenceRole: ReferenceRoleClassifier;
}

/** Extract quoted string references from a parsed statement. */
export function extractStringReferences(options: ExtractStringReferencesOptions): ParsedReference[] {
  const { statement, lineStarts, predicate, classifyReferenceRole } = options;
  const references: ParsedReference[] = [];
  const stringPattern = /"((?:[^"\\]|\\.)*)"/g;
  let referenceIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = stringPattern.exec(statement.text)) !== null) {
    const value = match[1];

    if (value === undefined) {
      continue;
    }

    const start = statement.startOffset + match.index + 1;

    references.push({
      value,
      role: classifyReferenceRole(predicate, referenceIndex, value),
      range: {
        start: offsetToPosition(lineStarts, start),
        end: offsetToPosition(lineStarts, start + value.length),
      },
    });

    referenceIndex += 1;
  }

  return references;
}
