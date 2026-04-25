import { getStringReferenceAtPosition, positionToOffset } from '@datalog/parser';
import type { parseDocument, ParsedClause } from '@datalog/parser';

import {
  getCompoundFieldPrefix,
  getIdentifierPrefix,
  getStringCompletionSlot,
  isCompoundFieldKeyPosition,
  isPredicatePosition,
  scanStatementPrefix,
} from './completion-scan.js';
import { collectClauseVariables, isVariableTermPosition } from './completion-variable-scan.js';

import type { Position, Range } from '../contracts/language-feature-types.js';

export type CompletionSlot =
  | { readonly kind: 'suppressed' }
  | { readonly kind: 'graph-predicate-string'; readonly prefix: string }
  | { readonly kind: 'node-id-string'; readonly prefix: string }
  | { readonly kind: 'compound-field-key'; readonly predicateName: string; readonly prefix: string }
  | {
      readonly kind: 'variable-term';
      readonly prefix: string;
      readonly variables: readonly string[];
    }
  | { readonly kind: 'predicate'; readonly prefix: string };

interface StatementScanContext {
  readonly prefix: string;
  readonly currentLinePrefix: string;
}

/** Scan the current source position and classify the completion slot to fill. */
export function classifyCompletionSlot(
  source: string,
  position: Position,
  parsed: ReturnType<typeof parseDocument>,
): CompletionSlot {
  const cursorOffset = positionToOffset(parsed.lineStarts, position);
  const stringReference = getStringReferenceAtPosition(source, position);

  if (stringReference) {
    return classifyStringReferenceSlot({
      source,
      lineStarts: parsed.lineStarts,
      range: stringReference.range,
      position,
      role: stringReference.role,
    });
  }

  const clause = findClauseAtOffset(parsed.clauses, parsed.lineStarts, cursorOffset);
  const statementContext = getStatementScanContext({
    source,
    parsed,
    position,
    cursorOffset,
    clause,
  });
  const scan = scanStatementPrefix(statementContext.prefix);
  const nonPredicateSlot = getNonPredicateSlot(statementContext.prefix, clause !== null, scan);

  if (nonPredicateSlot) {
    return nonPredicateSlot;
  }

  if (!isPredicatePosition(statementContext.currentLinePrefix)) {
    return { kind: 'suppressed' };
  }

  return { kind: 'predicate', prefix: getIdentifierPrefix(statementContext.currentLinePrefix) };
}

function getNonPredicateSlot(
  clausePrefix: string,
  hasClause: boolean,
  scan: ReturnType<typeof scanStatementPrefix>,
): CompletionSlot | null {
  if (scan.inComment) {
    return { kind: 'suppressed' };
  }

  if (scan.inString) {
    return getStringCompletionSlot(scan.activeCall, scan.stringPrefix) ?? { kind: 'suppressed' };
  }

  const compoundFieldSlot = getCompoundFieldSlot(scan);
  if (compoundFieldSlot) {
    return compoundFieldSlot;
  }

  const variableSlot = getVariableSlot(clausePrefix, hasClause, scan);
  if (variableSlot) {
    return variableSlot;
  }

  return null;
}

function getCompoundFieldSlot(
  scan: ReturnType<typeof scanStatementPrefix>,
): Extract<CompletionSlot, { readonly kind: 'compound-field-key' }> | null {
  if (!scan.activeCall?.isCompound || !isCompoundFieldKeyPosition(scan.currentArgumentPrefix)) {
    return null;
  }

  return {
    kind: 'compound-field-key',
    predicateName: scan.activeCall.name,
    prefix: getCompoundFieldPrefix(scan.currentArgumentPrefix),
  };
}

function getVariableSlot(
  clausePrefix: string,
  hasClause: boolean,
  scan: ReturnType<typeof scanStatementPrefix>,
): Extract<CompletionSlot, { readonly kind: 'variable-term' }> | null {
  if (!hasClause || !isVariableTermPosition(scan.currentArgumentPrefix, scan.currentTokenPrefix)) {
    return null;
  }

  return {
    kind: 'variable-term',
    prefix: scan.currentTokenPrefix,
    variables: collectClauseVariables(clausePrefix, scan.currentTokenPrefix),
  };
}

function classifyStringReferenceSlot(options: {
  readonly source: string;
  readonly lineStarts: readonly number[];
  readonly range: Range;
  readonly position: Position;
  readonly role: 'graph-predicate' | 'node-id' | 'label';
}): CompletionSlot {
  const prefix = getReferencePrefix(options);
  if (options.role === 'graph-predicate') {
    return { kind: 'graph-predicate-string', prefix };
  }

  if (options.role === 'node-id') {
    return { kind: 'node-id-string', prefix };
  }

  return { kind: 'suppressed' };
}

function getReferencePrefix(options: {
  readonly source: string;
  readonly lineStarts: readonly number[];
  readonly range: Range;
  readonly position: Position;
}): string {
  const startOffset = positionToOffset(options.lineStarts, options.range.start);
  const endOffset = Math.max(startOffset, positionToOffset(options.lineStarts, options.position));
  return options.source.slice(startOffset, endOffset);
}

function findClauseAtOffset(
  clauses: readonly ParsedClause[],
  lineStarts: readonly number[],
  offset: number,
): ParsedClause | null {
  for (const clause of clauses) {
    const startOffset = positionToOffset(lineStarts, clause.range.start);
    const endOffset = positionToOffset(lineStarts, clause.range.end);

    if (offset >= startOffset && offset <= endOffset) {
      return clause;
    }
  }

  return null;
}

function getStatementScanContext(options: {
  readonly source: string;
  readonly parsed: ReturnType<typeof parseDocument>;
  readonly position: Position;
  readonly cursorOffset: number;
  readonly clause: ParsedClause | null;
}): StatementScanContext {
  if (options.clause) {
    const startOffset = positionToOffset(options.parsed.lineStarts, options.clause.range.start);
    return {
      prefix: options.source.slice(startOffset, options.cursorOffset),
      currentLinePrefix: getCurrentLinePrefix(options.source, options.position),
    };
  }

  const lineStart = options.parsed.lineStarts[options.position.line] ?? 0;
  return {
    prefix: options.source.slice(lineStart, options.cursorOffset),
    currentLinePrefix: getCurrentLinePrefix(options.source, options.position),
  };
}

function getCurrentLinePrefix(source: string, position: Position): string {
  const line = source.split('\n')[position.line] ?? '';
  return line.slice(0, position.character);
}
