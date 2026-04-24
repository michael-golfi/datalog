import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  RevealOutputChannelOn: {
    Never: 0,
    Error: 1,
    Warn: 2,
    Info: 3,
  },
}));

vi.mock('vscode-languageclient/node', () => ({
  RevealOutputChannelOn: mocks.RevealOutputChannelOn,
}));

describe('createLanguageClientOptions', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('watches Datalog files and maps output-channel behavior from extension configuration', async () => {
    const watcher = { kind: 'watcher' };
    const outputChannel = {
      append: vi.fn(),
      appendLine: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
      hide: vi.fn(),
      name: 'Datalog Language Server',
      replace: vi.fn(),
      show: vi.fn(),
    };
    const createFileSystemWatcher = vi.fn(() => watcher);

    const { createLanguageClientOptions } = await import('./create-language-client-options.js');
    const options = createLanguageClientOptions({
      createFileSystemWatcher,
      outputChannel,
      configuration: {
        traceServer: 'messages',
        revealOutputChannelOn: 'warn',
      },
    });

    expect(createFileSystemWatcher).toHaveBeenCalledWith('**/*.dl');
    expect(options).toEqual({
      documentSelector: [{ scheme: 'file', language: 'datalog' }],
      outputChannel,
      revealOutputChannelOn: mocks.RevealOutputChannelOn.Warn,
      synchronize: {
        fileEvents: watcher,
      },
      traceOutputChannel: outputChannel,
    });
  });

  it('reads the supported language-client settings into a narrow DTO with safe defaults', async () => {
    const readSetting = vi
      .fn()
      .mockImplementationOnce((setting: string, defaultValue: string) =>
        setting === 'trace.server' ? 'verbose' : defaultValue,
      )
      .mockImplementationOnce((setting: string, defaultValue: string) =>
        setting === 'server.revealOutputChannelOn' ? 'info' : defaultValue,
      );

    const { readLanguageClientConfiguration } = await import('./create-language-client-options.js');

    expect(readLanguageClientConfiguration(readSetting)).toEqual({
      traceServer: 'verbose',
      revealOutputChannelOn: 'info',
    });
    expect(readSetting).toHaveBeenNthCalledWith(1, 'trace.server', 'off');
    expect(readSetting).toHaveBeenNthCalledWith(2, 'server.revealOutputChannelOn', 'error');
  });
});
