export function createLanguageServerModuleResolverSource(languageServerModuleId) {
  return `"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nexports.resolveLanguageServerModule = resolveLanguageServerModule;\nexports.getLanguageServerModuleId = getLanguageServerModuleId;\nconst languageServerModuleId = ${JSON.stringify(languageServerModuleId)};\nfunction resolveLanguageServerModule() {\n  return require.resolve(languageServerModuleId);\n}\nfunction getLanguageServerModuleId() {\n  return languageServerModuleId;\n}\n`;
}
