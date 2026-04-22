import { describe, expect, it } from 'vitest';

import { resolveMedicalOntologyWorkspacePath } from '../project/resolve-medical-ontology-workspace-path.js';
import {
  loadRepresentativeOntologyMigrations,
  representativeOntologyMigrations,
} from './representative-ontology-migrations.js';

describe('representativeOntologyMigrations', () => {
  it('loads the canonical migrations from the package migration directories', () => {
    const migrations = loadRepresentativeOntologyMigrations();

    expect(migrations.map((migration) => migration.id)).toEqual([
      '2026-04-21-ontology-a-core',
      '2026-04-21-ontology-b-core',
      '2026-04-21-ontology-c-core',
    ]);
    expect(migrations).toEqual(representativeOntologyMigrations);
  });

  it('resolves ontology source slices from the immutable migrations directory', () => {
    expect(representativeOntologyMigrations.map((migration) => migration.fixturePath)).toEqual([
      resolveMedicalOntologyWorkspacePath('migrations', '2026-04-21-ontology-a-core', 'ontology.dl'),
      resolveMedicalOntologyWorkspacePath('migrations', '2026-04-21-ontology-b-core', 'ontology.dl'),
      resolveMedicalOntologyWorkspacePath('migrations', '2026-04-21-ontology-c-core', 'ontology.dl'),
    ]);
  });
});
