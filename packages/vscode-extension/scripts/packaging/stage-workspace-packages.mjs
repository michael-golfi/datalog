import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createConsumerPackageManifest } from './create-consumer-package-manifest.mjs';
import { workspacePackageRoots } from './extension-package-paths.mjs';
import { readJson } from './package-stage-file-ops.mjs';
import { validatePackageSurface } from './package-surface-validation.mjs';
import {
  getExternalDependencyNames,
  stageExternalDependency,
} from './stage-external-dependencies.mjs';

export async function stageWorkspacePackage(packageName, stageRoot, stagedExternalPackages) {
  const packageRoot = workspacePackageRoots[packageName];
  const packageManifest = await readJson(path.join(packageRoot, 'package.json'));

  await validatePackageSurface(packageName, packageRoot, packageManifest);

  const scopedDirectory = path.join(
    stageRoot,
    'node_modules',
    '@datalog',
    packageName.split('/')[1],
  );
  await mkdir(path.dirname(scopedDirectory), { recursive: true });
  await cp(path.join(packageRoot, 'dist'), path.join(scopedDirectory, 'dist'), { recursive: true });
  await writeFile(
    path.join(scopedDirectory, 'package.json'),
    `${JSON.stringify(createConsumerPackageManifest(packageManifest), null, 2)}\n`,
    'utf8',
  );

  for (const dependencyName of getExternalDependencyNames(packageManifest)) {
    await stageExternalDependency(dependencyName, stageRoot, stagedExternalPackages);
  }
}
