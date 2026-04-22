import { parseDocument } from '@datalog/parser';

import type { LanguageServerDocumentSymbol } from '../contracts/language-feature-types.js';

/** Compute document symbols for clauses, compounds, and rules in a document. */
export function computeDocumentSymbols(source: string): LanguageServerDocumentSymbol[] {
  const parsed = parseDocument(source);

  return parsed.clauses.map((clause): LanguageServerDocumentSymbol => ({
    name: clause.isCompound ? `${clause.predicate}@` : clause.predicate,
    kind: getDocumentSymbolKind(clause.isRule, clause.isCompound),
    range: clause.range,
    selectionRange: clause.predicateRange,
    detail: getDocumentSymbolDetail(clause),
  }));
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
