import type {
  DatalogPredicateName,
  DatalogQueryId,
  DatalogRuleId,
  DatalogScalarValue,
  DatalogTypeName,
  DatalogVariableName,
} from '@datalog/ast';

export interface PredicateSignature {
  readonly name: DatalogPredicateName;
  readonly arity: number;
  readonly kind: 'edb' | 'idb' | 'builtin';
  readonly outputTypes?: readonly DatalogTypeName[];
}

export interface NormalizedVariable {
  readonly id: string;
  readonly sourceName: DatalogVariableName;
  readonly typeHint?: DatalogTypeName;
}

export interface NormalizedVariableTerm {
  readonly kind: 'variable';
  readonly variableId: string;
}

export interface NormalizedConstantTerm {
  readonly kind: 'constant';
  readonly value: DatalogScalarValue;
  readonly typeHint?: DatalogTypeName;
}

export interface NormalizedWildcardTerm {
  readonly kind: 'wildcard';
}

export type NormalizedTerm =
  | NormalizedVariableTerm
  | NormalizedConstantTerm
  | NormalizedWildcardTerm;

export interface NormalizedAtom {
  readonly kind: 'atom';
  readonly predicate: PredicateSignature;
  readonly terms: readonly NormalizedTerm[];
  readonly isNegated?: false;
}

export interface NormalizedNegatedAtom {
  readonly kind: 'atom';
  readonly predicate: PredicateSignature;
  readonly terms: readonly NormalizedTerm[];
  readonly isNegated: true;
}

export interface NormalizedComparison {
  readonly kind: 'comparison';
  readonly operator: '=' | '!=' | '<' | '<=' | '>' | '>=';
  readonly left: NormalizedTerm;
  readonly right: NormalizedTerm;
}

export interface NormalizedFunctionCall {
  readonly kind: 'function';
  readonly name: string;
  readonly args: readonly NormalizedTerm[];
  readonly returns?: DatalogTypeName;
}

export type NormalizedLiteral =
  | NormalizedAtom
  | NormalizedNegatedAtom
  | NormalizedComparison
  | NormalizedFunctionCall;

export interface NormalizedRule {
  readonly id: DatalogRuleId;
  readonly head: NormalizedAtom;
  readonly body: readonly [NormalizedLiteral, ...NormalizedLiteral[]];
  readonly variables: readonly NormalizedVariable[];
  readonly dependsOn: readonly DatalogPredicateName[];
  readonly produces: DatalogPredicateName;
  readonly isRecursive: boolean;
  readonly sccId?: number;
  readonly recursionDepthHint?: number;
}

export interface NormalizedFact {
  readonly atom: NormalizedAtom;
}

export interface NormalizedQuery {
  readonly id: DatalogQueryId;
  readonly body: readonly [NormalizedLiteral, ...NormalizedLiteral[]];
  readonly project: readonly DatalogVariableName[];
  readonly variables: readonly NormalizedVariable[];
  readonly dependsOn: readonly DatalogPredicateName[];
  readonly limit?: number;
  readonly offset?: number;
}

export interface NormalizedProgram {
  readonly kind: 'normalized-program';
  readonly predicates: readonly PredicateSignature[];
  readonly facts: readonly NormalizedFact[];
  readonly rules: readonly NormalizedRule[];
  readonly query: NormalizedQuery;
}
