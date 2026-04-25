import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadWorkspaceLayout } from './eslint/workspace-layout.mjs';

const TYPED_LINT_EXTENSIONS = '{ts,tsx,cts,mts}';
const PRETTIER_EXTENSIONS = '{js,jsx,mjs,cjs,json,md,yml,yaml,css,scss,html}';
const ROOT_PRETTIER_FILE_GLOBS = [
  '*.{js,jsx,mjs,cjs,json,md,yml,yaml,css,scss,html}',
  '.prettierrc',
  '.prettierignore',
  'eslint/**/*.{js,jsx,mjs,cjs,json,md,yml,yaml,css,scss,html}',
  'scripts/**/*.{js,jsx,mjs,cjs,json,md,yml,yaml,css,scss,html}',
];

function createWorkspaceFamilyFileGlobs(workspaceRoots, extensions) {
  return workspaceRoots.map((workspaceRoot) => `${workspaceRoot}/**/*.${extensions}`);
}

function createLintStagedEntries(globs, commands) {
  return Object.fromEntries(globs.map((glob) => [glob, commands]));
}

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceLayout = loadWorkspaceLayout(rootDir);

/** @type {import('lint-staged').Configuration} */
export default {
  ...createLintStagedEntries(
    createWorkspaceFamilyFileGlobs(workspaceLayout.workspaceRoots, TYPED_LINT_EXTENSIONS),
    ['eslint --fix --max-warnings=0', 'prettier --write'],
  ),
  ...createLintStagedEntries(
    [
      ...ROOT_PRETTIER_FILE_GLOBS,
      ...createWorkspaceFamilyFileGlobs(workspaceLayout.workspaceRoots, PRETTIER_EXTENSIONS),
    ],
    'prettier --write',
  ),
};
