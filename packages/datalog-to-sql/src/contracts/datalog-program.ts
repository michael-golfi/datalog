export type DatalogPredicateName = string;
export type DatalogVariableName = string;
export type DatalogRuleId = string;
export type DatalogQueryId = string;
export type DatalogTypeName = 'text' | 'int8' | 'numeric' | 'bool' | 'jsonb' | 'date' | 'timestamp' | 'unknown';
export type DatalogScalarValue = string | number | boolean | null;

export interface DatalogSourceLocation {
  readonly sourceName?: string;
  readonly startOffset?: number;
  readonly endOffset?: number;
  readonly startLine?: number;
  readonly endLine?: number;
  readonly startColumn?: number;
  readonly endColumn?: number;
}

export interface DatalogVariableTerm {
  readonly kind: 'variable';
  readonly name: DatalogVariableName;
  readonly typeHint?: DatalogTypeName;
  readonly location?: DatalogSourceLocation;
}

export interface DatalogConstantTerm {
  readonly kind: 'constant';
  readonly value: DatalogScalarValue;
  readonly typeHint?: DatalogTypeName;
  readonly location?: DatalogSourceLocation;
}

export interface DatalogWildcardTerm {
  readonly kind: 'wildcard';
  readonly location?: DatalogSourceLocation;
}

export type DatalogTerm = DatalogVariableTerm | DatalogConstantTerm | DatalogWildcardTerm;

export interface DatalogAtom {
  readonly kind: 'atom';
  readonly predicate: DatalogPredicateName;
  readonly terms: readonly DatalogTerm[];
  readonly location?: DatalogSourceLocation;
}

export interface DatalogNegatedAtom {
  readonly kind: 'not';
  readonly atom: DatalogAtom;
  readonly location?: DatalogSourceLocation;
}

export interface DatalogComparison {
  readonly kind: 'comparison';
  readonly operator: '=' | '!=' | '<' | '<=' | '>' | '>=';
  readonly left: DatalogTerm;
  readonly right: DatalogTerm;
  readonly location?: DatalogSourceLocation;
}

export interface DatalogFunctionCall {
  readonly kind: 'function';
  readonly name: string;
  readonly args: readonly DatalogTerm[];
  readonly returns?: DatalogTypeName;
  readonly location?: DatalogSourceLocation;
}

export type DatalogLiteral = DatalogAtom | DatalogNegatedAtom | DatalogComparison | DatalogFunctionCall;

export interface DatalogFactStatement {
  readonly kind: 'fact';
  readonly atom: DatalogAtom;
  readonly location?: DatalogSourceLocation;
}

export interface DatalogRuleStatement {
  readonly kind: 'rule';
  readonly id?: DatalogRuleId;
  readonly head: DatalogAtom;
  readonly body: readonly [DatalogLiteral, ...DatalogLiteral[]];
  readonly annotations?: Readonly<Record<string, string | number | boolean>>;
  readonly location?: DatalogSourceLocation;
}

export interface DatalogQueryStatement {
  readonly kind: 'query';
  readonly id?: DatalogQueryId;
  readonly body: readonly [DatalogLiteral, ...DatalogLiteral[]];
  readonly project?: readonly DatalogVariableName[];
  readonly limit?: number;
  readonly offset?: number;
  readonly location?: DatalogSourceLocation;
}

export interface DatalogDirectiveStatement {
  readonly kind: 'directive';
  readonly name: string;
  readonly args: readonly DatalogScalarValue[];
  readonly location?: DatalogSourceLocation;
}

export type DatalogStatement =
  | DatalogFactStatement
  | DatalogRuleStatement
  | DatalogQueryStatement
  | DatalogDirectiveStatement;

export interface DatalogProgram {
  readonly kind: 'program';
  readonly statements: readonly DatalogStatement[];
  readonly sourceName?: string;
}

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
