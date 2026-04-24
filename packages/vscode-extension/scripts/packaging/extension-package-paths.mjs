import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

export const packagingRoot = scriptDirectory;
export const scriptsRoot = path.resolve(packagingRoot, '..');
export const extensionRoot = path.resolve(packagingRoot, '..', '..');
export const workspaceRoot = path.resolve(extensionRoot, '..', '..');
export const extensionBuildRoot = path.join(extensionRoot, 'build');
export const compiledExtensionRelativeRoot = path.join('build', 'out');
export const compiledExtensionMainRelativePath = path.join(compiledExtensionRelativeRoot, 'extension.js');
export const defaultStageRoot = path.join(extensionRoot, 'build', 'package-stage');
export const defaultLanguageServerModuleId = '@datalog/lsp/server';
export const workspacePackageRoots = {
  '@datalog/ast': path.join(workspaceRoot, 'packages', 'datalog-ast'),
  '@datalog/datalog-migrate': path.join(workspaceRoot, 'packages', 'datalog-migrate'),
  '@datalog/parser': path.join(workspaceRoot, 'packages', 'parser'),
  '@datalog/lsp': path.join(workspaceRoot, 'packages', 'lsp'),
};
