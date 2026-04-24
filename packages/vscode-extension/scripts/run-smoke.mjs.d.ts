export function wasExpectedBrokenFailure(message: string, brokenSmokeMarkerPath?: string): Promise<boolean>;

export function createSmokeRunOptions(input: {
  brokenMode: boolean;
  stageRoot: string;
  currentFilePath: string;
  brokenSmokeMarkerPath: string;
}): {
  extensionDevelopmentPath: string;
  extensionTestsPath: string;
  extensionTestsEnv: Record<string, string>;
  launchArgs: string[];
};

export function runSmoke(options?: { brokenMode?: boolean }): Promise<void>;
