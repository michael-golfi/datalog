import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { initDatalogMigrationWorkspace } from './init-datalog-migration-workspace.js';

const temporaryRoots: string[] = [];
const DEFAULT_CURRENT_FILE_CONTENT = '% Current mutable ontology working area.\n';

describe('initDatalogMigrationWorkspace', () => {
  afterEach(() => {
    while (temporaryRoots.length > 0) {
      const root = temporaryRoots.pop();
      if (root) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it('creates migrations/ and current.dl in a fresh directory', () => {
    const workspaceRoot = createWorkspaceFixture();

    const result = initDatalogMigrationWorkspace({ workspaceRoot });

    expect(result).toEqual({
      workspaceRoot,
      migrationsDirectory: path.join(workspaceRoot, 'migrations'),
      currentMigrationPath: path.join(workspaceRoot, 'current.dl'),
      alreadyInitialized: false,
    });
    expect(readFileSync(result.currentMigrationPath, 'utf8')).toBe(DEFAULT_CURRENT_FILE_CONTENT);
  });

  it('is idempotent when run twice', () => {
    const workspaceRoot = createWorkspaceFixture();

    const firstResult = initDatalogMigrationWorkspace({ workspaceRoot });
    const secondResult = initDatalogMigrationWorkspace({ workspaceRoot });

    expect(firstResult.alreadyInitialized).toBe(false);
    expect(secondResult.alreadyInitialized).toBe(true);
    expect(readFileSync(secondResult.currentMigrationPath, 'utf8')).toBe(DEFAULT_CURRENT_FILE_CONTENT);
  });

  it('refuses to reinitialize when migrations/ already has committed files', () => {
    const workspaceRoot = createWorkspaceFixture();
    const migrationsDirectory = path.join(workspaceRoot, 'migrations');
    mkdirSync(migrationsDirectory, { recursive: true });
    writeFileSync(path.join(migrationsDirectory, '20260422.0001.bootstrap.dl'), '% migration.previous: none\n', 'utf8');

    expect(() => initDatalogMigrationWorkspace({ workspaceRoot })).toThrowError(
      'Cannot initialize Datalog migration workspace: migrations/ already contains committed migration files.',
    );
  });

  it('creates migrations/ with the expected path', () => {
    const workspaceRoot = createWorkspaceFixture();

    const result = initDatalogMigrationWorkspace({ workspaceRoot });

    expect(result.migrationsDirectory).toBe(path.join(workspaceRoot, 'migrations'));
  });

  it('creates current.dl with the default content', () => {
    const workspaceRoot = createWorkspaceFixture();

    const result = initDatalogMigrationWorkspace({ workspaceRoot });

    expect(readFileSync(result.currentMigrationPath, 'utf8')).toBe(DEFAULT_CURRENT_FILE_CONTENT);
  });
});

function createWorkspaceFixture(): string {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'datalog-migrate-'));
  temporaryRoots.push(workspaceRoot);
  return workspaceRoot;
}
