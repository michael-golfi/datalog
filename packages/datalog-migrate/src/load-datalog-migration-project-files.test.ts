import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadDatalogMigrationProjectFiles } from './load-datalog-migration-project-files.js';

const ontologyWorkspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../medical-ontology-e2e');

describe('loadDatalogMigrationProjectFiles', () => {
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
});
