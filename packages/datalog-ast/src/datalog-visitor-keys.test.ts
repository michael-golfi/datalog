import { describe, expect, it } from 'vitest';

import { variableTerm } from './datalog-builders.js';
import { edgeFact, edgeFactPattern, vertexFact, vertexFactPattern } from './datalog-graph-builders.js';
import { DATALOG_VISITOR_KEYS } from './datalog-visitor-keys.js';

describe('datalog visitor keys', () => {
  it('covers the canonical language and graph node kinds', () => {
    expect(Object.keys(DATALOG_VISITOR_KEYS).sort()).toEqual([
      'atom',
      'comparison',
      'constant',
      'directive',
      'edge',
      'fact',
      'function',
      'named',
      'not',
      'program',
      'query',
      'rule',
      'variable',
      'vertex',
      'wildcard',
    ]);
  });

  it('identifies traversable child properties only', () => {
    expect(DATALOG_VISITOR_KEYS.program).toEqual(['statements']);
    expect(DATALOG_VISITOR_KEYS.rule).toEqual(['head', 'body']);
    expect(DATALOG_VISITOR_KEYS.query).toEqual(['body']);
    expect(DATALOG_VISITOR_KEYS.atom).toEqual(['terms']);
    expect(DATALOG_VISITOR_KEYS.named).toEqual(['term']);
    expect(DATALOG_VISITOR_KEYS.edge).toEqual(['subject', 'predicate', 'object']);
    expect(DATALOG_VISITOR_KEYS.variable).toEqual([]);
    expect(DATALOG_VISITOR_KEYS.constant).toEqual([]);
    expect(DATALOG_VISITOR_KEYS.wildcard).toEqual([]);
    expect(DATALOG_VISITOR_KEYS.directive).toEqual([]);
  });

  it('describes graph fact patterns without pretending concrete graph facts have child nodes', () => {
    const vertexPattern = vertexFactPattern(variableTerm('Vertex'));
    const edgePattern = edgeFactPattern({
      subject: variableTerm('Subject'),
      predicate: variableTerm('Predicate'),
      object: variableTerm('Object'),
    });
    const vertex = vertexFact('node/alice');
    const edge = edgeFact({
      subjectId: 'node/alice',
      predicateId: 'graph/likes',
      objectId: 'node/bob',
    });

    expect(DATALOG_VISITOR_KEYS[vertexPattern.kind]).toEqual(['id']);
    expect(DATALOG_VISITOR_KEYS[edgePattern.kind]).toEqual(['subject', 'predicate', 'object']);
    expect('subject' in edge).toBe(false);
    expect('predicate' in edge).toBe(false);
    expect('object' in edge).toBe(false);
    expect(typeof vertex.id).toBe('string');
  });
});
