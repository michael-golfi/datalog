import { describe, expect, it } from 'vitest';

import { getLanguageServerModuleId } from './resolve-language-server-module.js';

describe('getLanguageServerModuleId', () => {
  it('targets the local @datalog/lsp server entry', () => {
    expect(getLanguageServerModuleId()).toBe('@datalog/lsp/server');
  });
});
