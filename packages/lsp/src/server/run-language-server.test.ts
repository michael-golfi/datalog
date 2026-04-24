import { pathToFileURL } from 'node:url';

import { parseDocument } from '@datalog/parser';
import { describe, expect, it } from 'vitest';
import { FileChangeType, type Diagnostic, type DidChangeWatchedFilesParams, type InitializeParams } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';

import type { LanguageServerDiagnostic } from '../contracts/language-feature-types.js';
import type { LanguageServerRuntime } from '../contracts/language-server-runtime.js';
import { toLspDiagnostic } from '../protocol/lsp-protocol-mappers.js';
import { DatalogDocumentStore } from '../workspace/datalog-document-store.js';
import { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';
import { registerLanguageServerHandlers } from './run-language-server.js';

describe('registerLanguageServerHandlers', () => {
  it('publishes diagnostics on open and change, then clears them on close', async () => {
    const harness = createServerHarness();
    await harness.initialize();

    harness.openDocument('file:///workspace/current.dl', 'warn open');
    await harness.flushPendingNotifications();
    harness.changeDocument('file:///workspace/current.dl', 'error change');
    await harness.flushPendingNotifications();
    await harness.closeDocument('file:///workspace/current.dl');

    expect(harness.sentDiagnostics).toEqual([
      createPublishedDiagnostics('file:///workspace/current.dl', [
        createDiagnostic('warning', 'warn open'),
      ]),
      createPublishedDiagnostics('file:///workspace/current.dl', [
        createDiagnostic('error', 'error change'),
      ]),
      createPublishedDiagnostics('file:///workspace/current.dl', []),
    ]);
  });

  it('revalidates every open document when one open document changes', async () => {
    const harness = createServerHarness();
    await harness.initialize();

    harness.openDocument('file:///workspace/first.dl', 'warn first');
    await harness.flushPendingNotifications();
    harness.openDocument('file:///workspace/second.dl', 'warn second');
    await harness.flushPendingNotifications();
    harness.clearSentDiagnostics();

    harness.changeDocument('file:///workspace/second.dl', 'error second');
    await harness.flushPendingNotifications();

    expect(harness.sentDiagnostics).toEqual([
      createPublishedDiagnostics('file:///workspace/first.dl', [
        createDiagnostic('warning', 'warn first'),
      ]),
      createPublishedDiagnostics('file:///workspace/second.dl', [
        createDiagnostic('error', 'error second'),
      ]),
    ]);
  });

  it('revalidates open documents on watched-file invalidation, clears deleted and renamed uris, and preserves open-buffer precedence', async () => {
    const workspaceRootPath = '/workspace';
    const renamedOldPath = `${workspaceRootPath}/old-name.dl`;
    const renamedNewPath = `${workspaceRootPath}/new-name.dl`;
    const dependencyPath = `${workspaceRootPath}/dependency.dl`;
    const currentPath = `${workspaceRootPath}/current.dl`;
    const currentUri = pathToFileURL(currentPath).href;
    const renamedOldUri = pathToFileURL(renamedOldPath).href;
    const dependencyUri = pathToFileURL(dependencyPath).href;

    const harness = createServerHarness({
      workspaceRootPath,
      diskFiles: new Map([
        [currentPath, 'disk clean'],
        [renamedOldPath, 'old disk'],
      ]),
    });
    await harness.initialize();

    harness.openDocument(currentUri, 'error open buffer');
    harness.clearSentDiagnostics();

    harness.setDiskFile(dependencyPath, 'new dependency');
    await harness.changeWatchedFiles({
      changes: [
        { uri: dependencyUri, type: FileChangeType.Created },
      ],
    });

    harness.deleteDiskFile(renamedOldPath);
    harness.setDiskFile(renamedNewPath, 'renamed disk');
    await harness.changeWatchedFiles({
      changes: [
        { uri: renamedOldUri, type: FileChangeType.Deleted },
        { uri: pathToFileURL(renamedNewPath).href, type: FileChangeType.Created },
      ],
    });

    expect(harness.sentDiagnostics).toEqual([
      createPublishedDiagnostics(currentUri, [
        createDiagnostic('error', 'error open buffer'),
      ]),
      createPublishedDiagnostics(renamedOldUri, []),
      createPublishedDiagnostics(currentUri, [
        createDiagnostic('error', 'error open buffer'),
      ]),
    ]);
  });
});

function createServerHarness(options?: {
  readonly workspaceRootPath?: string;
  readonly diskFiles?: ReadonlyMap<string, string>;
}): ServerHarness {
  const diskFiles = new Map(options?.diskFiles ?? []);
  const workspaceIndex = new DatalogWorkspaceIndex({
    documentStore: new DatalogDocumentStore(),
    listWorkspaceFiles: async (workspaceRootPath) => [...diskFiles.keys()]
      .filter((filePath) => filePath.startsWith(`${workspaceRootPath}/`))
      .sort((left, right) => left.localeCompare(right)),
    readFile: (async (filePath: string) => {
      const source = diskFiles.get(filePath);
      if (typeof source !== 'string') {
        throw new Error(`Missing stub disk file: ${filePath}`);
      }

      return source;
    }) as never,
  });
  const sentDiagnostics: PublishedDiagnostics[] = [];
  const handlers: HandlerRegistry = {};
  const documents = new Map<string, TextDocument>();

  const connection = {
    onInitialize: (handler: (params: InitializeParams) => Promise<unknown> | unknown) => {
      handlers.initialize = handler;
    },
    onCompletion: () => undefined,
    onHover: () => undefined,
    onDocumentSymbol: () => undefined,
    onFoldingRanges: () => undefined,
    onDefinition: () => undefined,
    onDidChangeWatchedFiles: (handler: (params: DidChangeWatchedFilesParams) => Promise<void> | void) => {
      handlers.didChangeWatchedFiles = handler;
    },
    languages: {
      semanticTokens: {
        on: () => undefined,
      },
    },
    sendDiagnostics: async (payload: PublishedDiagnostics) => {
      sentDiagnostics.push(payload);
    },
  };

  const trackedDocuments = {
    onDidOpen: (handler: (change: { document: TextDocument }) => void) => {
      handlers.didOpen = handler;
    },
    onDidChangeContent: (handler: (change: { document: TextDocument }) => void) => {
      handlers.didChangeContent = handler;
    },
    onDidClose: (handler: (change: { document: TextDocument }) => Promise<void> | void) => {
      handlers.didClose = handler;
    },
    get: (uri: string) => documents.get(uri),
    all: () => [...documents.values()],
    listen: () => undefined,
  };

  registerLanguageServerHandlers(
    connection as never,
    trackedDocuments as never,
    createRuntime(workspaceIndex),
  );

  return {
    sentDiagnostics,
    async initialize() {
      await handlers.initialize?.({
        processId: null,
        capabilities: {},
        rootUri: options?.workspaceRootPath
          ? pathToFileURL(options.workspaceRootPath).href
          : null,
        workspaceFolders: options?.workspaceRootPath
          ? [{ uri: pathToFileURL(options.workspaceRootPath).href, name: 'workspace' }]
          : null,
      });
    },
    openDocument(uri, source) {
      const document = TextDocument.create(uri, 'datalog', 1, source);
      documents.set(uri, document);
      handlers.didOpen?.({ document });
    },
    changeDocument(uri, source) {
      const currentVersion = documents.get(uri)?.version ?? 1;
      const document = TextDocument.create(uri, 'datalog', currentVersion + 1, source);
      documents.set(uri, document);
      handlers.didChangeContent?.({ document });
    },
    async closeDocument(uri) {
      const document = documents.get(uri);
      if (!document) {
        throw new Error(`Cannot close unopened document: ${uri}`);
      }

      documents.delete(uri);
      await handlers.didClose?.({ document });
    },
    async changeWatchedFiles(params) {
      handlers.didChangeWatchedFiles?.(params);
      await flushPendingNotifications();
    },
    async flushPendingNotifications() {
      await flushPendingNotifications();
    },
    setDiskFile(filePath, source) {
      diskFiles.set(filePath, source);
    },
    deleteDiskFile(filePath) {
      diskFiles.delete(filePath);
    },
    clearSentDiagnostics() {
      sentDiagnostics.length = 0;
    },
  };
}

function createRuntime(workspaceIndex: DatalogWorkspaceIndex): LanguageServerRuntime {
  return {
    parseDocument,
    workspaceIndex,
    computeCompletions: () => [],
    computeHover: () => null,
    computeDefinition: () => null,
    computeDiagnostics: (source) => createDiagnosticsForSource(source),
    computeDocumentSymbols: () => [],
    computeFoldingRanges: () => [],
    computeSemanticTokens: () => [],
  };
}

function createDiagnosticsForSource(source: string): readonly LanguageServerDiagnostic[] {
  if (source.includes('error')) {
    return [createDiagnostic('error', source)];
  }

  if (source.includes('warn')) {
    return [createDiagnostic('warning', source)];
  }

  return [];
}

function createDiagnostic(
  severity: LanguageServerDiagnostic['severity'],
  message: string,
): LanguageServerDiagnostic {
  return {
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: message.length },
    },
    severity,
    source: 'test',
    message,
  };
}

