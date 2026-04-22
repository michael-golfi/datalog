export const BUILTIN_PREDICATE_NAMES = new Set<string>([
  'DefPred',
  'Edge',
  'TypeAndCardinality',
]);

export const GRAPH_META_NODE_IDS = new Set<string>([
  'meta/domain_class',
  'meta/range_class',
  'meta/compound_subject_class',
]);

export const GRAPH_LABEL_PREDICATE = 'food/preferred_label';

export const GRAPH_CLASS_PREDICATE_NAMES = new Set<string>([
  'food/subclass_of',
  'food/instance_of',
]);
