import { describe, expect, it } from 'vitest';

import { createRecursiveClosureBenchmarkFixture } from './create-recursive-closure-benchmark-fixture.js';
import { DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT } from './recursive-closure-benchmark-contract.js';

describe('createRecursiveClosureBenchmarkFixture', () => {
  it('creates a seeded benchmark fact set and expected closure counts', () => {
    const fixture = createRecursiveClosureBenchmarkFixture(
      DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT,
    );

    expect(fixture).toMatchObject({
      expectedClosureRowCount: 21844,
      expectedEdgeCount: 21844,
      expectedVertexCount: 21845,
    });
    expect(fixture.seedFacts[0]).toEqual({ kind: 'vertex', id: 'vertex/root' });
    expect(fixture.seedFacts).toContainEqual({
      kind: 'edge',
      subjectId: 'vertex/root',
      predicateId: 'graph/reachable',
      objectId: 'vertex/1-1',
    });
  });

  it('creates a recursive closure benchmark operation that can be translated through the library surface', () => {
    const fixture = createRecursiveClosureBenchmarkFixture(
      DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT,
    );

    expect(fixture.benchmarkOperation).toEqual({
      kind: 'select-recursive-closure-count',
      rootVertexId: 'vertex/root',
      predicateId: 'graph/reachable',
    });
  });
});
