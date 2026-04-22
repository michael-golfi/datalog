import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyDatalogFacts } from './apply-datalog-facts.js';
import { createRecursiveClosureBenchmarkFixture } from '../benchmarks/create-recursive-closure-benchmark-fixture.js';
import { createPostgresSqlClient } from '../runtime/create-postgres-sql-client.js';
import { executeTranslatedSql } from './execute-translated-sql.js';
import { DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT } from '../benchmarks/recursive-closure-benchmark-contract.js';
import {
  initializeGraphSchema,
  startRecursiveClosurePostgresRuntime,
  waitForPostgres,
} from '../runtime/recursive-closure-postgres-runtime.js';
import { translateGraphOperation } from '../translation/translate-graph-operation.js';

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
});
