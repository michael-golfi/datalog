import { program, type DatalogProgram } from '@datalog/ast';

import { parseDatalogStatement } from './parse-datalog-statement.js';
import { computeLineStarts } from '../syntax/line-starts.js';
import { splitStatements } from '../syntax/split-statements.js';

import type { ParseContext } from './parse-context.js';

/** Parse a Datalog source document into the shared AST program model. */
export function parseDatalogProgram(source: string): DatalogProgram {
  const lineStarts = computeLineStarts(source);
  const context: ParseContext = { source, lineStarts };
  const statements = splitStatements(source)
    .map((statement) => parseDatalogStatement({ context, statement }))
    .filter((statement): statement is NonNullable<typeof statement> => statement !== null);

  return program({ statements });
}
