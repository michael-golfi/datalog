import { describe, expect, it } from 'vitest';

import {
  atom,
  constantTerm,
  factStatement,
  namedTerm,
  position,
  queryStatement,
  range,
  ruleStatement,
  sourceLocation,
  variableTerm,
  wildcardTerm,
} from './datalog-builders.js';
import {
  edgeFact,
  edgeFactPattern,
  vertexFact,
  vertexFactPattern,
} from './datalog-graph-builders.js';
import {
  isDatalogAtom,
  isDatalogAtomArgument,
  isDatalogConstantTerm,
  isDatalogFactStatement,
  isDatalogNamedTerm,
  isDatalogProgram,
  isDatalogQueryStatement,
  isDatalogRuleStatement,
  isDatalogSourceLocation,
  isDatalogTerm,
  isDatalogVariableTerm,
  isDatalogWildcardTerm,
  isPosition,
  isRange,
} from './datalog-type-guards.js';
import {
  isDatalogFact,
  isDatalogFactPattern,
  isEdgeFact,
  isEdgeFactPattern,
  isVertexFact,
  isVertexFactPattern,
} from './datalog-graph-type-guards.js';

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

  it('accepts graph facts and graph fact patterns', () => {
    const subject = variableTerm('Subject');
    const predicate = constantTerm('graph/likes');
    const object = constantTerm('node/bob');

    expect(isVertexFact(vertexFact('node/alice'))).toBe(true);
    expect(isEdgeFact(edgeFact({
      subjectId: 'node/alice',
      predicateId: 'graph/likes',
      objectId: 'node/bob',
    }))).toBe(true);
    expect(isDatalogFact(edgeFact({
      subjectId: 'node/alice',
      predicateId: 'graph/likes',
      objectId: 'node/bob',
    }))).toBe(true);
    expect(isVertexFactPattern(vertexFactPattern(subject))).toBe(true);
    expect(isEdgeFactPattern(edgeFactPattern({ subject, predicate, object }))).toBe(true);
    expect(isDatalogFactPattern(edgeFactPattern({ subject, predicate, object }))).toBe(true);
    expect(isDatalogFact({ kind: 'edge', subjectId: 'a' })).toBe(false);
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
});
