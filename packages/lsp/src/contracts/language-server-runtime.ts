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
import type { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';

export interface LanguageServerRuntime {
  readonly parseDocument: (source: string) => ParsedDocument;
  readonly workspaceIndex: DatalogWorkspaceIndex;
  readonly computeCompletions: (
    source: string,
    position: Position,
    context?: {
      readonly workspaceIndex?: DatalogWorkspaceIndex;
    },
  ) => readonly LanguageServerCompletionItem[];
  readonly computeHover: (
    source: string,
    position: Position,
    context?: {
      readonly targetUri?: string;
      readonly workspaceIndex?: DatalogWorkspaceIndex;
    },
  ) => LanguageServerHover | null;
  readonly computeDefinition: (
    source: string,
    position: Position,
    context?: {
      readonly targetUri?: string;
      readonly workspaceIndex?: DatalogWorkspaceIndex;
    },
  ) => LanguageServerDefinition | null;
  readonly computeDiagnostics: (source: string) => readonly LanguageServerDiagnostic[];
  readonly computeDocumentSymbols: (source: string) => readonly LanguageServerDocumentSymbol[];
  readonly computeFoldingRanges: (source: string) => readonly LanguageServerFoldingRange[];
  readonly computeSemanticTokens: (source: string) => readonly SemanticToken[];
}
