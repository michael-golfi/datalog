import { describe, expect, it } from 'vitest';

import {
  computeRecursiveClosureRowCount,
  computeRecursiveClosureVertexCount,
  DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT,
} from './recursive-closure-benchmark-contract.js';

describe('recursive closure benchmark contract', () => {
  it('pins the benchmark to PostgreSQL 13+ with explicit recursive-closure thresholds', () => {
    expect(DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT).toMatchObject({
      minimumPostgresVersion: 13,
      postgresImage: 'postgres:13-alpine',
      thresholds: {
        maxMedianExecutionTimeMs: 125,
        maxExecutionTimeMs: 175,
      },
    });
  });

  it('computes deterministic recursive closure sizes from the seeded dataset shape', () => {
    expect(
      computeRecursiveClosureRowCount(DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT.dataset),
    ).toBe(21844);
    expect(
      computeRecursiveClosureVertexCount(DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT.dataset),
    ).toBe(21845);
  });
});
