import {
  edgeFact,
  vertexFact,
  type DatalogAtomArgument,
  type DatalogFact,
  type DatalogFactStatement,
  type EdgeFact,
  type VertexFact,
} from '@datalog/ast';
import { parseDatalogProgram, parseDocument } from '@datalog/parser';

export type OntologyVertexFact = VertexFact;
export type OntologyEdgeFact = EdgeFact;
export type OntologyFact = DatalogFact;

export interface OntologyMigrationFactExtraction {
  readonly vertices: readonly OntologyVertexFact[];
  readonly edges: readonly OntologyEdgeFact[];
  readonly facts: readonly OntologyFact[];
}

export function extractOntologyFactsFromSource(source: string): OntologyMigrationFactExtraction {
  const vertexIds = new Set<string>();
  const edgeFacts: OntologyEdgeFact[] = [];

  for (const fact of extractStandardGraphFacts(source)) {
    if (fact.kind === 'vertex') {
      vertexIds.add(fact.id);
      continue;
    }

    vertexIds.add(fact.subjectId);
    vertexIds.add(fact.objectId);
    edgeFacts.push(fact);
  }

  for (const clause of parseDocument(source).clauses) {
    if (clause.predicate === 'DefCompound' || clause.predicate === 'DefPred' || !clause.isCompound) {
      continue;
    }

    expandCompoundBacklinks(clause, vertexIds, edgeFacts);
  }

  const vertices = [...vertexIds].map<OntologyVertexFact>((id) => vertexFact(id));
  return {
    vertices,
    edges: edgeFacts,
    facts: [...vertices, ...edgeFacts],
  };
}

function extractStandardGraphFacts(source: string): readonly OntologyFact[] {
  const facts: OntologyFact[] = [];

  for (const statement of parseDatalogProgram(source).statements) {
    const fact = tryExtractGraphFact(statement);

    if (fact !== null) {
      facts.push(fact);
    }
  }

  return facts;
}

function tryExtractGraphFact(statement: ReturnType<typeof parseDatalogProgram>['statements'][number]): OntologyFact | null {
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

function toEdgeFact(statement: DatalogFactStatement): OntologyEdgeFact | null {
  const [subject, predicate, object] = statement.atom.terms;
  const subjectId = getQuotedGraphId(subject);
  const predicateId = getQuotedGraphId(predicate);
  const objectId = getQuotedGraphId(object);

  if (subjectId === undefined || predicateId === undefined || objectId === undefined) {
    return null;
  }

  return edgeFact({ subjectId, predicateId, objectId });
}

function toVertexFact(statement: DatalogFactStatement): OntologyVertexFact | null {
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

function expandCompoundBacklinks(
  clause: ReturnType<typeof parseDocument>['clauses'][number],
  nodeIds: Set<string>,
  edgeFacts: OntologyEdgeFact[],
): void {
  const compoundFieldValues = new Map<string, string>();

  for (const [index, field] of clause.compoundFields.entries()) {
    const reference = clause.references[index];

    if (reference !== undefined) {
      compoundFieldValues.set(field, reference.value);
    }
  }

  const cid = compoundFieldValues.get('cid');

  if (cid !== undefined) {
    for (const [field, value] of compoundFieldValues) {
      if (field === 'cid') {
        continue;
      }

      nodeIds.add(cid);
      nodeIds.add(value);
      edgeFacts.push(edgeFact({
        subjectId: cid,
        predicateId: field,
        objectId: value,
      }));
    }
  }

  const backlink = createCompoundBacklink(clause.predicate, compoundFieldValues);

  if (backlink === undefined) {
    return;
  }

  nodeIds.add(backlink.subjectId);
  nodeIds.add(backlink.objectId);
  edgeFacts.push(backlink);
}

function createCompoundBacklink(
  predicate: string,
  compoundFieldValues: ReadonlyMap<string, string>,
): OntologyEdgeFact | undefined {
  if (predicate === 'ExternalMapping') {
    return createBacklinkEdge({
      subjectId: compoundFieldValues.get('mapping/concept'),
      predicateId: 'med/has_mapping',
      objectId: compoundFieldValues.get('cid'),
    });
  }

  if (predicate === 'MedicationClassMembership') {
    return createBacklinkEdge({
      subjectId: compoundFieldValues.get('clinical/medication'),
      predicateId: 'med/has_drug_class',
      objectId: compoundFieldValues.get('clinical/drug_class'),
    });
  }

  return undefined;
}

function createBacklinkEdge(input: {
  readonly subjectId: string | undefined;
  readonly predicateId: string;
  readonly objectId: string | undefined;
}): OntologyEdgeFact {
  const { subjectId, predicateId, objectId } = input;

  if (subjectId === undefined || objectId === undefined) {
    throw new Error('Committed ontology compound declarations must provide all required backlink fields.');
  }

  return edgeFact({ subjectId, predicateId, objectId });
}
