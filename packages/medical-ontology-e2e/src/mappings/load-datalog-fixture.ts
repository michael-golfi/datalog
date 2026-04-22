import { readFileSync } from 'node:fs';

import { parseDocument } from '@datalog/parser';

import type {
  OntologyDatalogFact,
  OntologyEdgeFact,
  OntologyVertexFact,
} from '../contracts/ontology-fixture-facts.js';

/** Load immutable ontology fixture facts from a Datalog file containing only Edge facts. */
export function loadDatalogFixture(filePath: string): readonly [OntologyDatalogFact, ...OntologyDatalogFact[]] {
  const source = readFileSync(filePath, 'utf8');
  const parsed = parseDocument(source);
  const edgeFacts = collectEdgeFacts(parsed, filePath);
  const nodeIds = collectNodeIds(edgeFacts);

  const vertexFacts: OntologyVertexFact[] = [...nodeIds].map((id) => ({ kind: 'vertex', id }));
  const facts = [...vertexFacts, ...edgeFacts];

  if (facts.length === 0) {
    throw new Error(`Fixture ${filePath} must contain at least one Edge fact.`);
  }

  return facts as [OntologyDatalogFact, ...OntologyDatalogFact[]];
}

function collectEdgeFacts(
  parsed: ReturnType<typeof parseDocument>,
  filePath: string,
): OntologyEdgeFact[] {
  const edgeFacts: OntologyEdgeFact[] = [];

  for (const clause of parsed.clauses) {
    if (clause.isCompound) {
      continue;
    }

    edgeFacts.push(parseEdgeFact(clause, filePath));
  }

  return edgeFacts;
}

function collectNodeIds(edgeFacts: readonly OntologyEdgeFact[]): Set<string> {
  const nodeIds = new Set<string>();

  for (const edgeFact of edgeFacts) {
    nodeIds.add(edgeFact.subjectId);
    nodeIds.add(edgeFact.objectId);
  }

  return nodeIds;
}

function parseEdgeFact(
  clause: ReturnType<typeof parseDocument>['clauses'][number],
  filePath: string,
): OntologyEdgeFact {
  assertSupportedEdgeClause(clause, filePath);

  const [subject, predicate, object] = clause.references;

  if (subject === undefined || predicate === undefined || object === undefined || clause.references.length !== 3) {
    throw new Error(`Fixture ${filePath} must use quoted Edge(subject, predicate, object) facts.`);
  }

  return {
    kind: 'edge',
    subjectId: subject.value,
    predicateId: predicate.value,
    objectId: object.value,
  };
}

function assertSupportedEdgeClause(
  clause: ReturnType<typeof parseDocument>['clauses'][number],
  filePath: string,
): void {
  if (!clause.isRule && clause.predicate === 'Edge') {
    return;
  }

  throw new Error(`Fixture ${filePath} must contain only Edge facts.`);
}
