import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { readCommittedDatalogMigrationFile } from './read-committed-datalog-migration-file.js';

describe('readCommittedDatalogMigrationFile', () => {
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
});
