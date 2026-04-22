import { describe, expect, it } from 'vitest';

import { reconcileAppliedMigrations } from './reconcile-applied-migrations.js';

describe('reconcileAppliedMigrations', () => {
  it('returns all committed migrations as applied when all are present in applied state', () => {
    expect(
      reconcileAppliedMigrations({
        committedMigrationFileNames: ['20260502.0001.bootstrap.dl', '20260503.0001.seed.dl'],
        appliedMigrationState: {
          appliedMigrationFileNames: ['20260502.0001.bootstrap.dl', '20260503.0001.seed.dl'],
        },
      }),
    ).toEqual({
      appliedMigrationFileNames: ['20260502.0001.bootstrap.dl', '20260503.0001.seed.dl'],
      pendingMigrationFileNames: [],
      allApplied: true,
    });
  });

  it('returns pending committed migrations when only some are applied', () => {
    expect(
      reconcileAppliedMigrations({
        committedMigrationFileNames: ['20260502.0001.bootstrap.dl', '20260503.0001.seed.dl'],
        appliedMigrationState: {
          appliedMigrationFileNames: ['20260502.0001.bootstrap.dl'],
        },
      }),
    ).toEqual({
      appliedMigrationFileNames: ['20260502.0001.bootstrap.dl'],
      pendingMigrationFileNames: ['20260503.0001.seed.dl'],
      allApplied: false,
    });
  });

  it('returns an empty reconciliation when there are no committed migrations', () => {
    expect(
      reconcileAppliedMigrations({
        committedMigrationFileNames: [],
        appliedMigrationState: {
          appliedMigrationFileNames: ['20260502.0001.bootstrap.dl'],
        },
      }),
    ).toEqual({
      appliedMigrationFileNames: [],
      pendingMigrationFileNames: [],
      allApplied: true,
    });
  });

  it('ignores applied file names that are not committed', () => {
    expect(
      reconcileAppliedMigrations({
        committedMigrationFileNames: ['20260502.0001.bootstrap.dl'],
        appliedMigrationState: {
          appliedMigrationFileNames: ['20260501.0001.legacy.dl', '20260502.0001.bootstrap.dl'],
        },
      }),
    ).toEqual({
      appliedMigrationFileNames: ['20260502.0001.bootstrap.dl'],
      pendingMigrationFileNames: [],
      allApplied: true,
    });
  });

  it('preserves committed order for pending migrations', () => {
    expect(
      reconcileAppliedMigrations({
        committedMigrationFileNames: [
          '20260502.0001.bootstrap.dl',
          '20260503.0001.seed.dl',
          '20260504.0001.patch.dl',
        ],
        appliedMigrationState: {
          appliedMigrationFileNames: ['20260503.0001.seed.dl'],
        },
      }).pendingMigrationFileNames,
    ).toEqual(['20260502.0001.bootstrap.dl', '20260504.0001.patch.dl']);
  });
});
