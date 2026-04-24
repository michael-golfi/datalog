import type {
  DatalogAtom,
  DatalogAtomArgument,
  DatalogComparison,
  DatalogConstantTerm,
  DatalogDirectiveStatement,
  DatalogFactStatement,
  DatalogFunctionCall,
  DatalogLiteral,
  DatalogNegatedAtom,
  DatalogNamedTerm,
  DatalogProgram,
  DatalogQueryStatement,
  DatalogRuleStatement,
  DatalogStatement,
  DatalogTerm,
  DatalogVariableTerm,
  DatalogWildcardTerm,
} from './datalog-language.js';
import type {
} from './datalog-graph.js';
import type {
  DatalogSourceLocation,
  Position,
  Range,
} from './datalog-source-span.js';

export function isPosition(value: unknown): value is Position {
  return isRecord(value)
    && typeof value.line === 'number'
    && typeof value.character === 'number';
}

export function isRange(value: unknown): value is Range {
  return isRecord(value)
    && isPosition(value.start)
    && isPosition(value.end);
}

export function isDatalogSourceLocation(value: unknown): value is DatalogSourceLocation {
  return isRecord(value)
    && isOptionalString(value.sourceName)
    && isOptionalNumber(value.startOffset)
    && isOptionalNumber(value.endOffset)
    && isOptionalRange(value.range);
}

export function isDatalogVariableTerm(value: unknown): value is DatalogVariableTerm {
  return isRecord(value)
    && value.kind === 'variable'
    && typeof value.name === 'string'
    && isOptionalString(value.typeHint)
    && isOptionalLocation(value.location);
}

export function isDatalogConstantTerm(value: unknown): value is DatalogConstantTerm {
  return isRecord(value)
    && value.kind === 'constant'
    && isScalarValue(value.value)
    && isOptionalString(value.typeHint)
    && isOptionalLocation(value.location);
}

export function isDatalogWildcardTerm(value: unknown): value is DatalogWildcardTerm {
  return isRecord(value)
    && value.kind === 'wildcard'
    && isOptionalLocation(value.location);
}

export function isDatalogTerm(value: unknown): value is DatalogTerm {
  return isDatalogVariableTerm(value) || isDatalogConstantTerm(value) || isDatalogWildcardTerm(value);
}

export function isDatalogNamedTerm(value: unknown): value is DatalogNamedTerm {
  return isRecord(value)
    && value.kind === 'named'
    && typeof value.name === 'string'
    && isDatalogTerm(value.term)
    && isOptionalLocation(value.location);
}

export function isDatalogAtomArgument(value: unknown): value is DatalogAtomArgument {
  return isDatalogTerm(value) || isDatalogNamedTerm(value);
}

export function isDatalogAtom(value: unknown): value is DatalogAtom {
  return isRecord(value)
    && value.kind === 'atom'
    && typeof value.predicate === 'string'
    && isReadonlyArrayOf(value.terms, isDatalogAtomArgument)
    && isOptionalLocation(value.location);
}

export function isDatalogNegatedAtom(value: unknown): value is DatalogNegatedAtom {
  return isRecord(value)
    && value.kind === 'not'
    && isDatalogAtom(value.atom)
    && isOptionalLocation(value.location);
}

export function isDatalogComparison(value: unknown): value is DatalogComparison {
  return isRecord(value)
    && value.kind === 'comparison'
    && isComparisonOperator(value.operator)
    && isDatalogTerm(value.left)
    && isDatalogTerm(value.right)
    && isOptionalLocation(value.location);
}

export function isDatalogFunctionCall(value: unknown): value is DatalogFunctionCall {
  return isRecord(value)
    && value.kind === 'function'
    && typeof value.name === 'string'
    && isReadonlyArrayOf(value.args, isDatalogTerm)
    && isOptionalString(value.returns)
    && isOptionalLocation(value.location);
}

export function isDatalogLiteral(value: unknown): value is DatalogLiteral {
  return isDatalogAtom(value)
    || isDatalogNegatedAtom(value)
    || isDatalogComparison(value)
    || isDatalogFunctionCall(value);
}

export function isDatalogFactStatement(value: unknown): value is DatalogFactStatement {
  return isRecord(value)
    && value.kind === 'fact'
    && isDatalogAtom(value.atom)
    && isOptionalLocation(value.location);
}

export function isDatalogRuleStatement(value: unknown): value is DatalogRuleStatement {
  return isRecord(value)
    && value.kind === 'rule'
    && isOptionalString(value.id)
    && isDatalogAtom(value.head)
    && isLiteralConjunction(value.body)
    && isOptionalAnnotations(value.annotations)
    && isOptionalLocation(value.location);
}

export function isDatalogQueryStatement(value: unknown): value is DatalogQueryStatement {
  return isRecord(value)
    && value.kind === 'query'
    && isOptionalString(value.id)
    && isLiteralConjunction(value.body)
    && isOptionalReadonlyArrayOfStrings(value.project)
    && isOptionalNumber(value.limit)
    && isOptionalNumber(value.offset)
    && isOptionalLocation(value.location);
}

export function isDatalogDirectiveStatement(value: unknown): value is DatalogDirectiveStatement {
  return isRecord(value)
    && value.kind === 'directive'
    && typeof value.name === 'string'
    && isReadonlyArrayOf(value.args, isScalarValue)
    && isOptionalLocation(value.location);
}

export function isDatalogStatement(value: unknown): value is DatalogStatement {
  return isDatalogFactStatement(value)
    || isDatalogRuleStatement(value)
    || isDatalogQueryStatement(value)
    || isDatalogDirectiveStatement(value);
}

export function isDatalogProgram(value: unknown): value is DatalogProgram {
  return isRecord(value)
    && value.kind === 'program'
    && isReadonlyArrayOf(value.statements, isDatalogStatement)
    && isOptionalString(value.sourceName);
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOptionalLocation(value: unknown): boolean {
  return value === undefined || isDatalogSourceLocation(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === 'number';
}

function isOptionalRange(value: unknown): boolean {
  return value === undefined || isRange(value);
}

function isScalarValue(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isComparisonOperator(value: unknown): boolean {
  return value === '=' || value === '!=' || value === '<' || value === '<=' || value === '>' || value === '>=';
}

function isReadonlyArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is readonly T[] {
  return Array.isArray(value) && value.every((item) => guard(item));
}

function isLiteralConjunction(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isDatalogLiteral(item));
}

function isOptionalReadonlyArrayOfStrings(value: unknown): boolean {
  return value === undefined || isReadonlyArrayOf(value, (item): item is string => typeof item === 'string');
}

function isOptionalAnnotations(value: unknown): boolean {
  return value === undefined
    || (isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'));
}
