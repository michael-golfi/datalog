#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadOntologyProjectFiles } from './load-ontology-project-files.js';
import { readCommittedMigrationFile } from './read-committed-migration-file.js';

const DEFAULT_CURRENT_FILE_CONTENT = '% Current mutable ontology working area.\n';
const DEFAULT_MIGRATION_SLUG = 'current';

export interface CommitCurrentMigrationOptions {
  readonly workspaceRoot?: string;
  readonly now?: Date;
}

export interface CommittedMigrationWriteResult {
  readonly fileName: string;
  readonly filePath: string;
  readonly previousFileName: string | null;
  readonly sha256: string;
}

/** Commit the mutable current.dl contents into a new immutable flat migration file. */
export function commitCurrentMigration(
  options: CommitCurrentMigrationOptions = {},
): CommittedMigrationWriteResult {
  const projectFiles = loadOntologyProjectFiles({
    ...(options.workspaceRoot ? { workspaceRoot: options.workspaceRoot } : {}),
  });
  const currentBody = readCurrentOntologyBody(projectFiles.currentOntologyPath);
  const fileName = getNextCommittedMigrationFileName(projectFiles.committedMigrations.map((migration) => migration.fileName), options.now);
  const filePath = path.join(projectFiles.committedMigrationsDirectory, fileName);
  const previousFileName = projectFiles.committedMigrations.at(-1)?.fileName ?? null;
  const committedSource = createCommittedMigrationSource(currentBody, previousFileName);

  mkdirSync(projectFiles.committedMigrationsDirectory, { recursive: true });
  writeFileSync(filePath, committedSource, 'utf8');
  writeFileSync(projectFiles.currentOntologyPath, DEFAULT_CURRENT_FILE_CONTENT, 'utf8');

  const committedMigration = readCommittedMigrationFile(filePath);

  return {
    fileName: committedMigration.fileName,
    filePath: committedMigration.filePath,
    previousFileName: committedMigration.previousFileName,
    sha256: committedMigration.sha256,
  };
}

/** Create the next flat committed migration file name for the given date. */
export function getNextCommittedMigrationFileName(
  existingFileNames: readonly string[],
  now: Date = new Date(),
): string {
  const datePrefix = formatDatePrefix(now);
  const nextSequence = existingFileNames
    .map((fileName) => parseCommittedMigrationSequence(fileName, datePrefix))
    .reduce((maxSequence, sequence) => Math.max(maxSequence, sequence), 0) + 1;

  return `${datePrefix}.${String(nextSequence).padStart(4, '0')}.${DEFAULT_MIGRATION_SLUG}.dl`;
}

/** Create the committed migration file content with embedded linkage and hash metadata. */
export function createCommittedMigrationSource(
  body: string,
  previousFileName: string | null,
): string {
  const normalizedBody = normalizeCurrentBody(body);
  const sha256 = createHash('sha256').update(normalizedBody, 'utf8').digest('hex');
  const previousValue = previousFileName ?? 'none';

  return [
    `% migration.previous: ${previousValue}`,
    `% migration.sha256: ${sha256}`,
    '',
    normalizedBody,
  ].join('\n');
}

function readCurrentOntologyBody(currentOntologyPath: string): string {
  const currentSource = readFileSync(currentOntologyPath, 'utf8');
  return normalizeCurrentBody(currentSource);
}

function normalizeCurrentBody(source: string): string {
  const normalizedSource = source.endsWith('\n') ? source : `${source}\n`;

  if (hasEmbeddedMetadata(normalizedSource)) {
    throw new Error('current.dl must not contain committed migration metadata lines.');
  }

  if (!hasMeaningfulDatalogContent(normalizedSource)) {
    throw new Error('current.dl must contain non-empty Datalog content before commit.');
  }

  return normalizedSource;
}

function hasEmbeddedMetadata(source: string): boolean {
  return source.split('\n').some((line) => line.startsWith('% migration.previous:') || line.startsWith('% migration.sha256:'));
}

function hasMeaningfulDatalogContent(source: string): boolean {
  return source
    .split('\n')
    .some((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('%');
    });
}

function formatDatePrefix(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function parseCommittedMigrationSequence(fileName: string, datePrefix: string): number {
  const match = new RegExp(`^${datePrefix}\\.(\\d{4})\\.[a-z0-9-]+\\.dl$`, 'u').exec(fileName);
  return match?.[1] ? Number.parseInt(match[1], 10) : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = commitCurrentMigration();
  process.stdout.write(`${result.fileName}\n`);
}
