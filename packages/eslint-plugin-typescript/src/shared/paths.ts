import fs from 'node:fs';
import path from 'node:path';

export interface WorkspaceInfo {
  group: string;
  name: string;
  root: string;
  rootAbs: string;
  relativeInsideWorkspace: string;
  packageName: string | null;
}

export interface PathHelpers {
  workspacePackageMap: Map<string, string>;
  getRepoRelativePath(filePath: string): string;
  getWorkspaceInfoFromAbsolutePath(filePath: string): WorkspaceInfo | null;
}

/** Normalize a filesystem path to POSIX separators. */
export function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

/** Read and parse JSON from disk, returning null on parse or read failure. */
export function readJsonFile(filePath: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

function getDefaultWorkspaceGlobs(): string[] {
  return [];
}

function readWorkspaceGlobsFromWorkspacesArray(workspaces: unknown[]): string[] {
  return workspaces.filter((entry): entry is string => typeof entry === 'string');
}

function readWorkspaceGlobsFromWorkspacesObject(workspaces: unknown): string[] | null {
  if (typeof workspaces !== 'object' || workspaces === null || !('packages' in workspaces)) {
    return null;
  }

  return Array.isArray(workspaces.packages)
    ? workspaces.packages.filter((entry): entry is string => typeof entry === 'string')
    : null;
}

function readWorkspaceGlobsFromRootPackageJson(rootDir: string): string[] | null {
  const rootPackageJson = readJsonFile(path.join(rootDir, 'package.json'));

  if (typeof rootPackageJson !== 'object' || rootPackageJson === null || !('workspaces' in rootPackageJson)) {
    return null;
  }

  const workspaces = rootPackageJson.workspaces;

  if (Array.isArray(workspaces)) {
    return readWorkspaceGlobsFromWorkspacesArray(workspaces);
  }

  return readWorkspaceGlobsFromWorkspacesObject(workspaces);
}

function getWorkspaceGlobs(rootDir: string): string[] {
  return readWorkspaceGlobsFromRootPackageJson(rootDir) ?? getDefaultWorkspaceGlobs();
}

function getWorkspaceRootNames(rootDir: string): string[] {
  return Array.from(
    new Set(
      getWorkspaceGlobs(rootDir)
        .map((workspaceGlob) => toPosixPath(workspaceGlob).replace(/\/\*.*$/u, ''))
        .filter((workspaceRoot) => workspaceRoot !== '' && workspaceRoot !== '.'),
    ),
  );
}

/** Find workspace package directories under the monorepo root. */
function getWorkspaceRootPackageDirs(workspaceRoot: string): string[] {
  if (!fs.existsSync(workspaceRoot)) {
    return [];
  }

  return fs.readdirSync(workspaceRoot, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) {
      return [];
    }

    const packageDir = path.join(workspaceRoot, entry.name);
    return fs.existsSync(path.join(packageDir, 'package.json')) ? [packageDir] : [];
  });
}

/** Find workspace package directories under the monorepo root. */
export function findWorkspacePackageDirs(rootDir: string): string[] {
  const packageDirs = [rootDir];

  for (const workspaceRootName of getWorkspaceRootNames(rootDir)) {
    packageDirs.push(...getWorkspaceRootPackageDirs(path.join(rootDir, workspaceRootName)));
  }

  return packageDirs;
}

/** Build a map from workspace-relative roots to package names. */
export function getWorkspacePackageMap(rootDir: string): Map<string, string> {
  const entries = new Map<string, string>();

  for (const packageDir of findWorkspacePackageDirs(rootDir)) {
    const packageJson = readJsonFile(path.join(packageDir, 'package.json'));
    const packageName =
      typeof packageJson === 'object' && packageJson !== null && 'name' in packageJson
        ? packageJson.name
        : null;

    if (typeof packageName !== 'string') {
      continue;
    }

    const relativeRoot = toPosixPath(path.relative(rootDir, packageDir));
    entries.set(relativeRoot === '' ? '.' : relativeRoot, packageName);
  }

  return entries;
}

