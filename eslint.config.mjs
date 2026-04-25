import path from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';

import { createDatalogPlugin } from '@datalog/eslint-plugin-datalog';
import { createTypeScriptWorkspacePlugin } from '@datalog/eslint-plugin-typescript';

import { createConfigFragments } from './eslint/config-fragments.mjs';
import {
  repoPolicy,
  restrictedHttpClientPaths,
  workspaceLayerPolicies,
} from './eslint/repo-policy.mjs';

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));
const { plugin: datalogPlugin } = createDatalogPlugin();
const { plugin: typeScriptWorkspacePlugin } = createTypeScriptWorkspacePlugin(tsconfigRootDir);
const {
  declarationFileGlobs,
  fixtureCommonJsGlobs,
  exportOnlyEntryGlobs,
  importResolverProjects,
  libraryTestIgnoreGlobs,
  librarySourceGlobs,
  maintainabilityFileGlobs,
  restrictedWorkspaceImportPatternMessages,
  sourceFileGlobs,
  testFileGlobs,
  typedSourceGlobs,
  vscodeExtensionScriptGlobs,
  workspacePackageDirs,
} = createConfigFragments({ rootDir: tsconfigRootDir, repoPolicy });

export default tseslint.config(
  {
    ignores: [
      '**/.sisyphus/**',
      '**/.vscode-test/**',
      '**/.worktrees/**',
      '**/.yarn/**',
      '**/build/**',
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/node_modules/.vite/**',
      '**/out/**',
      '**/out-tsc/**',
      '**/test-output/**',
      '**/*.tsbuildinfo',
      '**/src/**/*.d.ts',
      '**/src/**/*.js',
      'scripts/*.mjs',
    ],
  },
  {
    files: ['**/*.dl'],
    plugins: {
      datalog: datalogPlugin,
    },
    processor: 'datalog/datalog',
  },
  {
    files: ['**/*.dl.__datalog__'],
    plugins: {
      datalog: datalogPlugin,
    },
    rules: {
      'datalog/require-statement-termination': 'error',
      'datalog/no-duplicate-predicate-schemas': 'error',
      'datalog/no-unterminated-string': 'error',
    },
  },
  {
    files: sourceFileGlobs,
    ignores: ['**/*.dl.__datalog__'],
    plugins: {
      'typescript-workspace': typeScriptWorkspacePlugin,
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'],
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: importResolverProjects,
        },
        node: true,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'typescript-workspace/no-generic-filenames': 'error',
      'typescript-workspace/no-reexports-outside-index': 'error',
      'typescript-workspace/no-cross-workspace-relative-imports': 'error',
      'typescript-workspace/no-production-imports-from-tests': 'error',
      'typescript-workspace/no-internal-barrel-imports': 'error',
      'typescript-workspace/no-self-package-imports': 'error',
      'typescript-workspace/workspace-layer-imports': [
        'error',
        { policies: workspaceLayerPolicies },
      ],
      'import/no-cycle': [
        'error',
        {
          ignoreExternal: true,
          allowUnsafeDynamicCyclicDependency: false,
        },
      ],
      'import/no-duplicates': 'error',
      'import/no-extraneous-dependencies': [
        'error',
        {
          packageDir: workspacePackageDirs,
          includeInternal: true,
          includeTypes: true,
          devDependencies: [
            ...testFileGlobs,
            '**/*.config.{ts,js,mjs,cjs}',
            '**/vite.config.ts',
            '**/vitest.config.ts',
            '**/playwright.config.ts',
          ],
          optionalDependencies: false,
          peerDependencies: true,
        },
      ],
      'import/first': 'error',
      'import/no-mutable-exports': 'error',
      'import/no-self-import': 'error',
      'import/no-useless-path-segments': ['error', { noUselessIndex: true }],
      'import/newline-after-import': ['error', { count: 1, considerComments: true }],
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
            'object',
            'type',
          ],
          pathGroups: [{ pattern: '@datalog/**', group: 'internal', position: 'before' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          alphabetize: {
            order: 'asc',
            caseInsensitive: false,
          },
          'newlines-between': 'always',
        },
      ],
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'logical-assignment-operators': ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-else-return': ['error', { allowElseIf: false }],
      'no-implicit-coercion': 'error',
      'no-nested-ternary': 'error',
      'no-unneeded-ternary': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-const': 'error',
      'prefer-template': 'error',
    },
  },
  {
    files: typedSourceGlobs,
    ignores: ['**/*.dl.__datalog__'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'typescript-workspace': typeScriptWorkspacePlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'typescript-workspace/no-boolean-flags-on-exported-functions': 'error',
      'typescript-workspace/exported-function-return-type': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksConditionals: true,
          checksSpreads: true,
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowAny: false,
          allowBoolean: true,
          allowNever: false,
          allowNullish: false,
          allowNumber: true,
          allowRegExp: false,
        },
      ],
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-param-reassign': 'error',
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: restrictedHttpClientPaths,
          patterns: restrictedWorkspaceImportPatternMessages,
        },
      ],
    },
  },
  {
    files: maintainabilityFileGlobs,
    ignores: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'],
    rules: {
      complexity: ['error', 8],
      'max-depth': ['error', 2],
      'max-lines': [
        'error',
        {
          max: 220,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-lines-per-function': [
        'error',
        {
          max: 40,
          skipBlankLines: true,
          skipComments: true,
          IIFEs: true,
        },
      ],
      'max-params': ['error', { max: 3 }],
      'max-statements': ['error', { max: 15 }],
    },
  },
  {
    files: vscodeExtensionScriptGlobs,
    languageOptions: {
      globals: {
        process: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'import/no-extraneous-dependencies': [
        'error',
        {
          packageDir: workspacePackageDirs,
          includeInternal: true,
          includeTypes: true,
          devDependencies: true,
          optionalDependencies: false,
          peerDependencies: true,
        },
      ],
    },
  },
  {
    files: fixtureCommonJsGlobs,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      'import/no-extraneous-dependencies': [
        'error',
        {
          packageDir: workspacePackageDirs,
          includeInternal: true,
          includeTypes: true,
          devDependencies: true,
          optionalDependencies: false,
          peerDependencies: true,
        },
      ],
    },
  },
  {
    files: exportOnlyEntryGlobs,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportDeclaration',
          message:
            'Package src/index.ts must be export-only. Move implementation to named modules and re-export from the package surface.',
        },
        {
          selector: 'ExportNamedDeclaration[declaration!=null]',
          message:
            'Package src/index.ts must not declare exports inline. Define code in named modules and re-export it here.',
        },
      ],
    },
  },
  {
    files: librarySourceGlobs,
    ignores: [...libraryTestIgnoreGlobs, ...declarationFileGlobs],
    plugins: {
      jsdoc,
    },
    settings: {
      jsdoc: {
        mode: 'typescript',
      },
    },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: {
            cjs: false,
            esm: true,
            window: false,
          },
          require: {
            FunctionDeclaration: true,
            ClassDeclaration: true,
            MethodDefinition: false,
          },
        },
      ],
    },
  },
  {
    files: testFileGlobs,
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'no-console': 'off',
      'no-restricted-syntax': 'off',
    },
  },
);
