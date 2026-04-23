import { cp, mkdtemp, rename, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { createPackageStage } from './create-package-stage.mjs';
import {
  defaultStageRoot,
  extensionRoot,
  workspaceRoot,
} from './extension-package-paths.mjs';

const vsceBinaryPath = path.join(workspaceRoot, 'node_modules', '.bin', 'vsce');

export const defaultVsixPath = path.join(extensionRoot, 'build', 'datalog-language-support.vsix');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await createPackageVsix();
}

export async function createPackageVsix(options = {}) {
  const {
    stageRoot = defaultStageRoot,
    outputPath = defaultVsixPath,
    version = process.env.PACKAGE_VERSION ?? '',
  } = options;

  await createPackageStage({ stageRoot });
  await runVscePackage({ stageRoot, outputPath, version });

  return outputPath;
}

export function createVscePackageArgs({ outputPath = defaultVsixPath, version = '' } = {}) {
  const args = ['package'];

  if (version) {
    args.push(version);
  }

  args.push('--no-dependencies', '--allow-unused-files-pattern', '--allow-missing-repository', '--out', outputPath);

  return args;
}

async function runVscePackage({ stageRoot, outputPath, version }) {
  const args = createVscePackageArgs({ outputPath, version });

  await new Promise((resolve, reject) => {
    const child = spawn(vsceBinaryPath, args, {
      cwd: stageRoot,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`vsce package failed with exit code ${code ?? 'unknown'}.`));
    });
  });

  await injectNodeModulesIntoVsix({ stageRoot, vsixPath: outputPath });
}

async function injectNodeModulesIntoVsix({ stageRoot, vsixPath }) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'datalog-vsce-package-'));
  const unpackRoot = path.join(tempRoot, 'unpacked');
  const repackedVsixPath = path.join(tempRoot, 'repacked.vsix');

  try {
    await runCommand('unzip', ['-q', vsixPath, '-d', unpackRoot]);
    await cp(path.join(stageRoot, 'node_modules'), path.join(unpackRoot, 'extension', 'node_modules'), {
      recursive: true,
    });
    await runCommand('zip', ['-qr', repackedVsixPath, '.'], unpackRoot);
    await rm(vsixPath, { force: true });
    await rename(repackedVsixPath, vsixPath);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runCommand(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} failed with exit code ${code ?? 'unknown'}.`));
    });
  });
}
