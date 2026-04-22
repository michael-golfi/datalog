import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  defaultLanguageServerModuleId,
  defaultStageRoot,
  extensionRoot,
} from './extension-package-paths.mjs';
import { readJson } from './package-stage-file-ops.mjs';
import { stagedExtensionId, createStageExtensionManifest } from './create-stage-extension-manifest.mjs';
import { createLanguageServerModuleResolverSource } from './create-language-server-module-resolver-source.mjs';
import { createConsumerPackageManifest } from './create-consumer-package-manifest.mjs';
import { collectExportTargets } from './collect-export-targets.mjs';
import { writeStageExtensionManifest, copyStageAsset, writeStageLanguageServerModuleResolver } from './stage-extension-assets.mjs';
import { stageWorkspacePackage } from './stage-workspace-packages.mjs';
import { stageExternalDependency } from './stage-external-dependencies.mjs';
import { verifyConsumerSurface } from './verify-consumer-surface.mjs';

export const stagedExtensionRoot = defaultStageRoot;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await createPackageStage();
}

export async function createPackageStage(options = {}) {
  const {
    stageRoot = defaultStageRoot,
    languageServerModuleId = defaultLanguageServerModuleId,
  } = options;
  const extensionManifest = await readJson(new URL('../../package.json', import.meta.url));
  const stagedExternalPackages = new Set();

  await rm(stageRoot, { recursive: true, force: true });
  await mkdir(stageRoot, { recursive: true });
  await writeStageExtensionManifest(stageRoot, extensionManifest);
  await copyStageAsset(stageRoot, 'out');
  await copyStageAsset(stageRoot, 'syntaxes');
  await copyStageAsset(stageRoot, 'language-configuration.json');
  await writeStageLanguageServerModuleResolver(stageRoot, languageServerModuleId);
  await stageWorkspacePackage('@datalog/parser', stageRoot, stagedExternalPackages);
  await stageWorkspacePackage('@datalog/lsp', stageRoot, stagedExternalPackages);
  await stageExternalDependency('vscode-languageclient', stageRoot, stagedExternalPackages);
  await verifyConsumerSurface(stageRoot);

  return stageRoot;
}

export {
  collectExportTargets,
  createConsumerPackageManifest,
  createLanguageServerModuleResolverSource,
  createStageExtensionManifest,
  extensionRoot,
  stagedExtensionId,
};
