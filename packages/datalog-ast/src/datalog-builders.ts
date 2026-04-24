import type {
  DatalogAtom,
  DatalogAtomArgument,
  DatalogComparison,
  DatalogComparisonOperator,
  DatalogConstantTerm,
  DatalogDirectiveStatement,
  DatalogFactStatement,
  DatalogFunctionCall,
  DatalogLiteralConjunction,
  DatalogNamedTerm,
  DatalogNegatedAtom,
  DatalogProgram,
  DatalogQueryId,
  DatalogQueryStatement,
  DatalogRuleId,
  DatalogRuleStatement,
  DatalogScalarValue,
  DatalogStatement,
  DatalogTerm,
  DatalogTypeName,
  DatalogVariableName,
  DatalogVariableTerm,
  DatalogWildcardTerm,
  DatalogAnnotationValue,
} from './datalog-language.js';
import type {
  DatalogSourceLocation,
  Position,
  Range,
} from './datalog-source-span.js';

export function position(line: number, character: number): Position {
  return { line, character };
}

export function range(start: Position, end: Position): Range {
  return {
    start: position(start.line, start.character),
    end: position(end.line, end.character),
  };
}

export function sourceLocation(input: DatalogSourceLocation): DatalogSourceLocation {
  return input.range === undefined
    ? { ...input }
    : { ...input, range: range(input.range.start, input.range.end) };
}

export function variableTerm(name: DatalogVariableName, options: {
  readonly typeHint?: DatalogTypeName;
  readonly location?: DatalogSourceLocation;
} = {}): DatalogVariableTerm {
  return withOptionalLocation({
    kind: 'variable',
    name,
    ...withOptionalTypeHint(options.typeHint),
  }, options.location);
}

export function constantTerm(value: DatalogScalarValue, options: {
  readonly typeHint?: DatalogTypeName;
  readonly location?: DatalogSourceLocation;
} = {}): DatalogConstantTerm {
  return withOptionalLocation({
    kind: 'constant',
    value,
    ...withOptionalTypeHint(options.typeHint),
  }, options.location);
}

export function wildcardTerm(options: {
  readonly location?: DatalogSourceLocation;
} = {}): DatalogWildcardTerm {
  return withOptionalLocation({ kind: 'wildcard' }, options.location);
}

export function namedTerm(name: string, term: DatalogTerm, options: {
  readonly location?: DatalogSourceLocation;
} = {}): DatalogNamedTerm {
  return withOptionalLocation({ kind: 'named', name, term }, options.location);
}

export function atom(predicate: string, terms: readonly DatalogAtomArgument[], options: {
  readonly location?: DatalogSourceLocation;
} = {}): DatalogAtom {
  return withOptionalLocation({
    kind: 'atom',
    predicate,
    terms: [...terms],
  }, options.location);
}

export function negatedAtom(atomNode: DatalogAtom, options: {
  readonly location?: DatalogSourceLocation;
} = {}): DatalogNegatedAtom {
  return withOptionalLocation({ kind: 'not', atom: atomNode }, options.location);
}

export function comparison(input: {
  readonly operator: DatalogComparisonOperator;
  readonly left: DatalogTerm;
  readonly right: DatalogTerm;
  readonly location?: DatalogSourceLocation;
}): DatalogComparison {
  return withOptionalLocation({
    kind: 'comparison',
    operator: input.operator,
    left: input.left,
    right: input.right,
  }, input.location);
}

export function functionCall(input: {
  readonly name: string;
  readonly args: readonly DatalogTerm[];
  readonly returns?: DatalogTypeName;
  readonly location?: DatalogSourceLocation;
}): DatalogFunctionCall {
  return withOptionalLocation({
    kind: 'function',
    name: input.name,
    args: [...input.args],
    ...withOptionalReturns(input.returns),
  }, input.location);
}

export function factStatement(atomNode: DatalogAtom, options: {
  readonly location?: DatalogSourceLocation;
} = {}): DatalogFactStatement {
  return withOptionalLocation({ kind: 'fact', atom: atomNode }, options.location);
}

export function ruleStatement(input: {
  readonly head: DatalogAtom;
  readonly body: DatalogLiteralConjunction;
  readonly id?: DatalogRuleId;
  readonly annotations?: Readonly<Record<string, DatalogAnnotationValue>>;
  readonly location?: DatalogSourceLocation;
}): DatalogRuleStatement {
  return withOptionalLocation({
    kind: 'rule',
    head: input.head,
    body: toNonEmptyReadonlyArray(input.body),
    ...withOptionalId(input.id),
    ...withOptionalAnnotations(input.annotations),
  }, input.location);
}

export function queryStatement(input: {
  readonly body: DatalogLiteralConjunction;
  readonly id?: DatalogQueryId;
  readonly project?: readonly DatalogVariableName[];
  readonly limit?: number;
  readonly offset?: number;
  readonly location?: DatalogSourceLocation;
}): DatalogQueryStatement {
  return withOptionalLocation({
    kind: 'query',
    body: toNonEmptyReadonlyArray(input.body),
    ...withOptionalId(input.id),
    ...withOptionalProject(input.project),
    ...withOptionalLimitOffset(input.limit, input.offset),
  }, input.location);
}

export function directiveStatement(input: {
  readonly name: string;
  readonly args: readonly DatalogScalarValue[];
  readonly location?: DatalogSourceLocation;
}): DatalogDirectiveStatement {
  return withOptionalLocation({
    kind: 'directive',
    name: input.name,
    args: [...input.args],
  }, input.location);
}

export function program(input: {
  readonly statements: readonly DatalogStatement[];
  readonly sourceName?: string;
}): DatalogProgram {
  return {
    kind: 'program',
    statements: [...input.statements],
    ...withOptionalSourceName(input.sourceName),
  };
}

function toNonEmptyReadonlyArray<T>(items: readonly [T, ...T[]]): readonly [T, ...T[]] {
  const [first, ...rest] = items;
  return [first, ...rest] as const;
}

function withOptionalLocation<T extends object>(node: T, location: DatalogSourceLocation | undefined): T & {
  readonly location?: DatalogSourceLocation;
} {
  return location === undefined ? node : { ...node, location };
}

function withOptionalTypeHint(typeHint: DatalogTypeName | undefined): { readonly typeHint?: DatalogTypeName } {
  return typeHint === undefined ? {} : { typeHint };
}

function withOptionalReturns(returns: DatalogTypeName | undefined): { readonly returns?: DatalogTypeName } {
  return returns === undefined ? {} : { returns };
}

function withOptionalId(id: DatalogRuleId | DatalogQueryId | undefined): { readonly id?: DatalogRuleId | DatalogQueryId } {
  return id === undefined ? {} : { id };
}

function withOptionalAnnotations(annotations: Readonly<Record<string, DatalogAnnotationValue>> | undefined): {
  readonly annotations?: Readonly<Record<string, DatalogAnnotationValue>>;
} {
  return annotations === undefined ? {} : { annotations: { ...annotations } };
}

function withOptionalProject(project: readonly DatalogVariableName[] | undefined): {
  readonly project?: readonly DatalogVariableName[];
} {
  return project === undefined ? {} : { project: [...project] };
}

function withOptionalLimitOffset(limit: number | undefined, offset: number | undefined): {
  readonly limit?: number;
  readonly offset?: number;
} {
  return {
    ...(limit === undefined ? {} : { limit }),
    ...(offset === undefined ? {} : { offset }),
  };
}

function withOptionalSourceName(sourceName: string | undefined): { readonly sourceName?: string } {
  return sourceName === undefined ? {} : { sourceName };
}
