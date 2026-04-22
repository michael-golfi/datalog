import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { ImmutableDatalogMigration } from '../contracts/immutable-datalog-migration.js';

interface CreateImmutableDatalogMigrationInput {
  readonly id: string;
  readonly description: string;
  readonly fixturePath: string;
}

/** Create an immutable migration record with a content fingerprint. */
export function createImmutableDatalogMigration(
  input: CreateImmutableDatalogMigrationInput,
): ImmutableDatalogMigration {
  const fingerprint = createHash('sha256')
    .update(readFileSync(input.fixturePath, 'utf8'))
    .digest('hex');

  return {
    id: input.id,
    description: input.description,
    fixturePath: input.fixturePath,
    fingerprint,
  };
}
