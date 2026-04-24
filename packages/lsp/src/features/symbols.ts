import { parseDocument } from '@datalog/parser';

import type { LanguageServerDocumentSymbol } from '../contracts/language-feature-types.js';

/** Compute document symbols for clauses, compounds, and rules in a document. */
export function computeDocumentSymbols(source: string): LanguageServerDocumentSymbol[] {
  const parsed = parseDocument(source);
  const repeatedUserIdentityKeys = getRepeatedUserIdentityKeys(parsed);
  const groupedClauses = groupClausesByIdentity(parsed.clauses);
  const seenGroupedIdentityKeys = new Set<string>();

  return parsed.clauses.flatMap((clause): LanguageServerDocumentSymbol[] => {
    const identityKey = getClauseIdentityKey(clause);

    if (!repeatedUserIdentityKeys.has(identityKey)) {
      return [createClauseSymbol(clause)];
    }

    if (seenGroupedIdentityKeys.has(identityKey)) {
      return [];
    }

    seenGroupedIdentityKeys.add(identityKey);
    return [createGroupedClauseSymbol(groupedClauses.get(identityKey) ?? [clause])];
  });
}

function getRepeatedUserIdentityKeys(parsed: ReturnType<typeof parseDocument>): Set<string> {
  return new Set(
    parsed.datalogSymbols.predicates
      .filter((symbol) => symbol.identity.kind === 'user-predicate')
      .filter((symbol) => symbol.occurrences.filter((occurrence) => occurrence.kind === 'head').length > 1)
      .map((symbol) => `${symbol.identity.name}/${symbol.identity.arity}`),
  );
}

function groupClausesByIdentity(
  clauses: ReturnType<typeof parseDocument>['clauses'],
): Map<string, Array<(typeof clauses)[number]>> {
  const groupedClauses = new Map<string, Array<(typeof clauses)[number]>>();

  for (const clause of clauses) {
    const identityKey = getClauseIdentityKey(clause);
    const existingClauses = groupedClauses.get(identityKey) ?? [];
    existingClauses.push(clause);
    groupedClauses.set(identityKey, existingClauses);
  }

  return groupedClauses;
}

function getClauseIdentityKey(clause: ReturnType<typeof parseDocument>['clauses'][number]): string {
  return `${clause.predicate}/${clause.arity}`;
}

function createClauseSymbol(
  clause: ReturnType<typeof parseDocument>['clauses'][number],
): LanguageServerDocumentSymbol {
  return {
    name: getClauseDisplayName(clause),
    kind: getDocumentSymbolKind(clause.isRule, clause.isCompound),
    range: clause.range,
    selectionRange: clause.predicateRange,
    detail: getDocumentSymbolDetail(clause),
  };
}

function createGroupedClauseSymbol(
  clauses: ReadonlyArray<ReturnType<typeof parseDocument>['clauses'][number]>,
): LanguageServerDocumentSymbol {
  const firstClause = clauses[0];
  const lastClause = clauses[clauses.length - 1];

  if (firstClause === undefined || lastClause === undefined) {
    throw new Error('Grouped document symbols require at least one clause.');
  }

  return {
    name: `${getClauseDisplayName(firstClause)}/${firstClause.arity}`,
    kind: getDocumentSymbolKind(firstClause.isRule, firstClause.isCompound),
    range: {
      start: firstClause.range.start,
      end: lastClause.range.end,
    },
    selectionRange: firstClause.predicateRange,
    detail: `${clauses.length} definitions`,
    children: clauses.map((clause) => createClauseSymbol(clause)),
  };
}

function getClauseDisplayName(clause: ReturnType<typeof parseDocument>['clauses'][number]): string {
  return clause.isCompound ? `${clause.predicate}@` : clause.predicate;
}

function getDocumentSymbolKind(
  isRule: boolean,
  isCompound: boolean,
): LanguageServerDocumentSymbol['kind'] {
  if (isRule) {
    return 'function';
  }

  if (isCompound) {
    return 'property';
  }

  return 'key';
}

function getDocumentSymbolDetail(
  clause: ReturnType<typeof parseDocument>['clauses'][number],
): string {
  if (clause.isRule) {
    return `rule / arity ${clause.arity}`;
  }

  if (clause.predicate === 'DefPred') {
    return 'graph predicate contract';
  }

  if (clause.predicate === 'Edge') {
    return 'graph edge';
  }

  if (clause.isCompound) {
    return 'compound fact';
  }

  return `fact / arity ${clause.arity}`;
}
