import { applyDatalogFacts } from '@datalog/datalog-to-sql';
import { describe, expect, it } from 'vitest';

import {
  createOntologyLivePostgresProofFixture,
  executeOntologyGraphQuery,
} from './fixtures/ontology-live-postgres-proof-fixture.js';

describe('ontology live postgres e2e', () => {
  it('proves committed ontology migrations connect clinical concepts across vocabularies and user-tagged graph facts through localhost postgres', async () => {
    const fixture = await createOntologyLivePostgresProofFixture();

    try {
      await applyDatalogFacts({
        sql: fixture.sql,
        mode: 'insert-facts',
        facts: createSyntheticUserTagFacts(),
      });

      const medicationCrosswalkResult = await executeOntologyGraphQuery<{
        medication_label: string;
        rxnorm_label: string;
        umls_label: string;
        drugbank_label: string;
      }>(fixture.sql, createMedicationCrosswalkOperation());
      const conditionCrosswalkResult = await executeOntologyGraphQuery<{
        condition_label: string;
        snomed_label: string;
        umls_label: string;
      }>(fixture.sql, createConditionCrosswalkOperation());
      const drugClassResult = await executeOntologyGraphQuery<{
        medication_label: string;
        drug_class_label: string;
      }>(fixture.sql, createDrugClassOperation());
      const userTagConnectivityResult = await executeOntologyGraphQuery<{
        episode: string;
        medication: string;
        condition: string;
        medication_label: string;
        condition_label: string;
        drug_class_label: string;
      }>(fixture.sql, createUserTagConnectivityOperation());

      expect(fixture.committedFileNames).toEqual([
        '20260422.0001.ontology-foundation.dl',
        '20260422.0002.ontology-core-concepts.dl',
        '20260422.0003.ontology-clinical-relationships.dl',
        '20260422.0004.ontology-mappings-and-tags.dl',
      ]);
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

  it('proves broken cross-vocabulary state after load is observable through the same translated query flow', async () => {
    const fixture = await createOntologyLivePostgresProofFixture();

    try {
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

      const result = await executeOntologyGraphQuery<{
        medication_label: string;
        rxnorm_label: string;
        umls_label: string;
        drugbank_label: string;
      }>(fixture.sql, createMedicationCrosswalkOperation());

      expect(result).toHaveLength(0);
    } finally {
      await fixture.cleanup();
    }
  });
});

function createMedicationCrosswalkOperation() {
  return {
    kind: 'select-facts',
    match: [
      graphEdge(graphConstant('medication/metformin'), 'onto/preferred_label', graphVariable('medication_label')),
      graphEdge(graphConstant('medication/metformin'), 'med/has_mapping', graphConstant('mapping/rxnorm_6809')),
      graphEdge(graphConstant('mapping/rxnorm_6809'), 'onto/preferred_label', graphVariable('rxnorm_label')),
      graphEdge(graphConstant('medication/metformin'), 'med/has_mapping', graphConstant('mapping/umls_c0025598')),
      graphEdge(graphConstant('mapping/umls_c0025598'), 'onto/preferred_label', graphVariable('umls_label')),
      graphEdge(graphConstant('medication/metformin'), 'med/has_mapping', graphConstant('mapping/drugbank_db00331')),
      graphEdge(graphConstant('mapping/drugbank_db00331'), 'onto/preferred_label', graphVariable('drugbank_label')),
    ],
  } as const;
}

function createConditionCrosswalkOperation() {
  return {
    kind: 'select-facts',
    match: [
      graphEdge(graphConstant('condition/type_2_diabetes'), 'onto/preferred_label', graphVariable('condition_label')),
      graphEdge(graphConstant('condition/type_2_diabetes'), 'med/has_mapping', graphConstant('mapping/snomedct_44054006')),
      graphEdge(graphConstant('mapping/snomedct_44054006'), 'onto/preferred_label', graphVariable('snomed_label')),
      graphEdge(graphConstant('condition/type_2_diabetes'), 'med/has_mapping', graphConstant('mapping/umls_c0011860')),
      graphEdge(graphConstant('mapping/umls_c0011860'), 'onto/preferred_label', graphVariable('umls_label')),
    ],
  } as const;
}

function createDrugClassOperation() {
  return {
    kind: 'select-facts',
    match: [
      graphEdge(graphConstant('medication/apixaban'), 'onto/preferred_label', graphVariable('medication_label')),
      graphEdge(graphConstant('medication/apixaban'), 'med/has_drug_class', graphConstant('drug_class/factor_xa_inhibitor')),
      graphEdge(graphConstant('drug_class/factor_xa_inhibitor'), 'onto/preferred_label', graphVariable('drug_class_label')),
    ],
  } as const;
}

function createUserTagConnectivityOperation() {
  return {
    kind: 'select-facts',
    match: [
      graphEdge(graphConstant('tag/user-medication-lisinopril'), 'user', graphConstant('user/synthetic-demo')),
      graphEdge(graphConstant('tag/user-medication-lisinopril'), 'episode', graphVariable('episode')),
      graphEdge(graphConstant('tag/user-medication-lisinopril'), 'medication', graphVariable('medication')),
      graphEdge(graphConstant('tag/user-condition-hypertension'), 'user', graphConstant('user/synthetic-demo')),
      graphEdge(graphConstant('tag/user-condition-hypertension'), 'episode', graphVariable('episode')),
      graphEdge(graphConstant('tag/user-condition-hypertension'), 'condition', graphVariable('condition')),
      graphEdge(graphVariable('medication'), 'onto/preferred_label', graphVariable('medication_label')),
      graphEdge(graphVariable('medication'), 'med/has_drug_class', graphConstant('drug_class/ace_inhibitor')),
      graphEdge(graphConstant('drug_class/ace_inhibitor'), 'onto/preferred_label', graphVariable('drug_class_label')),
      graphEdge(graphVariable('condition'), 'onto/preferred_label', graphVariable('condition_label')),
      graphEdge(graphVariable('condition'), 'med/has_mapping', graphConstant('mapping/snomedct_38341003')),
      graphEdge(graphVariable('condition'), 'med/has_mapping', graphConstant('mapping/umls_c0020538')),
    ],
  } as const;
}

function createSyntheticUserTagFacts() {
  return [
    { kind: 'vertex', id: 'user/synthetic-demo' },
    { kind: 'vertex', id: 'episode/synthetic-hypertension-visit' },
    { kind: 'vertex', id: 'tag/user-medication-lisinopril' },
    { kind: 'vertex', id: 'tag/user-condition-hypertension' },
    { kind: 'vertex', id: 'status/active' },
    { kind: 'vertex', id: 'source/manual-review' },
    { kind: 'edge', subjectId: 'episode/synthetic-hypertension-visit', predicateId: 'onto/instance_of', objectId: 'class/EpisodeOfCare' },
    { kind: 'edge', subjectId: 'tag/user-medication-lisinopril', predicateId: 'onto/instance_of', objectId: 'class/UserMedicationTag' },
    { kind: 'edge', subjectId: 'tag/user-medication-lisinopril', predicateId: 'user', objectId: 'user/synthetic-demo' },
    { kind: 'edge', subjectId: 'tag/user-medication-lisinopril', predicateId: 'episode', objectId: 'episode/synthetic-hypertension-visit' },
    { kind: 'edge', subjectId: 'tag/user-medication-lisinopril', predicateId: 'medication', objectId: 'medication/lisinopril' },
    { kind: 'edge', subjectId: 'tag/user-medication-lisinopril', predicateId: 'status', objectId: 'status/active' },
    { kind: 'edge', subjectId: 'tag/user-medication-lisinopril', predicateId: 'source', objectId: 'source/manual-review' },
    { kind: 'edge', subjectId: 'tag/user-condition-hypertension', predicateId: 'onto/instance_of', objectId: 'class/UserConditionTag' },
    { kind: 'edge', subjectId: 'tag/user-condition-hypertension', predicateId: 'user', objectId: 'user/synthetic-demo' },
    { kind: 'edge', subjectId: 'tag/user-condition-hypertension', predicateId: 'episode', objectId: 'episode/synthetic-hypertension-visit' },
    { kind: 'edge', subjectId: 'tag/user-condition-hypertension', predicateId: 'condition', objectId: 'condition/hypertension' },
    { kind: 'edge', subjectId: 'tag/user-condition-hypertension', predicateId: 'status', objectId: 'status/active' },
    { kind: 'edge', subjectId: 'tag/user-condition-hypertension', predicateId: 'source', objectId: 'source/manual-review' },
  ] as const;
}

function graphConstant(value: string) {
  return { kind: 'constant', value } as const;
}

function graphVariable(name: string) {
  return { kind: 'variable', name } as const;
}

function graphEdge(
  subject: ReturnType<typeof graphConstant> | ReturnType<typeof graphVariable>,
  predicate: string,
  object: ReturnType<typeof graphConstant> | ReturnType<typeof graphVariable>,
) {
  return {
    kind: 'edge',
    subject,
    predicate: graphConstant(predicate),
    object,
  } as const;
}
