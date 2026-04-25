import {
  factStatement,
  queryStatement,
  ruleStatement,
  type DatalogLiteral,
  type DatalogLiteralConjunction,
  type DatalogQueryStatement,
  type DatalogStatement,
} from '@datalog/ast';

import { parseDatalogAtom } from './parse-datalog-atom.js';
import { parseDatalogLiteral } from './parse-datalog-literal.js';
import { createSourceLocation } from './source-location.js';
import { findTopLevelRuleDivider, splitTopLevelConjunction } from './top-level-scan.js';

import type { ParseContext, SourceSlice } from './parse-context.js';
import type { Statement } from '../syntax/split-statements.js';

const QUERY_PREFIX = '?-';

/** Parse one split statement into a shared AST statement. */
export function parseDatalogStatement(input: {
  readonly context: ParseContext;
  readonly statement: Statement;
}): DatalogStatement | null {
  const trimmed = input.statement.text.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const contentEnd = input.statement.startOffset + stripTrailingPeriod(input.statement.text).length;

  if (trimmed.startsWith(QUERY_PREFIX)) {
    return parseInlineQueryStatement(input.context, input.statement, contentEnd);
  }

  const content = input.context.source.slice(input.statement.startOffset, contentEnd);
  const divider = findTopLevelRuleDivider(content);

  if (divider >= 0) {
    return parseRuleStatement({
      context: input.context,
      statement: input.statement,
      divider,
      contentEnd,
    });
  }

  return parseFactStatement(input.context, input.statement, contentEnd);
}

/** Parse a standalone Datalog query or fact-pattern string. */
export function parseStandaloneQuery(
  source: string,
  lineStarts: readonly number[],
): DatalogQueryStatement {
  const startOffset = source.search(/\S|$/);
  const trimmed = source.trim();
  const content = stripTrailingPeriod(trimmed);
  const bodyStart = content.startsWith(QUERY_PREFIX)
    ? startOffset + content.indexOf(QUERY_PREFIX) + QUERY_PREFIX.length
    : startOffset;
  const contentEnd = startOffset + content.length;

  return parseQueryStatement({
    context: { source, lineStarts },
    bodySlice: { startOffset: bodyStart, endOffset: contentEnd },
    statementSlice: { startOffset, endOffset: contentEnd },
  });
}

function parseQueryStatement(input: {
  readonly context: ParseContext;
  readonly bodySlice: SourceSlice;
  readonly statementSlice: SourceSlice;
}): DatalogQueryStatement {
  const body = parseLiteralConjunction({ context: input.context, slice: input.bodySlice });

  return queryStatement({
    body,
    location: createSourceLocation({
      lineStarts: input.context.lineStarts,
      startOffset: input.statementSlice.startOffset,
      endOffset: input.statementSlice.endOffset,
    }),
  });
}

function parseInlineQueryStatement(
  context: ParseContext,
  statement: Statement,
  contentEnd: number,
): DatalogQueryStatement {
  const queryPrefixStart = statement.text.indexOf(QUERY_PREFIX);

  if (queryPrefixStart < 0) {
    throw new Error('Inline query statement is missing the query prefix.');
  }

  return parseQueryStatement({
    context,
    bodySlice: {
      startOffset: statement.startOffset + queryPrefixStart + QUERY_PREFIX.length,
      endOffset: contentEnd,
    },
    statementSlice: { startOffset: statement.startOffset, endOffset: contentEnd },
  });
}

function parseRuleStatement(input: {
  readonly context: ParseContext;
  readonly statement: Statement;
  readonly divider: number;
  readonly contentEnd: number;
}): DatalogStatement {
  const head = parseDatalogAtom({
    context: input.context,
    slice: {
      startOffset: input.statement.startOffset,
      endOffset: input.statement.startOffset + input.divider,
    },
  });
  const body = parseLiteralConjunction({
    context: input.context,
    slice: {
      startOffset: input.statement.startOffset + input.divider + 2,
      endOffset: input.contentEnd,
    },
  });

  return ruleStatement({
    head,
    body,
    location: createStatementLocation(input.context, input.statement),
  });
}

function parseFactStatement(
  context: ParseContext,
  statement: Statement,
  contentEnd: number,
): DatalogStatement {
  const atomNode = parseDatalogAtom({
    context,
    slice: { startOffset: statement.startOffset, endOffset: contentEnd },
  });

  return factStatement(atomNode, { location: createStatementLocation(context, statement) });
}

function parseLiteralConjunction(input: {
  readonly context: ParseContext;
  readonly slice: SourceSlice;
}): DatalogLiteralConjunction {
  const text = input.context.source.slice(input.slice.startOffset, input.slice.endOffset);
  const parts = splitTopLevelConjunction(text);
  const literals: DatalogLiteral[] = [];
  let searchFrom = 0;

  for (const part of parts) {
    const relativeIndex = text.indexOf(part, searchFrom);

    if (relativeIndex < 0) {
      throw new Error(`Unable to locate literal: ${part}`);
    }

    literals.push(
      parseDatalogLiteral({
        context: input.context,
        slice: {
          startOffset: input.slice.startOffset + relativeIndex,
          endOffset: input.slice.startOffset + relativeIndex + part.length,
        },
      }),
    );
    searchFrom = relativeIndex + part.length;
  }

  const [first, ...rest] = literals;

  if (first === undefined) {
    throw new Error('Datalog query/rule body must contain at least one literal.');
  }

  return [first, ...rest];
}

function stripTrailingPeriod(text: string): string {
  const trimmedEnd = text.trimEnd();
  return trimmedEnd.endsWith('.') ? trimmedEnd.slice(0, -1) : trimmedEnd;
}

function createStatementLocation(context: ParseContext, statement: Statement) {
  return createSourceLocation({
    lineStarts: context.lineStarts,
    startOffset: statement.startOffset,
    endOffset: statement.startOffset + statement.text.length,
  });
}
