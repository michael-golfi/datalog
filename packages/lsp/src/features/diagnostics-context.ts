import { parseDatalogProgram, parseDocument } from '@datalog/parser';

import { collectDuplicateSchemaClauses } from './diagnostic-duplicate-defpred-schemas.js';

import type { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';

type ParsedDiagnosticsDocument = ReturnType<typeof parseDocument>;
type ParsedDiagnosticsProgram = ReturnType<typeof parseDatalogProgram>;
type ParsedDiagnosticsSource = NonNullable<ReturnType<DatalogWorkspaceIndex['getProgram']>>['sources'][number];

export interface DiagnosticsContext {
  readonly parsedDocument: ParsedDiagnosticsDocument;
  readonly parsedProgram: ParsedDiagnosticsProgram;
  readonly duplicateSchemaClauses: ReadonlySet<ParsedDiagnosticsDocument['clauses'][number]>;
}

/** Build the parser and duplicate-schema context needed for diagnostic computation. */
export function createDiagnosticsContext(
  source: string,
  context: {
    readonly targetUri?: string;
    readonly workspaceIndex?: DatalogWorkspaceIndex;
  },
): DiagnosticsContext {
  const targetDocument = getProgramTargetDocument(source, context);
  const parsedDocument = targetDocument?.parsedDocument ?? parseDocument(source);
  const parsedProgram = safeParseDatalogProgram(source);
  const sources = getDiagnosticsSources({
    parsedDocument,
    targetDocument,
    ...(context.targetUri ? { targetUri: context.targetUri } : {}),
    ...(context.workspaceIndex ? { workspaceIndex: context.workspaceIndex } : {}),
  });

  return {
    parsedDocument,
    parsedProgram,
    duplicateSchemaClauses: collectDuplicateSchemaClauses({
      targetSourceId: targetDocument?.sourceId ?? context.targetUri ?? 'local',
      sources,
    }),
  };
}

function safeParseDatalogProgram(source: string): ParsedDiagnosticsProgram {
  try {
    return parseDatalogProgram(source);
  } catch {
    return {
      kind: 'program',
      statements: [],
    };
  }
}

function getDiagnosticsSources(options: {
  readonly parsedDocument: ParsedDiagnosticsDocument;
  readonly targetDocument: ParsedDiagnosticsSource | null;
  readonly targetUri?: string;
  readonly workspaceIndex?: DatalogWorkspaceIndex;
}): ReadonlyArray<{ readonly sourceId: string; readonly parsedDocument: ParsedDiagnosticsDocument }> {
  if (options.targetDocument) {
    return options.workspaceIndex?.getProgram()?.sources ?? [options.targetDocument];
  }

  return [{ sourceId: options.targetUri ?? 'local', parsedDocument: options.parsedDocument }];
}

function getProgramTargetDocument(
  source: string,
  context: {
    readonly targetUri?: string;
    readonly workspaceIndex?: DatalogWorkspaceIndex;
  },
): (ParsedDiagnosticsSource & { readonly sourceId: string }) | null {
  if (!context.targetUri) {
    return null;
  }

  const targetDocument = context.workspaceIndex
    ?.getProgram()
    ?.sources.find((candidate) => candidate.sourceId === context.targetUri);
  if (targetDocument?.source !== source) {
    return null;
  }

  return targetDocument;
}
