import path from 'node:path';

import { collectExportTargets } from './collect-export-targets.mjs';
import { assertExists } from './package-stage-file-ops.mjs';

export async function validatePackageSurface(packageName, packageRoot, packageManifest) {
  const requiredTargets = new Set([
    packageManifest.main,
    packageManifest.module,
    packageManifest.types,
    ...collectExportTargets(packageManifest.exports),
  ]);

  for (const relativeTarget of requiredTargets) {
    if (!relativeTarget) {
      continue;
    }

    const absoluteTarget = path.join(packageRoot, relativeTarget);
    await assertExists(
      absoluteTarget,
      `${packageName} surface target is missing: ${relativeTarget}`,
    );
  }
}
