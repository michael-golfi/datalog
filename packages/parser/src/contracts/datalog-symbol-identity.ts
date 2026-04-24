import type { Range } from './position.js';

export type DatalogPredicateIdentityKind = 'builtin-predicate' | 'user-predicate';

export interface DatalogPredicateSymbolIdentity {
  readonly key: string;
  readonly kind: DatalogPredicateIdentityKind;
  readonly name: string;
  readonly arity: number;
}

export interface DatalogPredicateSymbolOccurrence {
  readonly kind: 'head' | 'body';
  readonly range: Range;
}

export interface DatalogPredicateSymbol {
  readonly identity: DatalogPredicateSymbolIdentity;
  readonly occurrences: readonly DatalogPredicateSymbolOccurrence[];
}

export interface DatalogGraphNodeSymbolIdentity {
  readonly key: string;
  readonly id: string;
}

export interface DatalogGraphNodeSymbol {
  readonly identity: DatalogGraphNodeSymbolIdentity;
  readonly id: string;
  readonly references: readonly Range[];
}

export interface DatalogCompoundFieldSymbolIdentity {
  readonly key: string;
  readonly predicateName: string;
  readonly fieldName: string;
}

export interface DatalogCompoundFieldSymbol {
  readonly identity: DatalogCompoundFieldSymbolIdentity;
  readonly predicateName: string;
  readonly fieldName: string;
  readonly references: readonly Range[];
}

export interface DatalogSymbols {
  readonly predicates: readonly DatalogPredicateSymbol[];
  readonly graphNodes: readonly DatalogGraphNodeSymbol[];
  readonly compoundFields: readonly DatalogCompoundFieldSymbol[];
}
