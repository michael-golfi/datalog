import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface CommittedDatalogMigrationFile {
  readonly fileName: string;
  readonly filePath: string;
  readonly previousFileName: string | null;
  readonly sha256: string;
  readonly body: string;
}

/** Read and validate embedded metadata from a committed flat Datalog migration file. */
export function readCommittedDatalogMigrationFile(filePath: string): CommittedDatalogMigrationFile {
  const source = readFileSync(filePath, 'utf8');
  const [previousLine, hashLine, ...remainingLines] = source.split('\n');
  const body = trimLeadingBlankLine(remainingLines).join('\n');
  const previousValue = readRequiredMetadata(previousLine, '% migration.previous:', filePath);
  const actualHash = readRequiredMetadata(hashLine, '% migration.sha256:', filePath);
  const normalizedBody = body.endsWith('\n') ? body : `${body}\n`;

  if (createHash('sha256').update(normalizedBody, 'utf8').digest('hex') !== actualHash) {
    throw new Error(`Committed migration hash mismatch for ${path.basename(filePath)}.`);
  }

  return {
    fileName: path.basename(filePath),
    filePath,
    previousFileName: previousValue === 'none' ? null : previousValue,
    sha256: actualHash,
    body: normalizedBody,
  };
}

function readRequiredMetadata(
  line: string | undefined,
  prefix: string,
  filePath: string,
): string {
  if (!line?.startsWith(prefix)) {
    throw new Error(`Committed migration ${path.basename(filePath)} is missing required metadata line ${prefix}.`);
  }

  return line.slice(prefix.length).trim();
}

function trimLeadingBlankLine(lines: string[]): string[] {
  if (lines[0] === '') {
    return lines.slice(1);
  }

  return lines;
}
