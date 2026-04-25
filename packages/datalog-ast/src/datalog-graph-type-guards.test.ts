import { describe, expect, it } from 'vitest';

import {
  constantTerm,
  namedTerm,
  variableTerm,
} from './datalog-builders.js';
import {
  edgeFact,
  edgeFactPattern,
  vertexFact,
  vertexFactPattern,
} from './datalog-graph-builders.js';
import {
  isDatalogFact,
  isDatalogFactPattern,
  isEdgeFact,
  isEdgeFactPattern,
  isVertexFact,
  isVertexFactPattern,
} from './datalog-graph-type-guards.js';

describe('datalog graph type guards', () => {
  it('accepts concrete vertex and edge facts only when required ids are present', () => {
    const vertex = vertexFact('node/alice');
    const edge = edgeFact({
      subjectId: 'node/alice',
      predicateId: 'graph/likes',
      objectId: 'node/bob',
    });

    expect(isVertexFact(vertex)).toBe(true);
    expect(isVertexFact({ kind: 'vertex' })).toBe(false);
    expect(isVertexFact({ kind: 'vertex', id: 1 })).toBe(false);

    expect(isEdgeFact(edge)).toBe(true);
    expect(isEdgeFact({ kind: 'edge', subjectId: 'node/alice', predicateId: 'graph/likes' })).toBe(false);
    expect(isEdgeFact({ kind: 'edge', subjectId: 'node/alice', predicateId: 42, objectId: 'node/bob' })).toBe(false);

    expect(isDatalogFact(vertex)).toBe(true);
    expect(isDatalogFact(edge)).toBe(true);
    expect(isDatalogFact({ kind: 'edge', subjectId: 'node/alice', predicateId: 'graph/likes' })).toBe(false);
  });

  it('accepts graph fact patterns only when their term-shaped fields are complete', () => {
    const subject = variableTerm('Subject');
    const predicate = constantTerm('graph/likes');
    const object = constantTerm('node/bob');
    const vertexPattern = vertexFactPattern(subject);
    const edgePattern = edgeFactPattern({ subject, predicate, object });

    expect(isVertexFactPattern(vertexPattern)).toBe(true);
    expect(isVertexFactPattern({ kind: 'vertex', id: namedTerm('alias', variableTerm('Subject')) })).toBe(false);
    expect(isVertexFactPattern({ kind: 'vertex' })).toBe(false);

    expect(isEdgeFactPattern(edgePattern)).toBe(true);
    expect(isEdgeFactPattern({ kind: 'edge', subject, predicate })).toBe(false);
    expect(isEdgeFactPattern({ kind: 'edge', subject, predicate, object: namedTerm('target', object) })).toBe(false);

    expect(isDatalogFactPattern(vertexPattern)).toBe(true);
    expect(isDatalogFactPattern(edgePattern)).toBe(true);
    expect(isDatalogFactPattern({ kind: 'edge', subject, predicate })).toBe(false);
  });
});
