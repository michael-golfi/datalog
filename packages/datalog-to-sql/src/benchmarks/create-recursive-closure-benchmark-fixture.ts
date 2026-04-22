import {
  computeRecursiveClosureRowCount,
  computeRecursiveClosureVertexCount,
  type RecursiveClosureBenchmarkContract,
} from './recursive-closure-benchmark-contract.js';
import type { DatalogFact, SelectRecursiveClosureCountOperation } from '../contracts/postgres-graph-operation.js';

export interface RecursiveClosureBenchmarkFixture {
  readonly seedFacts: readonly [DatalogFact, ...DatalogFact[]];
  readonly benchmarkOperation: SelectRecursiveClosureCountOperation;
  readonly expectedClosureRowCount: number;
  readonly expectedVertexCount: number;
  readonly expectedEdgeCount: number;
}

/** Create a recursive-closure benchmark fixture from the benchmark contract. */
export function createRecursiveClosureBenchmarkFixture(
  contract: RecursiveClosureBenchmarkContract,
): RecursiveClosureBenchmarkFixture {
  const facts: DatalogFact[] = [{ kind: 'vertex', id: contract.dataset.rootVertexId }];
  let frontier = [contract.dataset.rootVertexId];
  let nextVertexNumber = 1;

  for (let level = 1; level <= contract.dataset.depth; level += 1) {
    const levelExpansion = expandFrontierLevel({
      frontier,
      level,
      nextVertexNumber,
      branchFactor: contract.dataset.branchFactor,
      predicateId: contract.dataset.predicateId,
      facts,
    });
    frontier = levelExpansion.nextFrontier;
    nextVertexNumber = levelExpansion.nextVertexNumber;
  }

  return {
    seedFacts: facts as [DatalogFact, ...DatalogFact[]],
    benchmarkOperation: {
      kind: 'select-recursive-closure-count',
      rootVertexId: contract.dataset.rootVertexId,
      predicateId: contract.dataset.predicateId,
    },
    expectedClosureRowCount: computeRecursiveClosureRowCount(contract.dataset),
    expectedVertexCount: computeRecursiveClosureVertexCount(contract.dataset),
    expectedEdgeCount: computeRecursiveClosureRowCount(contract.dataset),
  };
}

function expandFrontierLevel(input: {
  readonly frontier: readonly string[];
  readonly level: number;
  readonly nextVertexNumber: number;
  readonly branchFactor: number;
  readonly predicateId: string;
  readonly facts: DatalogFact[];
}): { readonly nextFrontier: string[]; readonly nextVertexNumber: number } {
  const nextFrontier: string[] = [];
  let currentVertexNumber = input.nextVertexNumber;

  for (const parentId of input.frontier) {
    createBranchChildren({
      parentId,
      level: input.level,
      nextVertexNumber: currentVertexNumber,
      branchFactor: input.branchFactor,
      predicateId: input.predicateId,
      facts: input.facts,
      nextFrontier,
    });
    currentVertexNumber += input.branchFactor;
  }

  return {
    nextFrontier,
    nextVertexNumber: currentVertexNumber,
  };
}

function createBranchChildren(input: {
  readonly parentId: string;
  readonly level: number;
  readonly nextVertexNumber: number;
  readonly branchFactor: number;
  readonly predicateId: string;
  readonly facts: DatalogFact[];
  readonly nextFrontier: string[];
}): void {
  for (let branchIndex = 0; branchIndex < input.branchFactor; branchIndex += 1) {
    const childId = `vertex/${input.level}-${input.nextVertexNumber + branchIndex}`;
    input.facts.push({ kind: 'vertex', id: childId });
    input.facts.push({
      kind: 'edge',
      subjectId: input.parentId,
      predicateId: input.predicateId,
      objectId: childId,
    });
    input.nextFrontier.push(childId);
  }
}
