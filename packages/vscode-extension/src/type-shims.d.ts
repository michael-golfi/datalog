declare module 'vscode' {
  export interface Disposable {
    dispose(): unknown;
  }

  export interface ExtensionContext {
    asAbsolutePath(relativePath: string): string;
    subscriptions: Disposable[];
  }

  export const workspace: {
    createFileSystemWatcher(globPattern: string): unknown;
  };
}

declare module 'vscode-languageclient/node' {
  export interface ServerOptions {
    run: {
      module: string;
      transport: number;
    };
    debug: {
      module: string;
      transport: number;
      options: {
        execArgv: string[];
      };
    };
  }

  export interface LanguageClientOptions {
    documentSelector: Array<{
      scheme: string;
      language: string;
    }>;
    synchronize: {
      fileEvents: unknown;
    };
  }

  export const TransportKind: {
    ipc: number;
  };

  export class LanguageClient {
    constructor(id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions);
    start(): unknown;
    stop(): Promise<void>;
  }
}
