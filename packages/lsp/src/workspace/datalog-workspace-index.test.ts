import { mkdir, mkdtemp, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DatalogDocumentStore } from './datalog-document-store.js';
import { DatalogWorkspaceIndex } from './datalog-workspace-index.js';
import { listDatalogWorkspaceFiles } from './datalog-workspace-files.js';

type WorkspaceReadFile = NonNullable<ConstructorParameters<typeof DatalogWorkspaceIndex>[0]['readFile']>;

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

  it('keeps newer refresh results when an older refresh resolves later', async () => {
    const workspaceRoot = await createWorkspaceRoot();

    try {
      await writeWorkspaceFile(workspaceRoot, 'stale.dl', 'StaleFact(value).');
      await writeWorkspaceFile(workspaceRoot, 'newer.dl', 'NewerFact(value).');

      const staleFilePath = join(workspaceRoot, 'stale.dl');
      const newerFilePath = join(workspaceRoot, 'newer.dl');
      const olderListing = defer<readonly string[]>();
      const newerListing = defer<readonly string[]>();
      const listingPromises = [olderListing.promise, newerListing.promise];
      const workspaceIndex = new DatalogWorkspaceIndex({
        documentStore: new DatalogDocumentStore(),
        listWorkspaceFiles: async (workspaceRootPath) => {
          expect(workspaceRootPath).toBe(workspaceRoot);

          const listingPromise = listingPromises.shift();
          if (!listingPromise) {
            throw new Error('Unexpected workspace file listing request.');
          }

          return listingPromise;
        },
      });

      const olderRefresh = workspaceIndex.setWorkspaceRootPath(workspaceRoot);
      const newerRefresh = workspaceIndex.refresh();

      newerListing.resolve([newerFilePath]);
      await newerRefresh;

      expect(workspaceIndex.getIndexedDocumentUris()).toEqual([
        pathToFileURL(newerFilePath).href,
      ]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:NewerFact/1')).toHaveLength(1);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:StaleFact/1')).toEqual([]);

      olderListing.resolve([staleFilePath]);
      await olderRefresh;

      expect(workspaceIndex.getIndexedDocumentUris()).toEqual([
        pathToFileURL(newerFilePath).href,
      ]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:NewerFact/1')).toHaveLength(1);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:StaleFact/1')).toEqual([]);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('aggregates graph metadata targets deterministically across disk files and open buffers', async () => {
    const workspaceRoot = await createWorkspaceRoot();

    try {
      await writeWorkspaceFile(workspaceRoot, 'schema-b.dl', [
        'DefPred("graph/shared", "0", "class/Entity", "0", "class/Target").',
        'DefPred("graph/b-only", "0", "class/Entity", "0", "class/Target").',
        'Edge("node/shared", "food/preferred_label", "Shared B").',
        'Edge("node/b", "food/instance_of", "class/B").',
      ].join('\n'));
      await writeWorkspaceFile(workspaceRoot, 'schema-a.dl', [
        'DefPred("graph/shared", "0", "class/Entity", "0", "class/Target").',
        'DefPred("graph/a-only", "0", "class/Entity", "0", "class/Target").',
        'Edge("node/shared", "food/preferred_label", "Shared A").',
        'Edge("node/a", "food/instance_of", "class/A").',
      ].join('\n'));
      await writeWorkspaceFile(workspaceRoot, 'current.dl', [
        'DefPred("graph/disk-only", "0", "class/Entity", "0", "class/Target").',
        'Edge("node/disk", "food/preferred_label", "Disk node").',
      ].join('\n'));

      const workspaceIndex = new DatalogWorkspaceIndex({
        documentStore: new DatalogDocumentStore(),
      });
      const currentUri = pathToFileURL(join(workspaceRoot, 'current.dl')).href;

      await workspaceIndex.setWorkspaceRootPath(workspaceRoot);
      workspaceIndex.upsertOpenDocument({
        uri: currentUri,
        source: [
          'DefPred("graph/open-only", "0", "class/Entity", "0", "class/Target").',
          'Edge("node/open", "food/preferred_label", "Open node").',
        ].join('\n'),
      });

      expect(workspaceIndex.getGraphPredicateIds()).toEqual([
        'food/instance_of',
        'food/preferred_label',
        'graph/a-only',
        'graph/b-only',
        'graph/open-only',
        'graph/shared',
      ]);
      expect(workspaceIndex.getPredicateSchemaTargets('graph/disk-only')).toEqual([]);
      expect(workspaceIndex.getPredicateSchemaTargets('graph/open-only').map((target) => target.uri)).toEqual([
        currentUri,
      ]);
      expect(workspaceIndex.getPredicateSchemaTargets('graph/shared').map((target) => target.uri)).toEqual([
        pathToFileURL(join(workspaceRoot, 'schema-a.dl')).href,
        pathToFileURL(join(workspaceRoot, 'schema-b.dl')).href,
      ]);
      expect(workspaceIndex.getPredicateSchemaTargets('graph/shared').map((target) => target.schema.subjectType)).toEqual([
        'class/Entity',
        'class/Entity',
      ]);
      expect(workspaceIndex.getNodeSummaryTargets('node/disk')).toEqual([]);
      expect(workspaceIndex.getNodeSummaryTargets('node/open').map((target) => ({
        label: target.summary.label,
        uri: target.uri,
      }))).toEqual([
        {
          label: 'Open node',
          uri: currentUri,
        },
      ]);
      expect(workspaceIndex.getNodeSummaryTargets('node/shared').map((target) => ({
        label: target.summary.label,
        uri: target.uri,
      }))).toEqual([
        {
          label: 'Shared A',
          uri: pathToFileURL(join(workspaceRoot, 'schema-a.dl')).href,
        },
        {
          label: 'Shared B',
          uri: pathToFileURL(join(workspaceRoot, 'schema-b.dl')).href,
        },
      ]);
      expect(workspaceIndex.getNodeSummaryTargets('node/a')[0]?.summary.classes).toEqual(['class/A']);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('skips transient traversal errors for affected directories only', async () => {
    const workspaceRoot = await createWorkspaceRoot();

    try {
      await writeWorkspaceFile(workspaceRoot, 'current.dl', 'Included(value).');
      await writeWorkspaceFile(workspaceRoot, 'nested/kept.dl', 'Kept(value).');
      await writeWorkspaceFile(workspaceRoot, 'nested/skipped/missing.dl', 'Missing(value).');

      const skippedDirectoryPath = join(workspaceRoot, 'nested/skipped');
      const files = await listDatalogWorkspaceFiles(workspaceRoot, {
        readDir: async (directoryPath, options) => {
          if (directoryPath === skippedDirectoryPath) {
            throw createFsError('ENOENT');
          }

          return readdir(directoryPath, options);
        },
      });

      expect(files).toEqual([
        join(workspaceRoot, 'current.dl'),
        join(workspaceRoot, 'nested/kept.dl'),
      ]);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('skips vanished or unreadable files during disk refresh without aborting other workspace documents', async () => {
    const workspaceRoot = await createWorkspaceRoot();

    try {
      const includedFilePath = join(workspaceRoot, 'included.dl');
      const vanishedFilePath = join(workspaceRoot, 'vanished.dl');
      const unreadableFilePath = join(workspaceRoot, 'unreadable.dl');
      const readFile = (async (filePath: Parameters<WorkspaceReadFile>[0]) => {
        const normalizedFilePath = String(filePath);

        if (normalizedFilePath === includedFilePath) {
          return 'Included(value).';
        }

        if (normalizedFilePath === vanishedFilePath) {
          throw createFsError('ENOENT');
        }

        if (normalizedFilePath === unreadableFilePath) {
          throw createFsError('EACCES');
        }

        throw new Error(`Unexpected file path: ${normalizedFilePath}`);
      }) as WorkspaceReadFile;
      const workspaceIndex = new DatalogWorkspaceIndex({
        documentStore: new DatalogDocumentStore(),
        listWorkspaceFiles: async () => [includedFilePath, vanishedFilePath, unreadableFilePath],
        readFile,
      });

      await workspaceIndex.setWorkspaceRootPath(workspaceRoot);

      expect(workspaceIndex.getIndexedDocumentUris()).toEqual([
        pathToFileURL(includedFilePath).href,
      ]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:Included/1')).toHaveLength(1);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('builds a migration-ordered whole-program view and preserves open-buffer precedence for current.dl', async () => {
    const workspaceRoot = await createWorkspaceRoot();

    try {
      const committedMigrationPath = join(workspaceRoot, 'migrations/20260422.0002.second.dl');
      const foundationMigrationPath = join(workspaceRoot, 'migrations/20260422.0001.foundation.dl');
      const currentMigrationPath = join(workspaceRoot, 'current.dl');
      const currentUri = pathToFileURL(currentMigrationPath).href;
      await writeWorkspaceFile(workspaceRoot, 'migrations/20260422.0002.second.dl', 'SecondMigration(value).');
      await writeWorkspaceFile(workspaceRoot, 'migrations/20260422.0001.foundation.dl', 'FoundationMigration(value).');
      await writeWorkspaceFile(workspaceRoot, 'current.dl', 'DiskCurrent(value).');

      const workspaceIndex = new DatalogWorkspaceIndex({
        documentStore: new DatalogDocumentStore(),
        loadMigrationProjectFiles: () => ({
          committedMigrationsDirectory: join(workspaceRoot, 'migrations'),
          committedMigrationPaths: [foundationMigrationPath, committedMigrationPath],
          currentMigrationPath,
          committedMigrations: [],
        }),
      });

      await workspaceIndex.setWorkspaceRootPath(workspaceRoot);
      workspaceIndex.upsertOpenDocument({
        uri: currentUri,
        source: 'OpenCurrent(value).',
      });

      expect(workspaceIndex.getProgram()?.sources.map((source) => source.sourceId)).toEqual([
        pathToFileURL(foundationMigrationPath).href,
        pathToFileURL(committedMigrationPath).href,
        currentUri,
      ]);
      expect(workspaceIndex.getProgram()?.program.statements.map((statement) => {
        if (statement.kind === 'fact') {
          return statement.atom.predicate;
        }

        if (statement.kind === 'rule') {
          return statement.head.predicate;
        }

        return statement.kind;
      })).toEqual([
        'FoundationMigration',
        'SecondMigration',
        'OpenCurrent',
      ]);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('fails soft when the ordered migration program includes an invalid open current.dl source', async () => {
    const workspaceRoot = await createWorkspaceRoot();

    try {
      const committedMigrationPath = join(workspaceRoot, 'migrations/20260422.0001.foundation.dl');
      const currentMigrationPath = join(workspaceRoot, 'current.dl');
      const currentUri = pathToFileURL(currentMigrationPath).href;
      await writeWorkspaceFile(workspaceRoot, 'migrations/20260422.0001.foundation.dl', 'FoundationMigration(value).');
      await writeWorkspaceFile(workspaceRoot, 'current.dl', 'DiskCurrent(value).');

      const workspaceIndex = new DatalogWorkspaceIndex({
        documentStore: new DatalogDocumentStore(),
        loadMigrationProjectFiles: () => ({
          committedMigrationsDirectory: join(workspaceRoot, 'migrations'),
          committedMigrationPaths: [committedMigrationPath],
          currentMigrationPath,
          committedMigrations: [],
        }),
      });

      await workspaceIndex.setWorkspaceRootPath(workspaceRoot);
      workspaceIndex.upsertOpenDocument({
        uri: currentUri,
        source: [
          'CompletionProbe(left, right) :-',
          '  Sha.',
        ].join('\n'),
      });

      expect(workspaceIndex.getProgram()).toBeNull();
      expect(workspaceIndex.getIndexedDocumentUris()).toEqual([
        currentUri,
        pathToFileURL(committedMigrationPath).href,
      ]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:CompletionProbe/2')).toHaveLength(1);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:FoundationMigration/1')).toHaveLength(1);
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
      await writeWorkspaceFile(workspaceRoot, '.git/ignored.dl', 'IgnoredGit(value).');
      await writeWorkspaceFile(workspaceRoot, 'dist/ignored.dl', 'IgnoredDist(value).');
      await writeWorkspaceFile(workspaceRoot, 'coverage/ignored.dl', 'IgnoredCoverage(value).');
      await writeWorkspaceFile(workspaceRoot, '.sisyphus/plans/ignored.dl', 'IgnoredPlans(value).');
      await writeWorkspaceFile(workspaceRoot, '.sisyphus/evidence/ignored.dl', 'IgnoredEvidence(value).');

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
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:IgnoredGit/1')).toEqual([]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:IgnoredDist/1')).toEqual([]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:IgnoredCoverage/1')).toEqual([]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:IgnoredPlans/1')).toEqual([]);
      expect(workspaceIndex.getPredicateDefinitions('user-predicate:IgnoredEvidence/1')).toEqual([]);
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

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function defer<T>(): Deferred<T> {
  let resolve: Deferred<T>['resolve'] = () => {
    throw new Error('Deferred resolved before initialization.');
  };
  const promise = new Promise<T>((promiseResolve) => {
    resolve = (value) => promiseResolve(value);
  });

  return {
    promise,
    resolve,
  };
}

function createFsError(code: 'ENOENT' | 'ENOTDIR' | 'EACCES' | 'EPERM'): NodeJS.ErrnoException {
  const error = new Error(code) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}
