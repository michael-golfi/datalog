import { parseDocument } from '@datalog/parser';

import { loadDatalogMigrationProjectFiles } from '@datalog/datalog-migrate';

export interface OntologyVertexFact {
  readonly kind: 'vertex';
  readonly id: string;
}

export interface OntologyEdgeFact {
  readonly kind: 'edge';
  readonly subjectId: string;
  readonly predicateId: string;
  readonly objectId: string;
}

export type OntologyFact = OntologyVertexFact | OntologyEdgeFact;

type ParsedClause = ReturnType<typeof parseDocument>['clauses'][number];

export function loadCommittedOntologyFacts(options: {
  readonly workspaceRoot?: string;
} = {}): readonly [OntologyFact, ...OntologyFact[]] {
  const projectFiles = loadDatalogMigrationProjectFiles(options);
  const nodeIds = new Set<string>();
  const edgeFacts: OntologyEdgeFact[] = [];

  for (const migration of projectFiles.committedMigrations) {
    collectMigrationEdgeFacts(migration.body, nodeIds, edgeFacts);
  }

  const vertexFacts: OntologyVertexFact[] = [...nodeIds].map((id) => ({ kind: 'vertex', id }));
  const facts = [...vertexFacts, ...edgeFacts];

  if (facts.length === 0) {
    throw new Error('Expected committed ontology migrations to contain at least one Edge fact.');
  }

  return facts as [OntologyFact, ...OntologyFact[]];
}

function collectMigrationEdgeFacts(
  source: string,
  nodeIds: Set<string>,
  edgeFacts: OntologyEdgeFact[],
): void {
  const parsed = parseDocument(source);

  for (const clause of parsed.clauses) {
    if (clause.predicate === 'DefCompound' || clause.predicate === 'DefPred') {
      continue;
    }

    if (clause.isCompound) {
      expandCompoundBacklinks(clause, nodeIds, edgeFacts);
      continue;
    }

    const edgeFact = parseEdgeFact(clause);
    nodeIds.add(edgeFact.subjectId);
    nodeIds.add(edgeFact.objectId);
    edgeFacts.push(edgeFact);
  }
}

function expandCompoundBacklinks(
  clause: ParsedClause,
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

  return {
    kind: 'edge',
    subjectId,
    predicateId,
    objectId,
  };
}

function parseEdgeFact(clause: ParsedClause): OntologyEdgeFact {
  if (clause.isRule || clause.predicate !== 'Edge') {
    throw new Error('Committed ontology migrations must only contain Edge facts outside compound declarations.');
  }

  const [subject, predicate, object] = clause.references;

  if (!subject || !predicate || !object || clause.references.length !== 3) {
    throw new Error('Committed ontology Edge facts must use quoted Edge(subject, predicate, object) clauses.');
  }

  return {
    kind: 'edge',
    subjectId: subject.value,
    predicateId: predicate.value,
    objectId: object.value,
  };
}
