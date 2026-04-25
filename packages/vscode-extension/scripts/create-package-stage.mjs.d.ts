export const stagedExtensionId: string;
export const stagedExtensionRoot: string;

export function createPackageStage(options?: {
  stageRoot?: string;
  languageServerModuleId?: string;
  allowMissingCompiledExtension?: boolean;
}): Promise<string>;

export function createLanguageServerModuleResolverSource(languageServerModuleId: string): string;

export function createConsumerPackageManifest(packageManifest: {
  name: string;
  version: string;
  type: string;
  main: string;
  module: string;
  types: string;
  exports: unknown;
  dependencies?: Record<string, string>;
}): {
  name: string;
  version: string;
  type: string;
  main: string;
  module: string;
  types: string;
  exports: unknown;
  dependencies: Record<string, string>;
};

export function collectExportTargets(exportsField: unknown): string[];

export function createStageExtensionManifest(extensionManifest: {
  displayName: string;
  description: string;
  version: string;
  engines: unknown;
  categories: unknown;
  activationEvents: unknown;
  contributes: unknown;
  main: string;
}): Record<string, unknown>;
