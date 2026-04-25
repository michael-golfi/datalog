import fs from 'node:fs';
import path from 'node:path';

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function pathExists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeWorkspaceGlobs(workspaces) {
  if (Array.isArray(workspaces)) {
    return workspaces.filter((entry) => typeof entry === 'string');
  }

  if (typeof workspaces !== 'object' || workspaces === null || !('packages' in workspaces)) {
    return [];
  }

  return Array.isArray(workspaces.packages)
    ? workspaces.packages.filter((entry) => typeof entry === 'string')
    : [];
}

function getWorkspaceFamily(workspaceGlob) {
  const normalizedGlob = toPosixPath(workspaceGlob);
  const workspaceRoot = normalizedGlob.replace(/\/\*.*$/u, '');

  if (workspaceRoot === '' || workspaceRoot === '.') {
    return null;
  }

  return {
    workspaceGlob: normalizedGlob,
    workspaceRoot,
  };
}

function listWorkspacePackageDirs(rootDir, workspaceFamily) {
  const absoluteWorkspaceRoot = path.join(rootDir, workspaceFamily.workspaceRoot);

  if (!pathExists(absoluteWorkspaceRoot)) {
    return [];
  }

  if (workspaceFamily.workspaceGlob === workspaceFamily.workspaceRoot) {
    return pathExists(path.join(absoluteWorkspaceRoot, 'package.json'))
      ? [workspaceFamily.workspaceRoot]
      : [];
  }

  if (workspaceFamily.workspaceGlob !== `${workspaceFamily.workspaceRoot}/*`) {
    return [];
  }

  return fs
    .readdirSync(absoluteWorkspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => toPosixPath(path.join(workspaceFamily.workspaceRoot, entry.name)))
    .filter((workspaceDir) => pathExists(path.join(rootDir, workspaceDir, 'package.json')))
    .sort((left, right) => left.localeCompare(right));
}

function getWorkspacePackage(rootDir, workspaceFamily, workspaceDir) {
  const packageJsonPath = path.join(rootDir, workspaceDir, 'package.json');
  const packageJson = readJsonFile(packageJsonPath);

  if (packageJson === null || typeof packageJson.name !== 'string') {
    return null;
  }

  return {
    packageName: packageJson.name,
    packageJsonPath: toPosixPath(path.relative(rootDir, packageJsonPath)),
    workspaceDir,
    workspaceGlob: workspaceFamily.workspaceGlob,
    workspaceRoot: workspaceFamily.workspaceRoot,
  };
}

export function loadWorkspaceLayout(rootDir) {
  const rootPackageJson = readJsonFile(path.join(rootDir, 'package.json'));
  const workspaceGlobs = normalizeWorkspaceGlobs(rootPackageJson?.workspaces);
  const workspaceFamilies = workspaceGlobs
    .map(getWorkspaceFamily)
    .filter((family) => family !== null);
  const workspacePackages = workspaceFamilies
    .flatMap((workspaceFamily) =>
      listWorkspacePackageDirs(rootDir, workspaceFamily)
        .map((workspaceDir) => getWorkspacePackage(rootDir, workspaceFamily, workspaceDir))
        .filter((workspacePackage) => workspacePackage !== null),
    )
    .sort((left, right) => left.workspaceDir.localeCompare(right.workspaceDir));

  return {
    rootDir,
    workspaceGlobs,
    workspaceFamilies,
    workspacePackages,
    workspaceRoots: workspaceFamilies.map((family) => family.workspaceRoot),
  };
}
