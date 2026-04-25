import { isDatalogTerm } from './datalog-type-guards.js';

import type {
  DatalogFact,
  DatalogFactPattern,
  EdgeFact,
  EdgeFactPattern,
  VertexFact,
  VertexFactPattern,
} from './datalog-graph.js';

export function isVertexFactPattern(value: unknown): value is VertexFactPattern {
  return isRecord(value) && value.kind === 'vertex' && isDatalogTerm(value.id);
}

export function isEdgeFactPattern(value: unknown): value is EdgeFactPattern {
  return (
    isRecord(value) &&
    value.kind === 'edge' &&
    isDatalogTerm(value.subject) &&
    isDatalogTerm(value.predicate) &&
    isDatalogTerm(value.object)
  );
}

export function isDatalogFactPattern(value: unknown): value is DatalogFactPattern {
  return isVertexFactPattern(value) || isEdgeFactPattern(value);
}

export function isVertexFact(value: unknown): value is VertexFact {
  return isRecord(value) && value.kind === 'vertex' && typeof value.id === 'string';
}

export function isEdgeFact(value: unknown): value is EdgeFact {
  return (
    isRecord(value) &&
    value.kind === 'edge' &&
    typeof value.subjectId === 'string' &&
    typeof value.predicateId === 'string' &&
    typeof value.objectId === 'string'
  );
}

export function isDatalogFact(value: unknown): value is DatalogFact {
  return isVertexFact(value) || isEdgeFact(value);
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}
