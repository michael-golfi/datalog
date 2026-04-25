import type {
  DatalogFactPatternMatch,
  DatalogFactSet,
  EdgeFact,
  EdgeFactPattern,
  VertexFact,
  VertexFactPattern,
} from './datalog-graph.js';
import type { DatalogTerm } from './datalog-language.js';

export function vertexFact(id: string): VertexFact {
  return { kind: 'vertex', id };
}

export function edgeFact(input: {
  readonly subjectId: string;
  readonly predicateId: string;
  readonly objectId: string;
}): EdgeFact {
  return {
    kind: 'edge',
    subjectId: input.subjectId,
    predicateId: input.predicateId,
    objectId: input.objectId,
  };
}

export function vertexFactPattern(id: DatalogTerm): VertexFactPattern {
  return { kind: 'vertex', id };
}

export function edgeFactPattern(input: {
  readonly subject: DatalogTerm;
  readonly predicate: DatalogTerm;
  readonly object: DatalogTerm;
}): EdgeFactPattern {
  return {
    kind: 'edge',
    subject: input.subject,
    predicate: input.predicate,
    object: input.object,
  };
}

export function factPatternMatch(...patterns: DatalogFactPatternMatch): DatalogFactPatternMatch {
  const [first, ...rest] = patterns;
  return [first, ...rest] as const;
}

export function factSet(...facts: DatalogFactSet): DatalogFactSet {
  const [first, ...rest] = facts;
  return [first, ...rest] as const;
}
