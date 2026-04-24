import type { DatalogQueryStatement } from '@datalog/ast';

import { computeLineStarts } from '../syntax/line-starts.js';

import { parseStandaloneQuery } from './parse-datalog-statement.js';

/** Parse a standalone Datalog query or fact-pattern string into a query AST node. */
export function parseDatalogQuery(source: string): DatalogQueryStatement {
  return parseStandaloneQuery(source, computeLineStarts(source));
}
