import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import { createTypeScriptWorkspacePlugin } from '../plugin.js';

type WorkspaceConfig = string[] | { packages: string[] };

function createLintFixture(options?: { workspaces?: WorkspaceConfig }) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-workspace-rule-'));
  const workspaces = options?.workspaces ?? ['packages/*'];

  fs.writeFileSync(
    path.join(rootDir, 'package.json'),
    JSON.stringify({ name: 'repo-root', workspaces }, null, 2),
  );

  fs.mkdirSync(path.join(rootDir, 'packages', 'parser', 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'packages', 'eslint-plugin-typescript', 'src'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(rootDir, 'apps', 'query-studio', 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'libs', 'query-kit', 'src'), { recursive: true });

  fs.writeFileSync(
    path.join(rootDir, 'packages', 'parser', 'package.json'),
    JSON.stringify({ name: '@datalog/parser' }, null, 2),
  );
  fs.writeFileSync(
    path.join(rootDir, 'packages', 'eslint-plugin-typescript', 'package.json'),
    JSON.stringify({ name: '@datalog/eslint-plugin-typescript' }, null, 2),
  );
  fs.writeFileSync(
    path.join(rootDir, 'packages', 'parser', 'src', 'index.ts'),
    'export const parser = true;\n',
  );
  fs.writeFileSync(
    path.join(rootDir, 'apps', 'query-studio', 'package.json'),
    JSON.stringify({ name: '@datalog/query-studio' }, null, 2),
  );
  fs.writeFileSync(
    path.join(rootDir, 'apps', 'query-studio', 'src', 'main.ts'),
    'export const main = true;\n',
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

async function lintFile(rootDir: string, filePath: string, code: string) {
  const { plugin } = createTypeScriptWorkspacePlugin(rootDir);
  const eslint = new ESLint({
    cwd: rootDir,
    ignore: false,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.ts'],
        languageOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
        plugins: { 'typescript-workspace': plugin },
        rules: {
          'typescript-workspace/no-cross-workspace-relative-imports': 'error',
        },
      },
    ],
  });

  const [result] = await eslint.lintText(code, { filePath });

  if (!result) {
    throw new Error('Expected ESLint result for workspace import fixture.');
  }

  return result;
}

describe('no-cross-workspace-relative-imports', () => {
  it('reports relative imports that cross into another workspace package', async () => {
    const { rootDir } = createLintFixture();

    try {
      const result = await lintFile(
        rootDir,
        path.join(rootDir, 'packages', 'eslint-plugin-typescript', 'src', 'rule.ts'),
        "import { parser } from '../../parser/src/index';\nvoid parser;\n",
      );

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.ruleId).toBe(
        'typescript-workspace/no-cross-workspace-relative-imports',
      );
      expect(result.messages[0]?.message).toContain('@datalog/parser');
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('reports mixed-layout relative imports using the target package name', async () => {
    const { rootDir } = createLintFixture({ workspaces: ['apps/*', 'libs/*'] });

    try {
      const result = await lintFile(
        rootDir,
        path.join(rootDir, 'apps', 'query-studio', 'src', 'main.ts'),
        "import { queryKit } from '../../../libs/query-kit/src/index';\nvoid queryKit;\n",
      );

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.ruleId).toBe(
        'typescript-workspace/no-cross-workspace-relative-imports',
      );
      expect(result.messages[0]?.message).toContain('@datalog/query-kit');
      expect(result.messages[0]?.message).not.toContain('libs/query-kit');
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('allows relative imports that stay inside the current workspace package', async () => {
    const { rootDir } = createLintFixture();

    try {
      const result = await lintFile(
        rootDir,
        path.join(rootDir, 'packages', 'eslint-plugin-typescript', 'src', 'rule.ts'),
        "import './local';\n",
      );

      expect(result.messages).toEqual([]);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
