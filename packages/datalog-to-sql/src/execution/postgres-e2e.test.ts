import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { defPredSchema } from '@datalog/ast';

import { applyDatalogFacts } from './apply-datalog-facts.js';
import { createQueryCountTracker } from './query-count-tracker.js';
import { createRecursiveClosureBenchmarkFixture } from '../benchmarks/create-recursive-closure-benchmark-fixture.js';
import type { PostgresGraphOperation } from '../contracts/postgres-graph-operation.js';
import { createPostgresSqlClient } from '../runtime/create-postgres-sql-client.js';
import { executeTranslatedSql } from './execute-translated-sql.js';
import { DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT } from '../benchmarks/recursive-closure-benchmark-contract.js';
import {
  initializeGraphSchema,
  startRecursiveClosurePostgresRuntime,
  waitForPostgres,
} from '../runtime/recursive-closure-postgres-runtime.js';
import { buildPredicateCatalogFromSchema } from '../translation/build-predicate-catalog-from-schema.js';
import { translateGraphOperation } from '../translation/translate-graph-operation.js';

const GRAPH_PREDICATE_CATALOG = buildPredicateCatalogFromSchema([
  defPredSchema({
    predicateName: 'vertex',
    subjectCardinality: '1',
    subjectDomain: 'node',
    objectCardinality: '0',
    objectDomain: 'node',
  }),
  defPredSchema({
    predicateName: 'edge',
    subjectCardinality: '0',
    subjectDomain: 'node',
    objectCardinality: '0',
    objectDomain: 'node',
  }),
]);

