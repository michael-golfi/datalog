import { getPredicateColumns, type PredicateBinding, type RelationColumnBinding } from '../contracts/predicate-catalog.js';

import type {
  ColumnReference,
  LogicalDistinctNode,
  LogicalExpression,
  LogicalFilterNode,
  LogicalJoinNode,
  LogicalNodeId,
  LogicalProjectNode,
  LogicalScanNode,
  OutputColumn,
  ProjectionBinding,
  ScalarLiteral,
} from '../contracts/logical-plan.js';

export interface VariableBinding {
  readonly nodeId: LogicalNodeId;
  readonly columnId: string;
  readonly type: OutputColumn['type'];
}

/** Create the scan node for one select-facts pattern. */
export function createScanNode(index: number, predicate: PredicateBinding): LogicalScanNode {
  const id = `scan_${index + 1}`;

  return {
    kind: 'scan',
    id,
    predicate: predicate.signature.name,
    output: getPredicateColumns(predicate).map((column) => createOutputColumn(id, column)),
  };
}

/** Create the stable column identifier used across wrapper nodes. */
export function createScanColumnId(nodeId: LogicalNodeId, columnName: string): string {
  return `${nodeId}.${columnName}`;
}

/** Create a filter node when one pattern introduces constant or repeated-variable predicates. */
export function createFilterNode(input: {
  readonly index: number;
  readonly inputNodeId: LogicalNodeId;
  readonly output: readonly OutputColumn[];
  readonly filters: readonly LogicalExpression[];
}): LogicalFilterNode {
  return {
    kind: 'filter',
    id: `filter_${input.index + 1}`,
    inputNodeId: input.inputNodeId,
    output: input.output,
    predicate: combineExpressions(input.filters),
  };
}

/** Create an inner join node for one compiled pattern append. */
export function createJoinNode(input: {
  readonly joinCount: number;
  readonly leftNodeId: LogicalNodeId;
  readonly rightNodeId: LogicalNodeId;
  readonly leftOutput: readonly OutputColumn[];
  readonly rightOutput: readonly OutputColumn[];
  readonly joinConditions: ReadonlyArray<LogicalJoinNode['conditions'][number]>;
}): LogicalJoinNode {
  return {
    kind: 'join',
    id: `join_${input.joinCount}`,
    joinKind: 'inner',
    leftNodeId: input.leftNodeId,
    rightNodeId: input.rightNodeId,
    output: [...input.leftOutput, ...input.rightOutput],
    conditions: asNonEmptyConditions(input.joinConditions),
  };
}

/** Create the final project node that exposes query variables as output columns. */
export function createProjectNode(
  inputNodeId: LogicalNodeId,
  projections: readonly ProjectionBinding[],
): LogicalProjectNode {
  const output = projections.map((projection) => ({
    id: projection.name,
    name: projection.name,
    type: projection.type,
  } satisfies OutputColumn));

  return {
    kind: 'project',
    id: 'project_1',
    inputNodeId,
    output,
    projections,
  };
}

/** Create the final distinct node for the current select-facts pipeline. */
export function createDistinctNode(
  inputNodeId: LogicalNodeId,
  output: readonly OutputColumn[],
): LogicalDistinctNode {
  return {
    kind: 'distinct' as const,
    id: 'distinct_1',
    inputNodeId,
    output,
    keyColumns: output.map((column) => column.id),
  };
}

/** Create a projection binding for one promoted query variable. */
export function createProjectionBinding(name: string, binding: VariableBinding): ProjectionBinding {
  return {
    name,
    expression: createColumnReference(binding.nodeId, binding.columnId),
    type: binding.type,
  };
}

/** Rebind a variable reference to the current wrapper node without changing its scan column id. */
export function rebindVariableBinding(binding: VariableBinding, nodeId: LogicalNodeId): VariableBinding {
  return {
    ...binding,
    nodeId,
  };
}

/** Create a logical column reference. */
export function createColumnReference(nodeId: LogicalNodeId, columnId: string): ColumnReference {
  return {
    kind: 'column',
    nodeId,
    columnId,
  };
}

/** Create an equality expression used by filters and joins. */
export function createEqualityExpression(left: ColumnReference, right: ColumnReference | ScalarLiteral): LogicalExpression {
  return {
    kind: 'comparison',
    operator: '=',
    left,
    right,
  };
}

/** Create a typed scalar literal for a select-facts predicate. */
export function createLiteral(value: string, type: OutputColumn['type']): ScalarLiteral {
  return {
    kind: 'literal',
    value,
    type,
  };
}

/** Assert that compilation produced at least one plan node. */
export function assertCurrentNodeId(currentNodeId: LogicalNodeId | undefined): LogicalNodeId {
  if (currentNodeId !== undefined) {
    return currentNodeId;
  }

  throw new Error('Expected select-facts compilation to produce at least one node.');
}

/** Look up the current binding for a promoted query variable. */
export function getVariableBinding(name: string, bindings: ReadonlyMap<string, VariableBinding>): VariableBinding {
  const binding = bindings.get(name);

  if (binding !== undefined) {
    return binding;
  }

  throw new Error(`Missing variable binding for ${name}.`);
}

function createOutputColumn(nodeId: LogicalNodeId, column: RelationColumnBinding): OutputColumn {
  const outputColumn = {
    id: createScanColumnId(nodeId, column.name),
    name: column.name,
    type: column.type,
  } satisfies OutputColumn;

  if (column.nullable === undefined) {
    return outputColumn;
  }

  return {
    ...outputColumn,
    nullable: column.nullable,
  };
}

function combineExpressions(expressions: readonly LogicalExpression[]): LogicalExpression {
  if (expressions.length === 1) {
    return expressions[0] as LogicalExpression;
  }

  return {
    kind: 'boolean',
    operator: 'and',
    args: expressions,
  };
}

function asNonEmptyConditions(
  conditions: ReadonlyArray<LogicalJoinNode['conditions'][number]>,
): LogicalJoinNode['conditions'] {
  const [firstCondition, ...remainingConditions] = conditions;

  if (firstCondition !== undefined) {
    return [firstCondition, ...remainingConditions];
  }

  return [
    {
      kind: 'predicate',
      predicate: {
        kind: 'literal',
        value: true,
        type: 'bool',
      },
    },
  ];
}
