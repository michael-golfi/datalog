import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DATALOG_SAMPLE } from './datalog-sample.js';
import { computeDiagnostics } from './diagnostics.js';
import { DatalogDocumentStore } from '../workspace/datalog-document-store.js';
import { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';

describe('computeDiagnostics', () => {
  it('accepts valid graph-oriented datalog', () => {
    expect(computeDiagnostics(DATALOG_SAMPLE)).toHaveLength(0);
  });

  it('reports wrong builtin arity and duplicate DefPred schemas', () => {
    const source = [
      'DefPred("food/has_cuisine", "0", "liquid/node", "0", "liquid/node").',
      'DefPred("food/has_cuisine", "0", "liquid/node", "0", "liquid/node").',
      'Edge("concept/chickpea_bowl", "food/has_cuisine").',
    ].join('\n');
    const diagnostics = computeDiagnostics(source);

    expect(diagnostics.map((diagnostic) => diagnostic.message)).toContain(
      'Duplicate DefPred for food/has_cuisine.',
    );
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toContain(
      'Edge expects arity 3, found 2.',
    );
  });

  it('reports compound field cardinality and domain violations from local schema declarations', () => {
    const source = [
      'DefCompound("Serving", "serv/id", "1", "liquid/node").',
      'DefCompound("Serving", "serv/unit", "?", "liquid/string").',
      'DefCompound("Serving", "serv/count", "1", "int8").',
      'Serving@(serv/unit="unit/gram", serv/unit="unit/ounce", serv/count=true).',
    ].join('\n');

    const diagnostics = computeDiagnostics(source);

    expect(diagnostics.map((diagnostic) => diagnostic.message)).toContain(
      'Serving@ field serv/id requires at least one value (cardinality `1`).',
    );
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toContain(
      'Serving@ field serv/unit allows at most one value (cardinality `?`).',
    );
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toContain(
      'Serving@ field serv/count expects domain `int8`, found `bool`.',
    );
  });

  it('reports workspace-backed compound schema violations for open documents', async () => {
    const workspaceRootPath = '/workspace';
    const schemaPath = join(workspaceRootPath, 'schema.dl');
    const currentPath = join(workspaceRootPath, 'current.dl');
    const currentUri = pathToFileURL(currentPath).href;
    const workspaceIndex = new DatalogWorkspaceIndex({
      documentStore: new DatalogDocumentStore(),
      listWorkspaceFiles: async () => [schemaPath, currentPath],
      readFile: (async (filePath: string) => {
        if (filePath === schemaPath) {
          return [
            'DefCompound("Serving", "serv/id", "1", "liquid/node").',
            'DefCompound("Serving", "serv/count", "1", "int8").',
          ].join('\n');
        }

        if (filePath === currentPath) {
          return 'Serving@(serv/id="serv/1", serv/count=1).';
        }

        throw new Error(`Unexpected file path: ${filePath}`);
      }) as never,
      loadMigrationProjectFiles: () => ({
        committedMigrationsDirectory: join(workspaceRootPath, 'migrations'),
        committedMigrationPaths: [],
        currentMigrationPath: currentPath,
        committedMigrations: [],
      }),
    });

    await workspaceIndex.setWorkspaceRootPath(workspaceRootPath);
    workspaceIndex.upsertOpenDocument({
      uri: currentUri,
      source: 'Serving@(serv/count=false).',
    });

    const diagnostics = computeDiagnostics('Serving@(serv/count=false).', {
      targetUri: currentUri,
      workspaceIndex,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.message)).toContain(
      'Serving@ field serv/id requires at least one value (cardinality `1`).',
    );
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toContain(
      'Serving@ field serv/count expects domain `int8`, found `bool`.',
    );
  });

  it('does not flag a one-line interactive query for missing trailing period', () => {
    expect(computeDiagnostics('ManagesReach(actor_id, manager_id, depth, path)')).toHaveLength(0);
  });

  it('uses migration program order for duplicate schema diagnostics and respects open-buffer current.dl content', async () => {
    const workspaceRootPath = '/workspace';
    const committedMigrationPath = join(
      workspaceRootPath,
      'migrations/20260422.0001.foundation.dl',
    );
    const currentMigrationPath = join(workspaceRootPath, 'current.dl');
    const currentUri = pathToFileURL(currentMigrationPath).href;
    const workspaceIndex = new DatalogWorkspaceIndex({
      documentStore: new DatalogDocumentStore(),
      listWorkspaceFiles: async () => [committedMigrationPath, currentMigrationPath],
      readFile: (async (filePath: string) => {
        if (filePath === committedMigrationPath) {
          return 'DefPred("graph/shared", "0", "class/Entity", "0", "class/Target").';
        }

        if (filePath === currentMigrationPath) {
          return 'CurrentOnly(value).';
        }

        throw new Error(`Unexpected file path: ${filePath}`);
      }) as never,
      loadMigrationProjectFiles: () => ({
        committedMigrationsDirectory: join(workspaceRootPath, 'migrations'),
        committedMigrationPaths: [committedMigrationPath],
        currentMigrationPath,
        committedMigrations: [],
      }),
    });

    await workspaceIndex.setWorkspaceRootPath(workspaceRootPath);
    workspaceIndex.upsertOpenDocument({
      uri: currentUri,
      source: 'DefPred("graph/shared", "0", "class/Entity", "0", "class/Target").',
    });

    const diagnostics = computeDiagnostics(
      'DefPred("graph/shared", "0", "class/Entity", "0", "class/Target").',
      {
        targetUri: currentUri,
        workspaceIndex,
      },
    );

    expect(diagnostics.map((diagnostic) => diagnostic.message)).toContain(
      'Duplicate DefPred for graph/shared.',
    );
  });
});
