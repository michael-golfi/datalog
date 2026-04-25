export const repoPolicy = {
  libraryWorkspacePackageNames: [
    '@datalog/parser',
    '@datalog/datalog-to-sql',
    '@datalog/datalog-migrate',
    '@datalog/lsp',
    '@datalog/eslint-plugin-datalog',
    '@datalog/eslint-plugin-typescript',
  ],
  exportOnlyEntryWorkspacePackageNames: [
    '@datalog/parser',
    '@datalog/datalog-to-sql',
    '@datalog/datalog-migrate',
    '@datalog/lsp',
    '@datalog/eslint-plugin-datalog',
    '@datalog/eslint-plugin-typescript',
  ],
  packageScopedGlobSelectors: {
    vscodeExtensionScripts: [
      {
        packageName: '@datalog/vscode-extension',
        patterns: ['scripts/**/*.mjs'],
      },
    ],
    fixtureCommonJs: [
      {
        packageName: '@datalog/vscode-extension',
        patterns: ['fixtures/**/*.cjs'],
      },
    ],
  },
  crossWorkspaceRelativeImportMessage:
    'Import other workspaces through their package exports rather than cross-package relative paths.',
  restrictedWorkspaceImportPatternMessages: [
    {
      group: [
        '@datalog/*/src/**',
        '@datalog/*/dist/**',
        '@datalog/*/build/**',
        '@datalog/*/internal/**',
      ],
      message:
        'Do not deep-import another workspace implementation. Import the @datalog/* package surface instead.',
    },
  ],
};

export const workspaceLayerPolicies = [
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

export const restrictedHttpClientPaths = [
  {
    name: 'axios',
    message:
      'Prefer shared fetch-based helpers exported from @datalog/* packages instead of axios.',
  },
  {
    name: 'cross-fetch',
    message: 'Prefer shared fetch-based helpers exported from @datalog/* packages.',
  },
  {
    name: 'got',
    message: 'Prefer shared fetch-based helpers exported from @datalog/* packages instead of got.',
  },
  {
    name: 'ky',
    message: 'Prefer shared fetch-based helpers exported from @datalog/* packages instead of ky.',
  },
  {
    name: 'needle',
    message:
      'Prefer shared fetch-based helpers exported from @datalog/* packages instead of needle.',
  },
  {
    name: 'node-fetch',
    message:
      'Node already exposes fetch; prefer shared helpers from @datalog/* packages when abstraction is needed.',
  },
  {
    name: 'request',
    message:
      'Prefer shared fetch-based helpers exported from @datalog/* packages instead of request.',
  },
  {
    name: 'superagent',
    message:
      'Prefer shared fetch-based helpers exported from @datalog/* packages instead of superagent.',
  },
  {
    name: 'undici',
    message:
      'Use runtime fetch directly or the shared fetch helpers exported from @datalog/* packages.',
  },
];
