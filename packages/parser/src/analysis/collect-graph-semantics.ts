import type {
  NodeSummary,
  ParsedClause,
  ParsedDocument,
  PredicateSchema,
} from '../contracts/parsed-document.js';
import {
  BUILTIN_PREDICATE_NAMES,
  GRAPH_CLASS_PREDICATE_NAMES,
  GRAPH_LABEL_PREDICATE,
} from '../semantics/graph-vocabulary.js';

import { createGraphClassNodeSummaryInput, createNodeSummary } from './node-summary.js';

type CollectedGraphSemantics = Omit<ParsedDocument, 'clauses' | 'lineStarts'>;

interface GraphSemanticsState {
  readonly predicateSchemas: Map<string, PredicateSchema>;
  readonly derivedPredicates: Map<string, ParsedClause[]>;
  readonly compoundPredicates: Map<string, Set<string>>;
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
  const state = createGraphSemanticsState();

  for (const clause of clauses) {
    collectClauseSemantics(clause, state);
  }

  addSchemaNodeIds(state);
  return finalizeGraphSemantics(state);
}

function createGraphSemanticsState(): GraphSemanticsState {
  return {
    predicateSchemas: new Map<string, PredicateSchema>(),
    derivedPredicates: new Map<string, ParsedClause[]>(),
    compoundPredicates: new Map<string, Set<string>>(),
    nodeSummaries: new Map<string, NodeSummary>(),
    graphPredicateIds: new Set<string>(),
    nodeIds: new Set<string>(),
  };
}

function collectClauseSemantics(clause: ParsedClause, state: GraphSemanticsState): void {
  collectDerivedPredicates(clause, state.derivedPredicates);
  collectReferenceIds(clause, state.graphPredicateIds, state.nodeIds);
  collectPredicateSchema(clause, state.predicateSchemas, state.graphPredicateIds);
  collectEdgeSemantics(clause, state);
  collectCompoundPredicates(clause, state.compoundPredicates);
}

function addSchemaNodeIds(state: GraphSemanticsState): void {
  for (const schema of state.predicateSchemas.values()) {
    state.nodeIds.add(schema.subjectType);
    state.nodeIds.add(schema.objectType);
  }
}

function finalizeGraphSemantics(state: GraphSemanticsState): CollectedGraphSemantics {
  return {
    predicateSchemas: state.predicateSchemas,
    derivedPredicates: state.derivedPredicates,
    compoundPredicates: state.compoundPredicates,
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

function collectPredicateSchema(
  clause: ParsedClause,
  predicateSchemas: Map<string, PredicateSchema>,
  graphPredicateIds: Set<string>,
): void {
  if (clause.predicate !== 'DefPred' || clause.references.length < 5) {
    return;
  }

  const predicateId = clause.references[0];
  const subjectCardinality = clause.references[1];
  const subjectType = clause.references[2];
  const objectCardinality = clause.references[3];
  const objectType = clause.references[4];

  if (
    predicateId === undefined
    || subjectCardinality === undefined
    || subjectType === undefined
    || objectCardinality === undefined
    || objectType === undefined
  ) {
    return;
  }

  predicateSchemas.set(predicateId.value, {
    predicateId: predicateId.value,
    subjectCardinality: subjectCardinality.value,
    subjectType: subjectType.value,
    objectCardinality: objectCardinality.value,
    objectType: objectType.value,
    range: predicateId.range,
  });
  graphPredicateIds.add(predicateId.value);
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

function collectCompoundPredicates(
  clause: ParsedClause,
  compoundPredicates: Map<string, Set<string>>,
): void {
  if (!clause.isCompound || clause.compoundFields.length === 0) {
    return;
  }

  const existing = compoundPredicates.get(clause.predicate) ?? new Set<string>();

  for (const field of clause.compoundFields) {
    existing.add(field);
  }

  compoundPredicates.set(clause.predicate, existing);
}
