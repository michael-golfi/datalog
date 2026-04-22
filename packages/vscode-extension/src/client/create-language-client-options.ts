import type { LanguageClientOptions } from 'vscode-languageclient/node';

type CreateFileSystemWatcher = (globPattern: string) => unknown;

export function createLanguageClientOptions(
  createFileSystemWatcher: CreateFileSystemWatcher,
): LanguageClientOptions {
  return {
    documentSelector: [{ scheme: 'file', language: 'datalog' }],
    synchronize: {
      fileEvents: createFileSystemWatcher('**/*.dl'),
    },
  };
}
