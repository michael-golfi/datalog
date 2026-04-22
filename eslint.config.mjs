import path from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

import { createDatalogPlugin } from '@datalog/eslint-plugin-datalog';
import {
  createTypeScriptWorkspacePlugin,
  findWorkspacePackageDirs,
} from '@datalog/eslint-plugin-typescript';

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));
const { plugin: datalogPlugin } = createDatalogPlugin();
const { plugin: typeScriptWorkspacePlugin } = createTypeScriptWorkspacePlugin(tsconfigRootDir);

const sourceFileGlobs = ['packages/**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx}'];
const typedSourceGlobs = ['packages/**/*.{ts,mts,cts,tsx}'];
const reactSourceGlobs = ['packages/vscode-extension/src/**/*.{tsx,jsx}'];
const maintainabilityFileGlobs = ['packages/*/src/**/*.{ts,tsx,js,mjs,cjs,jsx}'];
const librarySourceGlobs = ['packages/{parser,datalog-to-sql,datalog-migrate,lsp,eslint-plugin-datalog,eslint-plugin-typescript}/src/**/*.{ts,tsx}'];
const testFileGlobs = [
  '**/*.test.{ts,tsx,js,jsx}',
  '**/*.spec.{ts,tsx,js,jsx}',
  '**/test/**/*.{ts,tsx,js,jsx}',
  '**/tests/**/*.{ts,tsx,js,jsx}',
];

const workspacePackageDirs = findWorkspacePackageDirs(tsconfigRootDir);

const importResolverProjects = [
  path.join(tsconfigRootDir, 'tsconfig.json'),
  path.join(tsconfigRootDir, 'packages/*/tsconfig.json'),
];

const crossWorkspaceRelativeImportPatterns = [
  '../../packages/*',
  '../../../packages/*',
  '../../../../packages/*',
];

const workspaceLayerPolicies = [
  {
    workspaceRoot: 'packages/parser',
    sourceRoot: 'src',
    defaultLayer: 'internal',
    layers: [
      { name: 'public', files: ['index.ts', 'index.tsx'] },
      { name: 'internal', prefixes: [''] },
    ],
    allow: {
      public: ['public', 'internal'],
      internal: ['internal'],
    },
  },
  {
    workspaceRoot: 'packages/lsp',
    sourceRoot: 'src',
    defaultLayer: 'internal',
    layers: [
      { name: 'public', files: ['index.ts', 'index.tsx'] },
      { name: 'internal', prefixes: [''] },
    ],
    allow: {
      public: ['public', 'internal'],
      internal: ['internal'],
    },
  },
  {
    workspaceRoot: 'packages/datalog-to-sql',
    sourceRoot: 'src',
    defaultLayer: 'internal',
    layers: [
      { name: 'public', files: ['index.ts', 'index.tsx'] },
      { name: 'internal', prefixes: [''] },
    ],
    allow: {
      public: ['public', 'internal'],
      internal: ['internal'],
    },
  },
  {
    workspaceRoot: 'packages/datalog-migrate',
    sourceRoot: 'src',
    defaultLayer: 'internal',
    layers: [
      { name: 'public', files: ['index.ts', 'index.tsx'] },
      { name: 'internal', prefixes: [''] },
    ],
    allow: {
      public: ['public', 'internal'],
      internal: ['internal'],
    },
  },
  {
    workspaceRoot: 'packages/eslint-plugin-datalog',
    sourceRoot: 'src',
    defaultLayer: 'internal',
    layers: [
      { name: 'public', files: ['index.ts', 'index.tsx'] },
      { name: 'internal', prefixes: [''] },
    ],
    allow: {
      public: ['public', 'internal'],
      internal: ['internal'],
    },
  },
  {
    workspaceRoot: 'packages/eslint-plugin-typescript',
    sourceRoot: 'src',
    defaultLayer: 'internal',
    layers: [
      { name: 'public', files: ['index.ts', 'index.tsx'] },
      { name: 'internal', prefixes: [''] },
    ],
    allow: {
      public: ['public', 'internal'],
      internal: ['internal'],
    },
  },
  {
    workspaceRoot: 'packages/medical-ontology-e2e',
    sourceRoot: 'src',
    defaultLayer: 'internal',
    layers: [
      { name: 'public', files: ['index.ts', 'index.tsx'] },
      { name: 'internal', prefixes: [''] },
    ],
    allow: {
      public: ['public', 'internal'],
      internal: ['internal'],
    },
  },
  {
    workspaceRoot: 'packages/vscode-extension',
    sourceRoot: 'src',
    defaultLayer: 'internal',
    layers: [
      { name: 'entry', files: ['index.ts', 'index.tsx', 'extension.ts', 'main.ts'] },
      { name: 'internal', prefixes: [''] },
    ],
    allow: {
      entry: ['entry', 'internal'],
      internal: ['internal'],
    },
  },
];

const restrictedHttpClientPaths = [
  {
    name: 'axios',
    message: 'Prefer shared fetch-based helpers exported from @datalog/* packages instead of axios.',
  },
  {
    name: 'cross-fetch',
    message: 'Prefer shared fetch-based helpers exported from @datalog/* packages.',
  },
  {
    name: 'got',
    message: 'Prefer shared fetch-based helpers exported from @datalog/* packages instead of got.',
  },
  { name: 'ky', message: 'Prefer shared fetch-based helpers exported from @datalog/* packages instead of ky.' },
  {
    name: 'needle',
    message: 'Prefer shared fetch-based helpers exported from @datalog/* packages instead of needle.',
  },
  {
    name: 'node-fetch',
    message: 'Node already exposes fetch; prefer shared helpers from @datalog/* packages when abstraction is needed.',
  },
  {
    name: 'request',
    message: 'Prefer shared fetch-based helpers exported from @datalog/* packages instead of request.',
  },
  {
    name: 'superagent',
    message: 'Prefer shared fetch-based helpers exported from @datalog/* packages instead of superagent.',
  },
  {
    name: 'undici',
    message: 'Use runtime fetch directly or the shared fetch helpers exported from @datalog/* packages.',
  },
];

