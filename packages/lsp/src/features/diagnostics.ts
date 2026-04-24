import { parseDocument } from '@datalog/parser';

import type { LanguageServerDiagnostic } from '../contracts/language-feature-types.js';
import type { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';
import { collectDuplicateSchemaClauses } from './diagnostic-duplicate-defpred-schemas.js';

const EXPECTED_ARITY = new Map<string, number>([
  ['DefPred', 5],
  ['Edge', 3],
]);

/** Compute diagnostics for the current document text. */
export function computeDiagnostics(
  source: string,
  context: {
    readonly targetUri?: string;
    readonly workspaceIndex?: DatalogWorkspaceIndex;
  } = {},
): LanguageServerDiagnostic[] {
  const diagnosticsContext = createDiagnosticsContext(source, context);
  const diagnostics = createSourceDiagnostics(source);
  const allowInteractiveQuery = isLikelyInteractiveQuery(source, diagnosticsContext.parsedDocument.clauses.length);

  for (const clause of diagnosticsContext.parsedDocument.clauses) {
    diagnostics.push(...createClauseDiagnostics({
      source,
      clause,
      duplicateSchemaClauses: diagnosticsContext.duplicateSchemaClauses,
      allowInteractiveQuery,
    }));
  }

  return diagnostics;
}

function createDiagnosticsContext(
  source: string,
  context: {
    readonly targetUri?: string;
    readonly workspaceIndex?: DatalogWorkspaceIndex;
  },
): {
  readonly parsedDocument: ReturnType<typeof parseDocument>;
  readonly duplicateSchemaClauses: ReadonlySet<ReturnType<typeof parseDocument>['clauses'][number]>;
} {
  const targetDocument = getProgramTargetDocument(source, context);
  const parsedDocument = targetDocument?.parsedDocument ?? parseDocument(source);
  const sources = getDiagnosticsSources({
    parsedDocument,
    targetDocument,
    ...(context.targetUri ? { targetUri: context.targetUri } : {}),
    ...(context.workspaceIndex ? { workspaceIndex: context.workspaceIndex } : {}),
  });

  return {
    parsedDocument,
    duplicateSchemaClauses: collectDuplicateSchemaClauses({
      targetSourceId: targetDocument?.sourceId ?? context.targetUri ?? 'local',
      sources,
    }),
  };
}

function getDiagnosticsSources(options: {
  readonly parsedDocument: ReturnType<typeof parseDocument>;
  readonly targetDocument: ReturnType<typeof getProgramTargetDocument>;
  readonly targetUri?: string;
  readonly workspaceIndex?: DatalogWorkspaceIndex;
}): ReadonlyArray<{
  readonly sourceId: string;
  readonly parsedDocument: ReturnType<typeof parseDocument>;
}> {
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
): (NonNullable<ReturnType<DatalogWorkspaceIndex['getProgram']>>['sources'][number] & { readonly sourceId: string }) | null {
  if (!context.targetUri) {
    return null;
  }

  const program = context.workspaceIndex?.getProgram();
  const targetDocument = program?.sources.find((candidate) => candidate.sourceId === context.targetUri);
  if (targetDocument?.source !== source) {
    return null;
  }

  return targetDocument;
}

function createSourceDiagnostics(source: string): LanguageServerDiagnostic[] {
  if ((source.match(/"/g) ?? []).length % 2 !== 1) {
    return [];
  }

  return [{
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 1 },
    },
    severity: 'error',
    source: 'datalog',
    message: 'Detected an unterminated string literal.',
  }];
}

function createClauseDiagnostics(
  options: {
    readonly source: string;
    readonly clause: ReturnType<typeof parseDocument>['clauses'][number];
    readonly duplicateSchemaClauses: ReadonlySet<ReturnType<typeof parseDocument>['clauses'][number]>;
    readonly allowInteractiveQuery: boolean;
  },
): LanguageServerDiagnostic[] {
  return [
    ...createArityDiagnostics(options.clause),
    ...createDuplicateSchemaDiagnostics(options.clause, options.duplicateSchemaClauses),
    ...createClauseTerminationDiagnostics(options.source, options.clause, options.allowInteractiveQuery),
  ];
}

function createArityDiagnostics(
  clause: ReturnType<typeof parseDocument>['clauses'][number],
): LanguageServerDiagnostic[] {
  const expectedArity = EXPECTED_ARITY.get(clause.predicate);
  if (typeof expectedArity !== 'number' || clause.arity === expectedArity) {
    return [];
  }

  return [{
    range: clause.predicateRange,
    severity: 'error',
    source: 'datalog',
    message: `${clause.predicate} expects arity ${expectedArity}, found ${clause.arity}.`,
  }];
}

function createDuplicateSchemaDiagnostics(
  clause: ReturnType<typeof parseDocument>['clauses'][number],
  duplicateSchemaClauses: ReadonlySet<ReturnType<typeof parseDocument>['clauses'][number]>,
): LanguageServerDiagnostic[] {
  if (clause.predicate !== 'DefPred') {
    return [];
  }

  const predicateReference = clause.references[0];
  const predicateId = predicateReference?.value;
  if (!predicateReference || !predicateId) {
    return [];
  }

  return duplicateSchemaClauses.has(clause)
    ? [{
      range: predicateReference.range,
      severity: 'warning' as const,
      source: 'datalog',
      message: `Duplicate DefPred for ${predicateId}.`,
    }]
    : [];
}

function createClauseTerminationDiagnostics(
  source: string,
  clause: ReturnType<typeof parseDocument>['clauses'][number],
  allowInteractiveQuery: boolean,
): LanguageServerDiagnostic[] {
  if (allowInteractiveQuery || getClauseText(source, clause).endsWith('.')) {
    return [];
  }

  return [{
    range: clause.range,
    severity: 'error',
    source: 'datalog',
    message: 'Clause must end with a period.',
  }];
}

function getClauseText(source: string, clause: ReturnType<typeof parseDocument>['clauses'][number]): string {
  return source
    .split('\n')
    .slice(clause.range.start.line, clause.range.end.line + 1)
    .join('\n')
    .trimEnd();
}

function isLikelyInteractiveQuery(source: string, clauseCount: number): boolean {
  const trimmed = source.trim();

  return clauseCount === 1
    && trimmed.length > 0
    && !trimmed.endsWith('.')
    && !trimmed.includes('\n')
    && !trimmed.startsWith('%');
}
