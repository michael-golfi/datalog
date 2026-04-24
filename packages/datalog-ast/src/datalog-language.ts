import type { DatalogSourceLocation } from './datalog-source-span.js';

export type DatalogPredicateName = string;
export type DatalogVariableName = string;
export type DatalogRuleId = string;
export type DatalogQueryId = string;
export type DatalogTypeName = 'text' | 'int8' | 'numeric' | 'bool' | 'jsonb' | 'date' | 'timestamp' | 'unknown';
export type DatalogScalarValue = string | number | boolean | null;
export type DatalogComparisonOperator = '=' | '!=' | '<' | '<=' | '>' | '>=';
export type DatalogAnnotationValue = string | number | boolean;

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

export interface DatalogNamedTerm {
  readonly kind: 'named';
  readonly name: string;
  readonly term: DatalogTerm;
  readonly location?: DatalogSourceLocation;
}

export type DatalogAtomArgument = DatalogTerm | DatalogNamedTerm;

export interface DatalogAtom {
  readonly kind: 'atom';
  readonly predicate: DatalogPredicateName;
  readonly terms: readonly DatalogAtomArgument[];
  readonly location?: DatalogSourceLocation;
}

export interface DatalogNegatedAtom {
  readonly kind: 'not';
  readonly atom: DatalogAtom;
  readonly location?: DatalogSourceLocation;
}

export interface DatalogComparison {
  readonly kind: 'comparison';
  readonly operator: DatalogComparisonOperator;
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
export type DatalogLiteralConjunction = readonly [DatalogLiteral, ...DatalogLiteral[]];

export interface DatalogFactStatement {
  readonly kind: 'fact';
  readonly atom: DatalogAtom;
  readonly location?: DatalogSourceLocation;
}

export interface DatalogRuleStatement {
  readonly kind: 'rule';
  readonly id?: DatalogRuleId;
  readonly head: DatalogAtom;
  readonly body: DatalogLiteralConjunction;
  readonly annotations?: Readonly<Record<string, DatalogAnnotationValue>>;
  readonly location?: DatalogSourceLocation;
}

export interface DatalogQueryStatement {
  readonly kind: 'query';
  readonly id?: DatalogQueryId;
  readonly body: DatalogLiteralConjunction;
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

export type DatalogLanguageNode =
  | DatalogProgram
  | DatalogStatement
  | DatalogLiteral
  | DatalogAtomArgument;
