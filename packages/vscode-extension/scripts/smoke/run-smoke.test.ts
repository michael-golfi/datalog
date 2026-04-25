import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSmokeRunOptions, runSmoke } from './run-smoke.mjs';

const mocks = vi.hoisted(() => ({
  cp: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  mkdtemp: vi.fn(async (prefix: string) => `${prefix}mock`),
  readFile: vi.fn(async () => ''),
  rm: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  runTests: vi.fn(async () => undefined),
  createPackageStage: vi.fn(async () => undefined),
}));

vi.mock('node:fs/promises', () => ({
  cp: mocks.cp,
  mkdir: mocks.mkdir,
  mkdtemp: mocks.mkdtemp,
  readFile: mocks.readFile,
  rm: mocks.rm,
  writeFile: mocks.writeFile,
}));

vi.mock('@vscode/test-electron', () => ({
  runTests: mocks.runTests,
}));

vi.mock('../packaging/create-package-stage.mjs', () => ({
  createPackageStage: mocks.createPackageStage,
  stagedExtensionId: 'test.extension',
}));

describe('run-smoke helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DATALOG_SMOKE_EVIDENCE_PATH;
    mocks.mkdtemp
      .mockResolvedValueOnce('/tmp/workspace-root')
      .mockResolvedValueOnce('/tmp/stage-root');
    mocks.runTests.mockResolvedValue(undefined);
  });

  it('builds smoke run options for the happy path', () => {
    const options = createSmokeRunOptions({
      brokenMode: false,
      stageRoot: '/tmp/stage',
      currentFilePath: '/tmp/workspace/current.dl',
      brokenSmokeMarkerPath: '/tmp/work/marker.txt',
    });

    expect(options).toMatchObject({
      extensionDevelopmentPath: '/tmp/stage',
      launchArgs: ['/tmp/workspace', '--disable-extensions'],
      extensionTestsEnv: {
        DATALOG_SMOKE_EXPECT_FAILURE: '0',
        DATALOG_SMOKE_CURRENT_FILE_PATH: '/tmp/workspace/current.dl',
      },
    });
  });

  it('builds smoke run options for the broken path', () => {
    const options = createSmokeRunOptions({
      brokenMode: true,
      stageRoot: '/tmp/stage',
      currentFilePath: '/tmp/workspace/current.dl',
      brokenSmokeMarkerPath: '/tmp/work/marker.txt',
    });

    expect(options.extensionTestsEnv).toMatchObject({
      DATALOG_SMOKE_EXPECT_FAILURE: '1',
      DATALOG_SMOKE_BROKEN_MARKER_PATH: '/tmp/work/marker.txt',
    });
  });

  it('does not write evidence when no evidence path is configured', async () => {
    await runSmoke({ brokenMode: false });

    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it('writes success evidence for a normal smoke run', async () => {
    process.env.DATALOG_SMOKE_EVIDENCE_PATH = '.sisyphus/evidence/task-8-smoke-normal.md';

    await runSmoke({ brokenMode: false });

    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('/.sisyphus/evidence/task-8-smoke-normal.md'),
      expect.stringContaining('- status: pass'),
      'utf8',
    );
    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('/.sisyphus/evidence/task-8-smoke-normal.md'),
      expect.stringContaining('- commandOutcome: success'),
      'utf8',
    );
  });

  it('writes expected-failure evidence for broken smoke runs', async () => {
    process.env.DATALOG_SMOKE_EVIDENCE_PATH = '.sisyphus/evidence/task-8-smoke-broken.md';
    mocks.runTests.mockRejectedValueOnce(
      new Error('DATALOG_SMOKE_BROKEN_EXPECTED_FAILURE: broken smoke'),
    );

    await runSmoke({ brokenMode: true });

    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('/.sisyphus/evidence/task-8-smoke-broken.md'),
      expect.stringContaining('- status: pass'),
      'utf8',
    );
    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('/.sisyphus/evidence/task-8-smoke-broken.md'),
      expect.stringContaining('- commandOutcome: expected-failure'),
      'utf8',
    );
  });

  it('writes failure evidence and rethrows unexpected smoke failures', async () => {
    process.env.DATALOG_SMOKE_EVIDENCE_PATH = '.sisyphus/evidence/task-8-smoke-fail.md';
    mocks.runTests.mockRejectedValueOnce(new Error('unexpected smoke failure'));

    await expect(runSmoke({ brokenMode: false })).rejects.toThrow('unexpected smoke failure');

    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('/.sisyphus/evidence/task-8-smoke-fail.md'),
      expect.stringContaining('- status: fail'),
      'utf8',
    );
    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('/.sisyphus/evidence/task-8-smoke-fail.md'),
      expect.stringContaining('- commandOutcome: failure'),
      'utf8',
    );
  });
});
