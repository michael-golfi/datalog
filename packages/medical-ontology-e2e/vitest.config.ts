import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@datalog/medical-ontology-e2e',
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
