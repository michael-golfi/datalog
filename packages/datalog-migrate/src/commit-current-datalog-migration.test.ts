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

  it('rejects current.dl when it already contains committed migration metadata lines', () => {
    const workspaceRoot = createWorkspaceFixture();
    writeFileSync(
      path.join(workspaceRoot, 'current.dl'),
      [
        '% migration.previous: none',
        'Edge("concept/example", "graph/preferred_label", "Example").',
      ].join('\n'),
      'utf8',
    );

    expect(() => commitCurrentMigration({ workspaceRoot, now: new Date('2026-05-02T12:00:00Z') })).toThrow(
      'current.dl must not contain committed migration metadata lines.',
    );
  });

  it('rejects an empty current.dl body before commit', () => {
    const workspaceRoot = createWorkspaceFixture();
    writeFileSync(path.join(workspaceRoot, 'current.dl'), '% comment only\n\n', 'utf8');

    expect(() => commitCurrentMigration({ workspaceRoot, now: new Date('2026-05-02T12:00:00Z') })).toThrow(
      'current.dl must contain non-empty Datalog content before commit.',
    );
  });

  it('chains sequential commits through each previous pointer', () => {
    const workspaceRoot = createWorkspaceFixture();

    writeFileSync(path.join(workspaceRoot, 'current.dl'), 'Edge("concept/one", "graph/preferred_label", "One").\n', 'utf8');
    const firstCommit = commitCurrentMigration({
      workspaceRoot,
      now: new Date('2026-05-02T12:00:00Z'),
      slug: 'first pass',
    });

    writeFileSync(path.join(workspaceRoot, 'current.dl'), 'Edge("concept/two", "graph/preferred_label", "Two").\n', 'utf8');
    const secondCommit = commitCurrentMigration({
      workspaceRoot,
      now: new Date('2026-05-02T13:00:00Z'),
      slug: 'second pass',
    });

    expect(firstCommit).toMatchObject({
      fileName: '20260502.0001.first-pass.dl',
      previousFileName: null,
    });
    expect(secondCommit).toMatchObject({
      fileName: '20260502.0002.second-pass.dl',
      previousFileName: '20260502.0001.first-pass.dl',
    });
    expect(readCommittedDatalogMigrationFile(firstCommit.filePath).previousFileName).toBeNull();
    expect(readCommittedDatalogMigrationFile(secondCommit.filePath).previousFileName).toBe(
      '20260502.0001.first-pass.dl',
    );
  });

  it('normalizes special characters in migration slugs', () => {
    const fileName = getNextCommittedMigrationFileName([], new Date('2026-05-02T12:00:00Z'), ' Fix: spaces / CAPS & punctuation!!! ');

    expect(fileName).toBe('20260502.0001.fix-spaces-caps-punctuation.dl');
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
