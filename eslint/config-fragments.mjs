import path from 'node:path';

import { findWorkspacePackageDirs } from '@datalog/eslint-plugin-typescript';

import { loadWorkspaceLayout } from './workspace-layout.mjs';

const SOURCE_FILE_EXTENSIONS = '{ts,mts,cts,tsx,js,mjs,cjs,jsx}';
const TYPED_SOURCE_FILE_EXTENSIONS = '{ts,mts,cts,tsx}';
const SOURCE_DIRECTORY_EXTENSIONS = '{ts,tsx,js,mjs,cjs,jsx}';
const LIBRARY_SOURCE_EXTENSIONS = '{ts,tsx}';
const CROSS_WORKSPACE_PARENT_DEPTHS = [2, 3, 4];

function getWorkspacePackagesByName(workspaceLayout, packageNames) {
  const packageNameSet = new Set(packageNames);
  const matchedPackages = workspaceLayout.workspacePackages.filter((workspacePackage) =>
    packageNameSet.has(workspacePackage.packageName),
  );
  const matchedPackageNames = new Set(
    matchedPackages.map((workspacePackage) => workspacePackage.packageName),
  );
  const missingPackageNames = packageNames.filter(
    (packageName) => !matchedPackageNames.has(packageName),
  );

  if (missingPackageNames.length > 0) {
    throw new Error(
      `Unknown workspace package names in repo policy: ${missingPackageNames.join(', ')}`,
    );
  }

  return matchedPackages;
}

function createWorkspaceGlobWithSuffix(workspaceGlob, suffix) {
  return `${workspaceGlob}/${suffix}`;
}

function createWorkspaceFileGlobs(workspaceGlobs, extensions) {
  return workspaceGlobs.map((workspaceGlob) =>
    createWorkspaceGlobWithSuffix(workspaceGlob, `**/*.${extensions}`),
  );
}

function createWorkspaceSourceDirectoryGlobs(workspaceGlobs, extensions) {
  return workspaceGlobs.map((workspaceGlob) =>
    createWorkspaceGlobWithSuffix(workspaceGlob, `src/**/*.${extensions}`),
  );
}

function createScopedWorkspaceFileGlobs(workspaceRoots, suffix) {
  return workspaceRoots.map((workspaceRoot) => `${workspaceRoot}/${suffix}`);
}

function createPackageFileGlobs(workspacePackages, suffix) {
  return workspacePackages.map((workspacePackage) => `${workspacePackage.workspaceDir}/${suffix}`);
}

function createPackageScopedGlobs(workspaceLayout, packageScopedGlobSelectors) {
  return packageScopedGlobSelectors.flatMap(({ packageName, patterns }) => {
    const [workspacePackage] = getWorkspacePackagesByName(workspaceLayout, [packageName]);

    return patterns.map((pattern) => `${workspacePackage.workspaceDir}/${pattern}`);
  });
}

function createImportResolverProjects(rootDir, workspaceGlobs) {
  return [
    path.join(rootDir, 'tsconfig.json'),
    ...workspaceGlobs.map((workspaceGlob) => path.join(rootDir, workspaceGlob, 'tsconfig.json')),
  ];
}

function createCrossWorkspaceRelativeImportPatterns(workspaceRoots) {
  return workspaceRoots.flatMap((workspaceRoot) =>
    CROSS_WORKSPACE_PARENT_DEPTHS.map((depth) => `${'../'.repeat(depth)}${workspaceRoot}/*`),
  );
}

export function createConfigFragments({ rootDir, repoPolicy }) {
  const workspaceLayout = loadWorkspaceLayout(rootDir);
  const crossWorkspaceRelativeImportPatterns = createCrossWorkspaceRelativeImportPatterns(
    workspaceLayout.workspaceRoots,
  );
  const libraryWorkspacePackages = getWorkspacePackagesByName(
    workspaceLayout,
    repoPolicy.libraryWorkspacePackageNames,
  );
  const exportOnlyEntryWorkspacePackages = getWorkspacePackagesByName(
    workspaceLayout,
    repoPolicy.exportOnlyEntryWorkspacePackageNames,
  );
  const repositoryWorkspaceImportPatterns = workspaceLayout.workspaceRoots.map(
    (workspaceRoot) => `${workspaceRoot}/**`,
  );

  return {
    workspaceLayout,
    sourceFileGlobs: createWorkspaceFileGlobs(
      workspaceLayout.workspaceGlobs,
      SOURCE_FILE_EXTENSIONS,
    ),
    typedSourceGlobs: createWorkspaceFileGlobs(
      workspaceLayout.workspaceGlobs,
      TYPED_SOURCE_FILE_EXTENSIONS,
    ),
    maintainabilityFileGlobs: createWorkspaceSourceDirectoryGlobs(
      workspaceLayout.workspaceGlobs,
      SOURCE_DIRECTORY_EXTENSIONS,
    ),
    librarySourceGlobs: createPackageFileGlobs(
      libraryWorkspacePackages,
      `src/**/*.${LIBRARY_SOURCE_EXTENSIONS}`,
    ),
    libraryTestIgnoreGlobs: libraryWorkspacePackages.flatMap((workspacePackage) => [
      `${workspacePackage.workspaceDir}/src/**/*.test.ts`,
      `${workspacePackage.workspaceDir}/src/**/*.spec.ts`,
    ]),
    exportOnlyEntryGlobs: createPackageFileGlobs(exportOnlyEntryWorkspacePackages, 'src/index.ts'),
    testFileGlobs: [
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/test/**/*.{ts,tsx,js,jsx}',
      '**/tests/**/*.{ts,tsx,js,jsx}',
    ],
    declarationFileGlobs: createScopedWorkspaceFileGlobs(
      workspaceLayout.workspaceRoots,
      '**/*.d.ts',
    ),
    importResolverProjects: createImportResolverProjects(rootDir, workspaceLayout.workspaceGlobs),
    crossWorkspaceRelativeImportPatterns,
    vscodeExtensionScriptGlobs: createPackageScopedGlobs(
      workspaceLayout,
      repoPolicy.packageScopedGlobSelectors.vscodeExtensionScripts,
    ),
    fixtureCommonJsGlobs: createPackageScopedGlobs(
      workspaceLayout,
      repoPolicy.packageScopedGlobSelectors.fixtureCommonJs,
    ),
    restrictedWorkspaceImportPatternMessages: [
      {
        group: crossWorkspaceRelativeImportPatterns,
        message: repoPolicy.crossWorkspaceRelativeImportMessage,
      },
      {
        group: repositoryWorkspaceImportPatterns,
        message:
          'Do not import repository paths as modules. Use @datalog/* package exports for workspace-to-workspace imports and relative paths within the current package.',
      },
      ...repoPolicy.restrictedWorkspaceImportPatternMessages,
    ],
    workspacePackageDirs: findWorkspacePackageDirs(rootDir),
  };
}
