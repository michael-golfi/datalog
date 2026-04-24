import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@datalog/ast': fileURLToPath(new URL('../datalog-ast/src/index.ts', import.meta.url)),
      '@datalog/parser': fileURLToPath(new URL('../parser/src/index.ts', import.meta.url)),
    },
  },
  test: {
    name: '@datalog/lsp',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './test-output/vitest/coverage',
    },
  },
});
