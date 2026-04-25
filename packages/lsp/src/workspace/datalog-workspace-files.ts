import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { Dirent } from 'node:fs';

type ReadDir = (directoryPath: string, options: { withFileTypes: true }) => Promise<Dirent[]>;

const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  '.sisyphus',
  '.worktrees',
  '.yarn',
  'coverage',
  'dist',
  'node_modules',
]);

/** Enumerate `.dl` files beneath a single workspace root while skipping ignored paths. */
export async function listDatalogWorkspaceFiles(
  workspaceRootPath: string,
  options: {
    readonly readDir?: ReadDir;
  } = {},
): Promise<readonly string[]> {
  const files: string[] = [];

  await collectWorkspaceFiles({
    workspaceRootPath,
    currentDirectoryPath: workspaceRootPath,
    files,
    readDir: options.readDir ?? readdir,
  });

  return files.sort((left, right) => left.localeCompare(right));
}

async function collectWorkspaceFiles(options: {
  readonly workspaceRootPath: string;
  readonly currentDirectoryPath: string;
  readonly files: string[];
  readonly readDir: ReadDir;
}): Promise<void> {
  const entries = await readWorkspaceEntries(options.currentDirectoryPath, options.readDir);
  if (!entries) {
    return;
  }

  for (const entry of entries) {
    await collectWorkspaceEntry(options, entry);
  }
}

async function collectWorkspaceEntry(
  options: {
    readonly workspaceRootPath: string;
    readonly currentDirectoryPath: string;
    readonly files: string[];
    readonly readDir: ReadDir;
  },
  entry: Dirent,
): Promise<void> {
  const entryPath = join(options.currentDirectoryPath, entry.name);
  const relativePath = entryPath.slice(options.workspaceRootPath.length + 1);
  if (isIgnoredWorkspacePath(relativePath)) {
    return;
  }

  if (entry.isDirectory()) {
    await collectWorkspaceFiles({
      workspaceRootPath: options.workspaceRootPath,
      currentDirectoryPath: entryPath,
      files: options.files,
      readDir: options.readDir,
    });
    return;
  }

  if (entry.isFile() && entry.name.endsWith('.dl')) {
    options.files.push(entryPath);
  }
}

async function readWorkspaceEntries(
  directoryPath: string,
  readDir: ReadDir,
): Promise<Dirent[] | null> {
  try {
    return await readDir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (isSkippableWorkspaceFsError(error)) {
      return null;
    }

    throw error;
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

  return pathSegments[pathSegments.length - 1]?.endsWith('.tsbuildinfo') ?? false;
}

function isSkippableWorkspaceFsError(error: unknown): boolean {
  if (!(error instanceof Error) || !('code' in error)) {
    return false;
  }

  return (
    error.code === 'ENOENT' ||
    error.code === 'ENOTDIR' ||
    error.code === 'EACCES' ||
    error.code === 'EPERM'
  );
}
