import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import type { ImmutableDatalogMigration } from '../contracts/immutable-datalog-migration.js';
import { resolveMedicalOntologyWorkspacePath } from '../project/resolve-medical-ontology-workspace-path.js';
import { createImmutableDatalogMigration } from './create-immutable-datalog-migration.js';

interface ImmutableDatalogMigrationMetadata {
  readonly id: string;
  readonly description: string;
  readonly sourceFileName: string;
}

/** Load the canonical representative ontology migrations from the immutable migration directories. */
export function loadRepresentativeOntologyMigrations(): readonly [ImmutableDatalogMigration, ...ImmutableDatalogMigration[]] {
  const migrationsRoot = resolveMedicalOntologyWorkspacePath('migrations');
  const migrations = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => createMigrationFromDirectory(migrationsRoot, entry.name))
    .sort((left, right) => left.id.localeCompare(right.id));

  const [firstMigration, ...remainingMigrations] = migrations;

  if (!firstMigration) {
    throw new Error(`Expected at least one immutable ontology migration in ${migrationsRoot}.`);
  }

  return [firstMigration, ...remainingMigrations];
}

export const representativeOntologyMigrations = loadRepresentativeOntologyMigrations();

function createMigrationFromDirectory(
  migrationsRoot: string,
  directoryName: string,
): ImmutableDatalogMigration {
  const migrationDirectory = path.join(migrationsRoot, directoryName);
  const metadata = readMigrationMetadata(migrationDirectory);

  return createImmutableDatalogMigration({
    id: metadata.id,
    description: metadata.description,
    fixturePath: path.join(migrationDirectory, metadata.sourceFileName),
  });
}

function readMigrationMetadata(migrationDirectory: string): ImmutableDatalogMigrationMetadata {
  const metadataPath = path.join(migrationDirectory, 'migration.json');
  return JSON.parse(readFileSync(metadataPath, 'utf8')) as ImmutableDatalogMigrationMetadata;
}
