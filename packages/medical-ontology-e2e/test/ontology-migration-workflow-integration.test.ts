import { describe, expect, it } from 'vitest';

import type { CompoundBacklinkExpander } from '@datalog/datalog-migrate';
import {
  applyDatalogMigrations,
  readAppliedMigrationStateFromDatabase,
  readMigrationStatus,
} from '@datalog/datalog-migrate';
import type { EdgeFact } from '@datalog/datalog-to-sql';

import { createLocalhostPostgresFixture } from './fixtures/localhost-postgres-fixture.js';
import { resolveMedicalOntologyWorkspacePath } from './fixtures/medical-ontology-workspace-path-support.js';
import { loadCommittedOntologyFacts } from './fixtures/committed-ontology-facts-fixture.js';

const ontologyCompoundBacklinkExpander: CompoundBacklinkExpander = (clause): EdgeFact | null => {
  const fieldValues = new Map<string, string>();

  for (const [index, field] of clause.compoundFields.entries()) {
    const reference = clause.references[index];

    if (reference !== undefined) {
      fieldValues.set(field, reference.value);
    }
  }

  if (clause.predicate === 'ExternalMapping') {
    const subjectId = fieldValues.get('mapping/concept');
    const objectId = fieldValues.get('cid');

    if (subjectId !== undefined && objectId !== undefined) {
      return { kind: 'edge', subjectId, predicateId: 'med/has_mapping', objectId };
    }
  }

  if (clause.predicate === 'MedicationClassMembership') {
    const subjectId = fieldValues.get('clinical/medication');
    const objectId = fieldValues.get('clinical/drug_class');

    if (subjectId !== undefined && objectId !== undefined) {
      return { kind: 'edge', subjectId, predicateId: 'med/has_drug_class', objectId };
    }
  }

  return null;
};

describe('ontology migration workflow integration', () => {
  it('applies committed migrations through the public migration workflow and verifies graph persistence', async () => {
    const fixture = await createLocalhostPostgresFixture();
    const workspaceRoot = resolveMedicalOntologyWorkspacePath();

    try {
      const result = await applyDatalogMigrations({
        workspaceRoot,
        connectionString: fixture.connectionString,
        compoundBacklinkExpander: ontologyCompoundBacklinkExpander,
      });

      expect(result.appliedMigrationCount).toBe(4);
      expect(result.appliedFactCount).toBeGreaterThan(0);

      const appliedState = await readAppliedMigrationStateFromDatabase({
        connectionString: fixture.connectionString,
      });

      expect(appliedState.appliedMigrationFileNames).toEqual([
        '20260422.0001.ontology-foundation.dl',
        '20260422.0002.ontology-core-concepts.dl',
        '20260422.0003.ontology-clinical-relationships.dl',
        '20260422.0004.ontology-mappings-and-tags.dl',
      ]);

      const status = readMigrationStatus({
        workspaceRoot,
        appliedMigrationState: appliedState,
      });

      expect(status.statusCode).toBe('committed-applied');
      expect(status.committedMigrationCount).toBe(4);
      expect(status.canDeterminePendingCommittedMigrations).toBe(true);
      expect(status.pendingCommittedMigrations).toBe(false);

      const vertexCount = await fixture.sql<Array<{ count: string }>>`select count(*)::text as count from vertices`;
      const edgeCount = await fixture.sql<Array<{ count: string }>>`select count(*)::text as count from edges`;

      expect(Number.parseInt(vertexCount[0]?.count ?? '0', 10)).toBeGreaterThan(0);
      expect(Number.parseInt(edgeCount[0]?.count ?? '0', 10)).toBeGreaterThan(0);

      const mappingEdge = await fixture.sql<Array<{ subject_id: string; predicate_id: string; object_id: string }>>`
        select subject_id, predicate_id, object_id from edges
        where predicate_id = 'med/has_mapping'
        limit 1
      `;
      expect(mappingEdge.length).toBeGreaterThan(0);

      const fixtureFacts = loadCommittedOntologyFacts({ workspaceRoot });
      const fixtureVertexCount = fixtureFacts.filter((fact) => fact.kind === 'vertex').length;
      const fixtureEdgeCount = fixtureFacts.filter((fact) => fact.kind === 'edge').length;

      expect(Number.parseInt(vertexCount[0]?.count ?? '0', 10)).toBe(fixtureVertexCount);
      expect(Number.parseInt(edgeCount[0]?.count ?? '0', 10)).toBe(fixtureEdgeCount);
    } finally {
      await fixture.cleanup();
    }
  }, 20_000);
});