const restrictedWorkspaceImportPatternMessages = [
  {
    group: crossWorkspaceRelativeImportPatterns,
    message:
      'Import other workspaces through their package exports rather than cross-package relative paths.',
  },
  {
    group: ['@datalog/*/src/**', '@datalog/*/dist/**', '@datalog/*/build/**', '@datalog/*/internal/**'],
    message: 'Do not deep-import another workspace implementation. Import the @datalog/* package surface instead.',
  },
  {
    group: ['packages/**'],
    message:
      'Do not import repository paths as modules. Use @datalog/* package exports for workspace-to-workspace imports and relative paths within the current package.',
  },
];

const unstableRenderValueRestrictions = [
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message:
      'Do not read Date.now() during UI rendering. Inject time through a clock, fixture, or service.',
  },
  {
    selector: 'NewExpression[callee.name="Date"][arguments.length=0]',
    message:
      'Do not construct new Date() without an explicit input in UI code. Inject time or pass serialized values.',
  },
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: 'Do not use Math.random() in UI code. Use stable ids, seeded randomness, or supplied values.',
  },
  {
    selector: "CallExpression[callee.object.name='crypto'][callee.property.name='randomUUID']",
    message: 'Do not create random UUIDs during UI rendering. Use stable ids from data or controlled mutations.',
  },
];

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
      'typescript-workspace/workspace-layer-imports': ['error', { policies: workspaceLayerPolicies }],
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
      'import/no-mutable-exports': 'error',
      'import/no-self-import': 'error',
      'import/no-useless-path-segments': ['error', { noUselessIndex: true }],
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
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
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
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/promise-function-async': 'warn',
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
    files: reactSourceGlobs,
    ignores: ['**/*.dl.__datalog__'],
    plugins: {
      'typescript-workspace': typeScriptWorkspacePlugin,
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'react/button-has-type': 'error',
      'react/jsx-key': ['error', { checkFragmentShorthand: true }],
      'react/jsx-no-constructed-context-values': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
      'react/no-array-index-key': 'error',
      'react/no-danger': 'error',
      'react/no-unstable-nested-components': [
        'warn',
        {
          allowAsProps: true,
          propNamePattern: 'render*',
        },
      ],
      'react/no-unknown-property': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-role': ['error', { ignoreNonDOM: true }],
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/control-has-associated-label': [
        'warn',
        {
          ignoreElements: ['audio', 'canvas', 'embed', 'input', 'textarea', 'tr', 'video'],
          ignoreRoles: ['grid', 'listbox', 'menu', 'menubar', 'radiogroup', 'row', 'tablist', 'toolbar', 'tree', 'treegrid'],
        },
      ],
      'jsx-a11y/heading-has-content': 'error',
      'jsx-a11y/html-has-lang': 'error',
      'jsx-a11y/iframe-has-title': 'error',
      'jsx-a11y/img-redundant-alt': 'error',
      'jsx-a11y/interactive-supports-focus': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/media-has-caption': 'warn',
      'jsx-a11y/mouse-events-have-key-events': 'error',
      'jsx-a11y/no-access-key': 'error',
      'jsx-a11y/no-aria-hidden-on-focusable': 'error',
      'jsx-a11y/no-autofocus': ['error', { ignoreNonDOM: true }],
      'jsx-a11y/no-distracting-elements': 'error',
      'jsx-a11y/no-interactive-element-to-noninteractive-role': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
      'jsx-a11y/no-noninteractive-element-to-interactive-role': 'error',
      'jsx-a11y/no-noninteractive-tabindex': 'error',
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/scope': 'error',
      'jsx-a11y/tabindex-no-positive': 'error',
    },
  },
  {
    files: reactSourceGlobs,
    ignores: [...testFileGlobs, '**/*.stories.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...unstableRenderValueRestrictions],
    },
  },
  {
    files: maintainabilityFileGlobs,
    ignores: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'],
    rules: {
      complexity: ['warn', 8],
      'max-depth': ['warn', 2],
      'max-lines': [
        'warn',
        {
          max: 220,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-lines-per-function': [
        'warn',
        {
          max: 40,
          skipBlankLines: true,
          skipComments: true,
          IIFEs: true,
        },
      ],
      'max-params': ['warn', { max: 3 }],
      'max-statements': ['warn', { max: 15 }],
    },
  },
  {
    files: ['packages/vscode-extension/scripts/**/*.mjs'],
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
    files: ['packages/vscode-extension/fixtures/**/*.cjs'],
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
    files: ['packages/{parser,datalog-to-sql,datalog-migrate,lsp,eslint-plugin-datalog,eslint-plugin-typescript}/src/index.ts'],
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
    ignores: ['packages/{parser,datalog-to-sql,datalog-migrate,lsp,eslint-plugin-datalog,eslint-plugin-typescript}/src/**/*.test.ts', 'packages/{parser,datalog-to-sql,datalog-migrate,lsp,eslint-plugin-datalog,eslint-plugin-typescript}/src/**/*.spec.ts', 'packages/**/*.d.ts'],
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
        'warn',
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
