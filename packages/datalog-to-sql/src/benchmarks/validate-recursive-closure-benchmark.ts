import type { RecursiveClosureBenchmarkContract } from './recursive-closure-benchmark-contract.js';
import type { RecursiveClosureBenchmarkFixture } from './create-recursive-closure-benchmark-fixture.js';

export interface RecursiveClosureBenchmarkMeasurement {
  readonly postgresMajorVersion: number;
  readonly closureRowCount: number;
  readonly executionTimesMs: readonly number[];
}

export interface RecursiveClosureBenchmarkSummary {
  readonly expectedClosureRowCount: number;
  readonly actualClosureRowCount: number;
  readonly medianExecutionTimeMs: number;
  readonly maxExecutionTimeMs: number;
}

export type RecursiveClosureBenchmarkValidationResult =
  | {
      readonly ok: true;
      readonly summary: RecursiveClosureBenchmarkSummary;
    }
  | {
      readonly ok: false;
      readonly reasons: readonly string[];
      readonly summary: RecursiveClosureBenchmarkSummary;
    };

/** Validate benchmark measurements against the benchmark contract. */
export function validateRecursiveClosureBenchmark(
  contract: RecursiveClosureBenchmarkContract,
  fixture: RecursiveClosureBenchmarkFixture,
  measurement: RecursiveClosureBenchmarkMeasurement,
): RecursiveClosureBenchmarkValidationResult {
  const summary = createBenchmarkSummary(fixture, measurement);
  const reasons = collectBenchmarkValidationReasons({ contract, fixture, measurement, summary });

  if (reasons.length === 0) {
    return {
      ok: true,
      summary,
    };
  }

  return {
    ok: false,
    reasons,
    summary,
  };
}

function createBenchmarkSummary(
  fixture: RecursiveClosureBenchmarkFixture,
  measurement: RecursiveClosureBenchmarkMeasurement,
): RecursiveClosureBenchmarkSummary {
  return {
    expectedClosureRowCount: fixture.expectedClosureRowCount,
    actualClosureRowCount: measurement.closureRowCount,
    medianExecutionTimeMs: computeMedian(measurement.executionTimesMs),
    maxExecutionTimeMs: Math.max(...measurement.executionTimesMs),
  };
}

function collectBenchmarkValidationReasons(input: {
  readonly contract: RecursiveClosureBenchmarkContract;
  readonly fixture: RecursiveClosureBenchmarkFixture;
  readonly measurement: RecursiveClosureBenchmarkMeasurement;
  readonly summary: RecursiveClosureBenchmarkSummary;
}): string[] {
  const reasons: string[] = [];

  appendVersionReason(reasons, input.contract, input.measurement.postgresMajorVersion);
  appendClosureCountReason(reasons, input.fixture.expectedClosureRowCount, input.measurement.closureRowCount);
  appendMedianExecutionReason(reasons, input.contract, input.summary.medianExecutionTimeMs);
  appendMaxExecutionReason(reasons, input.contract, input.summary.maxExecutionTimeMs);

  return reasons;
}

function appendVersionReason(
  reasons: string[],
  contract: RecursiveClosureBenchmarkContract,
  postgresMajorVersion: number,
): void {
  if (postgresMajorVersion < contract.minimumPostgresVersion) {
    reasons.push(
      `Expected PostgreSQL ${contract.minimumPostgresVersion}+ but measured ${postgresMajorVersion}.`,
    );
  }
}

function appendClosureCountReason(
  reasons: string[],
  expectedClosureRowCount: number,
  closureRowCount: number,
): void {
  if (closureRowCount !== expectedClosureRowCount) {
    reasons.push(`Expected ${expectedClosureRowCount} recursive closure rows but measured ${closureRowCount}.`);
  }
}

function appendMedianExecutionReason(
  reasons: string[],
  contract: RecursiveClosureBenchmarkContract,
  medianExecutionTimeMs: number,
): void {
  if (medianExecutionTimeMs > contract.thresholds.maxMedianExecutionTimeMs) {
    reasons.push(
      `Median execution time ${medianExecutionTimeMs}ms exceeded ${contract.thresholds.maxMedianExecutionTimeMs}ms.`,
    );
  }
}

function appendMaxExecutionReason(
  reasons: string[],
  contract: RecursiveClosureBenchmarkContract,
  maxExecutionTimeMs: number,
): void {
  if (maxExecutionTimeMs > contract.thresholds.maxExecutionTimeMs) {
    reasons.push(
      `Max execution time ${maxExecutionTimeMs}ms exceeded ${contract.thresholds.maxExecutionTimeMs}ms.`,
    );
  }
}

function computeMedian(values: readonly number[]): number {
  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middleIndex] ?? 0;
  }

  const lower = sortedValues[middleIndex - 1] ?? 0;
  const upper = sortedValues[middleIndex] ?? 0;
  return (lower + upper) / 2;
}
