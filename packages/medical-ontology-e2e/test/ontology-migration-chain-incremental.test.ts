import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DatalogFact } from '@datalog/ast';
import { applyDatalogFacts } from '@datalog/datalog-to-sql';
import {
  loadDatalogMigrationProjectFiles,
  type CommittedDatalogMigrationFile,
} from '@datalog/datalog-migrate';
import { describe, expect, it } from 'vitest';

import { loadCommittedOntologyFacts } from './fixtures/committed-ontology-facts-fixture.js';
import { createLocalhostPostgresFixture } from './fixtures/localhost-postgres-fixture.js';
import {
  extractOntologyFactsFromSource,
  type OntologyEdgeFact,
  type OntologyFact,
} from './fixtures/ontology-migration-fact-extraction-fixture.js';

const e2eWorkspaceRoot = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

describe('ontology migration chain incremental delta', () => {
  it('proves each migration step adds the expected vertex and edge delta', async () => {
    const committedMigrations = loadDatalogMigrationProjectFiles({
      workspaceRoot: e2eWorkspaceRoot,
    }).committedMigrations;
    const finalCommittedFacts = loadCommittedOntologyFacts({ workspaceRoot: e2eWorkspaceRoot });
    const finalCommittedEdgeFacts = finalCommittedFacts.filter(
      (fact): fact is OntologyEdgeFact => fact.kind === 'edge',
    );
    const snapshots: Snapshot[] = [];
    const seenVertexIds = new Set<string>();
    const seenEdgeKeys = new Set<string>();
    const fixture = await createLocalhostPostgresFixture();

    expect(committedMigrations).toHaveLength(4);

    try {
      for (const migration of committedMigrations) {
        const migrationFacts = extractFactsFromMigration(migration);
        await applyDatalogFacts({
          sql: fixture.sql,
          mode: 'insert-facts',
          facts: migrationFacts,
        });

        const expectedDelta = countIncrementalDelta({
          facts: migrationFacts,
          seenVertexIds,
          seenEdgeKeys,
        });
        const counts = await readGraphCounts(fixture.sql);

        snapshots.push({
          migrationFileName: migration.fileName,
          vertexCount: counts.vertexCount,
          edgeCount: counts.edgeCount,
          vertexDelta: expectedDelta.vertexDelta,
          edgeDelta: expectedDelta.edgeDelta,
        });

        expect(counts.vertexCount).toBe(seenVertexIds.size);
        expect(counts.edgeCount).toBe(seenEdgeKeys.size);
        expect(expectedDelta.vertexDelta).toBeGreaterThan(0);
        expect(expectedDelta.edgeDelta).toBeGreaterThan(0);
      }
    } finally {
      await fixture.cleanup();
    }

    expect(snapshots).toHaveLength(4);

    const parsedMigrationFileNames = snapshots.map((snapshot) => parseCommittedMigrationFileName(snapshot.migrationFileName));
    const expectedSequences = ['0001', '0002', '0003', '0004'] as const;
    const expectedSlugs = [
      'ontology-foundation',
      'ontology-core-concepts',
      'ontology-clinical-relationships',
      'ontology-mappings-and-tags',
    ] as const;

    expect(parsedMigrationFileNames.map((snapshot) => snapshot.sequence)).toEqual(expectedSequences);
    expect(parsedMigrationFileNames.map((snapshot) => snapshot.slug)).toEqual(expectedSlugs);

    const migrationDatePrefix = parsedMigrationFileNames[0]?.datePrefix;

    expect(migrationDatePrefix).toMatch(/^\d{8}$/u);
    expect(parsedMigrationFileNames.map((snapshot) => snapshot.datePrefix)).toEqual([
      migrationDatePrefix,
      migrationDatePrefix,
      migrationDatePrefix,
      migrationDatePrefix,
    ]);

    expect(snapshots[0]?.vertexCount).toBeGreaterThan(20);
    expect(snapshots[0]?.edgeCount).toBeGreaterThan(30);

    for (let index = 1; index < snapshots.length; index += 1) {
      const previousSnapshot = snapshots[index - 1];
      const snapshot = snapshots[index];

      expect(snapshot?.vertexCount).toBeGreaterThan(previousSnapshot?.vertexCount ?? 0);
      expect(snapshot?.edgeCount).toBeGreaterThan(previousSnapshot?.edgeCount ?? 0);
    }

    expect(snapshots.at(-1)?.vertexCount).toBe(countOntologyVertices(finalCommittedFacts));
    expect(snapshots.at(-1)?.edgeCount).toBe(finalCommittedEdgeFacts.length);
  });
});

interface Snapshot {
  readonly migrationFileName: string;
  readonly vertexCount: number;
  readonly edgeCount: number;
  readonly vertexDelta: number;
  readonly edgeDelta: number;
}

function extractFactsFromMigration(
  migration: CommittedDatalogMigrationFile,
): readonly [DatalogFact, ...DatalogFact[]] {
  const facts = extractOntologyFactsFromSource(migration.body).facts;

  if (facts.length === 0) {
    const migrationFileName = String(migration.fileName);

    throw new Error(`Expected migration ${migrationFileName} to contain ontology facts.`);
  }

  return facts as [DatalogFact, ...DatalogFact[]];
}

function countIncrementalDelta(input: {
  readonly facts: readonly DatalogFact[];
  readonly seenVertexIds: Set<string>;
  readonly seenEdgeKeys: Set<string>;
}): { vertexDelta: number; edgeDelta: number } {
  let vertexDelta = 0;
  let edgeDelta = 0;

  for (const fact of input.facts) {
    if (fact.kind === 'vertex') {
      if (!input.seenVertexIds.has(fact.id)) {
        input.seenVertexIds.add(fact.id);
        vertexDelta += 1;
      }

      continue;
    }

    const edgeKey = createEdgeKey(fact);

    if (!input.seenEdgeKeys.has(edgeKey)) {
      input.seenEdgeKeys.add(edgeKey);
      edgeDelta += 1;
    }
  }

  return { vertexDelta, edgeDelta };
}

function parseCommittedMigrationFileName(fileName: string): {
  readonly datePrefix: string;
  readonly sequence: string;
  readonly slug: string;
} {
  const match = /^(?<datePrefix>\d{8})\.(?<sequence>\d{4})\.(?<slug>.+)\.dl$/u.exec(fileName);

  if (match?.groups === undefined) {
    throw new Error(`Unexpected committed migration file name: ${fileName}`);
  }

  const groups = match.groups as {
    readonly datePrefix: string;
    readonly sequence: string;
    readonly slug: string;
  };

  return {
    datePrefix: groups.datePrefix,
    sequence: groups.sequence,
    slug: groups.slug,
  };
}

async function readGraphCounts(sql: Awaited<ReturnType<typeof createLocalhostPostgresFixture>>['sql']): Promise<{
  vertexCount: number;
  edgeCount: number;
}> {
  const [vertexResult] = await sql<Array<{ count: string }>>`SELECT COUNT(*)::text AS count FROM public.vertices`;
  const [edgeResult] = await sql<Array<{ count: string }>>`SELECT COUNT(*)::text AS count FROM public.edges`;

  return {
    vertexCount: Number(vertexResult?.count ?? '0'),
    edgeCount: Number(edgeResult?.count ?? '0'),
  };
}

function countOntologyVertices(facts: readonly OntologyFact[]): number {
  return facts.filter((fact) => fact.kind === 'vertex').length;
}

function createEdgeKey(fact: OntologyEdgeFact): string {
  return `${fact.subjectId}\u0000${fact.predicateId}\u0000${fact.objectId}`;
}
