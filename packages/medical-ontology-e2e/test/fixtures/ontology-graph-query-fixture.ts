import type {
  DatalogConstantTerm,
  DatalogFact,
  DatalogVariableTerm,
  EdgeFactPattern,
  SelectFactsOperation,
  SelectVertexByIdOperation,
} from '@datalog/datalog-to-sql';

type GraphConstant = DatalogConstantTerm;
type GraphVariable = DatalogVariableTerm;
type GraphTerm = GraphConstant | GraphVariable;
type GraphEdgeMatch = EdgeFactPattern;

function graphConstant(value: string): GraphConstant {
  return { kind: 'constant', value } as const;
}

function graphVariable(name: string): GraphVariable {
  return { kind: 'variable', name } as const;
}

function graphEdge(
  subject: GraphTerm,
  predicate: string,
  object: GraphTerm,
): GraphEdgeMatch {
  return {
    kind: 'edge',
    subject,
    predicate: graphConstant(predicate),
    object,
  } as const;
}

export function createVertexByIdOperation(vertexId: string): SelectVertexByIdOperation {
  return {
    kind: 'select-vertex-by-id',
    vertexId,
  } as const;
}

export function createPreferredLabelOperation(subjectId: string, variableName = 'label'): SelectFactsOperation {
  return {
    kind: 'select-facts',
    match: [
      graphEdge(graphConstant(subjectId), 'onto/preferred_label', graphVariable(variableName)),
    ],
  } as const;
}

export function createMedicationCrosswalkOperation(): SelectFactsOperation {
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

export function createConditionCrosswalkOperation(): SelectFactsOperation {
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

export function createDrugClassOperation(): SelectFactsOperation {
  return {
    kind: 'select-facts',
    match: [
      graphEdge(graphConstant('medication/apixaban'), 'onto/preferred_label', graphVariable('medication_label')),
      graphEdge(graphConstant('medication/apixaban'), 'med/has_drug_class', graphConstant('drug_class/factor_xa_inhibitor')),
      graphEdge(graphConstant('drug_class/factor_xa_inhibitor'), 'onto/preferred_label', graphVariable('drug_class_label')),
    ],
  } as const;
}

export function createUserTagConnectivityOperation(): SelectFactsOperation {
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

export function createSyntheticUserTagFacts(): readonly [DatalogFact, ...DatalogFact[]] {
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
