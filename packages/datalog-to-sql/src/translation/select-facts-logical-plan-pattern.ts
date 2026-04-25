import {
  createColumnReference,
  createFilterNode,
  createScanNode,
  type VariableBinding,
} from './select-facts-logical-plan-node-factory.js';
import {
  bindPatternTerm,
  type PendingJoinCondition,
} from './select-facts-logical-plan-pattern-binding.js';
import { getPatternBindings, getSelectFactsPredicateBinding } from './select-facts-logical-plan-pattern-predicate.js';
import { getPredicateColumns, type PredicateCatalog } from '../contracts/predicate-catalog.js';

import type { LogicalExpression, LogicalJoinNode, LogicalPlanNode, LogicalNodeId, OutputColumn } from '../contracts/logical-plan.js';
import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';

interface CompiledPatternInput {
  readonly index: number;
  readonly pattern: SelectFactsOperation['match'][number];
  readonly catalog: PredicateCatalog;
  readonly variableBindings: ReadonlyMap<string, VariableBinding>;
  readonly variableOrder: string[];
}

export interface CompiledPattern {
  readonly nodeId: LogicalNodeId;
  readonly output: readonly OutputColumn[];
  readonly nodes: Record<string, LogicalPlanNode>;
  readonly promotedVariables: ReadonlyArray<readonly [string, VariableBinding]>;
  readonly joinConditions: ReadonlyArray<LogicalJoinNode['conditions'][number]>;
}

/** Compile one select-facts pattern into scan/filter nodes plus pending join metadata. */
export function compileSelectFactsPattern(input: CompiledPatternInput): CompiledPattern {
  const predicate = getSelectFactsPredicateBinding(input.pattern, input.catalog);
  const scanNode = createScanNode(input.index, predicate);
  const localBindings = new Map<string, VariableBinding>();
  const localFilters: LogicalExpression[] = [];
  const pendingJoinConditions: PendingJoinCondition[] = [];
  const pendingVariables: Array<readonly [string, VariableBinding]> = [];

  for (const binding of getPatternBindings(input.pattern, getPredicateColumns(predicate))) {
    bindPatternTerm({
      scanNodeId: scanNode.id,
      binding,
      variableBindings: input.variableBindings,
      variableOrder: input.variableOrder,
      localBindings,
      localFilters,
      pendingJoinConditions,
      pendingVariables,
    });
  }

  const filteredPattern = createFilteredPattern({
    scanNodeId: scanNode.id,
    output: scanNode.output,
    filters: localFilters,
    index: input.index,
  });

  return {
    nodeId: filteredPattern.nodeId,
    output: filteredPattern.output,
    nodes: createPatternNodes(scanNode, filteredPattern.node),
    promotedVariables: pendingVariables,
    joinConditions: createJoinConditions(pendingJoinConditions, filteredPattern.nodeId),
  };
}

function createPatternNodes(scanNode: LogicalPlanNode, filterNode?: LogicalPlanNode): Record<string, LogicalPlanNode> {
  return filterNode === undefined
    ? { [scanNode.id]: scanNode }
    : { [scanNode.id]: scanNode, [filterNode.id]: filterNode };
}

function createJoinConditions(
  pendingJoinConditions: readonly PendingJoinCondition[],
  rightNodeId: LogicalNodeId,
): ReadonlyArray<LogicalJoinNode['conditions'][number]> {
  return pendingJoinConditions.map((condition) => ({
    kind: 'equi',
    left: createColumnReference(condition.left.nodeId, condition.left.columnId),
    right: createColumnReference(rightNodeId, condition.right.columnId),
  }));
}

function createFilteredPattern(input: {
  readonly scanNodeId: LogicalNodeId;
  readonly output: readonly OutputColumn[];
  readonly filters: readonly LogicalExpression[];
  readonly index: number;
}): {
  readonly nodeId: LogicalNodeId;
  readonly output: readonly OutputColumn[];
  readonly node?: LogicalPlanNode;
} {
  if (input.filters.length === 0) {
    return {
      nodeId: input.scanNodeId,
      output: input.output,
    };
  }

  const filterNode = createFilterNode({
    index: input.index,
    inputNodeId: input.scanNodeId,
    output: input.output,
    filters: input.filters,
  });

  return {
    nodeId: filterNode.id,
    output: filterNode.output,
    node: filterNode,
  };
}
