#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadDatalogMigrationProjectFiles } from './load-datalog-migration-project-files.js';
import { readCommittedDatalogMigrationFile } from './read-committed-datalog-migration-file.js';

const DEFAULT_CURRENT_FILE_CONTENT = '% Current mutable ontology working area.\n';
const DEFAULT_MIGRATION_SLUG = 'current';

export interface CommitCurrentDatalogMigrationOptions {
  readonly workspaceRoot?: string;
  readonly now?: Date;
  readonly slug?: string;
}

export interface CommittedDatalogMigrationWriteResult {
  readonly fileName: string;
  readonly filePath: string;
  readonly previousFileName: string | null;
  readonly sha256: string;
}

/** Commit the mutable current.dl contents into a new immutable flat migration file. */
export function commitCurrentMigration(
  options: CommitCurrentDatalogMigrationOptions = {},
): CommittedDatalogMigrationWriteResult {
  const projectFiles = loadDatalogMigrationProjectFiles({
    ...(options.workspaceRoot ? { workspaceRoot: options.workspaceRoot } : {}),
  });
  const currentBody = readCurrentMigrationBody(projectFiles.currentMigrationPath);
  const fileName = getNextCommittedMigrationFileName(
    projectFiles.committedMigrations.map((migration) => migration.fileName),
    options.now,
    options.slug,
  );
  const filePath = path.join(projectFiles.committedMigrationsDirectory, fileName);
  const previousFileName = projectFiles.committedMigrations.at(-1)?.fileName ?? null;
  const committedSource = createCommittedMigrationSource(currentBody, previousFileName);

  mkdirSync(projectFiles.committedMigrationsDirectory, { recursive: true });
  writeFileSync(filePath, committedSource, 'utf8');
  writeFileSync(projectFiles.currentMigrationPath, DEFAULT_CURRENT_FILE_CONTENT, 'utf8');

  const committedMigration = readCommittedDatalogMigrationFile(filePath);

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
  slug: string = DEFAULT_MIGRATION_SLUG,
): string {
  const datePrefix = formatDatePrefix(now);
  const nextSequence = existingFileNames
    .map((fileName) => parseCommittedMigrationSequence(fileName, datePrefix))
    .reduce((maxSequence, sequence) => Math.max(maxSequence, sequence), 0) + 1;

  return `${datePrefix}.${String(nextSequence).padStart(4, '0')}.${normalizeMigrationSlug(slug)}.dl`;
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

function readCurrentMigrationBody(currentMigrationPath: string): string {
  return normalizeCurrentBody(readFileSync(currentMigrationPath, 'utf8'));
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

function normalizeMigrationSlug(slug: string): string {
  const normalized = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

  return normalized.length > 0 ? normalized : DEFAULT_MIGRATION_SLUG;
}

function readCliSlug(argv: readonly string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--message' || argument === '-m') {
      return argv[index + 1];
    }
  }

  return undefined;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cliSlug = readCliSlug(process.argv.slice(2));
  const result = commitCurrentMigration(cliSlug === undefined ? {} : { slug: cliSlug });
  process.stdout.write(`${result.fileName}\n`);
}