function createPublishedDiagnostics(uri: string, diagnostics: readonly LanguageServerDiagnostic[]): PublishedDiagnostics {
  return { uri, diagnostics: diagnostics.map(toLspDiagnostic) };
}

interface ServerHarness {
  readonly sentDiagnostics: PublishedDiagnostics[];
  readonly initialize: () => Promise<void>;
  readonly openDocument: (uri: string, source: string) => void;
  readonly changeDocument: (uri: string, source: string) => void;
  readonly closeDocument: (uri: string) => Promise<void>;
  readonly changeWatchedFiles: (params: DidChangeWatchedFilesParams) => Promise<void>;
  readonly flushPendingNotifications: () => Promise<void>;
  readonly setDiskFile: (filePath: string, source: string) => void;
  readonly deleteDiskFile: (filePath: string) => void;
  readonly clearSentDiagnostics: () => void;
}

interface HandlerRegistry {
  initialize?: (params: InitializeParams) => Promise<unknown> | unknown;
  didOpen?: (change: { document: TextDocument }) => void;
  didChangeContent?: (change: { document: TextDocument }) => void;
  didClose?: (change: { document: TextDocument }) => Promise<void> | void;
  didChangeWatchedFiles?: (params: DidChangeWatchedFilesParams) => Promise<void> | void;
}

interface PublishedDiagnostics {
  readonly uri: string;
  readonly diagnostics: readonly Diagnostic[];
}

async function flushPendingNotifications(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
