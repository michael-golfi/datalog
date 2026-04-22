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

function createWorkspaceFixture(options?: { useObjectWorkspaces?: boolean }) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-paths-'));
  const workspaces = options?.useObjectWorkspaces ? { packages: ['packages/*'] } : ['packages/*'];

  fs.writeFileSync(
    path.join(rootDir, 'package.json'),
    JSON.stringify({ name: 'repo-root', workspaces }, null, 2),
  );

  fs.mkdirSync(path.join(rootDir, 'packages', 'parser'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'packages', 'eslint-plugin-typescript', 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'packages', 'notes'), { recursive: true });

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

  it('builds workspace package metadata for nested files', () => {
    const { rootDir } = createWorkspaceFixture({ useObjectWorkspaces: true });

    try {
      const workspacePackageMap = getWorkspacePackageMap(rootDir);
      const ruleFile = path.join(rootDir, 'packages', 'eslint-plugin-typescript', 'src', 'rule.ts');

      expect(Array.from(workspacePackageMap.entries())).toEqual([
        ['.', 'repo-root'],
        ['packages/eslint-plugin-typescript', '@datalog/eslint-plugin-typescript'],
        ['packages/parser', '@datalog/parser'],
      ]);
      expect(getWorkspaceInfoFromAbsolutePath(rootDir, workspacePackageMap, ruleFile)).toEqual({
        group: 'packages',
        name: 'eslint-plugin-typescript',
        root: 'packages/eslint-plugin-typescript',
        rootAbs: path.join(rootDir, 'packages', 'eslint-plugin-typescript'),
        relativeInsideWorkspace: 'src/rule.ts',
        packageName: '@datalog/eslint-plugin-typescript',
      });
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('returns helper methods bound to the discovered workspace map', () => {
    const { rootDir } = createWorkspaceFixture();

    try {
      const pathHelpers = createPathHelpers(rootDir);
      const filePath = path.join(rootDir, 'packages', 'eslint-plugin-typescript', 'src', 'rule.ts');

      expect(Array.from(pathHelpers.workspacePackageMap.entries())).toEqual([
        ['.', 'repo-root'],
        ['packages/eslint-plugin-typescript', '@datalog/eslint-plugin-typescript'],
        ['packages/parser', '@datalog/parser'],
      ]);
      expect(pathHelpers.getRepoRelativePath(filePath)).toBe('packages/eslint-plugin-typescript/src/rule.ts');
      expect(pathHelpers.getWorkspaceInfoFromAbsolutePath(filePath)?.root).toBe('packages/eslint-plugin-typescript');
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
