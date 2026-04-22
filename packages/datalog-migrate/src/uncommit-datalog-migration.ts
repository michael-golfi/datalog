#!/usr/bin/env node
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadDatalogMigrationProjectFiles } from './load-datalog-migration-project-files.js';
import { readCommittedDatalogMigrationFile } from './read-committed-datalog-migration-file.js';

export interface UncommittedDatalogMigrationResult {
  readonly removedFileName: string;
  readonly restoredCurrentPath: string;
  readonly previousCommittedFileName: string | null;
}

/** Move the latest committed migration back into current.dl when the current file is safely empty. */
export function uncommitLatestDatalogMigration(
  options: { readonly workspaceRoot?: string } = {},
): UncommittedDatalogMigrationResult {
  const projectFiles = loadDatalogMigrationProjectFiles(options);
  const currentSource = readFileSync(projectFiles.currentMigrationPath, 'utf8');

  assertSafeCurrentState(currentSource);

  const latestMigration = projectFiles.committedMigrations.at(-1);
  if (!latestMigration) {
    throw new Error('Cannot uncommit because there are no committed Datalog migrations.');
  }

  assertLatestMigrationLinkage(projectFiles.committedMigrations.map((migration) => migration.fileName), latestMigration.filePath);

  writeFileSync(projectFiles.currentMigrationPath, latestMigration.body, 'utf8');
  rmSync(latestMigration.filePath);

  return {
    removedFileName: latestMigration.fileName,
    restoredCurrentPath: projectFiles.currentMigrationPath,
    previousCommittedFileName: latestMigration.previousFileName,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = uncommitLatestDatalogMigration();
  process.stdout.write(`${result.removedFileName}\n`);
}

function assertSafeCurrentState(currentSource: string): void {
  if (!hasMeaningfulCurrentContent(currentSource)) {
    return;
  }

  throw new Error('Cannot uncommit because current.dl already contains meaningful work. Commit or clear current.dl first.');
}

function hasMeaningfulCurrentContent(source: string): boolean {
  return source
    .split('\n')
    .some((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('%');
    });
}

function assertLatestMigrationLinkage(
  committedFileNames: readonly string[],
  latestMigrationPath: string,
): void {
  const latestMigration = readCommittedDatalogMigrationFile(latestMigrationPath);
  const expectedPreviousFileName = committedFileNames.at(-2) ?? null;

  if (latestMigration.previousFileName !== expectedPreviousFileName) {
    throw new Error(
      `Cannot uncommit ${latestMigration.fileName} because its previous pointer does not match the current committed migration order.`,
    );
  }

  if (path.basename(latestMigrationPath) !== committedFileNames.at(-1)) {
    throw new Error(`Cannot uncommit ${latestMigration.fileName} because it is not the latest committed migration.`);
  }
}
