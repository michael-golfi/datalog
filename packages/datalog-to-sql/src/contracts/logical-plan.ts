import type { DatalogPredicateName, DatalogScalarValue, DatalogTypeName } from './datalog-program.js';
import type { PredicateCatalog } from './predicate-catalog.js';

export type LogicalNodeId = string;
export type LogicalColumnId = string;
export type PlanParameterId = string;

export interface PlanParameter {
  readonly id: PlanParameterId;
  readonly type: DatalogTypeName;
  readonly required: boolean;
  readonly source: 'query' | 'directive' | 'runtime';
}

export interface OutputColumn {
  readonly id: LogicalColumnId;
  readonly name: string;
  readonly type: DatalogTypeName;
  readonly nullable?: boolean;
}

export interface ColumnReference {
  readonly kind: 'column';
  readonly nodeId: LogicalNodeId;
  readonly columnId: LogicalColumnId;
}

export interface ParameterReference {
  readonly kind: 'parameter';
  readonly parameterId: PlanParameterId;
}

export interface ScalarLiteral {
  readonly kind: 'literal';
  readonly value: DatalogScalarValue;
  readonly type: DatalogTypeName;
}

export interface ComparisonExpression {
  readonly kind: 'comparison';
  readonly operator: '=' | '!=' | '<' | '<=' | '>' | '>=';
  readonly left: LogicalExpression;
  readonly right: LogicalExpression;
}

export interface BooleanExpression {
  readonly kind: 'boolean';
  readonly operator: 'and' | 'or' | 'not';
  readonly args: readonly LogicalExpression[];
}

export interface FunctionExpression {
  readonly kind: 'function';
  readonly name: string;
  readonly args: readonly LogicalExpression[];
  readonly returns: DatalogTypeName;
}

export type LogicalExpression =
  | ColumnReference
  | ParameterReference
  | ScalarLiteral
  | ComparisonExpression
  | BooleanExpression
  | FunctionExpression;

export interface ProjectionBinding {
  readonly name: string;
  readonly expression: LogicalExpression;
  readonly type: DatalogTypeName;
}

export interface JoinCondition {
  readonly kind: 'equi' | 'predicate';
  readonly left?: ColumnReference;
  readonly right?: ColumnReference;
  readonly predicate?: LogicalExpression;
}

export interface SortKey {
  readonly expression: LogicalExpression;
  readonly direction: 'asc' | 'desc';
  readonly nulls?: 'first' | 'last';
}

export interface AggregateBinding {
  readonly name: string;
  readonly functionName: 'count' | 'count-distinct' | 'sum' | 'min' | 'max' | 'avg' | string;
  readonly args: readonly LogicalExpression[];
  readonly type: DatalogTypeName;
}

export interface LogicalScanNode {
  readonly kind: 'scan';
  readonly id: LogicalNodeId;
  readonly predicate: DatalogPredicateName;
  readonly output: readonly OutputColumn[];
  readonly filters?: readonly LogicalExpression[];
}

export interface LogicalValuesNode {
  readonly kind: 'values';
  readonly id: LogicalNodeId;
  readonly output: readonly OutputColumn[];
  readonly rows: ReadonlyArray<readonly DatalogScalarValue[]>;
}

export interface LogicalProjectNode {
  readonly kind: 'project';
  readonly id: LogicalNodeId;
  readonly inputNodeId: LogicalNodeId;
  readonly output: readonly OutputColumn[];
  readonly projections: readonly ProjectionBinding[];
}

export interface LogicalFilterNode {
  readonly kind: 'filter';
  readonly id: LogicalNodeId;
  readonly inputNodeId: LogicalNodeId;
  readonly output: readonly OutputColumn[];
  readonly predicate: LogicalExpression;
}

export interface LogicalJoinNode {
  readonly kind: 'join';
  readonly id: LogicalNodeId;
  readonly joinKind: 'inner' | 'left' | 'semi' | 'anti';
  readonly leftNodeId: LogicalNodeId;
  readonly rightNodeId: LogicalNodeId;
  readonly output: readonly OutputColumn[];
  readonly conditions: readonly [JoinCondition, ...JoinCondition[]];
}

export interface LogicalUnionNode {
  readonly kind: 'union';
  readonly id: LogicalNodeId;
  readonly unionKind: 'all' | 'distinct';
  readonly inputNodeIds: readonly [LogicalNodeId, ...LogicalNodeId[]];
  readonly output: readonly OutputColumn[];
}

export interface LogicalDistinctNode {
  readonly kind: 'distinct';
  readonly id: LogicalNodeId;
  readonly inputNodeId: LogicalNodeId;
  readonly output: readonly OutputColumn[];
  readonly keyColumns?: readonly LogicalColumnId[];
}

export interface LogicalAggregateNode {
  readonly kind: 'aggregate';
  readonly id: LogicalNodeId;
  readonly inputNodeId: LogicalNodeId;
  readonly output: readonly OutputColumn[];
  readonly groupBy: readonly ColumnReference[];
  readonly aggregates: readonly [AggregateBinding, ...AggregateBinding[]];
}

export interface LogicalSortNode {
  readonly kind: 'sort';
  readonly id: LogicalNodeId;
  readonly inputNodeId: LogicalNodeId;
  readonly output: readonly OutputColumn[];
  readonly sortKeys: readonly [SortKey, ...SortKey[]];
}

export interface LogicalLimitNode {
  readonly kind: 'limit';
  readonly id: LogicalNodeId;
  readonly inputNodeId: LogicalNodeId;
  readonly output: readonly OutputColumn[];
  readonly limit: number;
  readonly offset?: number;
}

export interface LogicalMaterializeNode {
  readonly kind: 'materialize';
  readonly id: LogicalNodeId;
  readonly inputNodeId: LogicalNodeId;
  readonly output: readonly OutputColumn[];
  readonly strategy: 'backend-default' | 'cte' | 'temp-relation' | 'memory-buffer';
  readonly reuseKey: string;
  readonly reason:
    | 'shared-subplan'
    | 'recursive-frontier'
    | 'cardinality-control'
    | 'join-reuse'
    | 'debug';
}

export interface LogicalWorkRelationScanNode {
  readonly kind: 'work-relation-scan';
  readonly id: LogicalNodeId;
  readonly relationName: string;
  readonly role: 'seed' | 'all' | 'delta' | 'next';
  readonly output: readonly OutputColumn[];
}

export type LogicalPlanNode =
  | LogicalScanNode
  | LogicalValuesNode
  | LogicalProjectNode
  | LogicalFilterNode
  | LogicalJoinNode
  | LogicalUnionNode
  | LogicalDistinctNode
  | LogicalAggregateNode
  | LogicalSortNode
  | LogicalLimitNode
  | LogicalMaterializeNode
  | LogicalWorkRelationScanNode;

export interface PlanDiagnostic {
  readonly level: 'info' | 'warning' | 'error';
  readonly code: string;
  readonly message: string;
}

export interface SharedSubplan {
  readonly reuseKey: string;
  readonly nodeId: LogicalNodeId;
  readonly referenceCount: number;
}

export interface LogicalPlan {
  readonly kind: 'logical-plan';
  readonly mode: 'query' | 'mutation';
  readonly catalog: PredicateCatalog;
  readonly rootNodeId: LogicalNodeId;
  readonly nodes: Readonly<Record<LogicalNodeId, LogicalPlanNode>>;
  readonly output: readonly OutputColumn[];
  readonly parameters: readonly PlanParameter[];
  readonly sharedSubplans?: readonly SharedSubplan[];
  readonly diagnostics?: readonly PlanDiagnostic[];
}
