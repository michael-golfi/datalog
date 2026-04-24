import {
  sortEvidenceRecords,
  type GraphRagEvidence,
} from './ontology-graph-rag-evidence-fixture.js';

export interface PregnancyLisinoprilRow {
  [key: string]: unknown;
  readonly medication_id: string;
  readonly indication_condition_id: string;
  readonly indication_label: string;
  readonly medication_label: string;
  readonly hypertension_label: string;
  readonly pregnancy_id: string;
  readonly contraindication_label: string;
  readonly pregnancy_label: string;
  readonly drug_class_label: string;
  readonly lisinopril_mapping: string;
  readonly mapping_label: string;
  readonly hypertension_mapping: string;
  readonly hypertension_mapping_label: string;
  readonly pregnancy_mapping: string;
  readonly pregnancy_mapping_label: string;
}

export interface CkdHeartFailureIbuprofenRow {
  [key: string]: unknown;
  readonly ckd_id: string;
  readonly ckd_contraindication_label: string;
  readonly hf_id: string;
  readonly hf_contraindication_label: string;
  readonly comorbidity_label: string;
  readonly ibuprofen_label: string;
  readonly ckd_label: string;
  readonly hf_label: string;
  readonly drug_class_label: string;
  readonly ibuprofen_mapping: string;
  readonly ibuprofen_mapping_label: string;
  readonly ckd_mapping: string;
  readonly ckd_mapping_label: string;
  readonly hf_mapping: string;
  readonly hf_mapping_label: string;
}

export interface AtrialFibrillationAlternativesRow {
  [key: string]: unknown;
  readonly warfarin_id: string;
  readonly af_id: string;
  readonly warfarin_indication_label: string;
  readonly apixaban_id: string;
  readonly apixaban_indication_label: string;
  readonly warfarin_label: string;
  readonly apixaban_label: string;
  readonly af_label: string;
  readonly vka_label: string;
  readonly fxa_label: string;
  readonly warfarin_mapping: string;
  readonly warfarin_mapping_label: string;
  readonly apixaban_mapping: string;
  readonly apixaban_mapping_label: string;
  readonly af_mapping: string;
  readonly af_mapping_label: string;
}

export interface NormalizedScenarioEvidence {
  readonly scenarioId: string;
  readonly evidence: readonly GraphRagEvidence[];
  readonly retrievedEvidenceIds: ReadonlySet<string>;
}

export function normalizePregnancyLisinoprilEvidence(
  rows: readonly PregnancyLisinoprilRow[],
): NormalizedScenarioEvidence {
  const evidenceMap = new Map<string, GraphRagEvidence>();
  const firstRow = rows[0];

  if (firstRow !== undefined) {
    addToEvidenceMap(evidenceMap, {
      evidenceId: 'indication/lisinopril/hypertension',
      evidenceType: 'indication',
      subjectId: firstRow.medication_id,
      predicateId: 'clinical/indication',
      objectId: firstRow.indication_condition_id,
      subjectLabel: firstRow.medication_label,
      objectLabel: firstRow.hypertension_label,
      relationshipKind: 'indication',
    });
    addToEvidenceMap(evidenceMap, {
      evidenceId: 'contraindication/lisinopril/pregnancy',
      evidenceType: 'contraindication',
      subjectId: firstRow.medication_id,
      predicateId: 'clinical/contraindication',
      objectId: firstRow.pregnancy_id,
      subjectLabel: firstRow.medication_label,
      objectLabel: firstRow.pregnancy_label,
      relationshipKind: 'contraindication',
    });
    addToEvidenceMap(evidenceMap, {
      evidenceId: 'membership/lisinopril/ace_inhibitor',
      evidenceType: 'drug_class',
      subjectId: firstRow.medication_id,
      predicateId: 'med/has_drug_class',
      objectId: 'drug_class/ace_inhibitor',
      subjectLabel: firstRow.medication_label,
      objectLabel: firstRow.drug_class_label,
      relationshipKind: 'class_membership',
    });
  }

  for (const row of rows) {
    addMappingEvidence(evidenceMap, {
      evidenceId: row.lisinopril_mapping,
      subjectId: row.medication_id,
      objectLabel: row.mapping_label,
    });
    addMappingEvidence(evidenceMap, {
      evidenceId: row.hypertension_mapping,
      subjectId: row.indication_condition_id,
      objectLabel: row.hypertension_mapping_label,
    });
    addMappingEvidence(evidenceMap, {
      evidenceId: row.pregnancy_mapping,
      subjectId: row.pregnancy_id,
      objectLabel: row.pregnancy_mapping_label,
    });
  }

  return createNormalizedScenarioEvidence('pregnancy-lisinopril-hypertension', evidenceMap);
}

