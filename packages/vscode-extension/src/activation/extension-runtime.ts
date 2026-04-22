import { workspace } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

import { createLanguageClientOptions } from '../client/create-language-client-options.js';
import { createLanguageServerOptions } from '../client/create-language-server-options.js';
import { resolveLanguageServerModule } from '../runtime/resolve-language-server-module.js';

let client: LanguageClient | undefined;

export function activateExtension(): void {
  const serverModule = resolveLanguageServerModule();

  client = new LanguageClient(
    'datalogLsp',
    'Datalog Graph Language Server',
    createLanguageServerOptions(serverModule),
    createLanguageClientOptions((globPattern) => workspace.createFileSystemWatcher(globPattern)),
  );

  client.start();
}

export function deactivateExtension(): Promise<void> | undefined {
  return client?.stop();
}
