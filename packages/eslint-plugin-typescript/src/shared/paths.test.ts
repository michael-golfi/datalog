import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createPathHelpers,
  findWorkspacePackageDirs,
  getWorkspaceInfoFromAbsolutePath,
  getWorkspacePackageMap,
} from './paths.js';

type WorkspaceConfig = string[] | { packages: string[] };

function createWorkspaceFixture(options?: { workspaces?: WorkspaceConfig }) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-paths-'));
  const workspaces = options?.workspaces ?? ['packages/*'];

  fs.writeFileSync(
    path.join(rootDir, 'package.json'),
    JSON.stringify({ name: 'repo-root', workspaces }, null, 2),
  );

  fs.mkdirSync(path.join(rootDir, 'packages', 'parser'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'packages', 'eslint-plugin-typescript', 'src'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(rootDir, 'packages', 'notes'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'apps', 'query-studio', 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'libs', 'query-kit', 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'libs', 'drafts'), { recursive: true });

  fs.writeFileSync(
    path.join(rootDir, 'packages', 'parser', 'package.json'),
    JSON.stringify({ name: '@datalog/parser' }, null, 2),
  );
  fs.writeFileSync(
    path.join(rootDir, 'packages', 'eslint-plugin-typescript', 'package.json'),
    JSON.stringify({ name: '@datalog/eslint-plugin-typescript' }, null, 2),
  );
  fs.writeFileSync(
    path.join(rootDir, 'packages', 'eslint-plugin-typescript', 'src', 'rule.ts'),
    'export const rule = true;\n',
  );
  fs.writeFileSync(
    path.join(rootDir, 'apps', 'query-studio', 'package.json'),
    JSON.stringify({ name: '@datalog/query-studio' }, null, 2),
  );
  fs.writeFileSync(
    path.join(rootDir, 'apps', 'query-studio', 'src', 'main.ts'),
    'export const queryStudio = true;\n',
  );
  fs.writeFileSync(
    path.join(rootDir, 'libs', 'query-kit', 'package.json'),
    JSON.stringify({ name: '@datalog/query-kit' }, null, 2),
  );
  fs.writeFileSync(
    path.join(rootDir, 'libs', 'query-kit', 'src', 'index.ts'),
    'export const queryKit = true;\n',
  );

  return { rootDir };
}

describe('shared path helpers', () => {
  it('discovers root and package workspace directories from package.json workspaces', () => {
    const { rootDir } = createWorkspaceFixture();

    try {
      expect(findWorkspacePackageDirs(rootDir)).toEqual([
        rootDir,
        path.join(rootDir, 'packages', 'eslint-plugin-typescript'),
        path.join(rootDir, 'packages', 'parser'),
      ]);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('discovers app and library workspace directories from package.json workspaces', () => {
    const { rootDir } = createWorkspaceFixture({ workspaces: ['apps/*', 'libs/*'] });

    try {
      expect(findWorkspacePackageDirs(rootDir)).toEqual([
        rootDir,
        path.join(rootDir, 'apps', 'query-studio'),
        path.join(rootDir, 'libs', 'query-kit'),
      ]);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('builds workspace package metadata for nested files from object workspaces', () => {
    const { rootDir } = createWorkspaceFixture({ workspaces: { packages: ['apps/*', 'libs/*'] } });

    try {
      const workspacePackageMap = getWorkspacePackageMap(rootDir);
      const mainFile = path.join(rootDir, 'apps', 'query-studio', 'src', 'main.ts');

      expect(Array.from(workspacePackageMap.entries())).toEqual([
        ['.', 'repo-root'],
        ['apps/query-studio', '@datalog/query-studio'],
        ['libs/query-kit', '@datalog/query-kit'],
      ]);
      expect(getWorkspaceInfoFromAbsolutePath(rootDir, workspacePackageMap, mainFile)).toEqual({
        group: 'apps',
        name: 'query-studio',
        root: 'apps/query-studio',
        rootAbs: path.join(rootDir, 'apps', 'query-studio'),
        relativeInsideWorkspace: 'src/main.ts',
        packageName: '@datalog/query-studio',
      });
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('returns helper methods bound to the discovered workspace map', () => {
    const { rootDir } = createWorkspaceFixture({ workspaces: { packages: ['apps/*', 'libs/*'] } });

    try {
      const pathHelpers = createPathHelpers(rootDir);
      const filePath = path.join(rootDir, 'libs', 'query-kit', 'src', 'index.ts');

      expect(Array.from(pathHelpers.workspacePackageMap.entries())).toEqual([
        ['.', 'repo-root'],
        ['apps/query-studio', '@datalog/query-studio'],
        ['libs/query-kit', '@datalog/query-kit'],
      ]);
      expect(pathHelpers.getRepoRelativePath(filePath)).toBe('libs/query-kit/src/index.ts');
      expect(pathHelpers.getWorkspaceInfoFromAbsolutePath(filePath)?.root).toBe('libs/query-kit');
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
