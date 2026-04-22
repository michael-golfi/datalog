const languageServerModuleId = '@datalog/lsp/server';

export function resolveLanguageServerModule(): string {
  return require.resolve(languageServerModuleId);
}

export function getLanguageServerModuleId(): string {
  return languageServerModuleId;
}
