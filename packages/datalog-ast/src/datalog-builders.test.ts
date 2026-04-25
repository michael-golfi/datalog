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
  program,
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
  factPatternMatch,
  factSet,
  vertexFact,
  vertexFactPattern,
} from './datalog-graph-builders.js';

describe('datalog builders', () => {
  it('builds zero-based UTF-16 source spans explicitly', () => {
    const emojiPrefix = '😀';
    const location = sourceLocation({
      sourceName: 'emoji.dl',
      startOffset: 0,
      endOffset: emojiPrefix.length,
      range: range(position(0, 0), position(0, emojiPrefix.length)),
    });

    expect(emojiPrefix.length).toBe(2);
    expect(location).toEqual({
      sourceName: 'emoji.dl',
      startOffset: 0,
      endOffset: 2,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 2 },
      },
    });
  });

  it('builds variable, constant, and wildcard terms', () => {
    expect(variableTerm('Person', { typeHint: 'text' })).toEqual({
      kind: 'variable',
      name: 'Person',
      typeHint: 'text',
    });
    expect(constantTerm('alice')).toEqual({ kind: 'constant', value: 'alice' });
    expect(wildcardTerm()).toEqual({ kind: 'wildcard' });
    expect(namedTerm('serv/id', constantTerm('serv/chickpea'))).toEqual({
      kind: 'named',
      name: 'serv/id',
      term: { kind: 'constant', value: 'serv/chickpea' },
    });
  });

  it('builds edge and vertex facts plus graph fact patterns', () => {
    const subject = variableTerm('Subject');
    const predicate = constantTerm('graph/likes');
    const object = wildcardTerm();

    expect(vertexFact('node/alice')).toEqual({ kind: 'vertex', id: 'node/alice' });
    expect(edgeFact({
      subjectId: 'node/alice',
      predicateId: 'graph/likes',
      objectId: 'node/bob',
    })).toEqual({
      kind: 'edge',
      subjectId: 'node/alice',
      predicateId: 'graph/likes',
      objectId: 'node/bob',
    });
    expect(vertexFactPattern(subject)).toEqual({ kind: 'vertex', id: subject });
    expect(edgeFactPattern({ subject, predicate, object })).toEqual({
      kind: 'edge',
      subject,
      predicate,
      object,
    });
    expect(factPatternMatch(vertexFactPattern(subject), edgeFactPattern({ subject, predicate, object }))).toHaveLength(2);
    expect(factSet(vertexFact('node/alice'), edgeFact({
      subjectId: 'node/alice',
      predicateId: 'graph/likes',
      objectId: 'node/bob',
    }))).toHaveLength(2);
  });

  it('builds fact, rule, query, and program nodes', () => {
    const head = atom('likes', [variableTerm('X'), variableTerm('Y')]);
    const bodyAtom = atom('knows', [variableTerm('X'), variableTerm('Y')]);
    const negated = negatedAtom(atom('blocked', [variableTerm('X'), variableTerm('Y')]));
    const compared = comparison({
      operator: '!=',
      left: variableTerm('X'),
      right: constantTerm('system'),
    });

    const fact = factStatement(atom('likes', [constantTerm('alice'), constantTerm('bob')]));
    const compoundFact = factStatement(atom('Serving', [namedTerm('serv/id', constantTerm('serv/chickpea'))]));
    const rule = ruleStatement({
      id: 'rule/likes-from-knows',
      head,
      body: [bodyAtom, negated, compared],
      annotations: { confidence: 1 },
    });
    const query = queryStatement({
      id: 'query/likes',
      body: [bodyAtom],
      project: ['X', 'Y'],
      limit: 10,
      offset: 2,
    });
    const astProgram = program({
      statements: [fact, rule, query],
      sourceName: 'likes.dl',
    });

    expect(fact.kind).toBe('fact');
    expect(compoundFact.atom.terms[0]).toMatchObject({ kind: 'named', name: 'serv/id' });
    expect(rule.body).toHaveLength(3);
    expect(query.project).toEqual(['X', 'Y']);
    expect(astProgram).toEqual({
      kind: 'program',
      sourceName: 'likes.dl',
      statements: [fact, rule, query],
    });
  });

  it('builds function calls and directives with empty argument lists when needed', () => {
    const call = functionCall({
      name: 'json_extract_path_text',
      args: [],
      returns: 'text',
      location: sourceLocation({ sourceName: 'functions.dl' }),
    });
    const directive = directiveStatement({
      name: 'pragma',
      args: [],
    });

    expect(call).toEqual({
      kind: 'function',
      name: 'json_extract_path_text',
      args: [],
      returns: 'text',
      location: { sourceName: 'functions.dl' },
    });
    expect(directive).toEqual({
      kind: 'directive',
      name: 'pragma',
      args: [],
    });
  });

  it('clones builder-owned arrays and annotation maps instead of reusing caller references', () => {
    const atomTerms = [variableTerm('X')];
    const callArgs = [constantTerm('segment')];
    const directiveArgs = ['strict', 1, false, null] as const;
    const statements = [factStatement(atom('seed', [constantTerm('alice')]))];
    const annotations = {
      emptyText: '',
      retries: 0,
      enabled: false,
    };

    const builtAtom = atom('path', atomTerms);
    const builtCall = functionCall({
      name: 'lower',
      args: callArgs,
    });
    const builtDirective = directiveStatement({
      name: 'pragma',
      args: directiveArgs,
    });
    const builtRule = ruleStatement({
      head: atom('path', [variableTerm('X')]),
      body: [atom('path', [variableTerm('X')])],
      annotations,
    });
    const builtProgram = program({ statements });

    atomTerms.push(variableTerm('Y'));
    callArgs.push(constantTerm('extra'));
    statements.push(factStatement(atom('seed', [constantTerm('bob')])));
    annotations.enabled = true;
    annotations.retries = 2;

    expect(builtAtom.terms).toEqual([{ kind: 'variable', name: 'X' }]);
    expect(builtAtom.terms).not.toBe(atomTerms);
    expect(builtCall.args).toEqual([{ kind: 'constant', value: 'segment' }]);
    expect(builtCall.args).not.toBe(callArgs);
    expect(builtDirective.args).toEqual(['strict', 1, false, null]);
    expect(builtDirective.args).not.toBe(directiveArgs);
    expect(builtRule.annotations).toEqual({
      emptyText: '',
      retries: 0,
      enabled: false,
    });
    expect(builtRule.annotations).not.toBe(annotations);
    expect(builtProgram.statements).toHaveLength(1);
    expect(builtProgram.statements).not.toBe(statements);
  });

  it('preserves empty annotations and empty statement lists without inventing defaults', () => {
    const head = atom('reachable', [variableTerm('X')]);
    const rule = ruleStatement({
      head,
      body: [head],
      annotations: {},
    });
    const astProgram = program({ statements: [] });

    expect(rule.annotations).toEqual({});
    expect(astProgram).toEqual({
      kind: 'program',
      statements: [],
    });
  });
});
