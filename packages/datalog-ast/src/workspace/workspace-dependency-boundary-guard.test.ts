import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const packagesRoot = path.join(repoRoot, 'packages');
const datalogAstRoot = path.join(packagesRoot, 'datalog-ast');
const parserRoot = path.join(packagesRoot, 'parser');
const ignoredDirectoryNames = new Set(['coverage', 'dist', 'node_modules', 'out-tsc', 'test-output']);
const astWorkspacePackageNames = new Map<string, string>([
  ['parser', '@datalog/parser'],
  ['datalog-to-sql', '@datalog/datalog-to-sql'],
  ['lsp', '@datalog/lsp'],
  ['datalog-migrate', '@datalog/datalog-migrate'],
  ['medical-ontology-e2e', '@datalog/medical-ontology-e2e'],
  ['vscode-extension', '@datalog/vscode-extension'],
  ['eslint-plugin-datalog', '@datalog/eslint-plugin-datalog'],
  ['eslint-plugin-typescript', '@datalog/eslint-plugin-typescript'],
]);
const disallowedParserWorkspacePackages = new Map<string, string>([
  ['datalog-to-sql', '@datalog/datalog-to-sql'],
  ['lsp', '@datalog/lsp'],
  ['datalog-migrate', '@datalog/datalog-migrate'],
  ['medical-ontology-e2e', '@datalog/medical-ontology-e2e'],
  ['vscode-extension', '@datalog/vscode-extension'],
]);

function getRepoRelativePath(filePath: string) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function readSourceFile(filePath: string) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  return ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function walkTypeScriptFiles(rootDir: string) {
  const files: string[] = [];
  const pending = [rootDir];

  while (pending.length > 0) {
    const currentDir = pending.pop();
    if (!currentDir) {
      continue;
    }

    const entries = fs.readdirSync(currentDir, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectoryNames.has(entry.name)) {
          pending.push(entryPath);
        }

        continue;
      }

      if (entry.isFile() && entryPath.endsWith('.ts') && !entryPath.endsWith('.d.ts')) {
        files.push(entryPath);
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function getModuleSpecifiers(sourceFile: ts.SourceFile) {
  const moduleSpecifiers: string[] = [];

  for (const statement of sourceFile.statements) {
    const isModuleStatement = (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
      && statement.moduleSpecifier
      && ts.isStringLiteral(statement.moduleSpecifier);
    if (isModuleStatement) {
      moduleSpecifiers.push(statement.moduleSpecifier.text);
    }
  }

  return moduleSpecifiers;
}

function collectWorkspaceManifestDependencies(packageDir: string) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')) as {
    readonly dependencies?: Record<string, string>;
    readonly devDependencies?: Record<string, string>;
    readonly optionalDependencies?: Record<string, string>;
    readonly peerDependencies?: Record<string, string>;
  };
  const dependencyNames = new Set<string>();

  for (const fieldName of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const) {
    const field = packageJson[fieldName];
    if (!field) {
      continue;
    }

    for (const dependencyName of Object.keys(field)) {
      if (dependencyName.startsWith('@datalog/')) {
        dependencyNames.add(dependencyName);
      }
    }
  }

  return dependencyNames;
}

function resolveRelativeWorkspacePackage(filePath: string, specifier: string) {
  if (!specifier.startsWith('.')) {
    return null;
  }

  const resolvedTarget = path.resolve(path.dirname(filePath), specifier);
  const relativeToPackages = path.relative(packagesRoot, resolvedTarget);
  if (relativeToPackages.startsWith('..') || path.isAbsolute(relativeToPackages)) {
    return null;
  }

  const [packageDirectoryName] = relativeToPackages.split(path.sep);
  return packageDirectoryName ?? null;
}

function collectDisallowedImportViolations(packageDir: string, packageNameByDirectory: ReadonlyMap<string, string>) {
  const violations: string[] = [];

  for (const filePath of walkTypeScriptFiles(packageDir)) {
    const sourceFile = readSourceFile(filePath);
    for (const specifier of getModuleSpecifiers(sourceFile)) {
      const isDisallowedWorkspacePackageImport = specifier.startsWith('@datalog/')
        && packageNameByDirectory.has(specifier.replace('@datalog/', ''));
      if (isDisallowedWorkspacePackageImport) {
        violations.push(`${getRepoRelativePath(filePath)} imports ${specifier}`);
        continue;
      }

      const relativeWorkspacePackage = resolveRelativeWorkspacePackage(filePath, specifier);
      if (!relativeWorkspacePackage) {
        continue;
      }

      const packageName = packageNameByDirectory.get(relativeWorkspacePackage);
      if (packageName) {
        violations.push(`${getRepoRelativePath(filePath)} imports ${specifier} -> ${packageName}`);
      }
    }
  }

  return violations;
}

function collectAstWorkspaceDependencyViolations() {
  const violations: string[] = [];
  const manifestDependencies = [...collectWorkspaceManifestDependencies(datalogAstRoot)].sort((left, right) => left.localeCompare(right));

  for (const dependencyName of manifestDependencies) {
    violations.push(`packages/datalog-ast/package.json depends on ${dependencyName}`);
  }

  return [...violations, ...collectDisallowedImportViolations(datalogAstRoot, astWorkspacePackageNames)];
}

function collectParserDependencyBoundaryViolations() {
  const violations: string[] = [];
  const manifestDependencies = [...collectWorkspaceManifestDependencies(parserRoot)].sort((left, right) => left.localeCompare(right));

  for (const dependencyName of manifestDependencies) {
    const isDisallowedWorkspaceDependency = disallowedParserWorkspacePackages.has(dependencyName.replace('@datalog/', ''));
    if (isDisallowedWorkspaceDependency) {
      violations.push(`packages/parser/package.json depends on ${dependencyName}`);
    }
  }

  return [...violations, ...collectDisallowedImportViolations(parserRoot, disallowedParserWorkspacePackages)];
}

describe('workspace dependency boundary guard', () => {
  it('@datalog/ast stays free of workspace dependencies', () => {
    expect(collectAstWorkspaceDependencyViolations()).toEqual([]);
  });

  it('@datalog/parser stays independent from downstream workspaces', () => {
    expect(collectParserDependencyBoundaryViolations()).toEqual([]);
  });
});
