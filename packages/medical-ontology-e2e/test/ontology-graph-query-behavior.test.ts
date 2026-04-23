import { applyDatalogFacts } from '@datalog/datalog-to-sql';
import { describe, expect, it } from 'vitest';

import {
  createConditionCrosswalkOperation,
  createDrugClassOperation,
  createMedicationCrosswalkOperation,
  createPreferredLabelOperation,
  createSyntheticUserTagFacts,
  createUserTagConnectivityOperation,
  createVertexByIdOperation,
} from './fixtures/ontology-graph-query-fixture.js';
import {
  createOntologyLivePostgresProofFixture,
  executeOntologyGraphQuery,
} from './fixtures/ontology-live-postgres-proof-fixture.js';

describe('ontology graph query behavior', () => {
  it('applies the canonical ontology once and verifies core ontology semantics through translated graph queries', async () => {
    const fixture = await createOntologyLivePostgresProofFixture();

    try {
      await applyDatalogFacts({
        sql: fixture.sql,
        mode: 'insert-facts',
        facts: createSyntheticUserTagFacts(),
      });

      const [vertexLookupResult, preferredLabelResult, medicationCrosswalkResult, conditionCrosswalkResult, drugClassResult, userTagConnectivityResult] = await Promise.all([
        executeOntologyGraphQuery<{ id: string }>(fixture.sql, createVertexByIdOperation('medication/metformin')),
        executeOntologyGraphQuery<{ label: string }>(fixture.sql, createPreferredLabelOperation('condition/type_2_diabetes')),
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
        executeOntologyGraphQuery<{
          medication_label: string;
          drug_class_label: string;
        }>(fixture.sql, createDrugClassOperation()),
        executeOntologyGraphQuery<{
          episode: string;
          medication: string;
          condition: string;
          medication_label: string;
          condition_label: string;
          drug_class_label: string;
        }>(fixture.sql, createUserTagConnectivityOperation()),
      ]);

      expect(fixture.committedFileNames).toEqual([
        expect.stringMatching(/^\d{8}\.0001\.ontology-foundation\.dl$/u),
        expect.stringMatching(/^\d{8}\.0002\.ontology-core-concepts\.dl$/u),
        expect.stringMatching(/^\d{8}\.0003\.ontology-clinical-relationships\.dl$/u),
        expect.stringMatching(/^\d{8}\.0004\.ontology-mappings-and-tags\.dl$/u),
      ]);
      expect(vertexLookupResult).toEqual([{ id: 'medication/metformin' }]);
      expect(preferredLabelResult).toEqual([{ label: 'Type 2 Diabetes Mellitus' }]);
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
      expect(drugClassResult).toEqual([
        {
          medication_label: 'Apixaban',
          drug_class_label: 'Factor Xa Inhibitor',
        },
      ]);
      expect(userTagConnectivityResult).toEqual([
        {
          episode: 'episode/synthetic-hypertension-visit',
          medication: 'medication/lisinopril',
          condition: 'condition/hypertension',
          medication_label: 'Lisinopril',
          condition_label: 'Hypertension',
          drug_class_label: 'ACE Inhibitor',
        },
      ]);
    } finally {
      await fixture.cleanup();
    }
  });

  it('observes ontology regressions through the same graph query client path after deleting canonical facts', async () => {
    const fixture = await createOntologyLivePostgresProofFixture();

    try {
      const beforeDelete = await executeOntologyGraphQuery<{
        medication_label: string;
        rxnorm_label: string;
        umls_label: string;
        drugbank_label: string;
      }>(fixture.sql, createMedicationCrosswalkOperation());

      expect(beforeDelete).toEqual([
        {
          medication_label: 'Metformin',
          rxnorm_label: 'RxNorm 6809',
          umls_label: 'UMLS C0025598',
          drugbank_label: 'DrugBank DB00331',
        },
      ]);

      await applyDatalogFacts({
        sql: fixture.sql,
        mode: 'delete-facts',
        facts: [{
          kind: 'edge',
          subjectId: 'medication/metformin',
          predicateId: 'med/has_mapping',
          objectId: 'mapping/rxnorm_6809',
        }],
      });

      const afterDelete = await executeOntologyGraphQuery<{
        medication_label: string;
        rxnorm_label: string;
        umls_label: string;
        drugbank_label: string;
      }>(fixture.sql, createMedicationCrosswalkOperation());
      const survivingPreferredLabel = await executeOntologyGraphQuery<{ label: string }>(
        fixture.sql,
        createPreferredLabelOperation('medication/metformin'),
      );

      expect(afterDelete).toEqual([]);
      expect(survivingPreferredLabel).toEqual([{ label: 'Metformin' }]);
    } finally {
      await fixture.cleanup();
    }
  });
});
