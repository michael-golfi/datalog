import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createVscePackageArgs,
  defaultVsixPath,
} from './package-vsix.mjs';

describe('package-vsix helper', () => {
  it('builds a staged vsce package command', () => {
    expect(
      createVscePackageArgs({
        outputPath: '/tmp/datalog-language-support.vsix',
        version: '1.2.3',
      }),
    ).toEqual([
      'package',
      '1.2.3',
      '--no-dependencies',
      '--allow-unused-files-pattern',
      '--allow-missing-repository',
      '--out',
      '/tmp/datalog-language-support.vsix',
    ]);
  });

  it('keeps the VSIX beside the staged package by default', () => {
    expect(defaultVsixPath).toBe(path.resolve(process.cwd(), 'build', 'datalog-language-support.vsix'));
  });
});
