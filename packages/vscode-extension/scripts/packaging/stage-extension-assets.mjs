import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createLanguageServerModuleResolverSource } from './create-language-server-module-resolver-source.mjs';
import { createStageExtensionManifest } from './create-stage-extension-manifest.mjs';
import { compiledExtensionRelativeRoot, extensionRoot } from './extension-package-paths.mjs';

export async function copyStageAsset(stageRoot, relativePath, options = {}) {
  const { allowMissing = false } = options;
  const sourcePath = path.join(extensionRoot, relativePath);
  const destinationPath = path.join(stageRoot, relativePath);

  if (allowMissing) {
    try {
      await stat(sourcePath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return;
      }

      throw error;
    }
  }

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
  const resolverModulePath = path.join(
    stageRoot,
    compiledExtensionRelativeRoot,
    'runtime',
    'resolve-language-server-module.js',
  );
  const resolverModuleSource = createLanguageServerModuleResolverSource(languageServerModuleId);

  await mkdir(path.dirname(resolverModulePath), { recursive: true });
  await writeFile(resolverModulePath, resolverModuleSource, 'utf8');
}
