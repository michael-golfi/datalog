import type { ParseDocumentResult } from '@datalog/parser';

type ParsedClause = ParseDocumentResult['clauses'][number];

/** Collect duplicate `DefPred` clauses for one target source in program order. */
export function collectDuplicateSchemaClauses(options: {
  readonly targetSourceId: string;
  readonly sources: ReadonlyArray<{
    readonly sourceId: string;
    readonly parsedDocument: ParseDocumentResult;
  }>;
}): ReadonlySet<ParsedClause> {
  const seenSchemas = new Set<string>();
  const duplicateClauses = new Set<ParsedClause>();

  for (const source of options.sources) {
    for (const clause of source.parsedDocument.clauses) {
      trackDuplicateSchemaClause({
        clause,
        sourceId: source.sourceId,
        targetSourceId: options.targetSourceId,
        seenSchemas,
        duplicateClauses,
      });
    }
  }

  return duplicateClauses;
}

function trackDuplicateSchemaClause(options: {
  readonly clause: ParsedClause;
  readonly sourceId: string;
  readonly targetSourceId: string;
  readonly seenSchemas: Set<string>;
  readonly duplicateClauses: Set<ParsedClause>;
}): void {
  const predicateId = getDefPredPredicateId(options.clause);
  if (!predicateId) {
    return;
  }

  if (options.seenSchemas.has(predicateId) && options.sourceId === options.targetSourceId) {
    options.duplicateClauses.add(options.clause);
  }

  options.seenSchemas.add(predicateId);
}

function getDefPredPredicateId(clause: ParsedClause): string | null {
  if (clause.predicate !== 'DefPred') {
    return null;
  }

  return clause.references[0]?.value ?? null;
}
