import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT } from '../benchmarks/recursive-closure-benchmark-contract.js';

const runCommand = vi.fn();
const sleep = vi.fn();
const sqlQuery = vi.fn();
const sqlUnsafe = vi.fn();
const sqlEnd = vi.fn();
const createPostgresSqlClient = vi.fn(() => Object.assign(sqlQuery, { unsafe: sqlUnsafe, end: sqlEnd }));

vi.mock('../benchmarks/benchmark-command-runner.js', () => ({
  runCommand,
  sleep,
}));
vi.mock('./create-postgres-sql-client.js', () => ({
  createPostgresSqlClient,
}));

const contract = {
  ...DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT,
  databaseName: 'bench',
  password: 'secret',
  username: 'postgres',
} as const;

describe('recursive-closure-postgres-runtime', () => {
  beforeEach(() => {
    runCommand.mockReset();
    sleep.mockReset();
    sqlQuery.mockReset();
    sqlUnsafe.mockReset();
    sqlEnd.mockReset();
    createPostgresSqlClient.mockClear();
    sqlEnd.mockResolvedValue(undefined);
  });

  it('starts postgres and returns a connection string plus cleanup', async () => {
    runCommand.mockReturnValueOnce('container-1\n').mockReturnValueOnce('127.0.0.1:5433\n');
    const { startRecursiveClosurePostgresRuntime } = await import('./recursive-closure-postgres-runtime.js');

    const runtime = startRecursiveClosurePostgresRuntime(contract);

    expect(runtime.connectionString).toBe('postgresql://postgres:secret@127.0.0.1:5433/bench');
    runtime.cleanup();
    expect(runCommand).toHaveBeenLastCalledWith({
      command: 'docker',
      args: ['rm', '--force', 'container-1'],
      throwOnFailure: false,
    });
  });

  it('waits until postgres responds through postgres.js', async () => {
    sqlQuery.mockRejectedValueOnce(new Error('not ready')).mockResolvedValueOnce([{ '?column?': 1 }]);
    const { waitForPostgres } = await import('./recursive-closure-postgres-runtime.js');

    await waitForPostgres('postgresql://example');

    expect(createPostgresSqlClient).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('reads postgres major version from server_version_num', async () => {
    sqlQuery.mockResolvedValue([{ server_version_num: '130005' }]);
    const { readPostgresMajorVersion } = await import('./recursive-closure-postgres-runtime.js');

    expect(await readPostgresMajorVersion(Object.assign(sqlQuery, { unsafe: sqlUnsafe, end: sqlEnd }) as never)).toBe(13);
  });

  it('throws when explain output has no execution time', async () => {
    sqlUnsafe.mockResolvedValue([{ 'QUERY PLAN': [{}] }]);
    const { readExecutionTime } = await import('./recursive-closure-postgres-runtime.js');

    await expect(readExecutionTime(Object.assign(sqlQuery, { unsafe: sqlUnsafe, end: sqlEnd }) as never, {
      operation: 'select',
      text: 'select 1',
      values: [],
    })).rejects.toThrow('PostgreSQL EXPLAIN output did not include Execution Time.');
  });
});
