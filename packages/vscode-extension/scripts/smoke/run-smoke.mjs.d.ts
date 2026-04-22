export interface SmokeRunOptionsInput {
  brokenMode: boolean;
  stageRoot: string;
  smokeFilePath: string;
  brokenSmokeMarkerPath: string;
}

export interface SmokeRunOptions {
  extensionDevelopmentPath: string;
  extensionTestsPath: string;
  extensionTestsEnv: {
    DATALOG_SMOKE_EXPECT_FAILURE: '0' | '1';
    DATALOG_SMOKE_EXTENSION_ID: string;
    DATALOG_SMOKE_FILE_PATH: string;
    DATALOG_SMOKE_BROKEN_MARKER_PATH: string;
  };
  launchArgs: string[];
}

export function wasExpectedBrokenFailure(
  message: string,
  brokenSmokeMarkerPath?: string,
): Promise<boolean>;

export function createSmokeRunOptions(input: SmokeRunOptionsInput): SmokeRunOptions;

export function runSmoke(options?: { brokenMode?: boolean }): Promise<void>;
