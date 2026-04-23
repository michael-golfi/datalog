import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionContext } from 'vscode';

const mocks = vi.hoisted(() => {
  class MockLanguageClient {
    public readonly start = start;
    public readonly stop = stop;

    public constructor(
      public readonly id: string,
      public readonly name: string,
      public readonly serverOptions: unknown,
      public readonly clientOptions: unknown,
    ) {
      instances.push(this);
    }
  }

  const start = vi.fn(async () => undefined);
  const stop = vi.fn(async () => undefined);
  const appendLine = vi.fn();
  const outputChannel = { appendLine };
  const createOutputChannel = vi.fn(() => outputChannel);
  const showErrorMessage = vi.fn(async () => undefined);
  const createFileSystemWatcher = vi.fn((globPattern: string) => ({ globPattern }));
  const resolveLanguageServerModule = vi.fn(() => '/tmp/datalog-lsp.js');
  const createLanguageServerOptions = vi.fn((serverModule: string) => ({ serverModule, kind: 'server-options' }));
  const createLanguageClientOptions = vi.fn((createWatcher: (globPattern: string) => unknown) => ({
    kind: 'client-options',
    watcher: createWatcher('**/*.dl'),
  }));
  const instances: MockLanguageClient[] = [];

  return {
    MockLanguageClient,
    appendLine,
    outputChannel,
    createOutputChannel,
    showErrorMessage,
    createFileSystemWatcher,
    resolveLanguageServerModule,
    createLanguageServerOptions,
    createLanguageClientOptions,
    start,
    stop,
    instances,
  };
});

vi.mock('vscode', () => ({
  workspace: {
    createFileSystemWatcher: mocks.createFileSystemWatcher,
  },
  window: {
    createOutputChannel: mocks.createOutputChannel,
    showErrorMessage: mocks.showErrorMessage,
  },
}));

vi.mock('vscode-languageclient/node', () => ({
  LanguageClient: mocks.MockLanguageClient,
}));

vi.mock('../runtime/resolve-language-server-module.js', () => ({
  resolveLanguageServerModule: mocks.resolveLanguageServerModule,
}));

vi.mock('../client/create-language-server-options.js', () => ({
  createLanguageServerOptions: mocks.createLanguageServerOptions,
}));

vi.mock('../client/create-language-client-options.js', () => ({
  createLanguageClientOptions: mocks.createLanguageClientOptions,
}));

describe('activateExtension', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.instances.length = 0;
    mocks.start.mockResolvedValue(undefined);
    mocks.stop.mockResolvedValue(undefined);
    mocks.resolveLanguageServerModule.mockImplementation(() => '/tmp/datalog-lsp.js');
    mocks.createOutputChannel.mockReturnValue(mocks.outputChannel);
  });

  it('registers the output channel and language client, then awaits client startup', async () => {
    const { activateExtension } = await import('./extension-runtime.js');
    const context = createContext();

    await activateExtension(context);

    expect(mocks.createOutputChannel).toHaveBeenCalledWith('Datalog Language Server');
    expect(mocks.resolveLanguageServerModule).toHaveBeenCalledTimes(1);
    expect(mocks.createLanguageServerOptions).toHaveBeenCalledWith('/tmp/datalog-lsp.js');
    expect(mocks.createLanguageClientOptions).toHaveBeenCalledTimes(1);
    expect(mocks.createFileSystemWatcher).toHaveBeenCalledWith('**/*.dl');
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(context.subscriptions).toEqual([mocks.outputChannel, mocks.instances[0]]);
    expect(mocks.showErrorMessage).not.toHaveBeenCalled();
  });

  it('reports module resolution failures through the output channel and VS Code UI', async () => {
    const error = new Error('Unable to resolve @datalog/lsp/server');
    mocks.resolveLanguageServerModule.mockImplementation(() => {
      throw error;
    });

    const { activateExtension } = await import('./extension-runtime.js');
    const context = createContext();

    await expect(activateExtension(context)).rejects.toThrow(error.message);

    expect(context.subscriptions).toEqual([mocks.outputChannel]);
    expect(mocks.appendLine).toHaveBeenNthCalledWith(1, 'Failed to activate Datalog Language Server extension.');
    expect(mocks.appendLine).toHaveBeenNthCalledWith(2, error.stack);
    expect(mocks.showErrorMessage).toHaveBeenCalledWith(
      'Failed to activate Datalog Language Server. See the "Datalog Language Server" output channel for details.',
    );
  });

  it('reports client startup failures after registering the client disposable', async () => {
    const error = new Error('Language client failed to start');
    mocks.start.mockRejectedValue(error);

    const { activateExtension } = await import('./extension-runtime.js');
    const context = createContext();

    await expect(activateExtension(context)).rejects.toThrow(error.message);

    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(context.subscriptions).toEqual([mocks.outputChannel, mocks.instances[0]]);
    expect(mocks.appendLine).toHaveBeenNthCalledWith(1, 'Failed to activate Datalog Language Server extension.');
    expect(mocks.appendLine).toHaveBeenNthCalledWith(2, error.stack);
    expect(mocks.showErrorMessage).toHaveBeenCalledWith(
      'Failed to activate Datalog Language Server. See the "Datalog Language Server" output channel for details.',
    );
  });
});

function createContext(): ExtensionContext {
  return {
    subscriptions: [],
  } as unknown as ExtensionContext;
}
