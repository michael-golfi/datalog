import type { DatalogScalarValue } from '@datalog/ast';
import type { OutputColumn, PlanDiagnostic, PlanParameter } from './logical-plan.js';
import type { WorkRelationDefinition } from './recursive-fixpoint.js';

export type BackendKind = 'postgres' | 'memory';
export type PhysicalStepId = string;
export type SqlParameterValue =
  | DatalogScalarValue
  | Date
  | Uint8Array
  | readonly DatalogScalarValue[];

export interface PreparedStatementTemplate {
  readonly key: string;
  readonly sql: string;
  readonly parameterOrder: readonly string[];
}

export interface PostgresCreateWorkRelationStep {
  readonly kind: 'postgres-create-work-relation';
  readonly id: PhysicalStepId;
  readonly relation: WorkRelationDefinition;
  readonly temporary: boolean;
  readonly unlogged?: boolean;
}

export interface PostgresAnalyzeWorkRelationStep {
  readonly kind: 'postgres-analyze-work-relation';
  readonly id: PhysicalStepId;
  readonly relationName: string;
}

export interface PostgresExecuteStatementStep {
  readonly kind: 'postgres-execute-statement';
  readonly id: PhysicalStepId;
  readonly statement: PreparedStatementTemplate;
  readonly writesTo?: readonly string[];
  readonly readsFrom?: readonly string[];
  readonly resultColumns?: readonly OutputColumn[];
}

export interface PostgresIterativeFixpointStep {
  readonly kind: 'postgres-iterative-fixpoint';
  readonly id: PhysicalStepId;
  readonly allRelationName: string;
  readonly deltaRelationName: string;
  readonly nextRelationName: string;
  readonly seedStatement: PreparedStatementTemplate;
  readonly deltaStatements: readonly [PreparedStatementTemplate, ...PreparedStatementTemplate[]];
  readonly swapMode: 'truncate-and-insert' | 'rename' | 'delete-and-insert';
  readonly termination: 'delta-empty' | 'iteration-limit';
  readonly maxIterations?: number;
}

export interface PostgresEmitResultStep {
  readonly kind: 'postgres-emit-result';
  readonly id: PhysicalStepId;
  readonly statement: PreparedStatementTemplate;
  readonly resultColumns: readonly OutputColumn[];
}

export interface MemoryLoadRelationStep {
  readonly kind: 'memory-load-relation';
  readonly id: PhysicalStepId;
  readonly relationName: string;
}

export interface MemoryBuildIndexStep {
  readonly kind: 'memory-build-index';
  readonly id: PhysicalStepId;
  readonly relationName: string;
  readonly indexName: string;
  readonly columns: readonly string[];
}

export interface MemoryIterativeFixpointStep {
  readonly kind: 'memory-iterative-fixpoint';
  readonly id: PhysicalStepId;
  readonly allRelationName: string;
  readonly deltaRelationName: string;
  readonly nextRelationName: string;
  readonly seedPlanKey: string;
  readonly deltaPlanKeys: readonly [string, ...string[]];
  readonly termination: 'delta-empty' | 'iteration-limit';
  readonly maxIterations?: number;
}

export interface MemoryEmitResultStep {
  readonly kind: 'memory-emit-result';
  readonly id: PhysicalStepId;
  readonly relationName: string;
  readonly resultColumns: readonly OutputColumn[];
}

export type PostgresPhysicalStep =
  | PostgresCreateWorkRelationStep
  | PostgresAnalyzeWorkRelationStep
  | PostgresExecuteStatementStep
  | PostgresIterativeFixpointStep
  | PostgresEmitResultStep;

export type MemoryPhysicalStep =
  | MemoryLoadRelationStep
  | MemoryBuildIndexStep
  | MemoryIterativeFixpointStep
  | MemoryEmitResultStep;

export interface PostgresPhysicalPlan {
  readonly kind: 'physical-plan';
  readonly backend: 'postgres';
  readonly parameters: readonly PlanParameter[];
  readonly preparedStatements: readonly PreparedStatementTemplate[];
  readonly steps: readonly PostgresPhysicalStep[];
  readonly output: readonly OutputColumn[];
  readonly diagnostics?: readonly PlanDiagnostic[];
}

export interface MemoryPhysicalPlan {
  readonly kind: 'physical-plan';
  readonly backend: 'memory';
  readonly parameters: readonly PlanParameter[];
  readonly steps: readonly MemoryPhysicalStep[];
  readonly output: readonly OutputColumn[];
  readonly diagnostics?: readonly PlanDiagnostic[];
}

export type PhysicalPlan = PostgresPhysicalPlan | MemoryPhysicalPlan;
