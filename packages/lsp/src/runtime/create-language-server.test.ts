import { isAbsolute } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createLanguageServer } from './create-language-server.js';

describe('createLanguageServer', () => {
  it('returns a node-based descriptor for the local server entrypoint', () => {
    const descriptor = createLanguageServer();
    const [entrypoint] = descriptor.args;
    if (!entrypoint) {
      throw new Error('Expected createLanguageServer() to include a server entrypoint argument.');
    }

    expect(descriptor.name).toBe('@datalog/lsp');
    expect(descriptor.transport).toBe('ipc');
    expect(descriptor.command).toBe(process.execPath);
    expect(descriptor.args).toHaveLength(1);
    expect(isAbsolute(entrypoint)).toBe(true);
    expect(entrypoint).toMatch(/server\.js$/);
  });
});
