import type { DatalogPredicateName, DatalogRuleId } from '@datalog/ast';

import type { LogicalColumnId, LogicalNodeId } from './logical-plan.js';
import type { RelationColumnBinding } from './predicate-catalog.js';

export interface RecursiveScc {
  readonly id: number;
  readonly predicates: readonly [DatalogPredicateName, ...DatalogPredicateName[]];
  readonly ruleIds: readonly [DatalogRuleId, ...DatalogRuleId[]];
  readonly stratum: number;
  readonly selfRecursive: boolean;
}

export interface WorkRelationDefinition {
  readonly relationName: string;
  readonly columns: readonly RelationColumnBinding[];
  readonly keyColumns: readonly [string, ...string[]];
}

export interface RecursiveDeltaExpansion {
  readonly deltaBodyAtomIndex: number;
  readonly candidateNodeId: LogicalNodeId;
}

export interface RecursiveRulePlan {
  readonly ruleId: DatalogRuleId;
  readonly targetPredicate: DatalogPredicateName;
  readonly firstIterationOnly: boolean;
  readonly expansions: readonly [RecursiveDeltaExpansion, ...RecursiveDeltaExpansion[]];
}

export interface RecursiveDeduplication {
  readonly strategy: 'distinct' | 'hash-set' | 'primary-key-anti-join';
  readonly keyColumns: readonly [LogicalColumnId, ...LogicalColumnId[]];
}

export interface RecursiveTermination {
  readonly stopWhen: 'delta-empty' | 'iteration-limit';
  readonly maxIterations?: number;
}

export interface TransitiveClosureFastPath {
  readonly kind: 'transitive-closure';
  readonly sourceColumn: string;
  readonly targetColumn: string;
  readonly strategy: 'with-recursive' | 'semi-naive';
}

export interface RecursiveFixpoint {
  readonly kind: 'recursive-fixpoint';
  readonly id: string;
  readonly scc: RecursiveScc;
  readonly strategy:
    | 'postgres-with-recursive'
    | 'postgres-semi-naive-temp-relations'
    | 'memory-semi-naive';
  readonly target: WorkRelationDefinition;
  readonly seedNodeId: LogicalNodeId;
  readonly rules: readonly [RecursiveRulePlan, ...RecursiveRulePlan[]];
  readonly deduplication: RecursiveDeduplication;
  readonly termination: RecursiveTermination;
  readonly fastPath?: TransitiveClosureFastPath;
}
