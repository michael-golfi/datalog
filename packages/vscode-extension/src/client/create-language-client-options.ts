import { RevealOutputChannelOn, type LanguageClientOptions } from 'vscode-languageclient/node';

import type { OutputChannel } from 'vscode';

type CreateFileSystemWatcher = (globPattern: string) => unknown;

export type DatalogTraceServerSetting = 'off' | 'messages' | 'verbose';

export type DatalogRevealOutputChannelOnSetting = 'never' | 'error' | 'warn' | 'info';

export interface DatalogLanguageClientConfiguration {
  traceServer: DatalogTraceServerSetting;
  revealOutputChannelOn: DatalogRevealOutputChannelOnSetting;
}

interface CreateLanguageClientOptionsParams {
  createFileSystemWatcher: CreateFileSystemWatcher;
  outputChannel: OutputChannel;
  configuration: DatalogLanguageClientConfiguration;
}

type ReadSetting = (setting: string, defaultValue: string) => string;

const revealOutputChannelOnMap = {
  error: RevealOutputChannelOn.Error,
  info: RevealOutputChannelOn.Info,
  never: RevealOutputChannelOn.Never,
  warn: RevealOutputChannelOn.Warn,
} as const;

export function createLanguageClientOptions({
  createFileSystemWatcher,
  outputChannel,
  configuration,
}: CreateLanguageClientOptionsParams): LanguageClientOptions {
  return {
    documentSelector: [{ scheme: 'file', language: 'datalog' }],
    outputChannel,
    revealOutputChannelOn: revealOutputChannelOnMap[configuration.revealOutputChannelOn],
    synchronize: {
      fileEvents: createFileSystemWatcher('**/*.dl'),
    },
    traceOutputChannel: outputChannel,
  };
}

export function readLanguageClientConfiguration(
  readSetting: ReadSetting,
): DatalogLanguageClientConfiguration {
  return {
    traceServer: normalizeTraceServerSetting(readSetting('trace.server', 'off')),
    revealOutputChannelOn: normalizeRevealOutputChannelOnSetting(
      readSetting('server.revealOutputChannelOn', 'error'),
    ),
  };
}

function normalizeTraceServerSetting(value: string): DatalogTraceServerSetting {
  if (value === 'messages' || value === 'verbose') {
    return value;
  }

  return 'off';
}

function normalizeRevealOutputChannelOnSetting(value: string): DatalogRevealOutputChannelOnSetting {
  if (value === 'never' || value === 'warn' || value === 'info') {
    return value;
  }

  return 'error';
}
