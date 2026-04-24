declare module 'vscode' {
  export interface Disposable {
    dispose(): unknown;
  }

  export interface ConfigurationChangeEvent {
    affectsConfiguration(section: string): boolean;
  }

  export interface ExtensionContext {
    asAbsolutePath(relativePath: string): string;
    subscriptions: Disposable[];
  }

  export interface OutputChannel extends Disposable {
    appendLine(value: string): void;
    show(preserveFocus?: boolean): void;
  }

  export interface StatusBarItem extends Disposable {
    command?: string;
    text: string;
    tooltip?: string;
    show(): void;
  }

  export interface WorkspaceConfiguration {
    get<T>(section: string, defaultValue: T): T;
  }

  export const commands: {
    registerCommand(command: string, callback: (...args: unknown[]) => unknown): Disposable;
  };

  export const StatusBarAlignment: {
    Left: number;
    Right: number;
  };

  export const workspace: {
    createFileSystemWatcher(globPattern: string): unknown;
    getConfiguration(section?: string): WorkspaceConfiguration;
    onDidChangeConfiguration(listener: (event: ConfigurationChangeEvent) => unknown): Disposable;
  };

  export const window: {
    createOutputChannel(name: string): OutputChannel;
    createStatusBarItem(alignment?: number): StatusBarItem;
    showErrorMessage(message: string): Promise<void>;
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
    outputChannel?: unknown;
    revealOutputChannelOn?: number;
    synchronize: {
      fileEvents: unknown;
    };
    traceOutputChannel?: unknown;
  }

  export const RevealOutputChannelOn: {
    Never: number;
    Error: number;
    Warn: number;
    Info: number;
  };

  export const TransportKind: {
    ipc: number;
  };

  export class LanguageClient {
    constructor(id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions);
    start(): unknown;
    dispose(): void;
    setTrace(value: string): Promise<void>;
    stop(): Promise<void>;
  }
}
