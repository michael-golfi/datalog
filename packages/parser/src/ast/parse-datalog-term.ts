import { constantTerm, variableTerm, wildcardTerm, type DatalogTerm } from '@datalog/ast';

import type { ParseContext, SourceSlice } from './parse-context.js';
import { createSourceLocation } from './source-location.js';

/** Parse a Datalog term from an absolute source slice. */
export function parseDatalogTerm(input: {
  readonly context: ParseContext;
  readonly slice: SourceSlice;
}): DatalogTerm {
  const raw = input.context.source.slice(input.slice.startOffset, input.slice.endOffset);
  const trimmed = raw.trim();
  const trimmedStart = input.slice.startOffset + raw.search(/\S|$/);
  const trimmedEnd = trimmedStart + trimmed.length;
  const location = createSourceLocation({
    lineStarts: input.context.lineStarts,
    startOffset: trimmedStart,
    endOffset: trimmedEnd,
  });

  return createTermFromText(trimmed, location);
}

function createTermFromText(
  text: string,
  location: ReturnType<typeof createSourceLocation>,
): DatalogTerm {
  if (isQuotedString(text)) {
    return constantTerm(unescapeString(text.slice(1, -1)), { location });
  }

  if (text === '_') {
    return wildcardTerm({ location });
  }

  if (/^-?\d+$/.test(text)) {
    return constantTerm(Number(text), { location });
  }

  if (text === 'true' || text === 'false') {
    return constantTerm(text === 'true', { location });
  }

  if (text === 'null') {
    return constantTerm(null, { location });
  }

  return variableTerm(text, { location });
}

function isQuotedString(text: string): boolean {
  return text.startsWith('"') && text.endsWith('"') && text.length >= 2;
}

function unescapeString(value: string): string {
  return value
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\');
}
