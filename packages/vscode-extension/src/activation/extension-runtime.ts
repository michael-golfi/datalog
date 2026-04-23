import { window, workspace, type ExtensionContext, type OutputChannel } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

import { createLanguageClientOptions } from '../client/create-language-client-options.js';
import { createLanguageServerOptions } from '../client/create-language-server-options.js';
import { resolveLanguageServerModule } from '../runtime/resolve-language-server-module.js';

let client: LanguageClient | undefined;

export async function activateExtension(context: ExtensionContext): Promise<void> {
  const outputChannel = window.createOutputChannel('Datalog Language Server');
  context.subscriptions.push(outputChannel);

  try {
    const serverModule = resolveLanguageServerModule();

    client = new LanguageClient(
      'datalogLsp',
      'Datalog Graph Language Server',
      createLanguageServerOptions(serverModule),
      createLanguageClientOptions((globPattern) => workspace.createFileSystemWatcher(globPattern)),
    );

    context.subscriptions.push(client);

    await client.start();
  } catch (error) {
    reportActivationFailure(outputChannel, error);
    throw error;
  }
}

export function deactivateExtension(): Promise<void> | undefined {
  return client?.stop();
}

function reportActivationFailure(outputChannel: OutputChannel, error: unknown): void {
  outputChannel.appendLine('Failed to activate Datalog Language Server extension.');

  if (error instanceof Error) {
    outputChannel.appendLine(error.stack ?? error.message);
  } else {
    outputChannel.appendLine(String(error));
  }

  void window.showErrorMessage(
    'Failed to activate Datalog Language Server. See the "Datalog Language Server" output channel for details.',
  );
}
