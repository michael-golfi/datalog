import type { DatalogFact } from '../contracts/postgres-graph-operation.js';

const DEFAULT_MAX_PARAMETERS = 60_000;
type FactBatch = readonly [DatalogFact, ...DatalogFact[]];
type MutableFactBatch = [DatalogFact, ...DatalogFact[]];

/** Split fact batches before they exceed PostgreSQL parameter-count limits. */
export function splitDatalogFactBatches(
  facts: FactBatch,
): readonly [FactBatch, ...FactBatch[]] {
  const batches: MutableFactBatch[] = [];
  let currentBatch: DatalogFact[] = [];
  let currentParameterCount = 0;

  for (const fact of facts) {
    if (shouldFlushCurrentBatch(currentBatch.length, currentParameterCount, fact)) {
      currentBatch = flushCurrentBatch(batches, currentBatch);
      currentParameterCount = 0;
    }

    currentBatch.push(fact);
    currentParameterCount += countFactParameters(fact);
  }

  appendTrailingBatch(batches, currentBatch);

  const [firstBatch, ...remainingBatches] = batches;

  if (firstBatch === undefined) {
    throw new Error('Expected at least one fact batch for a non-empty fact set.');
  }

  return [
    firstBatch,
    ...remainingBatches,
  ];
}

function shouldFlushCurrentBatch(
  currentBatchLength: number,
  currentParameterCount: number,
  fact: DatalogFact,
): boolean {
  if (currentBatchLength === 0) {
    return false;
  }

  return currentParameterCount + countFactParameters(fact) > DEFAULT_MAX_PARAMETERS;
}

function flushCurrentBatch(
  batches: MutableFactBatch[],
  currentBatch: DatalogFact[],
): DatalogFact[] {
  batches.push(currentBatch as MutableFactBatch);
  return [];
}

function appendTrailingBatch(batches: MutableFactBatch[], currentBatch: DatalogFact[]): void {
  if (currentBatch.length > 0) {
    batches.push(currentBatch as MutableFactBatch);
  }
}

function countFactParameters(fact: DatalogFact): number {
  return fact.kind === 'vertex' ? 1 : 3;
}
