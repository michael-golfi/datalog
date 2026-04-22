import {
  createConnection,
  type Hover,
  ProposedFeatures,
  TextDocuments,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';

import type { LanguageServerRuntime } from '../contracts/language-server-runtime.js';
import { encodeSemanticTokens } from '../features/semantic-tokens.js';
import {
  toLspCompletionItem,
  toLspDiagnostic,
  toLspDocumentSymbol,
  toLspFoldingRange,
} from '../protocol/lsp-protocol-mappers.js';
import { createLanguageServerCapabilities } from './language-server-capabilities.js';

/** Attach protocol handlers and start listening on the LSP connection. */
export function runLanguageServer(runtime: LanguageServerRuntime): LanguageServerRuntime {
  const connection = createConnection(ProposedFeatures.all);
  const documents = new TextDocuments(TextDocument);

  registerLanguageServerHandlers(connection, documents, runtime);

  documents.listen(connection);
  connection.listen();

  return runtime;
}

function registerLanguageServerHandlers(
  connection: ReturnType<typeof createConnection>,
  documents: TextDocuments<TextDocument>,
  runtime: LanguageServerRuntime,
): void {
  connection.onInitialize(() => ({
    capabilities: createLanguageServerCapabilities(),
  }));
  registerDocumentChangeHandler(connection, documents, runtime);
  registerCompletionHandler(connection, documents, runtime);
  registerHoverHandler(connection, documents, runtime);
  registerDocumentSymbolHandler(connection, documents, runtime);
  registerFoldingRangeHandler(connection, documents, runtime);
  registerDefinitionHandler(connection, documents, runtime);
  registerSemanticTokensHandler(connection, documents, runtime);
}

function registerDocumentChangeHandler(
  connection: ReturnType<typeof createConnection>,
  documents: TextDocuments<TextDocument>,
  runtime: LanguageServerRuntime,
): void {
  documents.onDidChangeContent((change) => {
    void connection.sendDiagnostics({
      uri: change.document.uri,
      diagnostics: runtime.computeDiagnostics(change.document.getText()).map(toLspDiagnostic),
    });
  });
}

function registerCompletionHandler(
  connection: ReturnType<typeof createConnection>,
  documents: TextDocuments<TextDocument>,
  runtime: LanguageServerRuntime,
): void {
  connection.onCompletion((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    return runtime.computeCompletions(document.getText(), params.position).map(toLspCompletionItem);
  });
}

function registerHoverHandler(
  connection: ReturnType<typeof createConnection>,
  documents: TextDocuments<TextDocument>,
  runtime: LanguageServerRuntime,
): void {
  connection.onHover((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    const hover = runtime.computeHover(document.getText(), params.position);
    return hover ? createHoverResponse(hover) : null;
  });
}

function registerDocumentSymbolHandler(
  connection: ReturnType<typeof createConnection>,
  documents: TextDocuments<TextDocument>,
  runtime: LanguageServerRuntime,
): void {
  connection.onDocumentSymbol((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    return runtime.computeDocumentSymbols(document.getText()).map(toLspDocumentSymbol);
  });
}

function registerFoldingRangeHandler(
  connection: ReturnType<typeof createConnection>,
  documents: TextDocuments<TextDocument>,
  runtime: LanguageServerRuntime,
): void {
  connection.onFoldingRanges((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    return runtime.computeFoldingRanges(document.getText()).map(toLspFoldingRange);
  });
}

function registerDefinitionHandler(
  connection: ReturnType<typeof createConnection>,
  documents: TextDocuments<TextDocument>,
  runtime: LanguageServerRuntime,
): void {
  connection.onDefinition((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    const definition = runtime.computeDefinition(document.getText(), params.position, document.uri);
    if (!definition) {
      return null;
    }

    return {
      uri: definition.targetUri ?? document.uri,
      range: definition.targetSelectionRange,
    };
  });
}

function registerSemanticTokensHandler(
  connection: ReturnType<typeof createConnection>,
  documents: TextDocuments<TextDocument>,
  runtime: LanguageServerRuntime,
): void {
  connection.languages.semanticTokens.on((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return { data: [] };
    }

    return {
      data: encodeSemanticTokens(runtime.computeSemanticTokens(document.getText())),
    };
  });
}

function createHoverResponse(
  hover: NonNullable<ReturnType<LanguageServerRuntime['computeHover']>>,
): Hover {
  const response: Hover = {
    contents: { kind: 'markdown' as const, value: hover.contents },
  };

  if (hover.range) {
    response.range = hover.range;
  }

  return response;
}
