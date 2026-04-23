export const defaultVsixPath: string;

export interface PackageVsixOptions {
  stageRoot?: string;
  outputPath?: string;
  version?: string;
}

export interface VscePackageArgs {
  outputPath?: string;
  version?: string;
}

export function createPackageVsix(options?: PackageVsixOptions): Promise<string>;

export function createVscePackageArgs(options?: VscePackageArgs): string[];
