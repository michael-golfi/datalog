import { beforeEach, describe, expect, it, vi } from 'vitest';

const createFixture = vi.fn();
const startRuntime = vi.fn();
const waitForPostgres = vi.fn();
const initializeGraphSchema = vi.fn();
const readMajorVersion = vi.fn();
const readExecutionTime = vi.fn();
const validateBenchmark = vi.fn();
const applyDatalogFacts = vi.fn();
const executeTranslatedSql = vi.fn();
const translateSelectRecursiveClosureCount = vi.fn();
const createPostgresSqlClient = vi.fn();
const mkdirSync = vi.fn();
const writeFileSync = vi.fn();
const sqlEnd = vi.fn();

vi.mock('./create-recursive-closure-benchmark-fixture.js', () => ({
  createRecursiveClosureBenchmarkFixture: createFixture,
}));
vi.mock('../execution/apply-datalog-facts.js', () => ({
  applyDatalogFacts,
}));
vi.mock('../execution/execute-translated-sql.js', () => ({
  executeTranslatedSql,
}));
vi.mock('../translation/translate-select-recursive-closure-count.js', () => ({
  translateSelectRecursiveClosureCount,
}));
vi.mock('../runtime/create-postgres-sql-client.js', () => ({
  createPostgresSqlClient,
}));
vi.mock('../runtime/recursive-closure-postgres-runtime.js', () => ({
  startRecursiveClosurePostgresRuntime: startRuntime,
  waitForPostgres,
  initializeGraphSchema,
  readPostgresMajorVersion: readMajorVersion,
  readExecutionTime,
}));
vi.mock('./validate-recursive-closure-benchmark.js', () => ({
  validateRecursiveClosureBenchmark: validateBenchmark,
}));
vi.mock('node:fs', () => ({
  mkdirSync,
  writeFileSync,
}));

describe('runRecursiveClosureBenchmark', () => {
  beforeEach(() => {
    createFixture.mockReset();
    startRuntime.mockReset();
    waitForPostgres.mockReset();
    initializeGraphSchema.mockReset();
    readMajorVersion.mockReset();
    readExecutionTime.mockReset();
    validateBenchmark.mockReset();
    applyDatalogFacts.mockReset();
    executeTranslatedSql.mockReset();
    translateSelectRecursiveClosureCount.mockReset();
    createPostgresSqlClient.mockReset();
    mkdirSync.mockReset();
    writeFileSync.mockReset();
    sqlEnd.mockReset();
    sqlEnd.mockResolvedValue(undefined);
  });

  it('writes a sanitized report and validates the translated benchmark result', async () => {
    createFixture.mockReturnValue({
      seedFacts: [{ kind: 'vertex', id: 'vertex/root' }],
      benchmarkOperation: { kind: 'select-recursive-closure-count', rootVertexId: 'vertex/root', predicateId: 'graph/reachable' },
      expectedClosureRowCount: 21844,
    });
    translateSelectRecursiveClosureCount.mockReturnValue({ operation: 'select', text: 'select 1', values: [] });
    startRuntime.mockReturnValue({ connectionString: 'postgresql://x', cleanup: vi.fn() });
    createPostgresSqlClient.mockReturnValue({ end: sqlEnd });
    readMajorVersion.mockResolvedValue(13);
    executeTranslatedSql.mockResolvedValue([{ closure_size: '21844' }]);
    readExecutionTime.mockResolvedValueOnce(10).mockResolvedValueOnce(11).mockResolvedValueOnce(12).mockResolvedValueOnce(13).mockResolvedValueOnce(14).mockResolvedValueOnce(15);
    validateBenchmark.mockReturnValue({ ok: true, summary: { actualClosureRowCount: 21844 } });

    const { runRecursiveClosureBenchmark } = await import('./recursive-closure-benchmark-runner.js');
    const report = await runRecursiveClosureBenchmark({ validate: true });

    expect(report.measuredClosureRowCount).toBe(21844);
    expect(report.postgresMajorVersion).toBe(13);
    expect(report.executionTimesMs).toEqual([11, 12, 13, 14, 15]);
    expect(applyDatalogFacts).toHaveBeenCalled();
    expect(executeTranslatedSql).toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalled();
  });

  it('throws when validation fails in validate mode', async () => {
    createFixture.mockReturnValue({
      seedFacts: [{ kind: 'vertex', id: 'vertex/root' }],
      benchmarkOperation: { kind: 'select-recursive-closure-count', rootVertexId: 'vertex/root', predicateId: 'graph/reachable' },
      expectedClosureRowCount: 21844,
    });
    translateSelectRecursiveClosureCount.mockReturnValue({ operation: 'select', text: 'select 1', values: [] });
    startRuntime.mockReturnValue({ connectionString: 'postgresql://x', cleanup: vi.fn() });
    createPostgresSqlClient.mockReturnValue({ end: sqlEnd });
    readMajorVersion.mockResolvedValue(13);
    executeTranslatedSql.mockResolvedValue([{ closure_size: '1' }]);
    readExecutionTime.mockResolvedValue(20);
    validateBenchmark.mockReturnValue({ ok: false, reasons: ['too slow'] });

    const { runRecursiveClosureBenchmark } = await import('./recursive-closure-benchmark-runner.js');

    await expect(runRecursiveClosureBenchmark({ validate: true })).rejects.toThrow('too slow');
  });
});