describe('postgres e2e validation', () => {
  const runtime = startRecursiveClosurePostgresRuntime(DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT);
  const sql = createPostgresSqlClient(runtime.connectionString);

  beforeAll(async () => {
    await waitForPostgres(runtime.connectionString);
    await initializeGraphSchema(sql);
  });

  afterAll(async () => {
    await sql.end({ timeout: 1 });
    runtime.cleanup();
  });

  it('executes translated fact inserts, reads, and deletes end to end', async () => {
    await initializeGraphSchema(sql);

    await applyDatalogFacts({
      sql,
      mode: 'insert-facts',
      facts: [
        { kind: 'vertex', id: 'vertex/alice' },
        { kind: 'vertex', id: 'vertex/bob' },
        {
          kind: 'edge',
          subjectId: 'vertex/alice',
          predicateId: 'graph/likes',
          objectId: 'vertex/bob',
        },
      ],
    });

    const selectResult = translateGraphOperation({
      kind: 'select-facts',
      predicateCatalog: GRAPH_PREDICATE_CATALOG,
      match: [
        { kind: 'vertex', id: { kind: 'variable', name: 'person' } },
        {
          kind: 'edge',
          subject: { kind: 'variable', name: 'person' },
          predicate: { kind: 'constant', value: 'graph/likes' },
          object: { kind: 'constant', value: 'vertex/bob' },
        },
      ],
    });

    expect(selectResult.ok).toBe(true);
    if (!selectResult.ok) {
      throw selectResult.error;
    }

    const selected = await executeTranslatedSql<{ person: string }>(sql, selectResult.value);
    expect(selected[0]?.person).toBe('vertex/alice');

    await applyDatalogFacts({
      sql,
      mode: 'delete-facts',
      facts: [
        {
          kind: 'edge',
          subjectId: 'vertex/alice',
          predicateId: 'graph/likes',
          objectId: 'vertex/bob',
        },
      ],
    });

    const edgeCount = await sql<Array<{ count: string }>>`select count(*)::text as count from edges`;
    expect(edgeCount[0]?.count).toBe('0');
  });

  it('executes the generated recursive closure query through the translator and returns the expected row count', async () => {
    const fixture = createRecursiveClosureBenchmarkFixture(DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT);

    await initializeGraphSchema(sql);
    await applyDatalogFacts({
      sql,
      mode: 'insert-facts',
      facts: fixture.seedFacts,
    });

    const result = translateGraphOperation(fixture.benchmarkOperation);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw result.error;
    }

    const rows = await executeTranslatedSql<{ closure_size: string }>(sql, result.value);

    expect(Number.parseInt(rows[0]?.closure_size ?? '0', 10)).toBe(fixture.expectedClosureRowCount);
    expect(result.value.text).toContain('with recursive closure as');
    expect(result.value.text).toContain('join edges e on e.subject_id = closure.descendant_id');
  });

  it('executes each graph operation with exactly one SQL statement', async () => {
    await initializeGraphSchema(sql);

    async function executeTrackedOperation<Row extends Record<string, unknown>>(
      operation: PostgresGraphOperation,
    ): Promise<readonly Row[]> {
      const tracker = createQueryCountTracker(sql);
      const result = translateGraphOperation(operation);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw result.error;
      }

      const rows = await executeTranslatedSql<Row>(tracker.sql, result.value);

      expect(tracker.getQueryCount()).toBe(1);
      return rows;
    }

    await executeTrackedOperation({
      kind: 'insert-facts',
      facts: [
        { kind: 'vertex', id: 'vertex/alice' },
        { kind: 'vertex', id: 'vertex/bob' },
        { kind: 'vertex', id: 'vertex/root' },
        { kind: 'vertex', id: 'vertex/middle' },
        { kind: 'vertex', id: 'vertex/leaf' },
        {
          kind: 'edge',
          subjectId: 'vertex/alice',
          predicateId: 'graph/likes',
          objectId: 'vertex/bob',
        },
        {
          kind: 'edge',
          subjectId: 'vertex/root',
          predicateId: 'graph/reachable',
          objectId: 'vertex/middle',
        },
        {
          kind: 'edge',
          subjectId: 'vertex/middle',
          predicateId: 'graph/reachable',
          objectId: 'vertex/leaf',
        },
      ],
    });

    const selectedFacts = await executeTrackedOperation<{ person: string }>({
      kind: 'select-facts',
      predicateCatalog: GRAPH_PREDICATE_CATALOG,
      match: [
        { kind: 'vertex', id: { kind: 'variable', name: 'person' } },
        {
          kind: 'edge',
          subject: { kind: 'variable', name: 'person' },
          predicate: { kind: 'constant', value: 'graph/likes' },
          object: { kind: 'constant', value: 'vertex/bob' },
        },
      ],
    });

    expect(selectedFacts[0]?.person).toBe('vertex/alice');

    const selectedVertex = await executeTrackedOperation<{ id: string }>({
      kind: 'select-vertex-by-id',
      vertexId: 'vertex/alice',
    });

    expect(selectedVertex[0]?.id).toBe('vertex/alice');

    const selectedEdges = await executeTrackedOperation<{
      subject_id: string;
      predicate_id: string;
      object_id: string;
    }>({
      kind: 'select-edges',
      where: {
        predicateId: 'graph/reachable',
      },
    });

    expect(selectedEdges).toHaveLength(2);

    const recursiveClosureRows = await executeTrackedOperation<{ closure_size: string }>({
      kind: 'select-recursive-closure-count',
      rootVertexId: 'vertex/root',
      predicateId: 'graph/reachable',
    });

    expect(Number.parseInt(recursiveClosureRows[0]?.closure_size ?? '0', 10)).toBe(2);

    await executeTrackedOperation({
      kind: 'delete-facts',
      facts: [
        {
          kind: 'edge',
          subjectId: 'vertex/alice',
          predicateId: 'graph/likes',
          objectId: 'vertex/bob',
        },
      ],
    });

    const remainingLikesEdges = await sql<Array<{ count: string }>>`
      select count(*)::text as count
      from edges
      where subject_id = 'vertex/alice'
        and predicate_id = 'graph/likes'
        and object_id = 'vertex/bob'
    `;

    expect(remainingLikesEdges[0]?.count).toBe('0');
  });
});