export function normalizeCkdHeartFailureIbuprofenEvidence(
  rows: readonly CkdHeartFailureIbuprofenRow[],
): NormalizedScenarioEvidence {
  const evidenceMap = new Map<string, GraphRagEvidence>();
  const firstRow = rows[0];

  if (firstRow !== undefined) {
    addToEvidenceMap(evidenceMap, {
      evidenceId: 'contraindication/ibuprofen/chronic_kidney_disease',
      evidenceType: 'contraindication',
      subjectId: 'medication/ibuprofen',
      predicateId: 'clinical/contraindication',
      objectId: firstRow.ckd_id,
      subjectLabel: firstRow.ibuprofen_label,
      objectLabel: firstRow.ckd_label,
      relationshipKind: 'contraindication',
    });
    addToEvidenceMap(evidenceMap, {
      evidenceId: 'contraindication/ibuprofen/heart_failure',
      evidenceType: 'contraindication',
      subjectId: 'medication/ibuprofen',
      predicateId: 'clinical/contraindication',
      objectId: firstRow.hf_id,
      subjectLabel: firstRow.ibuprofen_label,
      objectLabel: firstRow.hf_label,
      relationshipKind: 'contraindication',
    });
    addToEvidenceMap(evidenceMap, {
      evidenceId: 'comorbidity/chronic_kidney_disease/heart_failure',
      evidenceType: 'comorbidity',
      subjectId: firstRow.ckd_id,
      predicateId: 'clinical/comorbid_with',
      objectId: firstRow.hf_id,
      subjectLabel: firstRow.ckd_label,
      objectLabel: firstRow.hf_label,
      relationshipKind: 'comorbid_with',
    });
    addToEvidenceMap(evidenceMap, {
      evidenceId: 'membership/ibuprofen/nsaid',
      evidenceType: 'drug_class',
      subjectId: 'medication/ibuprofen',
      predicateId: 'med/has_drug_class',
      objectId: 'drug_class/nsaid',
      subjectLabel: firstRow.ibuprofen_label,
      objectLabel: firstRow.drug_class_label,
      relationshipKind: 'class_membership',
    });
  }

  for (const row of rows) {
    addMappingEvidence(evidenceMap, {
      evidenceId: row.ibuprofen_mapping,
      subjectId: 'medication/ibuprofen',
      objectLabel: row.ibuprofen_mapping_label,
    });
    addMappingEvidence(evidenceMap, {
      evidenceId: row.ckd_mapping,
      subjectId: row.ckd_id,
      objectLabel: row.ckd_mapping_label,
    });
    addMappingEvidence(evidenceMap, {
      evidenceId: row.hf_mapping,
      subjectId: row.hf_id,
      objectLabel: row.hf_mapping_label,
    });
  }

  return createNormalizedScenarioEvidence('ckd-heart-failure-ibuprofen', evidenceMap);
}

export function normalizeAtrialFibrillationAlternativesEvidence(
  rows: readonly AtrialFibrillationAlternativesRow[],
): NormalizedScenarioEvidence {
  const evidenceMap = new Map<string, GraphRagEvidence>();
  const firstRow = rows[0];

  if (firstRow !== undefined) {
    addToEvidenceMap(evidenceMap, {
      evidenceId: 'indication/warfarin/atrial_fibrillation',
      evidenceType: 'indication',
      subjectId: firstRow.warfarin_id,
      predicateId: 'clinical/indication',
      objectId: firstRow.af_id,
      subjectLabel: firstRow.warfarin_label,
      objectLabel: firstRow.af_label,
      relationshipKind: 'indication',
    });
    addToEvidenceMap(evidenceMap, {
      evidenceId: 'indication/apixaban/atrial_fibrillation',
      evidenceType: 'indication',
      subjectId: firstRow.apixaban_id,
      predicateId: 'clinical/indication',
      objectId: firstRow.af_id,
      subjectLabel: firstRow.apixaban_label,
      objectLabel: firstRow.af_label,
      relationshipKind: 'indication',
    });
    addToEvidenceMap(evidenceMap, {
      evidenceId: 'membership/warfarin/vitamin_k_antagonist',
      evidenceType: 'drug_class',
      subjectId: firstRow.warfarin_id,
      predicateId: 'med/has_drug_class',
      objectId: 'drug_class/vitamin_k_antagonist',
      subjectLabel: firstRow.warfarin_label,
      objectLabel: firstRow.vka_label,
      relationshipKind: 'class_membership',
    });
    addToEvidenceMap(evidenceMap, {
      evidenceId: 'membership/apixaban/factor_xa_inhibitor',
      evidenceType: 'drug_class',
      subjectId: firstRow.apixaban_id,
      predicateId: 'med/has_drug_class',
      objectId: 'drug_class/factor_xa_inhibitor',
      subjectLabel: firstRow.apixaban_label,
      objectLabel: firstRow.fxa_label,
      relationshipKind: 'class_membership',
    });
  }

  for (const row of rows) {
    addMappingEvidence(evidenceMap, {
      evidenceId: row.warfarin_mapping,
      subjectId: row.warfarin_id,
      objectLabel: row.warfarin_mapping_label,
    });
    addMappingEvidence(evidenceMap, {
      evidenceId: row.apixaban_mapping,
      subjectId: row.apixaban_id,
      objectLabel: row.apixaban_mapping_label,
    });
    addMappingEvidence(evidenceMap, {
      evidenceId: row.af_mapping,
      subjectId: row.af_id,
      objectLabel: row.af_mapping_label,
    });
  }

  return createNormalizedScenarioEvidence(
    'atrial-fibrillation-anticoagulant-alternatives',
    evidenceMap,
  );
}

interface MappingEvidenceInput {
  readonly evidenceId: string;
  readonly subjectId: string;
  readonly objectLabel: string;
}

function addMappingEvidence(
  map: Map<string, GraphRagEvidence>,
  input: MappingEvidenceInput,
): void {
  addToEvidenceMap(map, {
    evidenceId: input.evidenceId,
    evidenceType: 'mapping',
    subjectId: input.subjectId,
    predicateId: 'med/has_mapping',
    objectId: input.evidenceId,
    objectLabel: input.objectLabel,
  });
}

function createNormalizedScenarioEvidence(
  scenarioId: string,
  evidenceMap: Map<string, GraphRagEvidence>,
): NormalizedScenarioEvidence {
  const evidence = sortEvidenceRecords([...evidenceMap.values()]);
  return {
    scenarioId,
    evidence,
    retrievedEvidenceIds: new Set(evidence.map((record) => record.evidenceId)),
  };
}

function addToEvidenceMap(
  map: Map<string, GraphRagEvidence>,
  record: GraphRagEvidence,
): void {
  map.set(record.evidenceId, record);
}
