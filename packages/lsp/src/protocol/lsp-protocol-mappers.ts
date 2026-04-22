import {
  CompletionItemKind,
  DiagnosticSeverity,
  type CompletionItem,
  type Diagnostic,
  type DocumentSymbol,
  FoldingRangeKind,
  type FoldingRange,
  SymbolKind,
} from 'vscode-languageserver/node.js';

import type {
  LanguageServerCompletionItem,
  LanguageServerDiagnostic,
  LanguageServerDocumentSymbol,
  LanguageServerFoldingRange,
} from '../contracts/language-feature-types.js';

/** Convert an internal diagnostic into the LSP wire diagnostic shape. */
export function toLspDiagnostic(diagnostic: LanguageServerDiagnostic): Diagnostic {
  return {
    range: diagnostic.range,
    severity: diagnostic.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    source: diagnostic.source,
    message: diagnostic.message,
  };
}

/** Convert an internal completion item into the LSP completion shape. */
export function toLspCompletionItem(item: LanguageServerCompletionItem): CompletionItem {
  return {
    label: item.label,
    kind: getCompletionItemKind(item.kind),
    ...(item.detail ? { detail: item.detail } : {}),
    ...(item.documentation ? { documentation: item.documentation } : {}),
    ...(item.insertText ? { insertText: item.insertText } : {}),
    ...(item.sortText ? { sortText: item.sortText } : {}),
  };
}

/** Convert an internal document symbol into the LSP document symbol shape. */
export function toLspDocumentSymbol(symbol: LanguageServerDocumentSymbol): DocumentSymbol {
  return {
    name: symbol.name,
    kind: getDocumentSymbolKind(symbol.kind),
    range: symbol.range,
    selectionRange: symbol.selectionRange,
    ...(symbol.detail ? { detail: symbol.detail } : {}),
  };
}

/** Convert an internal folding range into the LSP folding range shape. */
export function toLspFoldingRange(range: LanguageServerFoldingRange): FoldingRange {
  return {
    startLine: range.startLine,
    endLine: range.endLine,
    kind: range.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
  };
}

function getCompletionItemKind(kind: LanguageServerCompletionItem['kind']): CompletionItemKind {
  if (kind === 'keyword') {
    return CompletionItemKind.Keyword;
  }

  if (kind === 'property') {
    return CompletionItemKind.Property;
  }

  if (kind === 'reference') {
    return CompletionItemKind.Reference;
  }

  if (kind === 'snippet') {
    return CompletionItemKind.Snippet;
  }

  return CompletionItemKind.Value;
}

function getDocumentSymbolKind(kind: LanguageServerDocumentSymbol['kind']): SymbolKind {
  if (kind === 'function') {
    return SymbolKind.Function;
  }

  if (kind === 'property') {
    return SymbolKind.Property;
  }

  return SymbolKind.Key;
}
