import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveMedicalOntologyWorkspacePath } from './resolve-medical-ontology-workspace-path.js';

describe('resolveMedicalOntologyWorkspacePath', () => {
  it('returns the absolute package root when no segments are supplied', () => {
    const workspaceRoot = resolveMedicalOntologyWorkspacePath();

    expect(path.isAbsolute(workspaceRoot)).toBe(true);
    expect(workspaceRoot).toMatch(/packages[\\/]medical-ontology-e2e$/u);
  });

  it('appends path segments inside the package workspace', () => {
    const migrationPath = resolveMedicalOntologyWorkspacePath('migrations', '2026-04-21-ontology-a-core', 'ontology.dl');

    expect(migrationPath).toMatch(/packages[\\/]medical-ontology-e2e[\\/]migrations[\\/]2026-04-21-ontology-a-core[\\/]ontology\.dl$/u);
  });
});
