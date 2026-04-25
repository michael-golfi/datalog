import { TextDocumentSyncKind } from 'vscode-languageserver/node.js';

import { SEMANTIC_TOKEN_MODIFIERS, SEMANTIC_TOKEN_TYPES } from '../features/semantic-tokens.js';

import type { ServerCapabilities } from 'vscode-languageserver/node.js';

/** Create the language server capability declaration exposed during initialization. */
export function createLanguageServerCapabilities(): ServerCapabilities {
  return {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    completionProvider: {
      triggerCharacters: ['"', ',', '(', '@', ' '],
    },
    hoverProvider: true,
    documentSymbolProvider: true,
    foldingRangeProvider: true,
    definitionProvider: true,
    semanticTokensProvider: {
      legend: {
        tokenTypes: [...SEMANTIC_TOKEN_TYPES],
        tokenModifiers: [...SEMANTIC_TOKEN_MODIFIERS],
      },
      full: true,
    },
  };
}
