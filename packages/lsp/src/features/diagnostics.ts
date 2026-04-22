import { parseDocument } from '@datalog/parser';

import type { LanguageServerDiagnostic } from '../contracts/language-feature-types.js';

const EXPECTED_ARITY = new Map<string, number>([
  ['DefPred', 5],
  ['Edge', 3],
]);

/** Compute diagnostics for the current document text. */
export function computeDiagnostics(source: string): LanguageServerDiagnostic[] {
  const parsed = parseDocument(source);
  const diagnostics = createSourceDiagnostics(source);
  const seenSchemas = new Set<string>();
  const allowInteractiveQuery = isLikelyInteractiveQuery(source, parsed.clauses.length);

  for (const clause of parsed.clauses) {
    diagnostics.push(...createClauseDiagnostics({ source, clause, seenSchemas, allowInteractiveQuery }));
  }

  return diagnostics;
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
    readonly seenSchemas: Set<string>;
    readonly allowInteractiveQuery: boolean;
  },
): LanguageServerDiagnostic[] {
  return [
    ...createArityDiagnostics(options.clause),
    ...createDuplicateSchemaDiagnostics(options.clause, options.seenSchemas),
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
  seenSchemas: Set<string>,
): LanguageServerDiagnostic[] {
  if (clause.predicate !== 'DefPred') {
    return [];
  }

  const predicateReference = clause.references[0];
  const predicateId = predicateReference?.value;
  if (!predicateReference || !predicateId) {
    return [];
  }

  const diagnostics = seenSchemas.has(predicateId)
    ? [{
      range: predicateReference.range,
      severity: 'warning' as const,
      source: 'datalog',
      message: `Duplicate DefPred for ${predicateId}.`,
    }]
    : [];

  seenSchemas.add(predicateId);
  return diagnostics;
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
