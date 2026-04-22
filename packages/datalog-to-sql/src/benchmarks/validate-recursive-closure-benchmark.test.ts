import { describe, expect, it } from 'vitest';

import { createRecursiveClosureBenchmarkFixture } from './create-recursive-closure-benchmark-fixture.js';
import { DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT } from './recursive-closure-benchmark-contract.js';
import { validateRecursiveClosureBenchmark } from './validate-recursive-closure-benchmark.js';

describe('validateRecursiveClosureBenchmark', () => {
  const fixture = createRecursiveClosureBenchmarkFixture(
    DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT,
  );

  it('passes when the seeded closure count and execution times meet the contract', () => {
    expect(
      validateRecursiveClosureBenchmark(
        DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT,
        fixture,
        {
          postgresMajorVersion: 13,
          closureRowCount: fixture.expectedClosureRowCount,
          executionTimesMs: [61, 63, 64, 66, 69],
        },
      ),
    ).toEqual({
      ok: true,
      summary: {
        expectedClosureRowCount: 21844,
        actualClosureRowCount: 21844,
        medianExecutionTimeMs: 64,
        maxExecutionTimeMs: 69,
      },
    });
  });

  it('fails deterministically when the result count or performance target regresses', () => {
    expect(
      validateRecursiveClosureBenchmark(
        DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT,
        fixture,
        {
          postgresMajorVersion: 12,
          closureRowCount: 20000,
          executionTimesMs: [101, 150, 180, 181, 190],
        },
      ),
    ).toEqual({
      ok: false,
      reasons: [
        'Expected PostgreSQL 13+ but measured 12.',
        'Expected 21844 recursive closure rows but measured 20000.',
        'Median execution time 180ms exceeded 125ms.',
        'Max execution time 190ms exceeded 175ms.',
      ],
      summary: {
        expectedClosureRowCount: 21844,
        actualClosureRowCount: 20000,
        medianExecutionTimeMs: 180,
        maxExecutionTimeMs: 190,
      },
    });
  });
});
