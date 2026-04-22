import { parseDocument } from '@datalog/parser';

import type { LanguageServerRuntime } from '../contracts/language-server-runtime.js';
import { computeCompletions } from '../features/completions.js';
import { computeDefinition } from '../features/definition.js';
import { computeDiagnostics } from '../features/diagnostics.js';
import { computeFoldingRanges } from '../features/folding.js';
import { computeHover } from '../features/hover.js';
import { computeSemanticTokens } from '../features/semantic-tokens.js';
import { computeDocumentSymbols } from '../features/symbols.js';

/** Create the parser-backed runtime surface used by the language server. */
export function createLanguageServerRuntime(): LanguageServerRuntime {
  return {
    parseDocument,
    computeCompletions,
    computeHover,
    computeDefinition,
    computeDiagnostics,
    computeDocumentSymbols,
    computeFoldingRanges,
    computeSemanticTokens,
  };
}
