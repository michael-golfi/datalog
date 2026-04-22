import { TransportKind, type ServerOptions } from 'vscode-languageclient/node';

export function createLanguageServerOptions(serverModule: string): ServerOptions {
  return {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6010'],
      },
    },
  };
}
