import { describe, expect, it } from 'vitest';

import { loadOntologyProjectFiles } from './load-ontology-project-files.js';
import { readCommittedMigrationFile } from './read-committed-migration-file.js';

describe('committed migration compound definition ordering', () => {
  it('declares each compound with DefCompound before its first usage', () => {
    const projectFiles = loadOntologyProjectFiles();

    for (const migrationPath of projectFiles.committedMigrationPaths) {
      const migration = readCommittedMigrationFile(migrationPath);
      const lines = migration.body.split('\n');
      const declaredCompounds = new Set<string>();

      for (const line of lines) {
        const declaredCompound = /^DefCompound\("([A-Za-z_][A-Za-z0-9_]*)"/.exec(line)?.[1];
        if (declaredCompound) {
          declaredCompounds.add(declaredCompound);
        }

        const usedCompound = /^([A-Za-z_][A-Za-z0-9_]*)@\(/.exec(line)?.[1];
        if (!usedCompound) {
          continue;
        }

        expect(
          declaredCompounds.has(usedCompound),
          `Expected ${migration.fileName} to declare DefCompound for ${usedCompound} before use.`,
        ).toBe(true);
      }
    }
  });
});
