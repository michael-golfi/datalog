import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCommittedMigrationSource } from './commit-current-datalog-migration.js';
import { uncommitLatestDatalogMigration } from './uncommit-datalog-migration.js';

const temporaryRoots: string[] = [];

describe('uncommitLatestDatalogMigration', () => {
  afterEach(() => {
    while (temporaryRoots.length > 0) {
      const root = temporaryRoots.pop();
      if (root) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it('restores the latest committed migration body into current.dl and removes the committed file', () => {
    const workspaceRoot = createWorkspaceFixture();
    writeCommittedMigration(
      workspaceRoot,
      '20260502.0001.bootstrap.dl',
      createCommittedMigrationSource('Edge("concept/seed-a", "graph/preferred_label", "Seed A").\n', null),
    );
    const latestBody = 'Edge("concept/seed-b", "graph/preferred_label", "Seed B").\n';
    writeCommittedMigration(
      workspaceRoot,
      '20260502.0002.seed.dl',
      createCommittedMigrationSource(latestBody, '20260502.0001.bootstrap.dl'),
    );

    const result = uncommitLatestDatalogMigration({ workspaceRoot });

    expect(result).toEqual({
      removedFileName: '20260502.0002.seed.dl',
      restoredCurrentPath: path.join(workspaceRoot, 'current.dl'),
      previousCommittedFileName: '20260502.0001.bootstrap.dl',
    });
    expect(readFileSync(path.join(workspaceRoot, 'current.dl'), 'utf8')).toBe(latestBody);
    expect(pathExists(path.join(workspaceRoot, 'migrations', '20260502.0002.seed.dl'))).toBe(false);
  });

  it('refuses to overwrite meaningful current.dl content', () => {
    const workspaceRoot = createWorkspaceFixture();
    writeCommittedMigration(
      workspaceRoot,
      '20260502.0001.bootstrap.dl',
      createCommittedMigrationSource('Edge("concept/seed-a", "graph/preferred_label", "Seed A").\n', null),
    );
    writeFileSync(path.join(workspaceRoot, 'current.dl'), 'Edge("concept/current", "graph/preferred_label", "Current").\n', 'utf8');

    expect(() => uncommitLatestDatalogMigration({ workspaceRoot })).toThrow(
      'Cannot uncommit because current.dl already contains meaningful work.',
    );
  });

  it('rejects a latest committed migration whose previous pointer does not match the current sequence', () => {
    const workspaceRoot = createWorkspaceFixture();
    writeCommittedMigration(
      workspaceRoot,
      '20260502.0001.bootstrap.dl',
      createCommittedMigrationSource('Edge("concept/seed-a", "graph/preferred_label", "Seed A").\n', null),
    );
    writeCommittedMigration(
      workspaceRoot,
      '20260502.0002.seed.dl',
      createCommittedMigrationSource('Edge("concept/seed-b", "graph/preferred_label", "Seed B").\n', '20260420.0009.other.dl'),
    );

    expect(() => uncommitLatestDatalogMigration({ workspaceRoot })).toThrow(
      'previous pointer does not match the current committed migration order',
    );
  });
});

function createWorkspaceFixture(): string {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'datalog-migration-uncommit-'));
  temporaryRoots.push(workspaceRoot);
  mkdirSync(path.join(workspaceRoot, 'migrations'), { recursive: true });
  writeFileSync(path.join(workspaceRoot, 'current.dl'), '% Current mutable ontology working area.\n', 'utf8');
  return workspaceRoot;
}

function writeCommittedMigration(workspaceRoot: string, fileName: string, source: string): void {
  writeFileSync(path.join(workspaceRoot, 'migrations', fileName), source, 'utf8');
}

function pathExists(filePath: string): boolean {
  try {
    readFileSync(filePath, 'utf8');
    return true;
  } catch {
    return false;
  }
}
