import type { ParsedDocument } from '../contracts/parsed-document.js';
import { classifyReferenceRole } from '../semantics/reference-role-classifier.js';
import { computeLineStarts } from '../syntax/line-starts.js';
import { parseClause } from '../syntax/parse-clause.js';
import { splitStatements } from '../syntax/split-statements.js';

import { collectGraphSemantics } from './collect-graph-semantics.js';
import { collectDatalogSymbols } from './collect-datalog-symbols.js';

/** Parse a Datalog document into clauses plus derived graph-oriented indexes. */
export function parseDocument(source: string): ParsedDocument {
  const lineStarts = computeLineStarts(source);
  const clauses = splitStatements(source)
    .map((statement) => parseClause(statement, lineStarts, classifyReferenceRole))
    .filter((clause): clause is NonNullable<typeof clause> => clause !== null);
  const semantics = collectGraphSemantics(clauses);
  const datalogSymbols = collectDatalogSymbols(clauses);

  return {
    clauses,
    ...semantics,
    datalogSymbols,
    lineStarts,
  };
}
