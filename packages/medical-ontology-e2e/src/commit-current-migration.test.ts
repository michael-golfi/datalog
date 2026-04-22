import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  commitCurrentMigration,
  createCommittedMigrationSource,
  getNextCommittedMigrationFileName,
} from './commit-current-migration.js';
import { readCommittedMigrationFile } from './read-committed-migration-file.js';

const temporaryRoots: string[] = [];

describe('commitCurrentMigration', () => {
  afterEach(() => {
    while (temporaryRoots.length > 0) {
      const root = temporaryRoots.pop();
      if (root) {
        import('node:fs').then(({ rmSync }) => rmSync(root, { recursive: true, force: true }));
      }
    }
  });

  it('selects the next flat committed migration filename for a given date', () => {
    const fileName = getNextCommittedMigrationFileName([
      '20260421.0001.ontology-a-core.dl',
      '20260421.0002.ontology-b-core.dl',
      '20260421.0003.ontology-c-core.dl',
    ], new Date('2026-04-21T12:00:00Z'));

    expect(fileName).toBe('20260421.0004.current.dl');
  });

  it('embeds previous-pointer metadata and resets current.dl after commit', () => {
    const workspaceRoot = createWorkspaceFixture();
    const currentPath = path.join(workspaceRoot, 'current.dl');
    const currentBody = 'Edge("concept/example", "graph/preferred_label", "Example").\n';
    writeFileSync(currentPath, currentBody, 'utf8');
    writeCommittedMigration(
      workspaceRoot,
      '20260421.0003.ontology-c-core.dl',
      createCommittedMigrationSource('Edge("concept/seed", "graph/preferred_label", "Seed").\n', '20260421.0002.ontology-b-core.dl'),
    );

    const result = commitCurrentMigration({
      workspaceRoot,
      now: new Date('2026-04-21T12:00:00Z'),
    });

    expect(result.fileName).toBe('20260421.0004.current.dl');
    expect(result.previousFileName).toBe('20260421.0003.ontology-c-core.dl');
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(readCommittedMigrationFile(result.filePath).body).toBe(currentBody);
    expect(readFileSync(currentPath, 'utf8')).toBe('% Current mutable ontology working area.\n');
  });
});

function createWorkspaceFixture(): string {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'medical-ontology-cli-'));
  temporaryRoots.push(workspaceRoot);
  mkdirSync(path.join(workspaceRoot, 'migrations'), { recursive: true });
  return workspaceRoot;
}

function writeCommittedMigration(workspaceRoot: string, fileName: string, source: string): void {
  writeFileSync(path.join(workspaceRoot, 'migrations', fileName), source, 'utf8');
}
