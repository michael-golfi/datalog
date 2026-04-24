import {
  createSelectFactsOperationFromDatalogQuery,
  type SelectFactsOperation,
} from '@datalog/datalog-to-sql';
import { parseDatalogQuery } from '@datalog/parser';

function createSelectFactsOperation(querySource: string): SelectFactsOperation {
  return createSelectFactsOperationFromDatalogQuery(parseDatalogQuery(querySource));
}

export function createPregnancyLisinoprilEvidenceOperation(): SelectFactsOperation {
  return createSelectFactsOperation([
    'Edge("indication/lisinopril/hypertension", "clinical/medication", medication_id)',
    'Edge("indication/lisinopril/hypertension", "clinical/condition", indication_condition_id)',
    'Edge("indication/lisinopril/hypertension", "onto/preferred_label", indication_label)',
    'Edge("medication/lisinopril", "onto/preferred_label", medication_label)',
    'Edge("condition/hypertension", "onto/preferred_label", hypertension_label)',
    'Edge("contraindication/lisinopril/pregnancy", "clinical/medication", "medication/lisinopril")',
    'Edge("contraindication/lisinopril/pregnancy", "clinical/condition", pregnancy_id)',
    'Edge("contraindication/lisinopril/pregnancy", "onto/preferred_label", contraindication_label)',
    'Edge("condition/pregnancy", "onto/preferred_label", pregnancy_label)',
    'Edge("medication/lisinopril", "med/has_drug_class", "drug_class/ace_inhibitor")',
    'Edge("drug_class/ace_inhibitor", "onto/preferred_label", drug_class_label)',
    'Edge("medication/lisinopril", "med/has_mapping", lisinopril_mapping)',
    'Edge(lisinopril_mapping, "onto/preferred_label", mapping_label)',
    'Edge("condition/hypertension", "med/has_mapping", hypertension_mapping)',
    'Edge(hypertension_mapping, "onto/preferred_label", hypertension_mapping_label)',
    'Edge("condition/pregnancy", "med/has_mapping", pregnancy_mapping)',
    'Edge(pregnancy_mapping, "onto/preferred_label", pregnancy_mapping_label).',
  ].join(',\n'));
}

export function createCkdHeartFailureIbuprofenEvidenceOperation(): SelectFactsOperation {
  return createSelectFactsOperation([
    'Edge("contraindication/ibuprofen/chronic_kidney_disease", "clinical/medication", "medication/ibuprofen")',
    'Edge("contraindication/ibuprofen/chronic_kidney_disease", "clinical/condition", ckd_id)',
    'Edge("contraindication/ibuprofen/chronic_kidney_disease", "onto/preferred_label", ckd_contraindication_label)',
    'Edge("contraindication/ibuprofen/heart_failure", "clinical/medication", "medication/ibuprofen")',
    'Edge("contraindication/ibuprofen/heart_failure", "clinical/condition", hf_id)',
    'Edge("contraindication/ibuprofen/heart_failure", "onto/preferred_label", hf_contraindication_label)',
    'Edge("comorbidity/chronic_kidney_disease/heart_failure", "clinical/condition_a", ckd_id)',
    'Edge("comorbidity/chronic_kidney_disease/heart_failure", "clinical/condition_b", hf_id)',
    'Edge("comorbidity/chronic_kidney_disease/heart_failure", "onto/preferred_label", comorbidity_label)',
    'Edge("medication/ibuprofen", "onto/preferred_label", ibuprofen_label)',
    'Edge("condition/chronic_kidney_disease", "onto/preferred_label", ckd_label)',
    'Edge("condition/heart_failure", "onto/preferred_label", hf_label)',
    'Edge("medication/ibuprofen", "med/has_drug_class", "drug_class/nsaid")',
    'Edge("drug_class/nsaid", "onto/preferred_label", drug_class_label)',
    'Edge("medication/ibuprofen", "med/has_mapping", ibuprofen_mapping)',
    'Edge(ibuprofen_mapping, "onto/preferred_label", ibuprofen_mapping_label)',
    'Edge("condition/chronic_kidney_disease", "med/has_mapping", ckd_mapping)',
    'Edge(ckd_mapping, "onto/preferred_label", ckd_mapping_label)',
    'Edge("condition/heart_failure", "med/has_mapping", hf_mapping)',
    'Edge(hf_mapping, "onto/preferred_label", hf_mapping_label).',
  ].join(',\n'));
}

export function createAtrialFibrillationAlternativesEvidenceOperation(): SelectFactsOperation {
  return createSelectFactsOperation([
    'Edge("indication/warfarin/atrial_fibrillation", "clinical/medication", warfarin_id)',
    'Edge("indication/warfarin/atrial_fibrillation", "clinical/condition", af_id)',
    'Edge("indication/warfarin/atrial_fibrillation", "onto/preferred_label", warfarin_indication_label)',
    'Edge("indication/apixaban/atrial_fibrillation", "clinical/medication", apixaban_id)',
    'Edge("indication/apixaban/atrial_fibrillation", "clinical/condition", af_id)',
    'Edge("indication/apixaban/atrial_fibrillation", "onto/preferred_label", apixaban_indication_label)',
    'Edge("medication/warfarin", "onto/preferred_label", warfarin_label)',
    'Edge("medication/apixaban", "onto/preferred_label", apixaban_label)',
    'Edge("condition/atrial_fibrillation", "onto/preferred_label", af_label)',
    'Edge("medication/warfarin", "med/has_drug_class", "drug_class/vitamin_k_antagonist")',
    'Edge("drug_class/vitamin_k_antagonist", "onto/preferred_label", vka_label)',
    'Edge("medication/apixaban", "med/has_drug_class", "drug_class/factor_xa_inhibitor")',
    'Edge("drug_class/factor_xa_inhibitor", "onto/preferred_label", fxa_label)',
    'Edge("medication/warfarin", "med/has_mapping", warfarin_mapping)',
    'Edge(warfarin_mapping, "onto/preferred_label", warfarin_mapping_label)',
    'Edge("medication/apixaban", "med/has_mapping", apixaban_mapping)',
    'Edge(apixaban_mapping, "onto/preferred_label", apixaban_mapping_label)',
    'Edge("condition/atrial_fibrillation", "med/has_mapping", af_mapping)',
    'Edge(af_mapping, "onto/preferred_label", af_mapping_label).',
  ].join(',\n'));
}
