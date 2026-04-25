import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import type { CommittedDatalogMigrationFile } from './read-committed-datalog-migration-file.js';
import { readCommittedDatalogMigrationFile } from './read-committed-datalog-migration-file.js';

interface LoadDatalogMigrationProjectFilesOptions {
  readonly workspaceRoot?: string;
}

export interface DatalogMigrationProjectFiles {
  readonly committedMigrationsDirectory: string;
  readonly committedMigrations: readonly CommittedDatalogMigrationFile[];
  readonly committedMigrationPaths: readonly string[];
  readonly currentMigrationPath: string;
}

/** Load the minimal filesystem-backed project surface for a Datalog migration workspace. */
export function loadDatalogMigrationProjectFiles(
  options: LoadDatalogMigrationProjectFilesOptions = {},
): DatalogMigrationProjectFiles {
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const committedMigrationsDirectory = path.join(workspaceRoot, 'migrations');

  return {
    committedMigrationsDirectory,
    committedMigrations: loadCommittedMigrations(committedMigrationsDirectory),
    committedMigrationPaths: listCommittedMigrationPaths(committedMigrationsDirectory),
    currentMigrationPath: path.join(workspaceRoot, 'current.dl'),
  };
}

function loadCommittedMigrations(migrationsDirectory: string): CommittedDatalogMigrationFile[] {
  return listCommittedMigrationPaths(migrationsDirectory)
    .map((migrationPath) => readCommittedDatalogMigrationFile(migrationPath));
}

function listCommittedMigrationPaths(migrationsDirectory: string): string[] {
  if (!existsSync(migrationsDirectory)) {
    return [];
  }

  return readdirSync(migrationsDirectory, { withFileTypes: true })
    .flatMap((entry) => getCommittedMigrationPaths(migrationsDirectory, entry.name, entry.isDirectory()))
    .sort((left, right) => left.localeCompare(right));
}

function getCommittedMigrationPaths(
  migrationsDirectory: string,
  entryName: string,
  isDirectory: boolean,
): string[] {
  if (!isDirectory && isCommittedMigrationFile(entryName)) {
    return [path.join(migrationsDirectory, entryName)];
  }

  return [];
}

function isCommittedMigrationFile(entryName: string): boolean {
  return /^\d{8}\.\d{4}\.[a-z0-9-]+\.dl$/u.test(entryName);
}
