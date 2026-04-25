import { describe, expect, it } from 'vitest';

import {
  atom,
  comparison,
  constantTerm,
  directiveStatement,
  factStatement,
  functionCall,
  namedTerm,
  negatedAtom,
  position,
  queryStatement,
  range,
  ruleStatement,
  sourceLocation,
  variableTerm,
  wildcardTerm,
} from './datalog-builders.js';
import {
  isDatalogAtom,
  isDatalogAtomArgument,
  isDatalogComparison,
  isDatalogConstantTerm,
  isDatalogDirectiveStatement,
  isDatalogFactStatement,
  isDatalogFunctionCall,
  isDatalogLiteral,
  isDatalogNamedTerm,
  isDatalogNegatedAtom,
  isDatalogProgram,
  isDatalogQueryStatement,
  isDatalogRuleStatement,
  isDatalogSourceLocation,
  isDatalogStatement,
  isDatalogTerm,
  isDatalogVariableTerm,
  isDatalogWildcardTerm,
  isPosition,
  isRange,
} from './datalog-type-guards.js';

describe('datalog type guards', () => {
  it('accepts shared source span contracts', () => {
    const start = position(0, 0);
    const end = position(1, 4);
    const span = range(start, end);
    const location = sourceLocation({
      sourceName: 'facts.dl',
      startOffset: 0,
      endOffset: 12,
      range: span,
    });

    expect(isPosition(start)).toBe(true);
    expect(isRange(span)).toBe(true);
    expect(isDatalogSourceLocation(location)).toBe(true);
    expect(isRange({ start, end: { line: '1', character: 4 } })).toBe(false);
  });

  it('accepts constant, variable, and wildcard terms only when their shapes match', () => {
    expect(isDatalogVariableTerm(variableTerm('X'))).toBe(true);
    expect(isDatalogConstantTerm(constantTerm('alice'))).toBe(true);
    expect(isDatalogWildcardTerm(wildcardTerm())).toBe(true);
    expect(isDatalogNamedTerm(namedTerm('serv/id', constantTerm('serv/chickpea')))).toBe(true);
    expect(isDatalogAtomArgument(namedTerm('serv/id', constantTerm('serv/chickpea')))).toBe(true);
    expect(isDatalogTerm({ kind: 'variable' })).toBe(false);
  });

  it('accepts fact, rule, and query statement nodes', () => {
    const bodyAtom = atom('likes', [variableTerm('X'), variableTerm('Y')]);
    const fact = factStatement(atom('likes', [constantTerm('alice'), constantTerm('bob')]));
    const rule = ruleStatement({
      head: bodyAtom,
      body: [bodyAtom],
    });
    const query = queryStatement({
      body: [bodyAtom],
      project: ['X', 'Y'],
    });
    const astProgram = {
      kind: 'program',
      statements: [fact, rule, query],
    };

    expect(isDatalogAtom(bodyAtom)).toBe(true);
    expect(isDatalogFactStatement(fact)).toBe(true);
    expect(isDatalogRuleStatement(rule)).toBe(true);
    expect(isDatalogQueryStatement(query)).toBe(true);
    expect(isDatalogProgram(astProgram)).toBe(true);
    expect(isDatalogProgram({ kind: 'program', statements: [] })).toBe(true);
    expect(isDatalogRuleStatement({ kind: 'rule', head: bodyAtom, body: [] })).toBe(false);
  });

  it('accepts negated atoms, comparisons, function calls, and literals only when shapes match', () => {
    const positiveAtom = atom('likes', [variableTerm('X'), variableTerm('Y')]);
    const negated = negatedAtom(positiveAtom);
    const compared = comparison({
      operator: '!=',
      left: variableTerm('X'),
      right: constantTerm('system'),
    });
    const call = functionCall({
      name: 'lower',
      args: [variableTerm('X')],
      returns: 'text',
    });

    expect(isDatalogNegatedAtom(negated)).toBe(true);
    expect(isDatalogNegatedAtom({ kind: 'not', atom: variableTerm('X') })).toBe(false);
    expect(isDatalogComparison(compared)).toBe(true);
    expect(isDatalogComparison({ kind: 'comparison', operator: 'contains', left: variableTerm('X'), right: constantTerm('system') })).toBe(false);
    expect(isDatalogFunctionCall(call)).toBe(true);
    expect(isDatalogFunctionCall({ kind: 'function', name: 'lower', args: [namedTerm('value', variableTerm('X'))] })).toBe(false);
    expect(isDatalogLiteral(positiveAtom)).toBe(true);
    expect(isDatalogLiteral(negated)).toBe(true);
    expect(isDatalogLiteral(compared)).toBe(true);
    expect(isDatalogLiteral(call)).toBe(true);
    expect(isDatalogLiteral(directiveStatement({ name: 'pragma', args: [] }))).toBe(false);
  });

  it('accepts directives and statements only for supported statement shapes', () => {
    const bodyAtom = atom('likes', [variableTerm('X'), variableTerm('Y')]);
    const fact = factStatement(bodyAtom);
    const rule = ruleStatement({
      head: bodyAtom,
      body: [bodyAtom],
      annotations: { retries: 0, enabled: false, label: '' },
    });
    const query = queryStatement({
      body: [bodyAtom, functionCall({ name: 'lower', args: [variableTerm('X')] })],
      project: ['X'],
    });
    const directive = directiveStatement({
      name: 'pragma',
      args: ['strict', 1, false, null],
    });

    expect(isDatalogDirectiveStatement(directive)).toBe(true);
    expect(isDatalogDirectiveStatement({ kind: 'directive', name: 'pragma', args: [Symbol('x')] })).toBe(false);
    expect(isDatalogStatement(fact)).toBe(true);
    expect(isDatalogStatement(rule)).toBe(true);
    expect(isDatalogStatement(query)).toBe(true);
    expect(isDatalogStatement(directive)).toBe(true);
    expect(isDatalogStatement(bodyAtom)).toBe(false);
  });
});
