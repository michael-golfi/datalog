import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  commitCurrentMigration,
  createCommittedMigrationSource,
  getNextCommittedMigrationFileName,
} from './commit-current-datalog-migration.js';
import { readCommittedDatalogMigrationFile } from './read-committed-datalog-migration-file.js';

const temporaryRoots: string[] = [];

describe('commitCurrentMigration', () => {
  afterEach(() => {
    while (temporaryRoots.length > 0) {
      const root = temporaryRoots.pop();
      if (root) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it('selects the next flat committed migration filename for a given date', () => {
    const fileName = getNextCommittedMigrationFileName([
      '20260502.0001.bootstrap.dl',
      '20260502.0002.seed.dl',
      '20260502.0003.backfill.dl',
    ], new Date('2026-05-02T12:00:00Z'));

    expect(fileName).toBe('20260502.0004.current.dl');
  });

  it('supports a custom slug when generating the next flat committed migration filename', () => {
    const fileName = getNextCommittedMigrationFileName([], new Date('2026-05-02T12:00:00Z'), 'seed baseline');

    expect(fileName).toBe('20260502.0001.seed-baseline.dl');
  });

  it('embeds previous-pointer metadata and resets current.dl after commit', () => {
    const workspaceRoot = createWorkspaceFixture();
    const currentPath = path.join(workspaceRoot, 'current.dl');
    const currentBody = 'Edge("concept/example", "graph/preferred_label", "Example").\n';
    writeFileSync(currentPath, currentBody, 'utf8');
    writeCommittedMigration(
      workspaceRoot,
      '20260502.0003.backfill.dl',
      createCommittedMigrationSource('Edge("concept/seed", "graph/preferred_label", "Seed").\n', '20260502.0002.seed.dl'),
    );

    const result = commitCurrentMigration({ workspaceRoot, now: new Date('2026-05-02T12:00:00Z') });

    expect(result.fileName).toBe('20260502.0004.current.dl');
    expect(result.previousFileName).toBe('20260502.0003.backfill.dl');
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(readCommittedDatalogMigrationFile(result.filePath).body).toBe(currentBody);
    expect(readFileSync(currentPath, 'utf8')).toBe('% Current mutable ontology working area.\n');
  });
});

function createWorkspaceFixture(): string {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'datalog-migrate-'));
  temporaryRoots.push(workspaceRoot);
  mkdirSync(path.join(workspaceRoot, 'migrations'), { recursive: true });
  return workspaceRoot;
}

function writeCommittedMigration(workspaceRoot: string, fileName: string, source: string): void {
  writeFileSync(path.join(workspaceRoot, 'migrations', fileName), source, 'utf8');
}
