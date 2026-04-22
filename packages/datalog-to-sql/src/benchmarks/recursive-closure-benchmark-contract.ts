export interface RecursiveClosureBenchmarkDataset {
  readonly rootVertexId: string;
  readonly predicateId: string;
  readonly depth: number;
  readonly branchFactor: number;
  readonly warmupRuns: number;
  readonly measuredRuns: number;
}

export interface RecursiveClosureBenchmarkThresholds {
  readonly maxMedianExecutionTimeMs: number;
  readonly maxExecutionTimeMs: number;
}

export interface RecursiveClosureBenchmarkContract {
  readonly minimumPostgresVersion: 13;
  readonly postgresImage: 'postgres:13-alpine';
  readonly databaseName: string;
  readonly username: string;
  readonly password: string;
  readonly dataset: RecursiveClosureBenchmarkDataset;
  readonly thresholds: RecursiveClosureBenchmarkThresholds;
  readonly evidenceFileName: string;
}

export const DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT: RecursiveClosureBenchmarkContract = {
  minimumPostgresVersion: 13,
  postgresImage: 'postgres:13-alpine',
  databaseName: 'datalog_benchmark',
  username: 'postgres',
  password: 'postgres',
  dataset: {
    rootVertexId: 'vertex/root',
    predicateId: 'graph/reachable',
    depth: 7,
    branchFactor: 4,
    warmupRuns: 1,
    measuredRuns: 5,
  },
  thresholds: {
    maxMedianExecutionTimeMs: 125,
    maxExecutionTimeMs: 175,
  },
  evidenceFileName: 'task-16-recursive-closure-benchmark.json',
};

/** Compute the number of rows expected from the recursive closure query. */
export function computeRecursiveClosureRowCount(dataset: RecursiveClosureBenchmarkDataset): number {
  let total = 0;
  let frontierWidth = 1;

  for (let level = 1; level <= dataset.depth; level += 1) {
    frontierWidth *= dataset.branchFactor;
    total += frontierWidth;
  }

  return total;
}

/** Compute the total number of vertices implied by the benchmark dataset. */
export function computeRecursiveClosureVertexCount(dataset: RecursiveClosureBenchmarkDataset): number {
  return computeRecursiveClosureRowCount(dataset) + 1;
}
