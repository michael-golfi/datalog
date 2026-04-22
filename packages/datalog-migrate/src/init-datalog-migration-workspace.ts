#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_CURRENT_FILE_CONTENT = '% Current mutable ontology working area.\n';

interface InitDatalogMigrationWorkspaceOptions {
  readonly workspaceRoot?: string;
}

export interface InitDatalogMigrationWorkspaceResult {
  readonly workspaceRoot: string;
  readonly migrationsDirectory: string;
  readonly currentMigrationPath: string;
  readonly alreadyInitialized: boolean;
}

/** Bootstrap a Datalog migration workspace with migrations/ and current.dl. */
export function initDatalogMigrationWorkspace(
  options: InitDatalogMigrationWorkspaceOptions = {},
): InitDatalogMigrationWorkspaceResult {
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const migrationsDirectory = path.join(workspaceRoot, 'migrations');
  const currentMigrationPath = path.join(workspaceRoot, 'current.dl');
  const migrationsDirectoryExists = existsSync(migrationsDirectory);
  const currentMigrationExists = existsSync(currentMigrationPath);
  const committedMigrationFileNames = migrationsDirectoryExists ? listCommittedMigrationFileNames(migrationsDirectory) : [];

  if (committedMigrationFileNames.length > 0 && !currentMigrationExists) {
    throw new Error('Cannot initialize Datalog migration workspace: migrations/ already contains committed migration files.');
  }

  mkdirSync(migrationsDirectory, { recursive: true });

  if (!currentMigrationExists) {
    writeFileSync(currentMigrationPath, DEFAULT_CURRENT_FILE_CONTENT, 'utf8');
  }

  return {
    workspaceRoot,
    migrationsDirectory,
    currentMigrationPath,
    alreadyInitialized: migrationsDirectoryExists && currentMigrationExists,
  };
}

function listCommittedMigrationFileNames(migrationsDirectory: string): string[] {
  return readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isCommittedMigrationFile(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function isCommittedMigrationFile(entryName: string): boolean {
  return /^\d{8}\.\d{4}\.[a-z0-9-]+\.dl$/u.test(entryName);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = initDatalogMigrationWorkspace();
  process.stdout.write(`${result.workspaceRoot}\n`);
}
