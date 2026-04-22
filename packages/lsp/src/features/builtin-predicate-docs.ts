export interface BuiltinPredicateDoc {
  readonly name: string;
  readonly summary: string;
  readonly detail: string;
  readonly example: string;
}

export const BUILTIN_PREDICATE_DOCS: ReadonlyMap<string, BuiltinPredicateDoc> = new Map([
  ['DefPred', {
    name: 'DefPred',
    summary: 'Declares a graph predicate contract.',
    detail: 'Use `DefPred` to make graph edges self-describing. It records the predicate id plus subject/object cardinality and storage types.',
    example: 'DefPred("food/preferred_label", "1", "liquid/node", "0", "liquid/string").',
  }],
  ['Edge', {
    name: 'Edge',
    summary: 'Writes a typed graph edge.',
    detail: 'Use `Edge(subject, predicate, object)` for the canonical graph layer. Pair it with `DefPred` and `meta/domain_class` / `meta/range_class` edges so graph algorithms can inspect schema as data.',
    example: 'Edge("concept/chickpea_bowl", "food/has_cuisine", "cuisine/mediterranean").',
  }],
  ['TypeAndCardinality', {
    name: 'TypeAndCardinality',
    summary: 'Reads compound metadata type/cardinality pairs.',
    detail: 'This is commonly used with `Smeta` and `Ometa` to bridge compound metadata into rule logic.',
    example: 'TypeAndCardinality(subject_meta_id, subject_type, subject_cardinality).',
  }],
]);
