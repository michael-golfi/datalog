import { describe, expect, it } from 'vitest';

import {
  loadCommittedOntologyFacts,
  type OntologyVertexFact,
} from './fixtures/committed-ontology-facts-fixture.js';
import { createOntologyLivePostgresProofFixture } from './fixtures/ontology-live-postgres-proof-fixture.js';

describe('ontology vertex persistence', () => {
  it('persists every ontology vertex from committed migrations into the public.vertices table', async () => {
    const fixture = await createOntologyLivePostgresProofFixture();

    try {
      const expectedFacts = loadCommittedOntologyFacts();
      const expectedVertices = expectedFacts.filter((fact): fact is OntologyVertexFact => fact.kind === 'vertex');
      const expectedVertexIds = new Set(expectedVertices.map((vertex) => vertex.id));

      const actualVertices = await fixture.sql<Array<{ id: string }>>`
        select id
        from public.vertices
      `;
      const actualVertexIds = new Set(actualVertices.map((vertex) => vertex.id));

      for (const expectedVertexId of expectedVertexIds) {
        expect(actualVertexIds.has(expectedVertexId), `Missing vertex: ${expectedVertexId}`).toBe(true);
      }

      expect(actualVertices).toHaveLength(expectedVertexIds.size);
      expect(actualVertexIds.size).toBe(actualVertices.length);
    } finally {
      await fixture.cleanup();
    }
  });
});
