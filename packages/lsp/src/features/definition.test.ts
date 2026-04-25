import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DATALOG_SAMPLE } from './datalog-sample.js';
import { computeDefinition } from './definition.js';
import { DatalogDocumentStore } from '../workspace/datalog-document-store.js';
import { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';

describe('computeDefinition', () => {
  it('jumps from an Edge predicate id to its DefPred declaration', () => {
    const line = 'Edge("concept/chickpea_bowl", "food/has_cuisine", "cuisine/mediterranean").';
    const source = `${DATALOG_SAMPLE}\n${line}`;
    const result = computeDefinition(
      source,
      {
        line: source.split('\n').length - 1,
        character: line.indexOf('food/has_cuisine') + 5,
      },
      { targetUri: 'file:///workspace/test.dl' },
    );
    const expectedLine = DATALOG_SAMPLE.split('\n').findIndex((entry) =>
      entry.includes('DefPred("food/has_cuisine"'),
    );

    expect(result).toEqual([
      {
        targetSelectionRange: expect.objectContaining({
          start: expect.objectContaining({ line: expectedLine }),
        }),
        targetUri: 'file:///workspace/test.dl',
      },
    ]);
  });

  it('resolves cross-file graph predicate ids to DefPred declarations through the workspace index', () => {
    const workspaceIndex = new DatalogWorkspaceIndex({
      documentStore: new DatalogDocumentStore(),
    });
    const schemaUri = 'file:///workspace/schema.dl';
    const currentUri = 'file:///workspace/current.dl';
    const schemaSource = 'DefPred("food/has_spice", "0", "liquid/node", "0", "liquid/node").';
    const currentSource = 'Edge("concept/stew", "food/has_spice", "spice/cumin").';

    workspaceIndex.upsertOpenDocument({ uri: schemaUri, source: schemaSource });
    workspaceIndex.upsertOpenDocument({ uri: currentUri, source: currentSource });

    expect(
      computeDefinition(currentSource, positionOf(currentSource, 'food/has_spice'), {
        targetUri: currentUri,
        workspaceIndex,
      }),
    ).toEqual([
      {
        targetUri: schemaUri,
        targetSelectionRange: stringValueRange(schemaSource, 'food/has_spice'),
      },
    ]);
  });

  it('resolves cross-file node ids to node summary sources through the workspace index', () => {
    const workspaceIndex = new DatalogWorkspaceIndex({
      documentStore: new DatalogDocumentStore(),
    });
    const summaryUri = 'file:///workspace/summary.dl';
    const currentUri = 'file:///workspace/current.dl';
    const summarySource = 'Edge("class/Dish", "food/preferred_label", "Dish").';
    const currentSource = 'Edge("concept/stew", "food/instance_of", "class/Dish").';

    workspaceIndex.upsertOpenDocument({ uri: summaryUri, source: summarySource });
    workspaceIndex.upsertOpenDocument({ uri: currentUri, source: currentSource });

    expect(
      computeDefinition(currentSource, positionOf(currentSource, 'class/Dish'), {
        targetUri: currentUri,
        workspaceIndex,
      }),
    ).toEqual([
      {
        targetUri: summaryUri,
        targetSelectionRange: stringValueRange(summarySource, 'class/Dish'),
      },
    ]);
  });

  it('keeps local string-reference definitions before workspace fallbacks', () => {
    const workspaceIndex = new DatalogWorkspaceIndex({
      documentStore: new DatalogDocumentStore(),
    });
    const workspaceUri = 'file:///workspace/schema.dl';
    const currentUri = 'file:///workspace/current.dl';
    const workspaceSource = 'DefPred("food/local", "0", "liquid/node", "0", "liquid/node").';
    const currentSource = [
      'DefPred("food/local", "0", "liquid/node", "0", "liquid/node").',
      'Edge("concept/stew", "food/local", "spice/cumin").',
    ].join('\n');

    workspaceIndex.upsertOpenDocument({ uri: workspaceUri, source: workspaceSource });
    workspaceIndex.upsertOpenDocument({ uri: currentUri, source: currentSource });

    expect(
      computeDefinition(currentSource, positionOf(currentSource, 'food/local', 1), {
        targetUri: currentUri,
        workspaceIndex,
      }),
    ).toEqual([
      {
        targetUri: currentUri,
        targetSelectionRange: stringValueRange(currentSource, 'food/local'),
      },
    ]);
  });

  it('returns duplicate workspace metadata targets in deterministic sorted order', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'datalog-definition-metadata-'));

    try {
      const workspaceIndex = new DatalogWorkspaceIndex({
        documentStore: new DatalogDocumentStore(),
      });
      const firstUri = pathToFileURL(join(workspaceRoot, 'a-schema.dl')).href;
      const secondUri = pathToFileURL(join(workspaceRoot, 'nested/b-schema.dl')).href;
      const currentUri = pathToFileURL(join(workspaceRoot, 'current.dl')).href;
      const firstSource = 'DefPred("food/shared", "0", "liquid/node", "0", "liquid/node").';
      const secondSource = 'DefPred("food/shared", "1", "liquid/node", "0", "liquid/string").';
      const currentSource = 'Edge("concept/stew", "food/shared", "spice/cumin").';

      await writeWorkspaceFile(workspaceRoot, 'nested/b-schema.dl', secondSource);
      await writeWorkspaceFile(workspaceRoot, 'a-schema.dl', firstSource);
      await writeWorkspaceFile(workspaceRoot, 'current.dl', currentSource);
      await workspaceIndex.setWorkspaceRootPath(workspaceRoot);
      workspaceIndex.upsertOpenDocument({ uri: currentUri, source: currentSource });

      expect(
        computeDefinition(currentSource, positionOf(currentSource, 'food/shared'), {
          targetUri: currentUri,
          workspaceIndex,
        }),
      ).toEqual([
        {
          targetUri: firstUri,
          targetSelectionRange: stringValueRange(firstSource, 'food/shared'),
        },
        {
          targetUri: secondUri,
          targetSelectionRange: stringValueRange(secondSource, 'food/shared'),
        },
      ]);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('resolves cross-file predicate references through the workspace index', () => {
    const workspaceIndex = new DatalogWorkspaceIndex({
      documentStore: new DatalogDocumentStore(),
    });
    const schemaUri = 'file:///workspace/schema.dl';
    const currentUri = 'file:///workspace/current.dl';
    const schemaSource = 'Parent(child, parent).';
    const currentSource = 'ChildOf(child, parent) :- Parent(child, parent).';

    workspaceIndex.upsertOpenDocument({ uri: schemaUri, source: schemaSource });
    workspaceIndex.upsertOpenDocument({ uri: currentUri, source: currentSource });

    expect(
      computeDefinition(currentSource, positionOf(currentSource, 'Parent(child, parent)'), {
        targetUri: currentUri,
        workspaceIndex,
      }),
    ).toEqual([
      {
        targetUri: schemaUri,
        targetSelectionRange: predicateRange(schemaSource, 'Parent(child, parent)'),
      },
    ]);
  });

  it('returns duplicate same-identity definitions in deterministic sorted order', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'datalog-definition-'));

    try {
      const workspaceIndex = new DatalogWorkspaceIndex({
        documentStore: new DatalogDocumentStore(),
      });
      const migrationsUri = pathToFileURL(join(workspaceRoot, 'migrations/001-shared.dl')).href;
      const schemaUri = pathToFileURL(join(workspaceRoot, 'schema.dl')).href;
      const currentUri = pathToFileURL(join(workspaceRoot, 'current.dl')).href;
      const migrationsSource = 'Shared(left, right) :- Parent(left, right).';
      const schemaSource = 'Shared(child, parent) :- Parent(child, parent).';
      const currentSource = 'UsesShared(child, parent) :- Shared(child, parent).';

      await writeWorkspaceFile(workspaceRoot, 'migrations/001-shared.dl', migrationsSource);
      await writeWorkspaceFile(workspaceRoot, 'schema.dl', schemaSource);
      await writeWorkspaceFile(workspaceRoot, 'current.dl', currentSource);
      await workspaceIndex.setWorkspaceRootPath(workspaceRoot);
      workspaceIndex.upsertOpenDocument({ uri: currentUri, source: currentSource });

      expect(
        computeDefinition(currentSource, positionOf(currentSource, 'Shared(child, parent)', 1), {
          targetUri: currentUri,
          workspaceIndex,
        }),
      ).toEqual([
        {
          targetUri: migrationsUri,
          targetSelectionRange: predicateRange(migrationsSource, 'Shared(left, right)'),
        },
        {
          targetUri: schemaUri,
          targetSelectionRange: predicateRange(schemaSource, 'Shared(child, parent)'),
        },
      ]);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('matches user predicates by exact name and arity', () => {
    const workspaceIndex = new DatalogWorkspaceIndex({
      documentStore: new DatalogDocumentStore(),
    });
    const schemaUri = 'file:///workspace/schema.dl';
    const currentUri = 'file:///workspace/current.dl';
    const schemaSource = [
      'Shared(left, right) :- Parent(left, right).',
      'Shared(left, middle, right) :- Parent(left, middle), Parent(middle, right).',
    ].join('\n');
    const currentSource = 'UsesShared(left, middle, right) :- Shared(left, middle, right).';

    workspaceIndex.upsertOpenDocument({ uri: schemaUri, source: schemaSource });
    workspaceIndex.upsertOpenDocument({ uri: currentUri, source: currentSource });

    expect(
      computeDefinition(
        currentSource,
        positionOf(currentSource, 'Shared(left, middle, right)', 1),
        {
          targetUri: currentUri,
          workspaceIndex,
        },
      ),
    ).toEqual([
      {
        targetUri: schemaUri,
        targetSelectionRange: predicateRange(schemaSource, 'Shared(left, middle, right)'),
      },
    ]);

    expect(
      computeDefinition(
        'UsesShared(value) :- Shared(value).',
        positionOf('UsesShared(value) :- Shared(value).', 'Shared(value)', 1),
        {
          targetUri: 'file:///workspace/missing-arity.dl',
          workspaceIndex,
        },
      ),
    ).toBeNull();
  });

  it('continues to resolve user predicates independently from quoted string metadata', () => {
    const workspaceIndex = new DatalogWorkspaceIndex({
      documentStore: new DatalogDocumentStore(),
    });
    const schemaUri = 'file:///workspace/schema.dl';
    const currentUri = 'file:///workspace/current.dl';
    const schemaSource = [
      'DefPred("Shared", "0", "liquid/node", "0", "liquid/node").',
      'Shared(child, parent) :- Parent(child, parent).',
    ].join('\n');
    const currentSource = 'UsesShared(child, parent) :- Shared(child, parent).';

    workspaceIndex.upsertOpenDocument({ uri: schemaUri, source: schemaSource });
    workspaceIndex.upsertOpenDocument({ uri: currentUri, source: currentSource });

    expect(
      computeDefinition(currentSource, positionOf(currentSource, 'Shared(child, parent)', 1), {
        targetUri: currentUri,
        workspaceIndex,
      }),
    ).toEqual([
      {
        targetUri: schemaUri,
        targetSelectionRange: predicateRange(schemaSource, 'Shared(child, parent)'),
      },
    ]);
  });

  it('returns null for builtins and unknown symbols', () => {
    const source = [
      'Parent(child, parent).',
      'Eligible(child, predicate, object) :- Edge(child, predicate, object), Missing(object).',
    ].join('\n');

    expect(
      computeDefinition(source, positionOf(source, 'Edge(child, predicate, object)', 0), {
        targetUri: 'file:///workspace/current.dl',
      }),
    ).toBeNull();
    expect(
      computeDefinition(source, positionOf(source, 'Missing(object)', 0), {
        targetUri: 'file:///workspace/current.dl',
      }),
    ).toBeNull();
    expect(
      computeDefinition(
        'Edge("node/a", "graph/missing", "node/b").',
        positionOf('Edge("node/a", "graph/missing", "node/b").', 'graph/missing'),
        {
          targetUri: 'file:///workspace/current.dl',
          workspaceIndex: new DatalogWorkspaceIndex({
            documentStore: new DatalogDocumentStore(),
          }),
        },
      ),
    ).toBeNull();
  });
});

function positionOf(
  source: string,
  snippet: string,
  occurrenceIndex = 0,
): { line: number; character: number } {
  const lines = source.split('\n');
  let matchesSeen = 0;

  for (const [lineNumber, line] of lines.entries()) {
    let startIndex = line.indexOf(snippet);

    while (startIndex >= 0) {
      if (matchesSeen === occurrenceIndex) {
        return {
          line: lineNumber,
          character: startIndex + 1,
        };
      }

      matchesSeen += 1;
      startIndex = line.indexOf(snippet, startIndex + 1);
    }
  }

  throw new Error(`Could not find snippet: ${snippet}`);
}

function predicateRange(source: string, predicateCall: string) {
  const lines = source.split('\n');

  for (const [lineNumber, line] of lines.entries()) {
    const startCharacter = line.indexOf(predicateCall);
    if (startCharacter >= 0) {
      return {
        start: {
          line: lineNumber,
          character: startCharacter,
        },
        end: {
          line: lineNumber,
          character: startCharacter + predicateCall.indexOf('('),
        },
      };
    }
  }

  throw new Error(`Could not find predicate call: ${predicateCall}`);
}

function stringValueRange(source: string, value: string) {
  const lines = source.split('\n');

  for (const [lineNumber, line] of lines.entries()) {
    const startCharacter = line.indexOf(value);
    if (startCharacter >= 0) {
      return {
        start: {
          line: lineNumber,
          character: startCharacter,
        },
        end: {
          line: lineNumber,
          character: startCharacter + value.length,
        },
      };
    }
  }

  throw new Error(`Could not find string value: ${value}`);
}

async function writeWorkspaceFile(
  workspaceRoot: string,
  relativePath: string,
  source: string,
): Promise<void> {
  const filePath = join(workspaceRoot, relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, source, 'utf8');
}
