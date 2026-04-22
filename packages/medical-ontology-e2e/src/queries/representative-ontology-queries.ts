import type { OntologyQueryOperation } from '../contracts/ontology-query-operation.js';

export function createCanonicalIngredientBacklinkQuery(): OntologyQueryOperation {
  return {
    kind: 'select-facts',
    match: [
      {
        kind: 'edge',
        subject: { kind: 'constant', value: 'concept/acetaminophen' },
        predicate: { kind: 'constant', value: 'graph/has_foreign_identifier' },
        object: { kind: 'variable', name: 'foreign_identifier' },
      },
      {
        kind: 'edge',
        subject: { kind: 'variable', name: 'foreign_identifier' },
        predicate: { kind: 'constant', value: 'graph/in_source_graph' },
        object: { kind: 'variable', name: 'source_graph' },
      },
    ],
  };
}

export function createCanonicalDisorderHierarchyQuery(): OntologyQueryOperation {
  return {
    kind: 'select-facts',
    match: [
      {
        kind: 'edge',
        subject: { kind: 'constant', value: 'concept/acute-bronchitis' },
        predicate: { kind: 'constant', value: 'graph/is_a' },
        object: { kind: 'variable', name: 'parent' },
      },
    ],
  };
}

export function createMedicationPresentationRelationQuery(): OntologyQueryOperation {
  return {
    kind: 'select-facts',
    match: [
      {
        kind: 'edge',
        subject: { kind: 'constant', value: 'concept/acetaminophen-500mg-oral-tablet' },
        predicate: { kind: 'constant', value: 'graph/has_ingredient_relation' },
        object: { kind: 'variable', name: 'relation' },
      },
      {
        kind: 'edge',
        subject: { kind: 'variable', name: 'relation' },
        predicate: { kind: 'constant', value: 'graph/relation_ingredient' },
        object: { kind: 'variable', name: 'ingredient' },
      },
      {
        kind: 'edge',
        subject: { kind: 'variable', name: 'relation' },
        predicate: { kind: 'constant', value: 'graph/relation_strength_unit' },
        object: { kind: 'variable', name: 'strength_unit' },
      },
      {
        kind: 'edge',
        subject: { kind: 'variable', name: 'relation' },
        predicate: { kind: 'constant', value: 'graph/relation_strength_value' },
        object: { kind: 'variable', name: 'strength_value' },
      },
    ],
  };
}

export function createCrossMappingDeletionCheck(): OntologyQueryOperation {
  return {
    kind: 'select-facts',
    match: [
      {
        kind: 'edge',
        subject: { kind: 'constant', value: 'concept/acetaminophen' },
        predicate: { kind: 'constant', value: 'graph/has_foreign_identifier' },
        object: { kind: 'variable', name: 'foreign_identifier' },
      },
      {
        kind: 'edge',
        subject: { kind: 'variable', name: 'foreign_identifier' },
        predicate: { kind: 'constant', value: 'graph/in_source_graph' },
        object: { kind: 'constant', value: 'source-graph/umls' },
      },
    ],
  };
}
