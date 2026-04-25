import { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type {
  LogicalFilterNode,
  LogicalJoinNode,
  LogicalPlan,
  LogicalPlanNode,
  LogicalProjectNode,
  LogicalScanNode,
} from '../contracts/logical-plan.js';
import type { PredicateBinding, PredicateCatalog, PredicateStorageBinding } from '../contracts/predicate-catalog.js';

import type { RenderContext } from './render-logical-plan-sql-context.js';
import { renderExpression, renderJoinCondition } from './render-logical-plan-sql-expression.js';

export interface RenderedSource {
  readonly from: string;
  readonly where: readonly string[];
}

/** Resolve the required `distinct -> project` root chain for SQL rendering. */
export function getDistinctProjectRoot(plan: LogicalPlan): {
  readonly distinctNode: Extract<LogicalPlanNode, { kind: 'distinct' }>;
  readonly projectNode: LogicalProjectNode;
} {
  const distinctNode = expectDistinctNode(getNode(plan, plan.rootNodeId));
  const projectNode = expectProjectNode(getNode(plan, distinctNode.inputNodeId));

  return {
    distinctNode,
    projectNode,
  };
}

/** Render the `from`/`where` source fragments for the supported plan subset. */
export function renderSource(nodeId: string, context: RenderContext): RenderedSource {
  const node = getNode(context.plan, nodeId);

  if (node.kind === 'join') {
    return renderJoinSource(node, context);
  }

  if (node.kind === 'filter') {
    return renderFilterSource(node, context);
  }

  if (node.kind === 'scan') {
    return {
      from: renderScanSource(node, context.plan.catalog),
      where: [],
    };
  }

  throw createUnsupportedNodeError(node.kind);
}

function renderJoinSource(node: LogicalJoinNode, context: RenderContext): RenderedSource {
  if (node.joinKind !== 'inner') {
    throw new GraphTranslationError('UNSUPPORTED_LOGICAL_PLAN_NODE', `Unsupported join kind ${node.joinKind}.`);
  }

  const leftSource = renderSource(node.leftNodeId, context);
  const rightSource = renderSource(node.rightNodeId, context);
  const onConditions = [...node.conditions.map((condition) => renderJoinCondition(condition, context)), ...rightSource.where];

  return {
    from: `${leftSource.from} join ${rightSource.from} on ${onConditions.join(' and ')}`,
    where: leftSource.where,
  };
}

function renderFilterSource(node: LogicalFilterNode, context: RenderContext): RenderedSource {
  const renderedInput = renderSource(node.inputNodeId, context);

  return {
    from: renderedInput.from,
    where: [...renderedInput.where, renderExpression(node.predicate, context)],
  };
}

function renderScanSource(node: LogicalScanNode, catalog: PredicateCatalog): string {
  const predicate = getPredicateBinding(catalog, node.predicate, node.output.length);
  const storage = predicate.storage;

  if (storage === undefined) {
    throw new GraphTranslationError(
      'UNSUPPORTED_GRAPH_PREDICATE',
      `Unsupported external predicate ${String(predicate.signature.name)}/${predicate.signature.arity} for SQL rendering.`,
    );
  }

  return `${renderStorageRelationName(storage, predicate)} ${node.id}`;
}

function getPredicateBinding(catalog: PredicateCatalog, predicateName: string, arity: number): PredicateBinding {
  const aliasedPredicateName = catalog.aliases?.[predicateName] ?? predicateName;
  const predicate = catalog.predicates.find((candidate) => {
    return candidate.signature.name === aliasedPredicateName && candidate.signature.arity === arity;
  });

  if (predicate !== undefined) {
    return predicate;
  }

  throw new GraphTranslationError(
    'UNSUPPORTED_GRAPH_PREDICATE',
    `Unsupported graph predicate ${aliasedPredicateName}/${arity}.`,
  );
}

function getNode(plan: LogicalPlan, nodeId: string): LogicalPlanNode {
  const node = plan.nodes[nodeId];

  if (node !== undefined) {
    return node;
  }

  throw new GraphTranslationError('UNSUPPORTED_LOGICAL_PLAN_NODE', `Missing logical plan node ${nodeId}.`);
}

function expectDistinctNode(node: LogicalPlanNode): Extract<LogicalPlanNode, { kind: 'distinct' }> {
  if (node.kind === 'distinct') {
    return node;
  }

  throw createUnsupportedNodeError(node.kind);
}

function expectProjectNode(node: LogicalPlanNode): LogicalProjectNode {
  if (node.kind === 'project') {
    return node;
  }

  throw createUnsupportedNodeError(node.kind);
}

function createUnsupportedNodeError(kind: LogicalPlanNode['kind']): GraphTranslationError {
  return new GraphTranslationError('UNSUPPORTED_LOGICAL_PLAN_NODE', `Unsupported logical plan node ${kind}.`);
}

function renderStorageRelationName(storage: PredicateStorageBinding, predicate: PredicateBinding): string {
  if (storage.kind === 'work-table') {
    return quoteIdentifier(storage.relationName);
  }

  if (storage.kind === 'postgres-table' || storage.kind === 'postgres-view') {
    return quoteRelationName(storage);
  }

  throw new GraphTranslationError(
    'UNSUPPORTED_GRAPH_PREDICATE',
    `Unsupported storage binding ${storage.kind} for ${String(predicate.signature.name)}/${predicate.signature.arity}.`,
  );
}

function quoteRelationName(storage: Extract<PredicateStorageBinding, { kind: 'postgres-table' | 'postgres-view' }>): string {
  if (storage.schemaName === undefined) {
    return storage.relationName;
  }

  return `${quoteIdentifier(storage.schemaName)}.${quoteIdentifier(storage.relationName)}`;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
