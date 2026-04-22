import { cp, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { extensionRoot } from './extension-package-paths.mjs';
import { createLanguageServerModuleResolverSource } from './create-language-server-module-resolver-source.mjs';
import { createStageExtensionManifest } from './create-stage-extension-manifest.mjs';

export async function copyStageAsset(stageRoot, relativePath) {
  const sourcePath = path.join(extensionRoot, relativePath);
  const destinationPath = path.join(stageRoot, relativePath);

  await cp(sourcePath, destinationPath, { recursive: true });
}

export async function writeStageExtensionManifest(stageRoot, extensionManifest) {
  const stageManifest = createStageExtensionManifest(extensionManifest);

  await writeFile(
    path.join(stageRoot, 'package.json'),
    `${JSON.stringify(stageManifest, null, 2)}\n`,
    'utf8',
  );
}

export async function writeStageLanguageServerModuleResolver(stageRoot, languageServerModuleId) {
  const resolverModulePath = path.join(stageRoot, 'out', 'runtime', 'resolve-language-server-module.js');
  const resolverModuleSource = createLanguageServerModuleResolverSource(languageServerModuleId);

  await writeFile(resolverModulePath, resolverModuleSource, 'utf8');
}
