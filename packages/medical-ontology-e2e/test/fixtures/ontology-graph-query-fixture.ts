import { edgeFact, factSet, vertexFact, type DatalogFactSet } from '@datalog/ast';
import {
  DEFAULT_SELECT_FACTS_PREDICATE_CATALOG,
  createSelectFactsOperationFromDatalogQuery,
  type SelectFactsOperation,
} from '@datalog/datalog-to-sql';
import { parseDatalogQuery } from '@datalog/parser';

function createSelectFactsOperation(querySource: string): SelectFactsOperation {
  return createSelectFactsOperationFromDatalogQuery(
    parseDatalogQuery(querySource),
    DEFAULT_SELECT_FACTS_PREDICATE_CATALOG,
  );
}

export function createVertexLookupByPreferredLabelOperation(label: string): SelectFactsOperation {
  return createSelectFactsOperation(`Edge(id, "onto/preferred_label", "${label}").`);
}

export function createPreferredLabelOperation(subjectId: string, variableName = 'label'): SelectFactsOperation {
  return createSelectFactsOperation(`Edge("${subjectId}", "onto/preferred_label", ${variableName}).`);
}

export function createMedicationCrosswalkOperation(): SelectFactsOperation {
  return createSelectFactsOperation([
    'Edge("medication/metformin", "onto/preferred_label", medication_label)',
    'Edge("medication/metformin", "med/has_mapping", "mapping/rxnorm_6809")',
    'Edge("mapping/rxnorm_6809", "onto/preferred_label", rxnorm_label)',
    'Edge("medication/metformin", "med/has_mapping", "mapping/umls_c0025598")',
    'Edge("mapping/umls_c0025598", "onto/preferred_label", umls_label)',
    'Edge("medication/metformin", "med/has_mapping", "mapping/drugbank_db00331")',
    'Edge("mapping/drugbank_db00331", "onto/preferred_label", drugbank_label).',
  ].join(',\n'));
}

export function createConditionCrosswalkOperation(): SelectFactsOperation {
  return createSelectFactsOperation([
    'Edge("condition/type_2_diabetes", "onto/preferred_label", condition_label)',
    'Edge("condition/type_2_diabetes", "med/has_mapping", "mapping/snomedct_44054006")',
    'Edge("mapping/snomedct_44054006", "onto/preferred_label", snomed_label)',
    'Edge("condition/type_2_diabetes", "med/has_mapping", "mapping/umls_c0011860")',
    'Edge("mapping/umls_c0011860", "onto/preferred_label", umls_label).',
  ].join(',\n'));
}

export function createDrugClassOperation(): SelectFactsOperation {
  return createSelectFactsOperation([
    'Edge("medication/apixaban", "onto/preferred_label", medication_label)',
    'Edge("medication/apixaban", "med/has_drug_class", "drug_class/factor_xa_inhibitor")',
    'Edge("drug_class/factor_xa_inhibitor", "onto/preferred_label", drug_class_label).',
  ].join(',\n'));
}

export function createUserTagConnectivityOperation(): SelectFactsOperation {
  return createSelectFactsOperation([
    'Edge("tag/user-medication-lisinopril", "user", "user/synthetic-demo")',
    'Edge("tag/user-medication-lisinopril", "episode", episode)',
    'Edge("tag/user-medication-lisinopril", "medication", medication)',
    'Edge("tag/user-condition-hypertension", "user", "user/synthetic-demo")',
    'Edge("tag/user-condition-hypertension", "episode", episode)',
    'Edge("tag/user-condition-hypertension", "condition", condition)',
    'Edge(medication, "onto/preferred_label", medication_label)',
    'Edge(medication, "med/has_drug_class", "drug_class/ace_inhibitor")',
    'Edge("drug_class/ace_inhibitor", "onto/preferred_label", drug_class_label)',
    'Edge(condition, "onto/preferred_label", condition_label)',
    'Edge(condition, "med/has_mapping", "mapping/snomedct_38341003")',
    'Edge(condition, "med/has_mapping", "mapping/umls_c0020538").',
  ].join(',\n'));
}

export function createSyntheticUserTagFacts(): DatalogFactSet {
  return factSet(
    vertexFact('user/synthetic-demo'),
    vertexFact('episode/synthetic-hypertension-visit'),
    vertexFact('tag/user-medication-lisinopril'),
    vertexFact('tag/user-condition-hypertension'),
    vertexFact('status/active'),
    vertexFact('source/manual-review'),
    edgeFact({ subjectId: 'episode/synthetic-hypertension-visit', predicateId: 'onto/instance_of', objectId: 'class/EpisodeOfCare' }),
    edgeFact({ subjectId: 'tag/user-medication-lisinopril', predicateId: 'onto/instance_of', objectId: 'class/UserMedicationTag' }),
    edgeFact({ subjectId: 'tag/user-medication-lisinopril', predicateId: 'user', objectId: 'user/synthetic-demo' }),
    edgeFact({ subjectId: 'tag/user-medication-lisinopril', predicateId: 'episode', objectId: 'episode/synthetic-hypertension-visit' }),
    edgeFact({ subjectId: 'tag/user-medication-lisinopril', predicateId: 'medication', objectId: 'medication/lisinopril' }),
    edgeFact({ subjectId: 'tag/user-medication-lisinopril', predicateId: 'status', objectId: 'status/active' }),
    edgeFact({ subjectId: 'tag/user-medication-lisinopril', predicateId: 'source', objectId: 'source/manual-review' }),
    edgeFact({ subjectId: 'tag/user-condition-hypertension', predicateId: 'onto/instance_of', objectId: 'class/UserConditionTag' }),
    edgeFact({ subjectId: 'tag/user-condition-hypertension', predicateId: 'user', objectId: 'user/synthetic-demo' }),
    edgeFact({ subjectId: 'tag/user-condition-hypertension', predicateId: 'episode', objectId: 'episode/synthetic-hypertension-visit' }),
    edgeFact({ subjectId: 'tag/user-condition-hypertension', predicateId: 'condition', objectId: 'condition/hypertension' }),
    edgeFact({ subjectId: 'tag/user-condition-hypertension', predicateId: 'status', objectId: 'status/active' }),
    edgeFact({ subjectId: 'tag/user-condition-hypertension', predicateId: 'source', objectId: 'source/manual-review' }),
  );
}
