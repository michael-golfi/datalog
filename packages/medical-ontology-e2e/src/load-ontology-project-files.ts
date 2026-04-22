import { readdirSync } from 'node:fs';
import path from 'node:path';

import type { CommittedOntologyMigrationFile } from './read-committed-migration-file.js';
import { readCommittedMigrationFile } from './read-committed-migration-file.js';
import { resolveMedicalOntologyWorkspacePath } from './resolve-medical-ontology-workspace-path.js';

interface LoadOntologyProjectFilesOptions {
  readonly workspaceRoot?: string;
}

export interface OntologyProjectFiles {
  readonly committedMigrationsDirectory: string;
  readonly committedMigrations: readonly CommittedOntologyMigrationFile[];
  readonly committedMigrationPaths: readonly string[];
  readonly currentOntologyPath: string;
}

/** Load the minimal filesystem-backed project surface for the ontology package. */
export function loadOntologyProjectFiles(options: LoadOntologyProjectFilesOptions = {}): OntologyProjectFiles {
  const committedMigrationsDirectory = resolveProjectPath(options.workspaceRoot, 'migrations');

  return {
    committedMigrationsDirectory,
    committedMigrations: loadCommittedMigrations(committedMigrationsDirectory),
    committedMigrationPaths: listCommittedMigrationPaths(committedMigrationsDirectory),
    currentOntologyPath: resolveProjectPath(options.workspaceRoot, 'current.dl'),
  };
}

function resolveProjectPath(workspaceRoot: string | undefined, ...segments: string[]): string {
  if (workspaceRoot) {
    return path.join(workspaceRoot, ...segments);
  }

  return resolveMedicalOntologyWorkspacePath(...segments);
}

function loadCommittedMigrations(migrationsDirectory: string): CommittedOntologyMigrationFile[] {
  return listCommittedMigrationPaths(migrationsDirectory)
    .map((migrationPath) => readCommittedMigrationFile(migrationPath));
}

function listCommittedMigrationPaths(migrationsDirectory: string): string[] {
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
