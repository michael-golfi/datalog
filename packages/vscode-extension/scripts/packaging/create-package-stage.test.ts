import { describe, expect, it } from 'vitest';

import {
  collectExportTargets,
  createConsumerPackageManifest,
  createLanguageServerModuleResolverSource,
  createStageExtensionManifest,
} from './create-package-stage.mjs';

describe('create-package-stage helpers', () => {
  it('rewrites workspace dependencies to concrete consumer versions', () => {
    expect(
      createConsumerPackageManifest({
        name: '@datalog/lsp',
        version: '0.0.0',
        type: 'module',
        main: './dist/index.js',
        module: './dist/index.js',
        types: './dist/index.d.ts',
        exports: { '.': './dist/index.js' },
        dependencies: {
          '@datalog/parser': 'workspace:*',
          'vscode-languageserver': '^9.0.0',
        },
      }),
    ).toMatchObject({
      dependencies: {
        '@datalog/parser': '0.0.0',
        'vscode-languageserver': '^9.0.0',
      },
    });
  });

  it('collects nested export targets', () => {
    expect(
      collectExportTargets({
        '.': {
          import: './dist/index.js',
          types: './dist/index.d.ts',
        },
        './server': {
          import: './dist/server.js',
        },
      }),
    ).toEqual(['./dist/index.js', './dist/index.d.ts', './dist/server.js']);
  });

  it('creates a stage manifest with unscoped extension identity', () => {
    expect(
      createStageExtensionManifest({
        displayName: 'Datalog Graph Language Support',
        description: 'desc',
        version: '0.0.0',
        engines: { vscode: '^1.85.0' },
        categories: ['Programming Languages'],
        activationEvents: ['onLanguage:datalog'],
        contributes: { languages: [] },
        main: './out/extension.js',
      }),
    ).toMatchObject({
      name: 'datalog-language-support',
      publisher: 'michaelgolfi',
      main: './out/extension.js',
    });
  });

  it('creates a CommonJS resolver source for the chosen language-server module', () => {
    const source = createLanguageServerModuleResolverSource('@datalog/lsp/server');

    expect(source).toContain('exports.resolveLanguageServerModule');
    expect(source).toContain('require.resolve(languageServerModuleId)');
    expect(source).toContain('@datalog/lsp/server');
  });
});
