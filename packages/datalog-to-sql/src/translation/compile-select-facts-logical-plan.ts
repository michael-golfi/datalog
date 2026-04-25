import {
  assertCurrentNodeId,
  createDistinctNode,
  createJoinNode,
  createProjectNode,
  createProjectionBinding,
  getVariableBinding,
  rebindVariableBinding,
  type VariableBinding,
} from './select-facts-logical-plan-node-factory.js';
import { compileSelectFactsPattern } from './select-facts-logical-plan-pattern.js';

import type {
  LogicalNodeId,
  LogicalPlan,
  LogicalPlanNode,
  OutputColumn,
} from '../contracts/logical-plan.js';
import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';
import type { PredicateCatalog } from '../contracts/predicate-catalog.js';

/** Compile a select-facts operation into the shared logical-plan IR. */
export function compileSelectFactsLogicalPlan(
  operation: SelectFactsOperation,
  catalog: PredicateCatalog,
): LogicalPlan {
  const compilerState = createCompilerState();

  for (const [index, pattern] of operation.match.entries()) {
    compileAndAppendPattern({
      index,
      pattern,
      catalog,
      state: compilerState,
    });
  }

  return createLogicalPlan({
    catalog,
    nodes: compilerState.nodes,
    inputNodeId: assertCurrentNodeId(compilerState.currentNodeId),
    variableBindings: compilerState.variableBindings,
    variableOrder: compilerState.variableOrder,
  });
}

interface SelectFactsLogicalPlanCompilerState {
  readonly nodes: Record<string, LogicalPlanNode>;
  readonly variableBindings: Map<string, VariableBinding>;
  readonly variableOrder: string[];
  currentNodeId?: LogicalNodeId;
  currentOutput: readonly OutputColumn[];
  joinCount: number;
}

function createCompilerState(): SelectFactsLogicalPlanCompilerState {
  return {
    nodes: {},
    variableBindings: new Map<string, VariableBinding>(),
    variableOrder: [],
    currentOutput: [],
    joinCount: 0,
  };
}

function compileAndAppendPattern(input: {
  readonly index: number;
  readonly pattern: SelectFactsOperation['match'][number];
  readonly catalog: PredicateCatalog;
  readonly state: SelectFactsLogicalPlanCompilerState;
}): void {
  const compiledPattern = compileSelectFactsPattern({
    index: input.index,
    pattern: input.pattern,
    catalog: input.catalog,
    variableBindings: input.state.variableBindings,
    variableOrder: input.state.variableOrder,
  });

  Object.assign(input.state.nodes, compiledPattern.nodes);

  if (input.state.currentNodeId === undefined) {
    input.state.currentNodeId = compiledPattern.nodeId;
    input.state.currentOutput = compiledPattern.output;
    promoteBindings(
      input.state.variableBindings,
      compiledPattern.promotedVariables,
      compiledPattern.nodeId,
    );
    return;
  }

  appendJoinedPattern(input.state, compiledPattern);
}

function appendJoinedPattern(
  state: SelectFactsLogicalPlanCompilerState,
  compiledPattern: ReturnType<typeof compileSelectFactsPattern>,
): void {
  state.joinCount += 1;
  const joinNode = createJoinNode({
    joinCount: state.joinCount,
    leftNodeId: assertCurrentNodeId(state.currentNodeId),
    rightNodeId: compiledPattern.nodeId,
    leftOutput: state.currentOutput,
    rightOutput: compiledPattern.output,
    joinConditions: compiledPattern.joinConditions,
  });

  state.nodes[joinNode.id] = joinNode;
  state.currentNodeId = joinNode.id;
  state.currentOutput = joinNode.output;
  rebindAllBindings(state.variableBindings, joinNode.id);
  promoteBindings(state.variableBindings, compiledPattern.promotedVariables, joinNode.id);
}

function promoteBindings(
  bindings: Map<string, VariableBinding>,
  variables: ReadonlyArray<readonly [string, VariableBinding]>,
  nodeId: LogicalNodeId,
): void {
  for (const [name, binding] of variables) {
    bindings.set(name, rebindVariableBinding(binding, nodeId));
  }
}

function rebindAllBindings(bindings: Map<string, VariableBinding>, nodeId: LogicalNodeId): void {
  for (const [name, binding] of bindings) {
    bindings.set(name, rebindVariableBinding(binding, nodeId));
  }
}

function createLogicalPlan(input: {
  readonly catalog: PredicateCatalog;
  readonly nodes: Record<string, LogicalPlanNode>;
  readonly inputNodeId: LogicalNodeId;
  readonly variableBindings: ReadonlyMap<string, VariableBinding>;
  readonly variableOrder: readonly string[];
}): LogicalPlan {
  const projections = input.variableOrder.map((name) => {
    return createProjectionBinding(name, getVariableBinding(name, input.variableBindings));
  });
  const projectNode = createProjectNode(input.inputNodeId, projections);
  const distinctNode = createDistinctNode(projectNode.id, projectNode.output);
  input.nodes[projectNode.id] = projectNode;
  input.nodes[distinctNode.id] = distinctNode;

  return {
    kind: 'logical-plan',
    mode: 'query',
    catalog: input.catalog,
    rootNodeId: distinctNode.id,
    nodes: input.nodes,
    output: projectNode.output,
    parameters: [],
  };
}
