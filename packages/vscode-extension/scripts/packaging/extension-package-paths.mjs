import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

export const packagingRoot = scriptDirectory;
export const scriptsRoot = path.resolve(packagingRoot, '..');
export const extensionRoot = path.resolve(packagingRoot, '..', '..');
export const workspaceRoot = path.resolve(extensionRoot, '..', '..');
export const defaultStageRoot = path.join(extensionRoot, 'build', 'package-stage');
export const defaultLanguageServerModuleId = '@datalog/lsp/server';
export const workspacePackageRoots = {
  '@datalog/parser': path.join(workspaceRoot, 'packages', 'parser'),
  '@datalog/lsp': path.join(workspaceRoot, 'packages', 'lsp'),
};
