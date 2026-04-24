import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runTests } from '@vscode/test-electron';

import { createPackageStage, stagedExtensionId } from '../packaging/create-package-stage.mjs';

const smokeRoot = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(smokeRoot, '..', '..');
const fixtureWorkspacePath = path.join(extensionRoot, 'fixtures', 'smoke', 'workspace');
const smokeSuitePath = path.join(extensionRoot, 'fixtures', 'smoke', 'smoke-suite.cjs');
const brokenServerModuleId = '@datalog/lsp/broken-server-entry';
const brokenSmokeFailureMessage = `DATALOG_SMOKE_BROKEN_EXPECTED_FAILURE: intentionally failed smoke run using ${brokenServerModuleId}.`;
const brokenSmokeFailurePrefix = 'DATALOG_SMOKE_BROKEN_EXPECTED_FAILURE:';

export async function wasExpectedBrokenFailure(message, brokenSmokeMarkerPath) {
  if (message.includes(brokenSmokeFailurePrefix)) {
    return true;
  }

  if (!brokenSmokeMarkerPath) {
    return false;
  }

  try {
    const markerContents = await readFile(brokenSmokeMarkerPath, 'utf8');

    return markerContents.includes(brokenSmokeFailurePrefix);
  } catch {
    return false;
  }
}

export function createSmokeRunOptions({ brokenMode, stageRoot, currentFilePath, brokenSmokeMarkerPath }) {
  return {
    extensionDevelopmentPath: stageRoot,
    extensionTestsPath: smokeSuitePath,
    extensionTestsEnv: {
      DATALOG_SMOKE_EXPECT_FAILURE: brokenMode ? '1' : '0',
      DATALOG_SMOKE_EXTENSION_ID: stagedExtensionId,
      DATALOG_SMOKE_CURRENT_FILE_PATH: currentFilePath,
      DATALOG_SMOKE_BROKEN_MARKER_PATH: brokenSmokeMarkerPath,
    },
    launchArgs: [path.dirname(currentFilePath), '--disable-extensions'],
  };
}

export async function runSmoke({ brokenMode = process.argv.includes('--broken') } = {}) {
  let temporaryWorkspaceDirectory;
  let temporaryStageDirectory;
  let brokenSmokeMarkerPath;

  try {
    temporaryWorkspaceDirectory = await mkdtemp(path.join(os.tmpdir(), 'datalog-vscode-smoke-'));
    temporaryStageDirectory = await mkdtemp(path.join(os.tmpdir(), 'datalog-vscode-stage-'));

    const stageRoot = path.join(temporaryStageDirectory, 'extension');
    const workspaceRoot = path.join(temporaryWorkspaceDirectory, 'workspace');
    brokenSmokeMarkerPath = path.join(temporaryWorkspaceDirectory, 'broken-smoke-marker.txt');
    await createPackageStage({
      stageRoot,
      languageServerModuleId: brokenMode ? brokenServerModuleId : '@datalog/lsp/server',
    });

    await cp(fixtureWorkspacePath, workspaceRoot, { recursive: true });

    const currentFilePath = path.join(workspaceRoot, 'current.dl');

    await runTests(createSmokeRunOptions({ brokenMode, stageRoot, currentFilePath, brokenSmokeMarkerPath }));

    if (brokenMode) {
      throw new Error(`${brokenSmokeFailureMessage} Smoke unexpectedly passed.`);
    }
  } catch (error) {
    if (!brokenMode) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);

    if (!(await wasExpectedBrokenFailure(message, brokenSmokeMarkerPath))) {
      throw error;
    }

    process.exitCode = 0;

    return;
  } finally {
    if (temporaryWorkspaceDirectory) {
      await rm(temporaryWorkspaceDirectory, { recursive: true, force: true });
    }

    if (temporaryStageDirectory) {
      await rm(temporaryStageDirectory, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runSmoke();
}
