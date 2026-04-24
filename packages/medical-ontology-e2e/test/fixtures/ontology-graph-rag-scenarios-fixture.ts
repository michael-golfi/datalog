export interface GraphRagScenario {
  readonly scenarioId: string;
  readonly question: string;
  readonly requiredEvidenceIds: readonly string[];
  readonly requiredEntityIds: readonly string[];
}

export const pregnancyLisinoprilHypertensionScenario: GraphRagScenario = {
  scenarioId: 'pregnancy-lisinopril-hypertension',
  question: 'For a pregnant patient taking lisinopril for hypertension, what evidence supports the indication and what risk should be reviewed?',
  requiredEvidenceIds: [
    'indication/lisinopril/hypertension',
    'contraindication/lisinopril/pregnancy',
    'membership/lisinopril/ace_inhibitor',
    'mapping/rxnorm_29046',
    'mapping/umls_c0065374',
    'mapping/snomedct_38341003',
    'mapping/snomedct_77386006',
  ],
  requiredEntityIds: [
    'medication/lisinopril',
    'condition/hypertension',
    'condition/pregnancy',
    'drug_class/ace_inhibitor',
  ],
};

export const ckdHeartFailureIbuprofenScenario: GraphRagScenario = {
  scenarioId: 'ckd-heart-failure-ibuprofen',
  question: 'For a patient with chronic kidney disease and heart failure, what connected ontology evidence makes ibuprofen a review risk?',
  requiredEvidenceIds: [
    'contraindication/ibuprofen/chronic_kidney_disease',
    'contraindication/ibuprofen/heart_failure',
    'comorbidity/chronic_kidney_disease/heart_failure',
    'membership/ibuprofen/nsaid',
    'mapping/rxnorm_5640',
    'mapping/snomedct_709044004',
    'mapping/snomedct_84114007',
  ],
  requiredEntityIds: [
    'medication/ibuprofen',
    'condition/chronic_kidney_disease',
    'condition/heart_failure',
    'drug_class/nsaid',
  ],
};

export const atrialFibrillationAlternativesScenario: GraphRagScenario = {
  scenarioId: 'atrial-fibrillation-anticoagulant-alternatives',
  question: 'Which anticoagulants are indicated for atrial fibrillation, and what classes and mappings support them?',
  requiredEvidenceIds: [
    'indication/warfarin/atrial_fibrillation',
    'indication/apixaban/atrial_fibrillation',
    'membership/warfarin/vitamin_k_antagonist',
    'membership/apixaban/factor_xa_inhibitor',
    'mapping/rxnorm_11289',
    'mapping/rxnorm_1364430',
    'mapping/atc_b01af02',
    'mapping/drugbank_db06605',
    'mapping/snomedct_49436004',
  ],
  requiredEntityIds: [
    'medication/warfarin',
    'medication/apixaban',
    'condition/atrial_fibrillation',
    'drug_class/vitamin_k_antagonist',
    'drug_class/factor_xa_inhibitor',
  ],
};

export const allGraphRagScenarios: readonly GraphRagScenario[] = [
  pregnancyLisinoprilHypertensionScenario,
  ckdHeartFailureIbuprofenScenario,
  atrialFibrillationAlternativesScenario,
];
