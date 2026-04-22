import { describe, expect, it } from 'vitest';

import { representativeOntologyMigrations } from '../migrations/representative-ontology-migrations.js';
import { createImmutableDatalogProject } from './create-immutable-datalog-project.js';
import { resolveMedicalOntologyWorkspacePath } from './resolve-medical-ontology-workspace-path.js';
import { assertImmutableMigrationHistory } from './assert-immutable-migration-history.js';

describe('immutable Datalog project', () => {
  it('creates a project with canonical migration ordering and structure', () => {
    const project = createImmutableDatalogProject({
      name: 'representative-ontologies',
      migrationsDirectory: resolveMedicalOntologyWorkspacePath('migrations'),
      migrations: [...representativeOntologyMigrations],
    });

    expect(project.name).toBe('representative-ontologies');
    expect(project.migrations.map((migration) => migration.id)).toEqual(
      representativeOntologyMigrations.map((migration) => migration.id),
    );
  });

  it('rejects duplicate migration ids', () => {
    expect(() =>
      createImmutableDatalogProject({
        name: 'invalid',
        migrationsDirectory: resolveMedicalOntologyWorkspacePath('migrations'),
        migrations: [representativeOntologyMigrations[0], { ...representativeOntologyMigrations[0] }],
      }),
    ).toThrow('Duplicate immutable migration id: 2026-04-21-ontology-a-core');
  });

  it('rejects migration fixtures that do not match their directory identity', () => {
    expect(() =>
      createImmutableDatalogProject({
        name: 'invalid',
        migrationsDirectory: resolveMedicalOntologyWorkspacePath('migrations'),
        migrations: [{
          ...representativeOntologyMigrations[0],
          fixturePath: resolveMedicalOntologyWorkspacePath('migrations', 'wrong-id', 'ontology.dl'),
        }],
      }),
    ).toThrow('Immutable migration id 2026-04-21-ontology-a-core must match its directory name wrong-id.');
  });

  it('rejects mutable migration edits or order changes after migrations are applied', () => {
    const project = createImmutableDatalogProject({
      name: 'representative-ontologies',
      migrationsDirectory: resolveMedicalOntologyWorkspacePath('migrations'),
      migrations: [...representativeOntologyMigrations],
    });
    const appliedHistory = project.migrations.map((migration) => ({
      id: migration.id,
      fingerprint: migration.fingerprint,
    }));

    expect(() =>
      assertImmutableMigrationHistory(project, [
        appliedHistory[1]!,
      ]),
    ).toThrow('Immutable migration order changed at position 1: expected 2026-04-21-ontology-b-core, found 2026-04-21-ontology-a-core.');

    expect(() =>
      assertImmutableMigrationHistory(project, [
        {
          id: appliedHistory[0]!.id,
          fingerprint: 'mutated-fingerprint',
        },
      ]),
    ).toThrow('Immutable migration 2026-04-21-ontology-a-core was modified after being applied.');
  });
});
