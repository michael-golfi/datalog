import { describe, expect, it } from 'vitest';

import { createSmokeRunOptions } from './run-smoke.mjs';

describe('run-smoke helpers', () => {
  it('builds smoke run options for the happy path', () => {
    const options = createSmokeRunOptions({
      brokenMode: false,
      stageRoot: '/tmp/stage',
      smokeFilePath: '/tmp/work/smoke.dl',
      brokenSmokeMarkerPath: '/tmp/work/marker.txt',
    });

    expect(options).toMatchObject({
      extensionDevelopmentPath: '/tmp/stage',
      launchArgs: ['/tmp/work', '--disable-extensions'],
      extensionTestsEnv: {
        DATALOG_SMOKE_EXPECT_FAILURE: '0',
        DATALOG_SMOKE_FILE_PATH: '/tmp/work/smoke.dl',
      },
    });
  });

  it('builds smoke run options for the broken path', () => {
    const options = createSmokeRunOptions({
      brokenMode: true,
      stageRoot: '/tmp/stage',
      smokeFilePath: '/tmp/work/smoke.dl',
      brokenSmokeMarkerPath: '/tmp/work/marker.txt',
    });

    expect(options.extensionTestsEnv).toMatchObject({
      DATALOG_SMOKE_EXPECT_FAILURE: '1',
      DATALOG_SMOKE_BROKEN_MARKER_PATH: '/tmp/work/marker.txt',
    });
  });
});
