import type { DatalogProgram } from '@datalog/ast';

import type { NormalizedProgram } from './datalog-program.js';
import type { LogicalPlan } from './logical-plan.js';
import type { BackendKind, PhysicalPlan } from './physical-plan.js';
import type { PredicateCatalog } from './predicate-catalog.js';
import type { RecursiveFixpoint } from './recursive-fixpoint.js';

export interface DatalogCompilerOptions {
  readonly backend: BackendKind;
  readonly recursionStrategy?: 'auto' | 'postgres-with-recursive' | 'semi-naive';
  readonly forceMaterializedSubplans?: boolean;
  readonly analyzeWorkRelations?: boolean;
  readonly enableFastPathTransitiveClosure?: boolean;
  readonly maxRecursiveIterations?: number;
}

export interface CompilerArtifacts {
  readonly ast: DatalogProgram;
  readonly normalized: NormalizedProgram;
  readonly logicalPlan: LogicalPlan;
  readonly recursiveFixpoints: readonly RecursiveFixpoint[];
  readonly physicalPlan: PhysicalPlan;
}

export interface DatalogCompiler {
  readonly catalog: PredicateCatalog;
  compile(program: DatalogProgram, options: DatalogCompilerOptions): CompilerArtifacts;
}
