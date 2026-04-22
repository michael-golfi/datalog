export interface LanguageServerDescriptor {
  readonly name: '@datalog/lsp';
  readonly transport: 'ipc';
  readonly command: string;
  readonly args: readonly string[];
}
