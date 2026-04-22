import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadOntologyProjectFiles } from './load-ontology-project-files.js';

describe('loadOntologyProjectFiles', () => {
  it('resolves the committed migrations directory and planned current.dl path', () => {
    const projectFiles = loadOntologyProjectFiles();

    expect(projectFiles.committedMigrationsDirectory).toMatch(/packages[\\/]medical-ontology-e2e[\\/]migrations$/u);
    expect(projectFiles.currentOntologyPath).toMatch(/packages[\\/]medical-ontology-e2e[\\/]current\.dl$/u);
  });

  it('lists committed ontology sources from the flat migration layout', () => {
    const projectFiles = loadOntologyProjectFiles();

    expect(projectFiles.committedMigrationPaths).toEqual([
      path.join(projectFiles.committedMigrationsDirectory, '20260421.0001.ontology-a-core.dl'),
      path.join(projectFiles.committedMigrationsDirectory, '20260421.0002.ontology-b-core.dl'),
      path.join(projectFiles.committedMigrationsDirectory, '20260421.0003.ontology-c-core.dl'),
    ]);
  });

  it('reads embedded migration metadata and preserves previous-pointer linkage', () => {
    const projectFiles = loadOntologyProjectFiles();

    expect(projectFiles.committedMigrations.map((migration) => ({
      fileName: migration.fileName,
      previousFileName: migration.previousFileName,
    }))).toEqual([
      {
        fileName: '20260421.0001.ontology-a-core.dl',
        previousFileName: null,
      },
      {
        fileName: '20260421.0002.ontology-b-core.dl',
        previousFileName: '20260421.0001.ontology-a-core.dl',
      },
      {
        fileName: '20260421.0003.ontology-c-core.dl',
        previousFileName: '20260421.0002.ontology-b-core.dl',
      },
    ]);
    expect(projectFiles.committedMigrations.every((migration) => migration.sha256.length === 64)).toBe(true);
  });
});
