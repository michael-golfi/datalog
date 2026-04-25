import { parseDocument } from '@datalog/parser';

import { computeCompletions } from '../features/completions.js';
import { computeDefinition } from '../features/definition.js';
import { computeDiagnostics } from '../features/diagnostics.js';
import { computeFoldingRanges } from '../features/folding.js';
import { computeHover } from '../features/hover.js';
import { computeSemanticTokens } from '../features/semantic-tokens.js';
import { computeDocumentSymbols } from '../features/symbols.js';
import { DatalogDocumentStore } from '../workspace/datalog-document-store.js';
import { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';

import type { LanguageServerRuntime } from '../contracts/language-server-runtime.js';

/** Create the parser-backed runtime surface used by the language server. */
export function createLanguageServerRuntime(): LanguageServerRuntime {
  const documentStore = new DatalogDocumentStore();
  const workspaceIndex = new DatalogWorkspaceIndex({ documentStore });

  return {
    parseDocument,
    workspaceIndex,
    computeCompletions,
    computeHover,
    computeDefinition,
    computeDiagnostics,
    computeDocumentSymbols,
    computeFoldingRanges,
    computeSemanticTokens,
  };
}
