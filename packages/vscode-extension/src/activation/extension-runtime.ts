import {
  StatusBarAlignment,
  commands,
  window,
  workspace,
  type ConfigurationChangeEvent,
  type ExtensionContext,
  type OutputChannel,
  type StatusBarItem,
} from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

import { createLanguageClientOptions, readLanguageClientConfiguration } from '../client/create-language-client-options.js';
import { createLanguageServerOptions } from '../client/create-language-server-options.js';
import { resolveLanguageServerModule } from '../runtime/resolve-language-server-module.js';

const datalogOutputChannelName = 'Datalog Language Server';
const restartLanguageServerCommand = 'datalog.restartLanguageServer';
const showLanguageServerOutputCommand = 'datalog.showLanguageServerOutput';
const traceServerSetting = 'datalog.trace.server';
const revealOutputChannelOnSetting = 'datalog.server.revealOutputChannelOn';

let runtimeState: ExtensionRuntimeState | undefined;
let lifecycleOperation: Promise<void> = Promise.resolve();

export async function activateExtension(context: ExtensionContext): Promise<void> {
  if (runtimeState) {
    return lifecycleOperation;
  }

  const outputChannel = window.createOutputChannel(datalogOutputChannelName);
  const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
  statusBarItem.command = restartLanguageServerCommand;
  statusBarItem.show();

  const state: ExtensionRuntimeState = {
    client: undefined,
    outputChannel,
    statusBarItem,
  };

  runtimeState = state;

  context.subscriptions.push(
    outputChannel,
    statusBarItem,
    commands.registerCommand(restartLanguageServerCommand, async () => {
      await restartLanguageServer();
    }),
    commands.registerCommand(showLanguageServerOutputCommand, () => {
      outputChannel.show();
    }),
    workspace.onDidChangeConfiguration(async (event) => {
      await handleConfigurationChange(event);
    }),
  );

  try {
    await enqueueLifecycleOperation(async () => {
      await startLanguageClient(state, 'Starting');
    });
  } catch (error) {
    await cleanupFailedInitialActivation(state);
    throw error;
  }
}

export function deactivateExtension(): Promise<void> | undefined {
  if (!runtimeState) {
    return undefined;
  }

  const state = runtimeState;
  runtimeState = undefined;

  return enqueueLifecycleOperation(async () => {
    updateStatus(state.statusBarItem, 'Stopped', 'Datalog language server stopped.');
    await stopLanguageClient(state);
  });
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

async function restartLanguageServer(): Promise<void> {
  const state = runtimeState;

  if (!state) {
    return;
  }

  await enqueueLifecycleOperation(async () => {
    updateStatus(state.statusBarItem, 'Restarting', 'Restarting Datalog language server.');
    await stopLanguageClient(state);
    await startLanguageClient(state, 'Restarting');
  });
}

async function startLanguageClient(state: ExtensionRuntimeState, phase: 'Starting' | 'Restarting'): Promise<void> {
  updateStatus(state.statusBarItem, phase, `${phase} Datalog language server.`);

  try {
    const configuration = getLanguageClientConfiguration();
    const serverModule = resolveLanguageServerModule();
    const nextClient = new LanguageClient(
      'datalogLsp',
      'Datalog Graph Language Server',
      createLanguageServerOptions(serverModule),
      createLanguageClientOptions({
        configuration,
        createFileSystemWatcher: (globPattern) => workspace.createFileSystemWatcher(globPattern),
        outputChannel: state.outputChannel,
      }),
    );

    state.client = nextClient;
    await nextClient.start();
    await nextClient.setTrace(configuration.traceServer);
    updateStatus(state.statusBarItem, 'Running', 'Datalog language server is running. Click to restart.');
  } catch (error) {
    await stopLanguageClient(state);
    updateStatus(state.statusBarItem, 'Error', 'Datalog language server failed to start. See output for details.');
    reportActivationFailure(state.outputChannel, error);
    throw error;
  }
}

async function stopLanguageClient(state: ExtensionRuntimeState): Promise<void> {
  const activeClient = state.client;

  if (!activeClient) {
    return;
  }

  state.client = undefined;
  await stopLanguageClientInstance(activeClient);
}

async function cleanupFailedInitialActivation(state: ExtensionRuntimeState): Promise<void> {
  await stopLanguageClient(state);

  if (runtimeState === state) {
    runtimeState = undefined;
  }
}

async function stopLanguageClientInstance(client: LanguageClient): Promise<void> {
  try {
    await client.stop();
  } catch (error) {
    if (isStartFailedStopError(error)) {
      return;
    }

    throw error;
  }
}

function isStartFailedStopError(error: unknown): boolean {
  return error instanceof Error
    && error.message.includes(`Client is not running and can't be stopped. It's current state is: startFailed`);
}

async function handleConfigurationChange(event: ConfigurationChangeEvent): Promise<void> {
  const state = runtimeState;

  if (!state) {
    return;
  }

  if (event.affectsConfiguration(revealOutputChannelOnSetting)) {
    await restartLanguageServer();
    return;
  }

  if (!event.affectsConfiguration(traceServerSetting)) {
    return;
  }

  const client = state.client;

  if (!client) {
    return;
  }

  await client.setTrace(getLanguageClientConfiguration().traceServer);
}

function getLanguageClientConfiguration() {
  const configuration = workspace.getConfiguration('datalog');

  return readLanguageClientConfiguration((setting, defaultValue) => configuration.get(setting, defaultValue));
}

async function enqueueLifecycleOperation(operation: () => Promise<void>): Promise<void> {
  const nextOperation = lifecycleOperation.then(operation, operation);

  lifecycleOperation = nextOperation.then(
    () => undefined,
    () => undefined,
  );

  return nextOperation;
}

function updateStatus(statusBarItem: StatusBarItem, label: string, tooltip: string): void {
  statusBarItem.text = `Datalog LSP: ${label}`;
  statusBarItem.tooltip = tooltip;
}

interface ExtensionRuntimeState {
  client: LanguageClient | undefined;
  outputChannel: OutputChannel;
  statusBarItem: StatusBarItem;
}
