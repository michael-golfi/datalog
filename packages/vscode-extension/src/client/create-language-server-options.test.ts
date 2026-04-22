import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode-languageclient/node', () => ({
  TransportKind: {
    ipc: 1,
  },
}));

describe('createLanguageServerOptions', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates IPC server options for run and debug modes', async () => {
    const { createLanguageServerOptions } = await import('./create-language-server-options.js');
    const options = createLanguageServerOptions('/tmp/server.js');

    expect(options.run).toEqual({
      module: '/tmp/server.js',
      transport: options.debug.transport,
    });
    expect(options.debug).toEqual({
      module: '/tmp/server.js',
      transport: options.run.transport,
      options: {
        execArgv: ['--nolazy', '--inspect=6010'],
      },
    });
  });
});
