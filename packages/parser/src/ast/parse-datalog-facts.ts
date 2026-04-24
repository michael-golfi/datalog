import {
  edgeFact,
  vertexFact,
  type DatalogAtomArgument,
  type DatalogFact,
} from '@datalog/ast';

import { parseDatalogProgram } from './parse-datalog-program.js';

/** Parse migration-style quoted graph facts into shared graph fact models. */
export function parseDatalogFacts(source: string): readonly DatalogFact[] {
  return parseDatalogProgram(source).statements.map((statement) => toGraphFact(statement));
}

function toGraphFact(statement: ReturnType<typeof parseDatalogProgram>['statements'][number]): DatalogFact {
  if (statement.kind !== 'fact') {
    throw new Error('parseDatalogFacts only supports fact statements.');
  }

  if (isEdgeFactStatement(statement)) {
    return toEdgeFact(statement.atom.terms);
  }

  if (isVertexFactStatement(statement)) {
    return toVertexFact(statement.atom.terms);
  }

  throw new Error(`Unsupported graph fact predicate: ${statement.atom.predicate}`);
}

function isEdgeFactStatement(statement: Extract<ReturnType<typeof parseDatalogProgram>['statements'][number], { kind: 'fact' }>): boolean {
  return statement.atom.predicate === 'Edge' && statement.atom.terms.length === 3;
}

function isVertexFactStatement(statement: Extract<ReturnType<typeof parseDatalogProgram>['statements'][number], { kind: 'fact' }>): boolean {
  return (statement.atom.predicate === 'Vertex' || statement.atom.predicate === 'Node') && statement.atom.terms.length === 1;
}

function toEdgeFact(terms: readonly DatalogAtomArgument[]): DatalogFact {
  const [subject, predicate, object] = terms;

  if (subject === undefined || predicate === undefined || object === undefined) {
    throw new Error('Edge facts must include subject, predicate, and object terms.');
  }

  return edgeFact({
    subjectId: getQuotedGraphId(subject),
    predicateId: getQuotedGraphId(predicate),
    objectId: getQuotedGraphId(object),
  });
}

function toVertexFact(terms: readonly DatalogAtomArgument[]): DatalogFact {
  const [vertexId] = terms;

  if (vertexId === undefined) {
    throw new Error('Vertex facts must include an id term.');
  }

  return vertexFact(getQuotedGraphId(vertexId));
}

function getQuotedGraphId(term: DatalogAtomArgument): string {
  if (term.kind === 'named' || term.kind !== 'constant' || typeof term.value !== 'string') {
    throw new Error('Graph facts must use quoted string constants.');
  }

  return term.value;
}
