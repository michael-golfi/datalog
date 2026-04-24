import { program, type DatalogProgram } from '@datalog/ast';

import { parseDocument } from '../analysis/parse-document.js';
import type { ParsedDocument } from '../contracts/parsed-document.js';

import { parseDatalogProgram } from './parse-datalog-program.js';

export interface DatalogProgramSource {
  readonly sourceId: string;
  readonly source: string;
}

export interface ParsedDatalogProgramSource extends DatalogProgramSource {
  readonly parsedDocument: ParsedDocument;
  readonly program: DatalogProgram;
}

export interface ParsedDatalogProgramSources {
  readonly sources: readonly ParsedDatalogProgramSource[];
  readonly program: DatalogProgram;
}

/** Parse an ordered set of Datalog sources into per-source analysis plus a combined AST program. */
export function parseDatalogProgramSources(
  sources: readonly DatalogProgramSource[],
): ParsedDatalogProgramSources {
  const parsedSources = sources.map((source) => {
    const parsedProgram = parseDatalogProgram(source.source);

    return {
      ...source,
      parsedDocument: parseDocument(source.source),
      program: parsedProgram,
    } satisfies ParsedDatalogProgramSource;
  });

  return {
    sources: parsedSources,
    program: program({
      statements: parsedSources.flatMap((source) => source.program.statements),
    }),
  };
}
