import path from 'node:path';

import type { ImmutableDatalogMigration } from '../contracts/immutable-datalog-migration.js';
import type { ImmutableDatalogProject } from '../contracts/immutable-datalog-project.js';

interface CreateImmutableDatalogProjectInput {
  readonly name: string;
  readonly migrationsDirectory: string;
  readonly migrations: readonly [ImmutableDatalogMigration, ...ImmutableDatalogMigration[]];
}

/** Create an immutable Datalog project with canonical migration ordering. */
export function createImmutableDatalogProject(
  input: CreateImmutableDatalogProjectInput,
): ImmutableDatalogProject {
  assertUniqueMigrationIds(input.migrations);
  assertMigrationStructure(input.migrationsDirectory, input.migrations);

  return {
    name: input.name,
    migrationsDirectory: input.migrationsDirectory,
    migrations: cloneMigrations(input.migrations),
  };
}

function cloneMigrations(
  migrations: CreateImmutableDatalogProjectInput['migrations'],
): ImmutableDatalogProject['migrations'] {
  const [firstMigration, ...remainingMigrations] = migrations;

  return [
    { ...firstMigration },
    ...remainingMigrations.map((migration) => ({ ...migration })),
  ];
}

function assertUniqueMigrationIds(migrations: readonly ImmutableDatalogMigration[]): void {
  const ids = new Set<string>();

  for (const migration of migrations) {
    if (ids.has(migration.id)) {
      throw new Error(`Duplicate immutable migration id: ${migration.id}`);
    }

    ids.add(migration.id);
  }
}

function assertMigrationStructure(
  migrationsDirectory: string,
  migrations: readonly ImmutableDatalogMigration[],
): void {
  for (const migration of migrations) {
    assertMigrationDirectory(migrationsDirectory, migration);
    assertMigrationIdentityMatchesDirectory(migration);
  }
}

function assertMigrationDirectory(
  migrationsDirectory: string,
  migration: ImmutableDatalogMigration,
): void {
  const relativeFixturePath = path.relative(migrationsDirectory, migration.fixturePath);

  if (relativeFixturePath.startsWith('..') || path.isAbsolute(relativeFixturePath)) {
    throw new Error(`Immutable migration fixture must live under ${migrationsDirectory}: ${migration.fixturePath}`);
  }
}

function assertMigrationIdentityMatchesDirectory(migration: ImmutableDatalogMigration): void {
  const migrationDirectoryName = path.basename(path.dirname(migration.fixturePath));

  if (migrationDirectoryName !== migration.id) {
    throw new Error(`Immutable migration id ${migration.id} must match its directory name ${migrationDirectoryName}.`);
  }
}
