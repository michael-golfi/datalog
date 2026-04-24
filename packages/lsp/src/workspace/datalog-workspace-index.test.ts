import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DatalogDocumentStore } from './datalog-document-store.js';
import { DatalogWorkspaceIndex } from './datalog-workspace-index.js';

describe('DatalogWorkspaceIndex', () => {
  it('indexes workspace .dl files, keeps duplicate definitions sorted, separates arities, and prefers open buffers over disk', async () => {
    const workspaceRoot = await createWorkspaceRoot();

    try {
      await writeWorkspaceFile(workspaceRoot, 'schema.dl', [
        'Parent(child, parent).',
        'Shared(child, parent) :- Parent(child, parent).',
      ].join('\n'));
      await writeWorkspaceFile(workspaceRoot, 'migrations/001-init.dl', [
        'Shared(left, right) :- Parent(left, right).',
        'Shared(left, middle, right) :- Parent(left, middle), Parent(middle, right).',
      ].join('\n'));
      await writeWorkspaceFile(workspaceRoot, 'current.dl', [
        'DiskOnly(value).',
        'Parent(current_child, current_parent).',
      ].join('\n'));

      const currentUri = pathToFileURL(join(workspaceRoot, 'current.dl')).href;
      const workspaceIndex = new DatalogWorkspaceIndex({
        documentStore: new DatalogDocumentStore(),
      });

      await workspaceIndex.setWorkspaceRootPath(workspaceRoot);
      workspaceIndex.upsertOpenDocument({
        uri: currentUri,
        source: [
          'UnsavedOnly(value).',
          'Parent(current_child, current_parent).',
        ].join('\n'),
      });

      expect(workspaceIndex.getIndexedDocumentUris()).toEqual([
        pathToFileURL(join(workspaceRoot, 'current.dl')).href,
        pathToFileURL(join(workspaceRoot, 'migrations/001-init.dl')).href,
        pathToFileURL(join(workspaceRoot, 'schema.dl')).href,
      ]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:DiskOnly/1')).toEqual([]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:UnsavedOnly/1')).toHaveLength(1);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:Parent/2')).toHaveLength(2);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:Shared/2').map((entry) => entry.uri)).toEqual([
        pathToFileURL(join(workspaceRoot, 'migrations/001-init.dl')).href,
        pathToFileURL(join(workspaceRoot, 'schema.dl')).href,
      ]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:Shared/3')).toHaveLength(1);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('refreshes the workspace index after file create and delete events', async () => {
    const workspaceRoot = await createWorkspaceRoot();

    try {
      await writeWorkspaceFile(workspaceRoot, 'schema.dl', 'Parent(child, parent).');

      const workspaceIndex = new DatalogWorkspaceIndex({
        documentStore: new DatalogDocumentStore(),
      });

      await workspaceIndex.setWorkspaceRootPath(workspaceRoot);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:LateFact/1')).toEqual([]);

      const lateFilePath = join(workspaceRoot, 'migrations/002-late-fact.dl');
      await writeWorkspaceFile(workspaceRoot, 'migrations/002-late-fact.dl', 'LateFact(value).');
      await workspaceIndex.refresh();

      expect(workspaceIndex.getPredicateDefinitions('user-predicate:LateFact/1')).toHaveLength(1);

      await unlink(lateFilePath);
      await workspaceIndex.refresh();

      expect(workspaceIndex.getPredicateDefinitions('user-predicate:LateFact/1')).toEqual([]);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('excludes ignored paths from workspace enumeration', async () => {
    const workspaceRoot = await createWorkspaceRoot();

    try {
      await writeWorkspaceFile(workspaceRoot, 'current.dl', 'Included(value).');
      await writeWorkspaceFile(workspaceRoot, 'node_modules/ignored.dl', 'IgnoredNodeModules(value).');
      await writeWorkspaceFile(workspaceRoot, '.worktrees/ignored.dl', 'IgnoredWorktrees(value).');
      await writeWorkspaceFile(workspaceRoot, '.yarn/ignored.dl', 'IgnoredYarn(value).');
      await writeWorkspaceFile(workspaceRoot, 'dist/ignored.dl', 'IgnoredDist(value).');
      await writeWorkspaceFile(workspaceRoot, 'coverage/ignored.dl', 'IgnoredCoverage(value).');
      await writeWorkspaceFile(workspaceRoot, '.sisyphus/plans/ignored.dl', 'IgnoredPlans(value).');

      const workspaceIndex = new DatalogWorkspaceIndex({
        documentStore: new DatalogDocumentStore(),
      });

      await workspaceIndex.setWorkspaceRootPath(workspaceRoot);

      expect(workspaceIndex.getIndexedDocumentUris()).toEqual([
        pathToFileURL(join(workspaceRoot, 'current.dl')).href,
      ]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:Included/1')).toHaveLength(1);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:IgnoredNodeModules/1')).toEqual([]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:IgnoredWorktrees/1')).toEqual([]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:IgnoredYarn/1')).toEqual([]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:IgnoredDist/1')).toEqual([]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:IgnoredCoverage/1')).toEqual([]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:IgnoredPlans/1')).toEqual([]);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('treats Windows-style open document paths inside the workspace as members', async () => {
    const workspaceRoot = 'C:\\workspace';
    const workspaceDocumentUri = 'file:///C:%5Cworkspace%5Ccurrent.dl';
    const outsideWorkspaceUri = 'file:///C:%5Cworkspace-other%5Coutside.dl';
    const workspaceIndex = new DatalogWorkspaceIndex({
      documentStore: new DatalogDocumentStore(),
      listWorkspaceFiles: async () => [],
    });

    await workspaceIndex.setWorkspaceRootPath(workspaceRoot);
    workspaceIndex.upsertOpenDocument({
      uri: workspaceDocumentUri,
      source: 'Inside(value).',
    });
    workspaceIndex.upsertOpenDocument({
      uri: outsideWorkspaceUri,
      source: 'Outside(value).',
    });

    expect(workspaceIndex.getIndexedDocumentUris()).toEqual([workspaceDocumentUri]);
    expect(workspaceIndex.getPredicateDefinitions('user-predicate:Inside/1')).toHaveLength(1);
    expect(workspaceIndex.getPredicateDefinitions('user-predicate:Outside/1')).toEqual([]);
  });
});

async function createWorkspaceRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'datalog-workspace-index-'));
}

async function writeWorkspaceFile(
  workspaceRoot: string,
  relativePath: string,
  source: string,
): Promise<void> {
  const filePath = join(workspaceRoot, relativePath);
  const directoryPath = filePath.slice(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));

  await mkdir(directoryPath, { recursive: true });
  await writeFile(filePath, source, 'utf8');
}
