import { fileURLToPath } from 'node:url';

import type { LanguageServerDescriptor } from '../contracts/language-server-descriptor.js';

/** Create the local Node-based descriptor for launching the LSP server entrypoint. */
export function createLanguageServer(): LanguageServerDescriptor {
  return {
    name: '@datalog/lsp',
    transport: 'ipc',
    command: process.execPath,
    args: [fileURLToPath(new URL('../server.js', import.meta.url))],
  };
}
