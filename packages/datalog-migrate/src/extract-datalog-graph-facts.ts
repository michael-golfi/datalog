import {
  edgeFact,
  vertexFact,
  type DatalogAtomArgument,
  type DatalogFact,
  type DatalogFactStatement,
  type EdgeFact,
  type VertexFact,
} from '@datalog/ast';
import type { parseDatalogProgram } from '@datalog/parser';

type ParsedProgramStatement = ReturnType<typeof parseDatalogProgram>['statements'][number];

/** Extract executable graph facts from parsed committed migration statements. */
export function extractStandardGraphFacts(statements: readonly ParsedProgramStatement[]): readonly DatalogFact[] {
  const facts: DatalogFact[] = [];

  for (const statement of statements) {
    const fact = tryExtractGraphFact(statement);

    if (fact !== null) {
      facts.push(fact);
    }
  }

  return facts;
}

function tryExtractGraphFact(statement: ParsedProgramStatement): DatalogFact | null {
  if (statement.kind !== 'fact') {
    return null;
  }

  if (isEdgeFactStatement(statement)) {
    return toEdgeFact(statement);
  }

  if (isVertexFactStatement(statement)) {
    return toVertexFact(statement);
  }

  return null;
}

function isEdgeFactStatement(statement: DatalogFactStatement): boolean {
  return statement.atom.predicate === 'Edge' && statement.atom.terms.length === 3;
}

function isVertexFactStatement(statement: DatalogFactStatement): boolean {
  return (statement.atom.predicate === 'Vertex' || statement.atom.predicate === 'Node')
    && statement.atom.terms.length === 1;
}

function toEdgeFact(statement: DatalogFactStatement): EdgeFact | null {
  const [subject, predicate, object] = statement.atom.terms;
  const subjectId = getQuotedGraphId(subject);
  const predicateId = getQuotedGraphId(predicate);
  const objectId = getQuotedGraphId(object);

  if (subjectId === undefined || predicateId === undefined || objectId === undefined) {
    return null;
  }

  return edgeFact({ subjectId, predicateId, objectId });
}

function toVertexFact(statement: DatalogFactStatement): VertexFact | null {
  const [vertexIdTerm] = statement.atom.terms;
  const id = getQuotedGraphId(vertexIdTerm);

  if (id === undefined) {
    return null;
  }

  return vertexFact(id);
}

function getQuotedGraphId(term: DatalogAtomArgument | undefined): string | undefined {
  if (term === undefined || term.kind === 'named' || term.kind !== 'constant' || typeof term.value !== 'string') {
    return undefined;
  }

  return term.value;
}
