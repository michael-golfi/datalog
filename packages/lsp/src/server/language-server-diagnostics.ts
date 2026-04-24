import { FileChangeType, type Diagnostic, type DidChangeWatchedFilesParams, type Hover, type TextDocuments } from 'vscode-languageserver/node.js';
import type { TextDocument } from 'vscode-languageserver-textdocument';

import type { LanguageServerRuntime } from '../contracts/language-server-runtime.js';
import { toLspDiagnostic } from '../protocol/lsp-protocol-mappers.js';

/** Publish diagnostics for every currently open document. */
export async function publishDiagnosticsForOpenDocuments(
  connection: { sendDiagnostics: (payload: { uri: string; diagnostics: Diagnostic[] }) => Promise<void> },
  documents: TextDocuments<TextDocument>,
  runtime: LanguageServerRuntime,
): Promise<void> {
  for (const document of documents.all()) {
    await publishDocumentDiagnostics(connection, runtime, document);
  }
}

/** Publish diagnostics for one open document snapshot. */
export async function publishDocumentDiagnostics(
  connection: { sendDiagnostics: (payload: { uri: string; diagnostics: Diagnostic[] }) => Promise<void> },
  runtime: LanguageServerRuntime,
  document: TextDocument,
): Promise<void> {
  await connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: runtime.computeDiagnostics(document.getText(), {
      targetUri: document.uri,
      workspaceIndex: runtime.workspaceIndex,
    }).map(toLspDiagnostic),
  });
}

/** Clear previously published diagnostics for a URI. */
export async function clearDocumentDiagnostics(
  connection: { sendDiagnostics: (payload: { uri: string; diagnostics: Diagnostic[] }) => Promise<void> },
  uri: string,
): Promise<void> {
  await connection.sendDiagnostics({ uri, diagnostics: [] satisfies Diagnostic[] });
}

/** Extract deleted URIs from a watched-file change batch. */
export function getDeletedWatchedFileUris(params: DidChangeWatchedFilesParams): readonly string[] {
  return params.changes
    .filter((change) => change.type === FileChangeType.Deleted)
    .map((change) => change.uri);
}

/** Convert internal hover payloads to the LSP wire shape. */
export function createHoverResponse(
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

/** Convert an internal definition target to an LSP location. */
export function createDefinitionLocation(
  definition: NonNullable<ReturnType<LanguageServerRuntime['computeDefinition']>>[number],
  documentUri: string,
): { uri: string; range: NonNullable<ReturnType<LanguageServerRuntime['computeDefinition']>>[number]['targetSelectionRange'] } {
  return {
    uri: definition.targetUri ?? documentUri,
    range: definition.targetSelectionRange,
  };
}
