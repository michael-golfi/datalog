import { fileURLToPath } from 'node:url';

import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  type InitializeParams,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { createLanguageServerCapabilities } from './language-server-capabilities.js';
import {
  clearDocumentDiagnostics,
  createDefinitionLocation,
  createHoverResponse,
  getDeletedWatchedFileUris,
  publishDiagnosticsForOpenDocuments,
} from './language-server-diagnostics.js';
import { encodeSemanticTokens } from '../features/semantic-tokens.js';
import {
  toLspCompletionItem,
  toLspDocumentSymbol,
  toLspFoldingRange,
} from '../protocol/lsp-protocol-mappers.js';

import type { LanguageServerRuntime } from '../contracts/language-server-runtime.js';

/** Attach protocol handlers and start listening on the LSP connection. */
export function runLanguageServer(runtime: LanguageServerRuntime): LanguageServerRuntime {
  const connection = createConnection(ProposedFeatures.all);
  const documents = new TextDocuments(TextDocument);

  registerLanguageServerHandlers(connection, documents, runtime);

  documents.listen(connection);
  connection.listen();

  return runtime;
}

/** Register all document, workspace, and feature handlers on the server connection. */
export function registerLanguageServerHandlers(
  connection: ReturnType<typeof createConnection>,
  documents: TextDocuments<TextDocument>,
  runtime: LanguageServerRuntime,
): void {
  connection.onInitialize(async (params) => {
    await runtime.workspaceIndex.setWorkspaceRootPath(resolveWorkspaceRootPath(params));

    return {
      capabilities: createLanguageServerCapabilities(),
    };
  });
  registerDocumentChangeHandler(connection, documents, runtime);
  registerCompletionHandler(connection, documents, runtime);
  registerHoverHandler(connection, documents, runtime);
  registerDocumentSymbolHandler(connection, documents, runtime);
  registerFoldingRangeHandler(connection, documents, runtime);
  registerDefinitionHandler(connection, documents, runtime);
  registerSemanticTokensHandler(connection, documents, runtime);
  registerWatchedFileHandler(connection, documents, runtime);
}

function registerDocumentChangeHandler(
  connection: ReturnType<typeof createConnection>,
  documents: TextDocuments<TextDocument>,
  runtime: LanguageServerRuntime,
): void {
  documents.onDidOpen((change) => {
    runtime.workspaceIndex.upsertOpenDocument({
      uri: change.document.uri,
      source: change.document.getText(),
    });
    void publishDiagnosticsForOpenDocuments(connection, documents, runtime);
  });
  documents.onDidChangeContent((change) => {
    runtime.workspaceIndex.upsertOpenDocument({
      uri: change.document.uri,
      source: change.document.getText(),
    });
    void publishDiagnosticsForOpenDocuments(connection, documents, runtime);
  });
  documents.onDidClose(async (change) => {
    runtime.workspaceIndex.removeOpenDocument(change.document.uri);
    await runtime.workspaceIndex.refresh();
    await clearDocumentDiagnostics(connection, change.document.uri);
    await publishDiagnosticsForOpenDocuments(connection, documents, runtime);
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

    return runtime
      .computeCompletions(document.getText(), params.position, {
        workspaceIndex: runtime.workspaceIndex,
      })
      .map(toLspCompletionItem);
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

    const hover = runtime.computeHover(document.getText(), params.position, {
      targetUri: document.uri,
      workspaceIndex: runtime.workspaceIndex,
    });
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

    const definition = runtime.computeDefinition(document.getText(), params.position, {
      targetUri: document.uri,
      workspaceIndex: runtime.workspaceIndex,
    });
    if (!definition) {
      return null;
    }

    if (definition.length === 1) {
      const [singleDefinition] = definition;
      return singleDefinition ? createDefinitionLocation(singleDefinition, document.uri) : null;
    }

    return definition.map((target) => createDefinitionLocation(target, document.uri));
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

function registerWatchedFileHandler(
  connection: ReturnType<typeof createConnection>,
  documents: TextDocuments<TextDocument>,
  runtime: LanguageServerRuntime,
): void {
  connection.onDidChangeWatchedFiles((params) => {
    void handleWatchedFileChanges({ connection, documents, runtime, params });
  });
}

async function handleWatchedFileChanges(options: {
  readonly connection: ReturnType<typeof createConnection>;
  readonly documents: TextDocuments<TextDocument>;
  readonly runtime: LanguageServerRuntime;
  readonly params: Parameters<
    Parameters<ReturnType<typeof createConnection>['onDidChangeWatchedFiles']>[0]
  >[0];
}): Promise<void> {
  await options.runtime.workspaceIndex.refresh();

  for (const deletedUri of getDeletedWatchedFileUris(options.params)) {
    await clearDocumentDiagnostics(options.connection, deletedUri);
  }

  await publishDiagnosticsForOpenDocuments(options.connection, options.documents, options.runtime);
}

function resolveWorkspaceRootPath(params: InitializeParams): string | null {
  const workspaceUri = params.workspaceFolders?.[0]?.uri ?? params.rootUri;
  if (!workspaceUri?.startsWith('file://')) {
    return null;
  }

  return fileURLToPath(workspaceUri);
}
