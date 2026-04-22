import { describe, expect, expectTypeOf, it } from 'vitest';

import { readAppliedMigrationStateFromDatabase } from './read-applied-migration-state.js';

describe('readAppliedMigrationStateFromDatabase', () => {
  it('is exported as an async function with the expected signature', () => {
    expect(readAppliedMigrationStateFromDatabase).toBeTypeOf('function');
    expectTypeOf(readAppliedMigrationStateFromDatabase).toEqualTypeOf<
      (options: { readonly connectionString: string }) => Promise<{
        readonly appliedMigrationFileNames: readonly string[];
      }>
    >();
  });
});
