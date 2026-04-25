import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readCommittedDatalogMigrationFile } from './read-committed-datalog-migration-file.js';

const temporaryRoots: string[] = [];

describe('readCommittedDatalogMigrationFile', () => {
  afterEach(() => {
    while (temporaryRoots.length > 0) {
      const root = temporaryRoots.pop();
      if (root) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it('reads the embedded previous-pointer and sha256 metadata from a committed migration', () => {
    const migration = readCommittedDatalogMigrationFile(
      path.join(process.cwd(), '..', 'medical-ontology-e2e', 'migrations', '20260422.0002.ontology-core-concepts.dl'),
    );

    expect(migration.fileName).toBe('20260422.0002.ontology-core-concepts.dl');
    expect(migration.previousFileName).toBe('20260422.0001.ontology-foundation.dl');
    expect(migration.sha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('treats the first migration as having no previous committed file', () => {
    const migration = readCommittedDatalogMigrationFile(
      path.join(process.cwd(), '..', 'medical-ontology-e2e', 'migrations', '20260422.0001.ontology-foundation.dl'),
    );

    expect(migration.previousFileName).toBeNull();
  });

  it('rejects a committed migration whose body no longer matches the embedded hash', () => {
    const filePath = writeTemporaryMigrationFile(
      '20260502.0001.bootstrap.dl',
      [
        '% migration.previous: none',
        '% migration.sha256: 8d59475d7ebf4211808f61f95ff047f4f5d5f1af4322faaa90c32f77ec9ac672',
        '',
        'Edge("concept/example", "graph/preferred_label", "Tampered").',
      ].join('\n'),
    );

    expect(() => readCommittedDatalogMigrationFile(filePath)).toThrow(
      'Committed migration hash mismatch for 20260502.0001.bootstrap.dl.',
    );
  });

  it('rejects a committed migration without embedded sha256 metadata', () => {
    const filePath = writeTemporaryMigrationFile(
      '20260502.0001.bootstrap.dl',
      ['% migration.previous: none', '', 'Edge("concept/example", "graph/preferred_label", "Example").'].join('\n'),
    );

    expect(() => readCommittedDatalogMigrationFile(filePath)).toThrow(
      'Committed migration 20260502.0001.bootstrap.dl is missing required metadata line % migration.sha256:.',
    );
  });

  it('rejects a committed migration without embedded previous-pointer metadata', () => {
    const filePath = writeTemporaryMigrationFile(
      '20260502.0002.seed.dl',
      [
        '% migration.sha256: 8d59475d7ebf4211808f61f95ff047f4f5d5f1af4322faaa90c32f77ec9ac672',
        '',
        'Edge("concept/example", "graph/preferred_label", "Example").',
      ].join('\n'),
    );

    expect(() => readCommittedDatalogMigrationFile(filePath)).toThrow(
      'Committed migration 20260502.0002.seed.dl is missing required metadata line % migration.previous:.',
    );
  });

  it('accepts an empty first committed migration body when metadata and hash are valid', () => {
    const filePath = writeTemporaryMigrationFile(
      '20260502.0001.bootstrap.dl',
      [
        '% migration.previous: none',
        '% migration.sha256: 01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
        '',
      ].join('\n'),
    );

    expect(readCommittedDatalogMigrationFile(filePath)).toMatchObject({
      fileName: '20260502.0001.bootstrap.dl',
      previousFileName: null,
      body: '\n',
    });
  });
});

function writeTemporaryMigrationFile(fileName: string, source: string): string {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'datalog-read-committed-'));
  temporaryRoots.push(workspaceRoot);
  const filePath = path.join(workspaceRoot, fileName);
  writeFileSync(filePath, source, 'utf8');
  return filePath;
}
