import type { DatalogPredicateName, DatalogTypeName, PredicateSignature } from './datalog-program.js';

export interface RelationColumnBinding {
  readonly name: string;
  readonly ordinal: number;
  readonly type: DatalogTypeName;
  readonly nullable?: boolean;
}

export interface PredicateStatistics {
  readonly estimatedRowCount?: number;
  readonly distinctValueCountByColumn?: Readonly<Record<string, number>>;
  readonly nullFractionByColumn?: Readonly<Record<string, number>>;
  readonly averageWidthByColumn?: Readonly<Record<string, number>>;
}

export interface PredicateConstraint {
  readonly kind: 'primary-key' | 'unique' | 'not-null' | 'check' | 'foreign-key';
  readonly columns: readonly string[];
  readonly expression?: string;
  readonly references?: {
    readonly relationName: string;
    readonly columns: readonly string[];
  };
}

export interface PredicateIndex {
  readonly name: string;
  readonly kind: 'btree' | 'hash' | 'gin' | 'gist' | 'memory-hash' | 'memory-array';
  readonly columns: readonly string[];
  readonly predicateSql?: string;
  readonly unique?: boolean;
  readonly supportsEquality?: boolean;
  readonly supportsRange?: boolean;
  readonly estimatedSelectivity?: number;
}

export interface PredicateCapabilities {
  readonly readable: boolean;
  readonly writable: boolean;
  readonly supportsPredicatePushdown: boolean;
  readonly supportsJoinPushdown: boolean;
  readonly supportsAggregationPushdown: boolean;
  readonly supportsRecursionSeedPushdown: boolean;
  readonly supportsDeltaScan: boolean;
}

export interface PostgresTableBinding {
  readonly kind: 'postgres-table';
  readonly relationName: string;
  readonly schemaName?: string;
  readonly columns: readonly RelationColumnBinding[];
  readonly softDeleteColumn?: string;
  readonly literalWhereSql?: string;
}

export interface PostgresViewBinding {
  readonly kind: 'postgres-view';
  readonly relationName: string;
  readonly schemaName?: string;
  readonly columns: readonly RelationColumnBinding[];
  readonly literalWhereSql?: string;
}

export interface WorkTableBinding {
  readonly kind: 'work-table';
  readonly relationName: string;
  readonly columns: readonly RelationColumnBinding[];
  readonly scope: 'statement' | 'transaction' | 'session';
}

export interface MemoryRelationBinding {
  readonly kind: 'memory-relation';
  readonly relationName: string;
  readonly columns: readonly RelationColumnBinding[];
  readonly orderedBy?: readonly string[];
}

export type PredicateStorageBinding =
  | PostgresTableBinding
  | PostgresViewBinding
  | WorkTableBinding
  | MemoryRelationBinding;

export interface PredicateBinding {
  readonly signature: PredicateSignature;
  readonly source: 'catalog' | 'program' | 'workspace';
  readonly storage: PredicateStorageBinding;
  readonly constraints: readonly PredicateConstraint[];
  readonly indexes: readonly PredicateIndex[];
  readonly statistics?: PredicateStatistics;
  readonly capabilities: PredicateCapabilities;
}

export interface BuiltinPredicateBinding {
  readonly signature: PredicateSignature;
  readonly evaluator: 'postgres-sql' | 'memory-function' | 'compiler-rewrite';
}

export interface PredicateCatalog {
  readonly version: 1;
  readonly predicates: readonly PredicateBinding[];
  readonly builtins?: readonly BuiltinPredicateBinding[];
  readonly aliases?: Readonly<Record<DatalogPredicateName, DatalogPredicateName>>;
}

export interface PredicateCatalogLookup {
  readonly predicate: PredicateBinding;
  readonly aliasApplied?: DatalogPredicateName;
}
