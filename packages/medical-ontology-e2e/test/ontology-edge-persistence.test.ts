import { describe, expect, it } from 'vitest';

import {
  loadCommittedOntologyFacts,
  type OntologyEdgeFact,
} from './fixtures/committed-ontology-facts-fixture.js';
import { createOntologyLivePostgresProofFixture } from './fixtures/ontology-live-postgres-proof-fixture.js';

describe('ontology edge persistence', () => {
  it('persists every ontology edge from committed migrations into the public.edges table', async () => {
    const fixture = await createOntologyLivePostgresProofFixture();

    try {
      const expectedFacts = loadCommittedOntologyFacts();
      const expectedEdges = expectedFacts.filter((fact): fact is OntologyEdgeFact => fact.kind === 'edge');

      const actualEdges = await fixture.sql<Array<{
        subject_id: string;
        predicate_id: string;
        object_id: string;
      }>>`
        select subject_id, predicate_id, object_id
        from public.edges
      `;
      const actualEdgeKeys = new Set(
        actualEdges.map((edge) => `${edge.subject_id}|${edge.predicate_id}|${edge.object_id}`),
      );

      for (const expectedEdge of expectedEdges) {
        const expectedEdgeKey = `${expectedEdge.subjectId}|${expectedEdge.predicateId}|${expectedEdge.objectId}`;
        expect(actualEdgeKeys.has(expectedEdgeKey), `Missing edge: ${expectedEdgeKey}`).toBe(true);
      }

      expect(actualEdges).toHaveLength(expectedEdges.length);
      expect(actualEdgeKeys.size).toBe(actualEdges.length);
    } finally {
      await fixture.cleanup();
    }
  });

  it('groups edges by predicate and verifies per-predicate counts', async () => {
    const fixture = await createOntologyLivePostgresProofFixture();

    try {
      const expectedFacts = loadCommittedOntologyFacts();
      const expectedEdges = expectedFacts.filter((fact): fact is OntologyEdgeFact => fact.kind === 'edge');
      const expectedByPredicate = new Map<string, number>();

      for (const edge of expectedEdges) {
        expectedByPredicate.set(edge.predicateId, (expectedByPredicate.get(edge.predicateId) ?? 0) + 1);
      }

      const actualCounts = await fixture.sql<Array<{ predicate_id: string; count: string }>>`
        select predicate_id, count(*)::text as count
        from public.edges
        group by predicate_id
        order by predicate_id
      `;
      const actualByPredicate = new Map(
        actualCounts.map((row) => [row.predicate_id, Number(row.count)]),
      );

      for (const [predicateId, expectedCount] of expectedByPredicate) {
        expect(actualByPredicate.get(predicateId) ?? 0, `Predicate ${predicateId} count mismatch`).toBe(expectedCount);
      }

      expect(actualByPredicate.size).toBe(expectedByPredicate.size);
    } finally {
      await fixture.cleanup();
    }
  });
});
