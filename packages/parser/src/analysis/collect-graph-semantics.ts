import type {
  NodeSummary,
  ParsedClause,
  ParsedDocument,
  ParsedSchemaDeclaration,
} from '../contracts/parsed-document.js';
import {
  BUILTIN_PREDICATE_NAMES,
  GRAPH_CLASS_PREDICATE_NAMES,
  GRAPH_LABEL_PREDICATE,
} from '../semantics/graph-vocabulary.js';

import { createGraphClassNodeSummaryInput, createNodeSummary } from './node-summary.js';
import { extractDatalogSchema } from './extract-datalog-schema.js';

type CollectedGraphSemantics = Omit<ParsedDocument, 'clauses' | 'datalogSymbols' | 'lineStarts'>;

interface GraphSemanticsState {
  readonly schemaDeclarations: readonly ParsedSchemaDeclaration[];
  readonly derivedPredicates: Map<string, ParsedClause[]>;
  readonly nodeSummaries: Map<string, NodeSummary>;
  readonly graphPredicateIds: Set<string>;
  readonly nodeIds: Set<string>;
}

interface EdgeReferences {
  readonly subjectId: ParsedClause['references'][number];
  readonly predicateId: ParsedClause['references'][number];
  readonly objectId: ParsedClause['references'][number];
}

/** Collect graph-oriented semantic indexes from parsed Datalog clauses. */
export function collectGraphSemantics(clauses: readonly ParsedClause[]): CollectedGraphSemantics {
  const state = createGraphSemanticsState(extractDatalogSchema(clauses));

  for (const clause of clauses) {
    collectClauseSemantics(clause, state);
  }

  addSchemaNodeIds(state);
  return finalizeGraphSemantics(state);
}

function createGraphSemanticsState(schemaDeclarations: readonly ParsedSchemaDeclaration[]): GraphSemanticsState {
  return {
    schemaDeclarations,
    derivedPredicates: new Map<string, ParsedClause[]>(),
    nodeSummaries: new Map<string, NodeSummary>(),
    graphPredicateIds: new Set<string>(),
    nodeIds: new Set<string>(),
  };
}

function collectClauseSemantics(clause: ParsedClause, state: GraphSemanticsState): void {
  collectDerivedPredicates(clause, state.derivedPredicates);
  collectReferenceIds(clause, state.graphPredicateIds, state.nodeIds);
  collectEdgeSemantics(clause, state);
}

function addSchemaNodeIds(state: GraphSemanticsState): void {
  for (const declaration of state.schemaDeclarations) {
    if (declaration.schema.kind !== 'predicate-schema') {
      continue;
    }

    state.graphPredicateIds.add(declaration.schema.predicateName);
  }
}

function finalizeGraphSemantics(state: GraphSemanticsState): CollectedGraphSemantics {
  return {
    schemaDeclarations: state.schemaDeclarations,
    derivedPredicates: state.derivedPredicates,
    nodeSummaries: state.nodeSummaries,
    graphPredicateIds: [...state.graphPredicateIds].sort(),
    nodeIds: [...state.nodeIds].sort(),
  };
}

function collectDerivedPredicates(
  clause: ParsedClause,
  derivedPredicates: Map<string, ParsedClause[]>,
): void {
  if (BUILTIN_PREDICATE_NAMES.has(clause.predicate)) {
    return;
  }

  const existing = derivedPredicates.get(clause.predicate) ?? [];
  existing.push(clause);
  derivedPredicates.set(clause.predicate, existing);
}

function collectReferenceIds(
  clause: ParsedClause,
  graphPredicateIds: Set<string>,
  nodeIds: Set<string>,
): void {
  for (const reference of clause.references) {
    if (reference.role === 'graph-predicate') {
      graphPredicateIds.add(reference.value);
    }

    if (reference.role === 'node-id') {
      nodeIds.add(reference.value);
    }
  }
}

function collectEdgeSemantics(clause: ParsedClause, state: GraphSemanticsState): void {
  const edgeReferences = getEdgeReferences(clause);

  if (!edgeReferences) {
    return;
  }

  collectEdgeReferenceIds(edgeReferences, state);

  if (edgeReferences.predicateId.value === GRAPH_LABEL_PREDICATE) {
    collectGraphLabelEdge(edgeReferences, state.nodeSummaries);
    return;
  }

  if (GRAPH_CLASS_PREDICATE_NAMES.has(edgeReferences.predicateId.value)) {
    collectGraphClassEdge(edgeReferences, state.nodeSummaries);
  }
}

function getEdgeReferences(clause: ParsedClause): EdgeReferences | null {
  if (clause.predicate !== 'Edge' || clause.references.length < 3) {
    return null;
  }

  const [subjectId, predicateId, objectId] = clause.references;

  if (subjectId === undefined || predicateId === undefined || objectId === undefined) {
    return null;
  }

  return { subjectId, predicateId, objectId };
}

function collectEdgeReferenceIds(edgeReferences: EdgeReferences, state: GraphSemanticsState): void {
  state.nodeIds.add(edgeReferences.subjectId.value);
  state.nodeIds.add(edgeReferences.objectId.value);
  state.graphPredicateIds.add(edgeReferences.predicateId.value);
}

function collectGraphLabelEdge(
  edgeReferences: EdgeReferences,
  nodeSummaries: Map<string, NodeSummary>,
): void {
  const current = nodeSummaries.get(edgeReferences.subjectId.value);
  nodeSummaries.set(
    edgeReferences.subjectId.value,
    createNodeSummary({
      id: edgeReferences.subjectId.value,
      range: edgeReferences.subjectId.range,
      classes: current?.classes ?? [],
      label: edgeReferences.objectId.value,
    }),
  );
}

function collectGraphClassEdge(
  edgeReferences: EdgeReferences,
  nodeSummaries: Map<string, NodeSummary>,
): void {
  const current = nodeSummaries.get(edgeReferences.subjectId.value);
  const classes = new Set(current?.classes ?? []);
  classes.add(edgeReferences.objectId.value);
  nodeSummaries.set(
    edgeReferences.subjectId.value,
    createNodeSummary(createGraphClassNodeSummaryInput({
      id: edgeReferences.subjectId.value,
      range: edgeReferences.subjectId.range,
      classes: [...classes],
      ...(current?.label === undefined ? {} : { label: current.label }),
    })),
  );
}
