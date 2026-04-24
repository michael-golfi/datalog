import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const IGNORED_DIRECTORY_NAMES = new Set([
  '.worktrees',
  '.yarn',
  'coverage',
  'dist',
  'node_modules',
]);

/** Enumerate `.dl` files beneath a single workspace root while skipping ignored paths. */
export async function listDatalogWorkspaceFiles(workspaceRootPath: string): Promise<readonly string[]> {
  const files: string[] = [];

  await collectWorkspaceFiles({
    workspaceRootPath,
    currentDirectoryPath: workspaceRootPath,
    files,
  });

  return files.sort((left, right) => left.localeCompare(right));
}

async function collectWorkspaceFiles(options: {
  readonly workspaceRootPath: string;
  readonly currentDirectoryPath: string;
  readonly files: string[];
}): Promise<void> {
  const entries = await readdir(options.currentDirectoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(options.currentDirectoryPath, entry.name);
    const relativePath = entryPath.slice(options.workspaceRootPath.length + 1);
    if (isIgnoredWorkspacePath(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectWorkspaceFiles({
        workspaceRootPath: options.workspaceRootPath,
        currentDirectoryPath: entryPath,
        files: options.files,
      });
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.dl')) {
      options.files.push(entryPath);
    }
  }
}

function isIgnoredWorkspacePath(relativePath: string): boolean {
  const pathSegments = relativePath.split(/[\\/]/).filter((segment) => segment.length > 0);
  if (pathSegments.length === 0) {
    return false;
  }

  if (pathSegments.some((segment) => IGNORED_DIRECTORY_NAMES.has(segment))) {
    return true;
  }

  if (pathSegments[0] === '.sisyphus' && pathSegments[1] === 'plans') {
    return true;
  }

  return pathSegments[pathSegments.length - 1]?.endsWith('.tsbuildinfo') ?? false;
}