/** Convert an absolute path into a repo-relative POSIX path. */
export function getRepoRelativePath(rootDir: string, filePath: string): string {
  return toPosixPath(path.relative(rootDir, filePath));
}

function getContainingWorkspaceRoot(
  repoRelativePath: string,
  workspacePackageMap: Map<string, string>,
): string | null {
  const workspaceRoots = Array.from(workspacePackageMap.keys())
    .filter((workspaceRoot) => workspaceRoot !== '.' && startsWithPathPrefix(repoRelativePath, workspaceRoot))
    .sort((left, right) => right.length - left.length);

  return workspaceRoots[0] ?? null;
}

/** Resolve workspace metadata for an absolute file path. */
export function getWorkspaceInfoFromAbsolutePath(
  rootDir: string,
  workspacePackageMap: Map<string, string>,
  filePath: string,
): WorkspaceInfo | null {
  const repoRelativePath = getRepoRelativePath(rootDir, filePath);
  const root = getContainingWorkspaceRoot(repoRelativePath, workspacePackageMap);

  if (!root) {
    return null;
  }

  const [group = root, ...nameParts] = root.split('/');
  const relativeInsideWorkspace = repoRelativePath === root ? '' : repoRelativePath.slice(root.length + 1);

  return {
    group,
    name: nameParts.join('/') || group,
    root,
    rootAbs: path.join(rootDir, root),
    relativeInsideWorkspace,
    packageName: workspacePackageMap.get(root) ?? null,
  };
}

/** Check whether a path matches or sits beneath a prefix. */
export function startsWithPathPrefix(value: string, prefix: string): boolean {
  return value === prefix || value.startsWith(`${prefix}/`);
}

/** Determine whether an import source looks like a code module path. */
export function hasCodeLikeExtension(importSource: string): boolean {
  const extension = path.extname(importSource).toLowerCase();

  if (extension === '') {
    return true;
  }

  return ['.js', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs'].includes(extension);
}

/** Resolve a relative import source against the importing file. */
export function resolveRelativeImport(filename: string, importSource: string): string | null {
  if (!importSource.startsWith('.')) {
    return null;
  }

  return path.resolve(path.dirname(filename), importSource);
}

/** Identify test and fixture-like paths. */
export function isTestPath(value: string): boolean {
  return /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)|\.(?:test|spec)(?:\.[cm]?[jt]sx?)?$/u.test(
    toPosixPath(value),
  );
}

function hasIndexFile(directoryPath: string): boolean {
  return ['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.mts', 'index.cts'].some((fileName) =>
    fs.existsSync(path.join(directoryPath, fileName)),
  );
}

function isBareIndexImport(importSource: string): boolean {
  return importSource === '.' || importSource === '..';
}

/** Check whether a relative import resolves to an internal index barrel. */
export function resolvesToIndexBarrel(filename: string, importSource: string): boolean {
  if (!importSource.startsWith('.') || !hasCodeLikeExtension(importSource)) {
    return false;
  }

  const resolvedPath = resolveRelativeImport(filename, importSource);

  if (!resolvedPath) {
    return false;
  }

  const basename = path.basename(resolvedPath);

  if (basename === 'index') {
    return true;
  }

  if (isBareIndexImport(importSource)) {
    return true;
  }

  if (!fs.existsSync(resolvedPath)) {
    return false;
  }

  if (!fs.statSync(resolvedPath).isDirectory()) {
    return false;
  }

  return hasIndexFile(resolvedPath);
}

/** Create workspace-aware path helper utilities for lint rules. */
export function createPathHelpers(rootDir: string): PathHelpers {
  const workspacePackageMap = getWorkspacePackageMap(rootDir);

  return {
    workspacePackageMap,
    getRepoRelativePath(filePath: string): string {
      return getRepoRelativePath(rootDir, filePath);
    },
    getWorkspaceInfoFromAbsolutePath(filePath: string): WorkspaceInfo | null {
      return getWorkspaceInfoFromAbsolutePath(rootDir, workspacePackageMap, filePath);
    },
  };
}
