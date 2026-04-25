import { describe, expect, it } from 'vitest';

import { edgeFact, type EdgeFact } from '@datalog/ast';
import type { CompoundBacklinkExpander } from '@datalog/datalog-migrate';
import {
  applyDatalogMigrations,
  readAppliedMigrationStateFromDatabase,
  readMigrationStatus,
} from '@datalog/datalog-migrate';

import { createLocalhostPostgresFixture } from './fixtures/localhost-postgres-fixture.js';
import {
  createConditionCrosswalkOperation,
  createMedicationCrosswalkOperation,
  createVertexLookupByPreferredLabelOperation,
} from './fixtures/ontology-graph-query-fixture.js';
import { resolveMedicalOntologyWorkspacePath } from './fixtures/medical-ontology-workspace-path-support.js';
import { executeOntologyGraphQuery } from './fixtures/ontology-live-postgres-proof-fixture.js';

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
      return edgeFact({ subjectId, predicateId: 'med/has_mapping', objectId });
    }
  }

  if (clause.predicate === 'MedicationClassMembership') {
    const subjectId = fieldValues.get('clinical/medication');
    const objectId = fieldValues.get('clinical/drug_class');

    if (subjectId !== undefined && objectId !== undefined) {
      return edgeFact({ subjectId, predicateId: 'med/has_drug_class', objectId });
    }
  }

  return null;
};

describe('ontology migration workflow integration', () => {
  it('applies committed migrations through the public migration workflow and verifies graph-query semantics', async () => {
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
        expect.stringMatching(/^\d{8}\.0001\.ontology-foundation\.dl$/u),
        expect.stringMatching(/^\d{8}\.0002\.ontology-core-concepts\.dl$/u),
        expect.stringMatching(/^\d{8}\.0003\.ontology-clinical-relationships\.dl$/u),
        expect.stringMatching(/^\d{8}\.0004\.ontology-mappings-and-tags\.dl$/u),
      ]);

      const status = readMigrationStatus({
        workspaceRoot,
        appliedMigrationState: appliedState,
      });

      expect(status.statusCode).toBe('committed-applied');
      expect(status.committedMigrationCount).toBe(4);
      expect(status.canDeterminePendingCommittedMigrations).toBe(true);
      expect(status.pendingCommittedMigrations).toBe(false);

      const [vertexLookupResult, medicationCrosswalkResult, conditionCrosswalkResult] = await Promise.all([
        executeOntologyGraphQuery<{ id: string }>(
          fixture.sql,
          createVertexLookupByPreferredLabelOperation('Metformin'),
        ),
        executeOntologyGraphQuery<{
          medication_label: string;
          rxnorm_label: string;
          umls_label: string;
          drugbank_label: string;
        }>(fixture.sql, createMedicationCrosswalkOperation()),
        executeOntologyGraphQuery<{
          condition_label: string;
          snomed_label: string;
          umls_label: string;
        }>(fixture.sql, createConditionCrosswalkOperation()),
      ]);

      expect(vertexLookupResult).toEqual([{ id: 'medication/metformin' }]);
      expect(medicationCrosswalkResult).toEqual([
        {
          medication_label: 'Metformin',
          rxnorm_label: 'RxNorm 6809',
          umls_label: 'UMLS C0025598',
          drugbank_label: 'DrugBank DB00331',
        },
      ]);
      expect(conditionCrosswalkResult).toEqual([
        {
          condition_label: 'Type 2 Diabetes Mellitus',
          snomed_label: 'SNOMED CT 44054006',
          umls_label: 'UMLS C0011860',
        },
      ]);
    } finally {
      await fixture.cleanup();
    }
  }, 20_000);
});
