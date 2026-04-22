import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveMedicalOntologyWorkspacePath } from './resolve-medical-ontology-workspace-path.js';
import { readCommittedMigrationFile } from './read-committed-migration-file.js';

describe('readCommittedMigrationFile', () => {
  it('reads the embedded previous-pointer and sha256 metadata from a committed migration', () => {
    const migration = readCommittedMigrationFile(
      resolveMedicalOntologyWorkspacePath('migrations', '20260421.0002.ontology-b-core.dl'),
    );

    expect(migration.fileName).toBe('20260421.0002.ontology-b-core.dl');
    expect(migration.previousFileName).toBe('20260421.0001.ontology-a-core.dl');
    expect(migration.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(migration.body).toContain('ClinicalConcept@(');
  });

  it('treats the first migration as having no previous committed file', () => {
    const migration = readCommittedMigrationFile(
      path.join(resolveMedicalOntologyWorkspacePath('migrations'), '20260421.0001.ontology-a-core.dl'),
    );

    expect(migration.previousFileName).toBeNull();
  });
});
