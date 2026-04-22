import type { ParsedDocument, Position } from '@datalog/parser';

import type {
  LanguageServerCompletionItem,
  LanguageServerDefinition,
  LanguageServerDiagnostic,
  LanguageServerDocumentSymbol,
  LanguageServerFoldingRange,
  LanguageServerHover,
} from './language-feature-types.js';
import type { SemanticToken } from '../features/semantic-tokens.js';

export interface LanguageServerRuntime {
  readonly parseDocument: (source: string) => ParsedDocument;
  readonly computeCompletions: (
    source: string,
    position: Position,
  ) => readonly LanguageServerCompletionItem[];
  readonly computeHover: (source: string, position: Position) => LanguageServerHover | null;
  readonly computeDefinition: (
    source: string,
    position: Position,
    targetUri?: string,
  ) => LanguageServerDefinition | null;
  readonly computeDiagnostics: (source: string) => readonly LanguageServerDiagnostic[];
  readonly computeDocumentSymbols: (source: string) => readonly LanguageServerDocumentSymbol[];
  readonly computeFoldingRanges: (source: string) => readonly LanguageServerFoldingRange[];
  readonly computeSemanticTokens: (source: string) => readonly SemanticToken[];
}
