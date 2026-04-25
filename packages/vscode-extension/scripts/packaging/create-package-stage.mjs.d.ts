export interface ConsumerPackageManifest {
  name: string;
  version: string;
  type?: string;
  main?: string;
  module?: string;
  types?: string;
  exports?: Record<string, unknown>;
  dependencies?: Record<string, string>;
}

export interface ExtensionManifest {
  displayName: string;
  description: string;
  version: string;
  engines: { vscode: string };
  categories: string[];
  activationEvents: string[];
  contributes: { languages: unknown[] };
  main: string;
  files?: string[];
}

export const extensionRoot: string;
export const stagedExtensionId: string;
export const stagedExtensionRoot: string;

export function collectExportTargets(exportsField: Record<string, unknown>): string[];

export function createConsumerPackageManifest(
  manifest: ConsumerPackageManifest,
): ConsumerPackageManifest;

export function createLanguageServerModuleResolverSource(
  languageServerModuleId: string,
): string;

export function createStageExtensionManifest(
  extensionManifest: ExtensionManifest,
): ExtensionManifest & { name: string; publisher: string; files: string[] };

export function createPackageStage(options?: {
  stageRoot?: string;
  languageServerModuleId?: string;
  allowMissingCompiledExtension?: boolean;
}): Promise<string>;
