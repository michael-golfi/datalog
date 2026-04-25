export function copyStageAsset(
  stageRoot: string,
  relativePath: string,
  options?: {
    allowMissing?: boolean;
  },
): Promise<void>;

export function writeStageExtensionManifest(
  stageRoot: string,
  extensionManifest: Record<string, unknown>,
): Promise<void>;

export function writeStageLanguageServerModuleResolver(
  stageRoot: string,
  languageServerModuleId: string,
): Promise<void>;
