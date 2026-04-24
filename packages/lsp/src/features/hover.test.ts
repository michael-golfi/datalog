import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DATALOG_SAMPLE } from './datalog-sample.js';
import { computeHover } from './hover.js';
import { DatalogDocumentStore } from '../workspace/datalog-document-store.js';
import { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';

describe('computeHover', () => {
  it('describes graph predicate schema from DefPred', () => {
    const line = 'Edge("concept/chickpea_bowl", "food/has_cuisine", "cuisine/mediterranean").';
    const source = `${DATALOG_SAMPLE}\n${line}`;
    const hover = computeHover(source, {
      line: source.split('\n').length - 1,
      character: line.indexOf('food/has_cuisine') + 4,
    });

    expect(hover?.contents).toContain('Graph predicate contract');
    expect(hover?.contents).toContain('liquid/node');
  });

  it('describes nodes using self-describing graph metadata', () => {
    const line = 'Edge("concept/chickpea_bowl", "food/has_cuisine", "cuisine/mediterranean").';
    const source = `${DATALOG_SAMPLE}\n${line}`;
    const hover = computeHover(source, {
      line: source.split('\n').length - 1,
      character: line.indexOf('concept/chickpea_bowl') + 2,
    });

    expect(hover?.contents).toContain('FoodConcept');
    expect(hover?.contents).toContain('concept/chickpea_bowl');
  });

  it('describes local derived predicates with arity and local provenance', () => {
    const source = [
      'Parent(child, parent).',
      'Ancestor(child, parent) :- Parent(child, parent).',
    ].join('\n');

    const hover = computeHover(source, {
      line: 1,
      character: source.split('\n')[1]!.indexOf('Ancestor') + 2,
    }, {
      targetUri: 'file:///workspace/current.dl',
    });

    expect(hover?.contents).toContain('**Ancestor/2**');
    expect(hover?.contents).toContain('Arity: `2`');
    expect(hover?.contents).toContain('1 definition');
    expect(hover?.contents).toContain('file:///workspace/current.dl');
  });

  it('describes cross-file workspace predicates and sorted duplicate provenance', async () => {
    const workspaceRoot = await createWorkspaceRoot();

    try {
      const currentUri = pathToFileURL(join(workspaceRoot, 'current.dl')).href;
      const schemaUri = pathToFileURL(join(workspaceRoot, 'schema.dl')).href;
      const migrationUri = pathToFileURL(join(workspaceRoot, 'migrations/001-derived.dl')).href;
      const source = [
        'Shared(local_left, local_right) :- Parent(local_left, local_right).',
        'UsesShared(left, right) :- Shared(left, right).',
      ].join('\n');

      await writeWorkspaceFile(workspaceRoot, 'schema.dl', 'Shared(schema_left, schema_right) :- Parent(schema_left, schema_right).');
      await writeWorkspaceFile(workspaceRoot, 'migrations/001-derived.dl', 'Shared(migration_left, migration_right) :- Parent(migration_left, migration_right).');

      const workspaceIndex = new DatalogWorkspaceIndex({
        documentStore: new DatalogDocumentStore(),
      });
      await workspaceIndex.setWorkspaceRootPath(workspaceRoot);
      workspaceIndex.upsertOpenDocument({
        uri: currentUri,
        source,
      });

      const hover = computeHover(source, {
        line: 1,
        character: source.split('\n')[1]!.lastIndexOf('Shared') + 2,
      }, {
        targetUri: currentUri,
        workspaceIndex,
      });

      expect(hover?.contents).toContain('**Shared/2**');
      expect(hover?.contents).toContain('3 definitions');
      expect(hover?.contents).toContain(currentUri);
      expect(hover?.contents).toContain(schemaUri);
      expect(hover?.contents).toContain(migrationUri);
      expect(hover?.contents.indexOf(currentUri)).toBeLessThan(hover?.contents.indexOf(migrationUri) ?? Number.POSITIVE_INFINITY);
      expect(hover?.contents.indexOf(migrationUri)).toBeLessThan(hover?.contents.indexOf(schemaUri) ?? Number.POSITIVE_INFINITY);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('uses builtin docs only when no user-defined predicate resolves', () => {
    const source = 'Edge("concept/chickpea_bowl", "food/has_cuisine", "cuisine/mediterranean").';
    const hover = computeHover(source, {
      line: 0,
      character: 1,
    });

    expect(hover?.contents).toContain('Use `Edge(subject, predicate, object)` for the canonical graph layer.');
    expect(hover?.contents).toContain('Example: `Edge("concept/chickpea_bowl", "food/has_cuisine", "cuisine/mediterranean").`');
  });

  it('returns null for unknown predicates, comments, and ordinary strings', () => {
    const source = [
      '% Shared is only mentioned in a comment.',
      'Unknown(left, right) :- Missing(left, right).',
      'Label("just text").',
    ].join('\n');

    expect(computeHover(source, {
      line: 0,
      character: 3,
    })).toBeNull();
    expect(computeHover(source, {
      line: 1,
      character: source.split('\n')[1]!.indexOf('Missing') + 2,
    })).toBeNull();
    expect(computeHover(source, {
      line: 2,
      character: source.split('\n')[2]!.indexOf('just text') + 2,
    })).toBeNull();
  });

  it('returns null for quoted strings with escaped quotes that are not graph references', () => {
    const source = 'Says("escaped \\"hello\\" text").';

    expect(computeHover(source, {
      line: 0,
      character: source.indexOf('hello'),
    })).toBeNull();
  });
});

async function createWorkspaceRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'datalog-hover-'));
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
