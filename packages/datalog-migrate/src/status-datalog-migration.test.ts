import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCommittedMigrationSource } from './commit-current-datalog-migration.js';
import { readMigrationStatus } from './status-datalog-migration.js';

const temporaryRoots: string[] = [];

describe('readMigrationStatus', () => {
  afterEach(() => {
    while (temporaryRoots.length > 0) {
      const root = temporaryRoots.pop();
      if (root) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it('reports committed migration count, latest file, and current dirty state', () => {
    const workspaceRoot = createWorkspaceFixture();
    writeCommittedMigration(
      workspaceRoot,
      '20260502.0001.bootstrap.dl',
      createCommittedMigrationSource('Edge("concept/seed", "graph/preferred_label", "Seed").\n', null),
    );
    writeFileSync(path.join(workspaceRoot, 'current.dl'), 'Edge("concept/example", "graph/preferred_label", "Example").\n', 'utf8');

    expect(readMigrationStatus({ workspaceRoot })).toEqual({
      committedMigrationCount: 1,
      hasCurrentChanges: true,
      latestCommittedMigrationFileName: '20260502.0001.bootstrap.dl',
      canDeterminePendingCommittedMigrations: false,
      pendingCommittedMigrations: null,
      statusCode: 'committed-and-current',
      statusFlags: {
        currentUncommitted: true,
        committedPresent: true,
        pendingCommittedUnknown: true,
      },
    });
  });

  it('reports committed migrations without current changes as pending state that cannot yet be resolved', () => {
    const workspaceRoot = createWorkspaceFixture();
    writeCommittedMigration(
      workspaceRoot,
      '20260502.0001.bootstrap.dl',
      createCommittedMigrationSource('Edge("concept/seed", "graph/preferred_label", "Seed").\n', null),
    );

    expect(readMigrationStatus({ workspaceRoot })).toEqual({
      committedMigrationCount: 1,
      hasCurrentChanges: false,
      latestCommittedMigrationFileName: '20260502.0001.bootstrap.dl',
      canDeterminePendingCommittedMigrations: false,
      pendingCommittedMigrations: null,
      statusCode: 'committed-pending-unknown',
      statusFlags: {
        currentUncommitted: false,
        committedPresent: true,
        pendingCommittedUnknown: true,
      },
    });
  });

  it('preserves unresolved pending state when no applied migration state is provided', () => {
    const workspaceRoot = createWorkspaceFixture();
    writeCommittedMigration(
      workspaceRoot,
      '20260502.0001.bootstrap.dl',
      createCommittedMigrationSource('Edge("concept/seed", "graph/preferred_label", "Seed").\n', null),
    );

    expect(readMigrationStatus({ workspaceRoot })).toEqual({
      committedMigrationCount: 1,
      hasCurrentChanges: false,
      latestCommittedMigrationFileName: '20260502.0001.bootstrap.dl',
      canDeterminePendingCommittedMigrations: false,
      pendingCommittedMigrations: null,
      statusCode: 'committed-pending-unknown',
      statusFlags: {
        currentUncommitted: false,
        committedPresent: true,
        pendingCommittedUnknown: true,
      },
    });
  });

  it('reports committed migrations as applied when reconciliation shows none pending', () => {
    const workspaceRoot = createWorkspaceFixture();
    writeCommittedMigration(
      workspaceRoot,
      '20260502.0001.bootstrap.dl',
      createCommittedMigrationSource('Edge("concept/seed", "graph/preferred_label", "Seed").\n', null),
    );

    expect(
      readMigrationStatus({
        workspaceRoot,
        appliedMigrationState: {
          appliedMigrationFileNames: ['20260502.0001.bootstrap.dl'],
        },
      }),
    ).toEqual({
      committedMigrationCount: 1,
      hasCurrentChanges: false,
      latestCommittedMigrationFileName: '20260502.0001.bootstrap.dl',
      canDeterminePendingCommittedMigrations: true,
      pendingCommittedMigrations: false,
      statusCode: 'committed-applied',
      statusFlags: {
        currentUncommitted: false,
        committedPresent: true,
        pendingCommittedUnknown: false,
      },
    });
  });

  it('reports committed migrations as pending when reconciliation shows some unapplied', () => {
    const workspaceRoot = createWorkspaceFixture();
    writeCommittedMigration(
      workspaceRoot,
      '20260502.0001.bootstrap.dl',
      createCommittedMigrationSource('Edge("concept/seed", "graph/preferred_label", "Seed").\n', null),
    );
    writeCommittedMigration(
      workspaceRoot,
      '20260503.0001.seed.dl',
      createCommittedMigrationSource('Edge("concept/seed", "graph/preferred_label", "Seed 2").\n', null),
    );

    expect(
      readMigrationStatus({
        workspaceRoot,
        appliedMigrationState: {
          appliedMigrationFileNames: ['20260502.0001.bootstrap.dl'],
        },
      }),
    ).toEqual({
      committedMigrationCount: 2,
      hasCurrentChanges: false,
      latestCommittedMigrationFileName: '20260503.0001.seed.dl',
      canDeterminePendingCommittedMigrations: true,
      pendingCommittedMigrations: true,
      statusCode: 'committed-pending',
      statusFlags: {
        currentUncommitted: false,
        committedPresent: true,
        pendingCommittedUnknown: false,
      },
    });
  });

  it('reports all committed migrations as pending when applied state is empty', () => {
    const workspaceRoot = createWorkspaceFixture();
    writeCommittedMigration(
      workspaceRoot,
      '20260502.0001.bootstrap.dl',
      createCommittedMigrationSource('Edge("concept/seed", "graph/preferred_label", "Seed").\n', null),
    );

    expect(
      readMigrationStatus({
        workspaceRoot,
        appliedMigrationState: {
          appliedMigrationFileNames: [],
        },
      }),
    ).toEqual({
      committedMigrationCount: 1,
      hasCurrentChanges: false,
      latestCommittedMigrationFileName: '20260502.0001.bootstrap.dl',
      canDeterminePendingCommittedMigrations: true,
      pendingCommittedMigrations: true,
      statusCode: 'committed-pending',
      statusFlags: {
        currentUncommitted: false,
        committedPresent: true,
        pendingCommittedUnknown: false,
      },
    });
  });
});

function createWorkspaceFixture(): string {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'datalog-migration-status-'));
  temporaryRoots.push(workspaceRoot);
  mkdirSync(path.join(workspaceRoot, 'migrations'), { recursive: true });
  writeFileSync(path.join(workspaceRoot, 'current.dl'), '% Current mutable ontology working area.\n', 'utf8');
  return workspaceRoot;
}

function writeCommittedMigration(workspaceRoot: string, fileName: string, source: string): void {
  writeFileSync(path.join(workspaceRoot, 'migrations', fileName), source, 'utf8');
}
