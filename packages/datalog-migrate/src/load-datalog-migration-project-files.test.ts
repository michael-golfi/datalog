import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { createCommittedMigrationSource } from './commit-current-datalog-migration.js';

import { loadDatalogMigrationProjectFiles } from './load-datalog-migration-project-files.js';

const ontologyWorkspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../medical-ontology-e2e');
const temporaryRoots: string[] = [];

describe('loadDatalogMigrationProjectFiles', () => {
  afterEach(() => {
    while (temporaryRoots.length > 0) {
      const root = temporaryRoots.pop();
      if (root) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it('resolves the committed migrations directory and planned current.dl path', () => {
    const projectFiles = loadDatalogMigrationProjectFiles({ workspaceRoot: ontologyWorkspaceRoot });

    expect(projectFiles.committedMigrationsDirectory).toMatch(/packages[\\/]medical-ontology-e2e[\\/]migrations$/u);
    expect(projectFiles.currentMigrationPath).toMatch(/packages[\\/]medical-ontology-e2e[\\/]current\.dl$/u);
  });

  it('lists committed ontology sources from the flat migration layout', () => {
    const projectFiles = loadDatalogMigrationProjectFiles({ workspaceRoot: ontologyWorkspaceRoot });

    expect(projectFiles.committedMigrationPaths).toEqual([
      path.join(projectFiles.committedMigrationsDirectory, '20260422.0001.ontology-foundation.dl'),
      path.join(projectFiles.committedMigrationsDirectory, '20260422.0002.ontology-core-concepts.dl'),
      path.join(projectFiles.committedMigrationsDirectory, '20260422.0003.ontology-clinical-relationships.dl'),
      path.join(projectFiles.committedMigrationsDirectory, '20260422.0004.ontology-mappings-and-tags.dl'),
    ]);
  });

  it('ignores non-matching files when listing committed migrations', () => {
    const workspaceRoot = createWorkspaceFixture();
    const migrationsDirectory = path.join(workspaceRoot, 'migrations');
    writeFileSync(
      path.join(migrationsDirectory, '20260502.0001.bootstrap.dl'),
      createCommittedMigrationSource('Edge("concept/seed", "graph/preferred_label", "Seed").\n', null),
      'utf8',
    );
    writeFileSync(path.join(migrationsDirectory, '.gitkeep'), '', 'utf8');
    writeFileSync(path.join(migrationsDirectory, 'README.md'), '# notes\n', 'utf8');
    writeFileSync(path.join(migrationsDirectory, '2024.txt'), 'not a migration\n', 'utf8');
    mkdirSync(path.join(migrationsDirectory, 'nested'), { recursive: true });

    const projectFiles = loadDatalogMigrationProjectFiles({ workspaceRoot });

    expect(projectFiles.committedMigrationPaths).toEqual([
      path.join(migrationsDirectory, '20260502.0001.bootstrap.dl'),
    ]);
    expect(projectFiles.committedMigrations.map((migration) => migration.fileName)).toEqual([
      '20260502.0001.bootstrap.dl',
    ]);
  });

  it('returns an empty committed migration list for an empty migrations directory', () => {
    const workspaceRoot = createWorkspaceFixture();

    const projectFiles = loadDatalogMigrationProjectFiles({ workspaceRoot });

    expect(projectFiles.committedMigrationPaths).toEqual([]);
    expect(projectFiles.committedMigrations).toEqual([]);
  });
});

function createWorkspaceFixture(): string {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'datalog-load-project-files-'));
  temporaryRoots.push(workspaceRoot);
  mkdirSync(path.join(workspaceRoot, 'migrations'), { recursive: true });
  return workspaceRoot;
}
