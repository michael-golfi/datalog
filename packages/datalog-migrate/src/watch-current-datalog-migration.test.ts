import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCommittedMigrationSource } from './commit-current-datalog-migration.js';
import {
  readDatalogWatchSnapshot,
  type DatalogWatchSnapshot,
  watchCurrentDatalogMigration,
} from './watch-current-datalog-migration.js';

const temporaryRoots: string[] = [];

describe('watchCurrentDatalogMigration', () => {
  afterEach(() => {
    while (temporaryRoots.length > 0) {
      const root = temporaryRoots.pop();
      if (root) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it('reads the current committed-plus-current workflow state', () => {
    const workspaceRoot = createWorkspaceFixture();
    writeCommittedMigration(
      workspaceRoot,
      '20260502.0001.bootstrap.dl',
      createCommittedMigrationSource('Edge("concept/seed", "graph/preferred_label", "Seed").\n', null),
    );

    expect(readDatalogWatchSnapshot({ workspaceRoot })).toEqual({
      committedMigrationFileNames: ['20260502.0001.bootstrap.dl'],
      currentMigrationPath: path.join(workspaceRoot, 'current.dl'),
      hasCurrentChanges: false,
      currentContentHash: null,
    });
  });

  it('emits an initial snapshot and a follow-up snapshot when current.dl changes', async () => {
    const workspaceRoot = createWorkspaceFixture();
    writeCommittedMigration(
      workspaceRoot,
      '20260502.0001.bootstrap.dl',
      createCommittedMigrationSource('Edge("concept/seed", "graph/preferred_label", "Seed").\n', null),
    );
    const snapshots: DatalogWatchSnapshot[] = [];

    const watchPromise = watchCurrentDatalogMigration({
      workspaceRoot,
      pollIntervalMs: 20,
      maxSnapshots: 2,
      timeoutMs: 1000,
      onSnapshot: (snapshot) => {
        snapshots.push(snapshot);
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    writeFileSync(path.join(workspaceRoot, 'current.dl'), 'Edge("concept/example", "graph/preferred_label", "Example").\n', 'utf8');
    await watchPromise;

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toMatchObject({
      committedMigrationFileNames: ['20260502.0001.bootstrap.dl'],
      hasCurrentChanges: false,
      currentContentHash: null,
    });
    expect(snapshots[1]?.hasCurrentChanges).toBe(true);
    expect(snapshots[1]?.currentContentHash).toMatch(/^[a-f0-9]{64}$/u);
  });
});

function createWorkspaceFixture(): string {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'datalog-migration-watch-'));
  temporaryRoots.push(workspaceRoot);
  mkdirSync(path.join(workspaceRoot, 'migrations'), { recursive: true });
  writeFileSync(path.join(workspaceRoot, 'current.dl'), '% Current mutable ontology working area.\n', 'utf8');
  return workspaceRoot;
}

function writeCommittedMigration(workspaceRoot: string, fileName: string, source: string): void {
  writeFileSync(path.join(workspaceRoot, 'migrations', fileName), source, 'utf8');
}
