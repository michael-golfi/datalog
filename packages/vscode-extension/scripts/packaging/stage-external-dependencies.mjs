import { cp, mkdir, realpath, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

import { workspaceRoot } from './extension-package-paths.mjs';
import { readJson } from './package-stage-file-ops.mjs';

export async function stageExternalDependency(packageName, stageRoot, stagedExternalPackages) {
  if (packageName.startsWith('@datalog/')) {
    return;
  }

  if (stagedExternalPackages.has(packageName)) {
    return;
  }

  stagedExternalPackages.add(packageName);

  const sourcePackageDirectory = await resolveInstalledPackageDirectory(packageName);
  const destinationPackageDirectory = path.join(stageRoot, 'node_modules', ...packageName.split('/'));
  const packageManifest = await readJson(path.join(sourcePackageDirectory, 'package.json'));

  await mkdir(path.dirname(destinationPackageDirectory), { recursive: true });
  await cp(sourcePackageDirectory, destinationPackageDirectory, { recursive: true });

  for (const dependencyName of getExternalDependencyNames(packageManifest)) {
    await stageExternalDependency(dependencyName, stageRoot, stagedExternalPackages);
  }
}

export function getExternalDependencyNames(packageManifest) {
  return [
    ...Object.keys(packageManifest.dependencies ?? {}),
    ...Object.keys(packageManifest.optionalDependencies ?? {}),
  ];
}

async function resolveInstalledPackageDirectory(packageName) {
  const packageEntryPath = createRequire(path.join(workspaceRoot, 'package.json')).resolve(packageName);
  let candidateDirectory = path.dirname(await realpath(packageEntryPath));

  while (candidateDirectory !== path.dirname(candidateDirectory)) {
    const packageJsonPath = path.join(candidateDirectory, 'package.json');

    try {
      await stat(packageJsonPath);
      const packageManifest = await readJson(packageJsonPath);

      if (packageManifest.name === packageName) {
        return candidateDirectory;
      }
    } catch {
      // Keep walking upward until the package root is found.
    }

    candidateDirectory = path.dirname(candidateDirectory);
  }

  throw new Error(`Unable to resolve installed package directory for ${packageName}.`);
}
