import { startsWithPathPrefix } from '../shared/paths.js';

import type { WorkspaceInfo } from '../shared/paths.js';

export interface LayerDefinition {
  name: string;
  files?: string[];
  prefixes?: string[];
}

export interface WorkspaceLayerPolicy {
  workspaceRoot: string;
  sourceRoot: string;
  defaultLayer: string;
  layers: LayerDefinition[];
  allow: Record<string, string[]>;
}

export interface WorkspaceLayerImportOptions {
  policies?: WorkspaceLayerPolicy[];
}

function stripFileExtension(value: string): string {
  return value.replace(/\.[^./]+$/u, '');
}

function matchesLayerFile(layerFile: string, relativeInsideSourceRoot: string): boolean {
  return (
    layerFile === relativeInsideSourceRoot ||
    stripFileExtension(layerFile) === relativeInsideSourceRoot ||
    layerFile === stripFileExtension(relativeInsideSourceRoot)
  );
}

/** Find the active layer policy for a workspace path. */
export function getLayerPolicy(
  policies: WorkspaceLayerPolicy[],
  workspaceInfo: WorkspaceInfo | null,
  relativeInsideWorkspace: string,
): WorkspaceLayerPolicy | null {
  if (!workspaceInfo) {
    return null;
  }

  return (
    policies.find(
      (policy) =>
        policy.workspaceRoot === workspaceInfo.root &&
        startsWithPathPrefix(relativeInsideWorkspace, policy.sourceRoot),
    ) ?? null
  );
}

/** Strip a policy source root from a workspace-relative path. */
export function getRelativeInsideSourceRoot(
  policy: WorkspaceLayerPolicy,
  relativeInsideWorkspace: string,
): string {
  if (relativeInsideWorkspace === policy.sourceRoot) {
    return '';
  }

  return relativeInsideWorkspace.slice(policy.sourceRoot.length + 1);
}

/** Resolve the policy layer name for a path within a source root. */
export function getLayerName(
  policy: WorkspaceLayerPolicy,
  relativeInsideSourceRoot: string,
): string {
  for (const layer of policy.layers) {
    if (layer.files?.some((layerFile) => matchesLayerFile(layerFile, relativeInsideSourceRoot))) {
      return layer.name;
    }

    if (
      layer.prefixes?.some(
        (prefix) =>
          relativeInsideSourceRoot === prefix.slice(0, -1) ||
          relativeInsideSourceRoot.startsWith(prefix),
      )
    ) {
      return layer.name;
    }
  }

  return policy.defaultLayer;
}
