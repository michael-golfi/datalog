import type { TranslatedSqlQuery } from '../contracts/translated-sql-query.js';
import type { RecursiveClosureBenchmarkContract } from '../benchmarks/recursive-closure-benchmark-contract.js';
import { runCommand, sleep } from '../benchmarks/benchmark-command-runner.js';
import { createPostgresSqlClient, type PostgresSqlClient } from './create-postgres-sql-client.js';

export interface RecursiveClosurePostgresRuntime {
  readonly connectionString: string;
  readonly cleanup: () => void;
}

/** Start a disposable PostgreSQL runtime for benchmark and integration testing. */
export function startRecursiveClosurePostgresRuntime(
  contract: RecursiveClosureBenchmarkContract,
): RecursiveClosurePostgresRuntime {
  const containerId = runCommand({
    command: 'docker',
    args: [
      'run',
      '--detach',
      '--env',
      `POSTGRES_DB=${contract.databaseName}`,
      '--env',
      `POSTGRES_PASSWORD=${contract.password}`,
      '--publish',
      '127.0.0.1::5432',
      contract.postgresImage,
    ],
  }).trim();
  const port = resolveDockerPort(containerId);

  return {
    connectionString: `postgresql://${contract.username}:${contract.password}@127.0.0.1:${port}/${contract.databaseName}`,
    cleanup: () => {
      runCommand({ command: 'docker', args: ['rm', '--force', containerId], throwOnFailure: false });
    },
  };
}

/** Wait until the postgres.js client can successfully query the database. */
export async function waitForPostgres(connectionString: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const sql = createPostgresSqlClient(connectionString);

    try {
      await sql`select 1`;
      await sql.end({ timeout: 1 });
      return;
    } catch {
      await sql.end({ timeout: 1 }).catch(() => undefined);
      sleep(1000);
    }
  }

  throw new Error('PostgreSQL container did not become ready within 60 seconds.');
}

/** Initialize the generic vertices/edges graph schema in PostgreSQL. */
export async function initializeGraphSchema(sql: PostgresSqlClient): Promise<void> {
  await sql.unsafe([
    'create table if not exists vertices (id text primary key);',
    'create table if not exists edges (subject_id text not null, predicate_id text not null, object_id text not null, primary key (subject_id, predicate_id, object_id));',
    'create index if not exists edges_predicate_subject_idx on edges (predicate_id, subject_id);',
    'truncate table edges;',
    'truncate table vertices;',
  ].join('\n'));
}

/** Read the PostgreSQL major version from the running database. */
export async function readPostgresMajorVersion(sql: PostgresSqlClient): Promise<number> {
  const rows = await sql<Array<{ server_version_num: string }>>`show server_version_num`;
  const versionText = rows[0]?.server_version_num ?? '0';
  return Math.floor(Number.parseInt(versionText, 10) / 10000);
}

/** Measure execution time for a translated benchmark query using EXPLAIN ANALYZE JSON output. */
export async function readExecutionTime(
  sql: PostgresSqlClient,
  benchmarkQuery: TranslatedSqlQuery,
): Promise<number> {
  const rows = await sql.unsafe<Array<Record<string, unknown>>>(
    `explain (analyze, format json) ${benchmarkQuery.text}`,
    [...benchmarkQuery.values],
  );
  const planValue = rows[0]?.['QUERY PLAN'];
  const parsedExplain = parseExplainPlan(planValue);
  const executionTime = parsedExplain[0]?.['Execution Time'];

  if (typeof executionTime !== 'number') {
    throw new Error('PostgreSQL EXPLAIN output did not include Execution Time.');
  }

  return executionTime;
}

function parseExplainPlan(value: unknown): Array<Record<string, unknown>> {
  if (typeof value === 'string') {
    return JSON.parse(value) as Array<Record<string, unknown>>;
  }

  if (Array.isArray(value)) {
    return value as Array<Record<string, unknown>>;
  }

  throw new Error('PostgreSQL EXPLAIN output did not include a JSON plan payload.');
}

function resolveDockerPort(containerId: string): string {
  const portOutput = runCommand({ command: 'docker', args: ['port', containerId, '5432/tcp'] }).trim();
  const firstMapping = portOutput.split(/\r?\n/u)[0] ?? '';
  const hostPort = firstMapping.split(':').at(-1);

  if (hostPort === undefined || hostPort.length === 0) {
    throw new Error(`Unable to resolve PostgreSQL port for container ${containerId}.`);
  }

  return hostPort;
}
