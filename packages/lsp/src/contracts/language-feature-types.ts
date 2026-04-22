import type { Position as ParserPosition, Range as ParserRange } from '@datalog/parser';

export type Position = ParserPosition;
export type Range = ParserRange;

export interface LanguageServerDiagnostic {
  readonly range: Range;
  readonly severity: 'error' | 'warning' | 'information' | 'hint';
  readonly source: string;
  readonly message: string;
}

export interface LanguageServerCompletionItem {
  readonly label: string;
  readonly kind: 'keyword' | 'value' | 'property' | 'reference' | 'snippet';
  readonly detail?: string;
  readonly documentation?: string;
  readonly insertText?: string;
  readonly sortText?: string;
}

export interface LanguageServerHover {
  readonly contents: string;
  readonly range?: Range;
}

export interface LanguageServerDocumentSymbol {
  readonly name: string;
  readonly kind: 'function' | 'variable' | 'property' | 'key';
  readonly range: Range;
  readonly selectionRange: Range;
  readonly detail?: string;
}

export interface LanguageServerFoldingRange {
  readonly startLine: number;
  readonly endLine: number;
  readonly kind?: 'comment' | 'region';
}

export interface LanguageServerDefinition {
  readonly targetSelectionRange: Range;
  readonly targetUri?: string;
}
