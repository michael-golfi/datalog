import type {
  DatalogPredicateName,
  DatalogTypeName,
} from './datalog-language.js';

export type ScalarDomain = 'node' | Exclude<DatalogTypeName, 'unknown'>;

export type Cardinality = '0' | '1' | '?' | '+' | '*';

export interface DefPredSchema {
  readonly kind: 'predicate-schema';
  readonly predicateName: DatalogPredicateName;
  readonly subjectCardinality: Cardinality;
  readonly subjectDomain: ScalarDomain;
  readonly objectCardinality: Cardinality;
  readonly objectDomain: ScalarDomain;
}

export interface DefCompoundFieldSchema {
  readonly fieldName: string;
  readonly cardinality: Cardinality;
  readonly domain: ScalarDomain;
}

export interface DefCompoundSchema {
  readonly kind: 'compound-schema';
  readonly compoundName: string;
  readonly fields: readonly DefCompoundFieldSchema[];
  readonly mutable?: boolean;
}

export type DatalogSchema = DefPredSchema | DefCompoundSchema;
