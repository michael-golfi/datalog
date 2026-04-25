import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExtensionContext } from 'vscode';

const mocks = vi.hoisted(() => {
  const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
  let configurationChangeListener:
    | ((event: { affectsConfiguration(section: string): boolean }) => unknown)
    | undefined;

  class MockLanguageClient {
    public readonly start = start;
    public readonly stop = stop;
    public readonly setTrace = setTrace;

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
  const setTrace = vi.fn(async () => undefined);
  const appendLine = vi.fn();
  const showOutputChannel = vi.fn();
  const outputChannel = { appendLine, show: showOutputChannel };
  const statusBarItem = {
    command: undefined as string | undefined,
    show: vi.fn(),
    text: '',
    tooltip: undefined as string | undefined,
  };
  const createOutputChannel = vi.fn(() => outputChannel);
  const createStatusBarItem = vi.fn(() => statusBarItem);
  const showErrorMessage = vi.fn(async () => undefined);
  const registerCommand = vi.fn((command: string, callback: (...args: unknown[]) => unknown) => {
    registeredCommands.set(command, callback);
    return { dispose: vi.fn() };
  });
  const getConfigurationValue = vi.fn((setting: string, defaultValue: string) => defaultValue);
  const getConfiguration = vi.fn(() => ({
    get: getConfigurationValue,
  }));
  const onDidChangeConfiguration = vi.fn(
    (listener: (event: { affectsConfiguration(section: string): boolean }) => unknown) => {
      configurationChangeListener = listener;
      return { dispose: vi.fn() };
    },
  );
  const createFileSystemWatcher = vi.fn((globPattern: string) => ({ globPattern }));
  const resolveLanguageServerModule = vi.fn(() => '/tmp/datalog-lsp.js');
  const createLanguageServerOptions = vi.fn((serverModule: string) => ({
    serverModule,
    kind: 'server-options',
  }));
  const readLanguageClientConfiguration = vi.fn(
    (readSetting: (setting: string, defaultValue: string) => string) => ({
      traceServer: readSetting('trace.server', 'off'),
      revealOutputChannelOn: readSetting('server.revealOutputChannelOn', 'error'),
    }),
  );
  const createLanguageClientOptions = vi.fn(
    ({
      createFileSystemWatcher: createWatcher,
      configuration,
      outputChannel: clientOutputChannel,
    }) => ({
      configuration,
      kind: 'client-options',
      outputChannel: clientOutputChannel,
      watcher: createWatcher('**/*.dl'),
    }),
  );
  const instances: MockLanguageClient[] = [];

  async function fireConfigurationChange(sections: string[]): Promise<unknown> {
    if (!configurationChangeListener) {
      return undefined;
    }

    return configurationChangeListener({
      affectsConfiguration(section: string): boolean {
        return sections.includes(section);
      },
    });
  }

  return {
    MockLanguageClient,
    appendLine,
    showOutputChannel,
    outputChannel,
    statusBarItem,
    createOutputChannel,
    createStatusBarItem,
    showErrorMessage,
    registerCommand,
    registeredCommands,
    getConfiguration,
    getConfigurationValue,
    onDidChangeConfiguration,
    fireConfigurationChange,
    createFileSystemWatcher,
    resolveLanguageServerModule,
    createLanguageServerOptions,
    readLanguageClientConfiguration,
    createLanguageClientOptions,
    start,
    stop,
    setTrace,
    instances,
  };
});

vi.mock('vscode', () => ({
  commands: {
    registerCommand: mocks.registerCommand,
  },
  StatusBarAlignment: {
    Left: 1,
  },
  workspace: {
    createFileSystemWatcher: mocks.createFileSystemWatcher,
    getConfiguration: mocks.getConfiguration,
    onDidChangeConfiguration: mocks.onDidChangeConfiguration,
  },
  window: {
    createOutputChannel: mocks.createOutputChannel,
    createStatusBarItem: mocks.createStatusBarItem,
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
  readLanguageClientConfiguration: mocks.readLanguageClientConfiguration,
  createLanguageClientOptions: mocks.createLanguageClientOptions,
}));

describe('activateExtension', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.instances.length = 0;
    mocks.registeredCommands.clear();
    mocks.start.mockResolvedValue(undefined);
    mocks.stop.mockResolvedValue(undefined);
    mocks.setTrace.mockResolvedValue(undefined);
    mocks.resolveLanguageServerModule.mockImplementation(() => '/tmp/datalog-lsp.js');
    mocks.createOutputChannel.mockReturnValue(mocks.outputChannel);
    mocks.createStatusBarItem.mockReturnValue(mocks.statusBarItem);
    mocks.statusBarItem.command = undefined;
    mocks.statusBarItem.text = '';
    mocks.statusBarItem.tooltip = undefined;
    mocks.getConfigurationValue.mockImplementation(
      (setting: string, defaultValue: string) => defaultValue,
    );
    mocks.readLanguageClientConfiguration.mockImplementation(
      (readSetting: (setting: string, defaultValue: string) => string) => ({
        traceServer: readSetting('trace.server', 'off'),
        revealOutputChannelOn: readSetting('server.revealOutputChannelOn', 'error'),
      }),
    );
  });

  it('registers status and lifecycle commands, then starts the client with the configured trace/output plumbing', async () => {
    mocks.getConfigurationValue.mockImplementation((setting: string, defaultValue: string) => {
      if (setting === 'trace.server') {
        return 'verbose';
      }

      if (setting === 'server.revealOutputChannelOn') {
        return 'warn';
      }

      return defaultValue;
    });

    const { activateExtension } = await import('./extension-runtime.js');
    const context = createContext();

    await activateExtension(context);

    expect(mocks.createOutputChannel).toHaveBeenCalledWith('Datalog Language Server');
    expect(mocks.createStatusBarItem).toHaveBeenCalledTimes(1);
    expect(mocks.statusBarItem.command).toBe('datalog.restartLanguageServer');
    expect(mocks.statusBarItem.text).toBe('Datalog LSP: Running');
    expect(mocks.statusBarItem.show).toHaveBeenCalledTimes(1);
    expect(Array.from(mocks.registeredCommands.keys())).toEqual([
      'datalog.restartLanguageServer',
      'datalog.showLanguageServerOutput',
    ]);
    expect(mocks.resolveLanguageServerModule).toHaveBeenCalledTimes(1);
    expect(mocks.createLanguageServerOptions).toHaveBeenCalledWith('/tmp/datalog-lsp.js');
    expect(mocks.createLanguageClientOptions).toHaveBeenCalledWith({
      configuration: {
        traceServer: 'verbose',
        revealOutputChannelOn: 'warn',
      },
      createFileSystemWatcher: expect.any(Function),
      outputChannel: mocks.outputChannel,
    });
    expect(mocks.createFileSystemWatcher).toHaveBeenCalledWith('**/*.dl');
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.setTrace).toHaveBeenCalledWith('verbose');
    expect(context.subscriptions).toContain(mocks.outputChannel);
    expect(context.subscriptions).toContain(mocks.statusBarItem);
    expect(mocks.showErrorMessage).not.toHaveBeenCalled();
  });

  it('reveals the language-server output channel through the dedicated command', async () => {
    const { activateExtension } = await import('./extension-runtime.js');
    const context = createContext();

    await activateExtension(context);

    const showOutput = mocks.registeredCommands.get('datalog.showLanguageServerOutput');

    await showOutput?.();

    expect(mocks.showOutputChannel).toHaveBeenCalledTimes(1);
  });

  it('serializes restart requests so a second restart waits for the first stop/start cycle', async () => {
    let resolveStop: (() => void) | undefined;
    const firstStop = new Promise<undefined>((resolve) => {
      resolveStop = () => {
        resolve(undefined);
      };
    });

    const { activateExtension } = await import('./extension-runtime.js');
    const context = createContext();

    await activateExtension(context);

    mocks.stop.mockImplementationOnce(async () => firstStop);

    const restart = mocks.registeredCommands.get('datalog.restartLanguageServer');
    const firstRestart = Promise.resolve(restart?.());
    const secondRestart = Promise.resolve(restart?.());

    await Promise.resolve();

    expect(mocks.stop).toHaveBeenCalledTimes(1);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.statusBarItem.text).toBe('Datalog LSP: Restarting');

    resolveStop?.();

    await firstRestart;
    await secondRestart;

    expect(mocks.stop).toHaveBeenCalledTimes(2);
    expect(mocks.start).toHaveBeenCalledTimes(3);
    expect(mocks.statusBarItem.text).toBe('Datalog LSP: Running');
  });

  it('applies trace changes in place and restarts only when output-channel visibility changes', async () => {
    const { activateExtension } = await import('./extension-runtime.js');
    const context = createContext();

    await activateExtension(context);

    mocks.getConfigurationValue.mockImplementation((setting: string, defaultValue: string) => {
      if (setting === 'trace.server') {
        return 'messages';
      }

      return defaultValue;
    });

    await mocks.fireConfigurationChange(['datalog.trace.server']);

    expect(mocks.setTrace).toHaveBeenLastCalledWith('messages');
    expect(mocks.stop).toHaveBeenCalledTimes(0);

    mocks.getConfigurationValue.mockImplementation((setting: string, defaultValue: string) => {
      if (setting === 'trace.server') {
        return 'messages';
      }

      if (setting === 'server.revealOutputChannelOn') {
        return 'info';
      }

      return defaultValue;
    });

    await mocks.fireConfigurationChange(['datalog.server.revealOutputChannelOn']);

    expect(mocks.stop).toHaveBeenCalledTimes(1);
    expect(mocks.start).toHaveBeenCalledTimes(2);
    expect(mocks.createLanguageClientOptions).toHaveBeenLastCalledWith({
      configuration: {
        traceServer: 'messages',
        revealOutputChannelOn: 'info',
      },
      createFileSystemWatcher: expect.any(Function),
      outputChannel: mocks.outputChannel,
    });
  });

  it('reports module resolution failures through the output channel and VS Code UI', async () => {
    const error = new Error('Unable to resolve @datalog/lsp/server');
    mocks.resolveLanguageServerModule.mockImplementation(() => {
      throw error;
    });

    const { activateExtension } = await import('./extension-runtime.js');
    const context = createContext();

    await expect(activateExtension(context)).rejects.toThrow(error.message);

    expect(context.subscriptions).toContain(mocks.outputChannel);
    expect(context.subscriptions).toContain(mocks.statusBarItem);
    expect(mocks.statusBarItem.text).toBe('Datalog LSP: Error');
    expect(mocks.appendLine).toHaveBeenNthCalledWith(
      1,
      'Failed to activate Datalog Language Server extension.',
    );
    expect(mocks.appendLine).toHaveBeenNthCalledWith(2, error.stack);
    expect(mocks.showErrorMessage).toHaveBeenCalledWith(
      'Failed to activate Datalog Language Server. See the "Datalog Language Server" output channel for details.',
    );
  });

  it('retries activation from a fresh runtime after module resolution fails', async () => {
    const error = new Error('Unable to resolve @datalog/lsp/server');
    mocks.resolveLanguageServerModule
      .mockImplementationOnce(() => {
        throw error;
      })
      .mockImplementation(() => '/tmp/datalog-lsp.js');

    const { activateExtension } = await import('./extension-runtime.js');
    const firstContext = createContext();

    await expect(activateExtension(firstContext)).rejects.toThrow(error.message);

    const secondContext = createContext();

    await activateExtension(secondContext);

    expect(mocks.resolveLanguageServerModule).toHaveBeenCalledTimes(2);
    expect(mocks.createOutputChannel).toHaveBeenCalledTimes(2);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.statusBarItem.text).toBe('Datalog LSP: Running');
    expect(secondContext.subscriptions).toContain(mocks.outputChannel);
  });

  it('reports client startup failures after registering the client disposable', async () => {
    const error = new Error('Language client failed to start');
    mocks.start.mockRejectedValue(error);

    const { activateExtension } = await import('./extension-runtime.js');
    const context = createContext();

    await expect(activateExtension(context)).rejects.toThrow(error.message);

    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.statusBarItem.text).toBe('Datalog LSP: Error');
    expect(mocks.appendLine).toHaveBeenNthCalledWith(
      1,
      'Failed to activate Datalog Language Server extension.',
    );
    expect(mocks.appendLine).toHaveBeenNthCalledWith(2, error.stack);
    expect(mocks.showErrorMessage).toHaveBeenCalledWith(
      'Failed to activate Datalog Language Server. See the "Datalog Language Server" output channel for details.',
    );
  });

  it('stops a partially started client and retries activation from a fresh runtime', async () => {
    const error = new Error('Language client failed to start');
    mocks.start.mockRejectedValueOnce(error).mockResolvedValue(undefined);

    const { activateExtension } = await import('./extension-runtime.js');
    const firstContext = createContext();

    await expect(activateExtension(firstContext)).rejects.toThrow(error.message);

    expect(mocks.stop).toHaveBeenCalledTimes(1);
    expect(mocks.statusBarItem.text).toBe('Datalog LSP: Error');

    const secondContext = createContext();

    await activateExtension(secondContext);

    expect(mocks.createOutputChannel).toHaveBeenCalledTimes(2);
    expect(mocks.start).toHaveBeenCalledTimes(2);
    expect(mocks.stop).toHaveBeenCalledTimes(1);
    expect(mocks.statusBarItem.text).toBe('Datalog LSP: Running');
    expect(secondContext.subscriptions).toContain(mocks.outputChannel);
  });

  it('keeps the original startup error when stop rejects for a startFailed client and still allows retry', async () => {
    const startError = new Error('Language client failed to start');
    const stopError = new Error(
      "Client is not running and can't be stopped. It's current state is: startFailed",
    );
    mocks.start.mockRejectedValueOnce(startError).mockResolvedValue(undefined);
    mocks.stop.mockRejectedValueOnce(stopError).mockResolvedValue(undefined);

    const { activateExtension } = await import('./extension-runtime.js');
    const firstContext = createContext();

    await expect(activateExtension(firstContext)).rejects.toThrow(startError.message);

    expect(mocks.stop).toHaveBeenCalledTimes(1);
    expect(mocks.appendLine).toHaveBeenNthCalledWith(
      1,
      'Failed to activate Datalog Language Server extension.',
    );
    expect(mocks.appendLine).toHaveBeenNthCalledWith(2, startError.stack);
    expect(mocks.statusBarItem.text).toBe('Datalog LSP: Error');

    const secondContext = createContext();

    await activateExtension(secondContext);

    expect(mocks.createOutputChannel).toHaveBeenCalledTimes(2);
    expect(mocks.start).toHaveBeenCalledTimes(2);
    expect(mocks.stop).toHaveBeenCalledTimes(1);
    expect(mocks.statusBarItem.text).toBe('Datalog LSP: Running');
    expect(secondContext.subscriptions).toContain(mocks.outputChannel);
  });

  it('treats deactivate after failed activation as already cleaned up', async () => {
    const error = new Error('Language client failed to start');
    mocks.start.mockRejectedValue(error);

    const { activateExtension, deactivateExtension } = await import('./extension-runtime.js');
    const context = createContext();

    await expect(activateExtension(context)).rejects.toThrow(error.message);

    expect(deactivateExtension()).toBeUndefined();
    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });
});

function createContext(): ExtensionContext {
  return {
    subscriptions: [],
  } as unknown as ExtensionContext;
}
