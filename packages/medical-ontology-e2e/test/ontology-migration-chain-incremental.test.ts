import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyDatalogFacts,
  type DatalogFact,
  type EdgeFact,
  type VertexFact,
} from '@datalog/datalog-to-sql';
import {
  loadDatalogMigrationProjectFiles,
  type CommittedDatalogMigrationFile,
} from '@datalog/datalog-migrate';
import { parseDocument } from '@datalog/parser';
import { describe, expect, it } from 'vitest';

import { loadCommittedOntologyFacts, type OntologyEdgeFact, type OntologyFact } from './fixtures/committed-ontology-facts-fixture.js';
import { createLocalhostPostgresFixture } from './fixtures/localhost-postgres-fixture.js';

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
    expect(snapshots.map((snapshot) => snapshot.migrationFileName)).toEqual([
      '20260422.0001.ontology-foundation.dl',
      '20260422.0002.ontology-core-concepts.dl',
      '20260422.0003.ontology-clinical-relationships.dl',
      '20260422.0004.ontology-mappings-and-tags.dl',
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
  const vertexIds = new Set<string>();
  const edgeFacts: EdgeFact[] = [];
  const parsed = parseDocument(migration.body);

  for (const clause of parsed.clauses) {
    if (clause.predicate === 'DefCompound' || clause.predicate === 'DefPred' || clause.isRule) {
      continue;
    }

    if (clause.isCompound) {
      const backlink = createCompoundBacklink(clause);

      if (backlink !== undefined) {
        vertexIds.add(backlink.subjectId);
        vertexIds.add(backlink.objectId);
        edgeFacts.push(backlink);
      }

      continue;
    }

    const edgeFact = parseEdgeFact(clause);
    vertexIds.add(edgeFact.subjectId);
    vertexIds.add(edgeFact.objectId);
    edgeFacts.push(edgeFact);
  }

  const vertexFacts: VertexFact[] = [...vertexIds].map((id) => ({ kind: 'vertex', id }));
  const facts = [...vertexFacts, ...edgeFacts];

  if (facts.length === 0) {
    throw new Error(`Expected migration ${migration.fileName} to contain ontology facts.`);
  }

  return facts as [DatalogFact, ...DatalogFact[]];
}

function createCompoundBacklink(
  clause: ReturnType<typeof parseDocument>['clauses'][number],
): EdgeFact | undefined {
  const compoundFieldValues = new Map<string, string>();

  for (const [index, field] of clause.compoundFields.entries()) {
    const reference = clause.references[index];

    if (reference !== undefined) {
      compoundFieldValues.set(field, reference.value);
    }
  }

  if (clause.predicate === 'ExternalMapping') {
    return createBacklinkEdge({
      subjectId: compoundFieldValues.get('mapping/concept'),
      predicateId: 'med/has_mapping',
      objectId: compoundFieldValues.get('cid'),
    });
  }

  if (clause.predicate === 'MedicationClassMembership') {
    return createBacklinkEdge({
      subjectId: compoundFieldValues.get('clinical/medication'),
      predicateId: 'med/has_drug_class',
      objectId: compoundFieldValues.get('clinical/drug_class'),
    });
  }

  return undefined;
}

function createBacklinkEdge(input: {
  readonly subjectId: string | undefined;
  readonly predicateId: string;
  readonly objectId: string | undefined;
}): OntologyEdgeFact {
  const { subjectId, predicateId, objectId } = input;

  if (subjectId === undefined || objectId === undefined) {
    throw new Error('Committed ontology compound declarations must provide all required backlink fields.');
  }

  return {
    kind: 'edge',
    subjectId,
    predicateId,
    objectId,
  };
}

function parseEdgeFact(
  clause: ReturnType<typeof parseDocument>['clauses'][number],
): EdgeFact {
  if (clause.predicate !== 'Edge') {
    throw new Error('Committed ontology migrations must only contain Edge facts outside compound declarations.');
  }

  const [subject, predicate, object] = clause.references;

  if (!subject || !predicate || !object || clause.references.length !== 3) {
    throw new Error('Committed ontology Edge facts must use quoted Edge(subject, predicate, object) clauses.');
  }

  return {
    kind: 'edge',
    subjectId: subject.value,
    predicateId: predicate.value,
    objectId: object.value,
  };
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
