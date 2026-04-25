import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { createRecursiveClosureBenchmarkFixture } from './create-recursive-closure-benchmark-fixture.js';
import {
  DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT,
  type RecursiveClosureBenchmarkContract,
} from './recursive-closure-benchmark-contract.js';
import { validateRecursiveClosureBenchmark } from './validate-recursive-closure-benchmark.js';
import { applyDatalogFacts } from '../execution/apply-datalog-facts.js';
import { executeTranslatedSql } from '../execution/execute-translated-sql.js';
import { createPostgresGraphTranslator } from '../runtime/create-postgres-graph-translator.js';
import { createPostgresSqlClient } from '../runtime/create-postgres-sql-client.js';
import {
  initializeGraphSchema,
  readExecutionTime,
  readPostgresMajorVersion,
  startRecursiveClosurePostgresRuntime,
  waitForPostgres,
} from '../runtime/recursive-closure-postgres-runtime.js';

import type { TranslatedSqlQuery } from '../contracts/translated-sql-query.js';

export interface RunRecursiveClosureBenchmarkOptions {
  readonly validate: boolean;
}

export interface RecursiveClosureBenchmarkReport {
  readonly contract: {
    readonly minimumPostgresVersion: number;
    readonly postgresImage: string;
    readonly databaseName: string;
    readonly dataset: RecursiveClosureBenchmarkContract['dataset'];
    readonly thresholds: RecursiveClosureBenchmarkContract['thresholds'];
    readonly evidenceFileName: string;
  };
  readonly expectedClosureRowCount: number;
  readonly measuredClosureRowCount: number;
  readonly postgresMajorVersion: number;
  readonly executionTimesMs: readonly number[];
  readonly validation: ReturnType<typeof validateRecursiveClosureBenchmark>;
}

/** Run the recursive-closure benchmark end to end and return a report. */
export async function runRecursiveClosureBenchmark(
  options: RunRecursiveClosureBenchmarkOptions,
): Promise<RecursiveClosureBenchmarkReport> {
  const contract = DEFAULT_RECURSIVE_CLOSURE_BENCHMARK_CONTRACT;
  const fixture = createRecursiveClosureBenchmarkFixture(contract);
  const translator = createPostgresGraphTranslator();
  const benchmarkTranslation = translateBenchmarkOperation(translator, fixture.benchmarkOperation);
  const postgresRuntime = startRecursiveClosurePostgresRuntime(contract);
  const sql = createPostgresSqlClient(postgresRuntime.connectionString);

  try {
    const measurement = await measureBenchmark({
      sql,
      connectionString: postgresRuntime.connectionString,
      benchmarkQuery: benchmarkTranslation,
      seedFacts: fixture.seedFacts,
      contract,
    });
    const validation = validateRecursiveClosureBenchmark(contract, fixture, measurement);
    const report = createBenchmarkReport({
      contract,
      expectedClosureRowCount: fixture.expectedClosureRowCount,
      measurement,
      validation,
    });

    writeBenchmarkReport(report, contract);

    assertBenchmarkValidation(validation, options.validate);

    return report;
  } finally {
    await sql.end({ timeout: 1 });
    postgresRuntime.cleanup();
  }
}

function assertBenchmarkValidation(
  validation: ReturnType<typeof validateRecursiveClosureBenchmark>,
  validate: boolean,
): void {
  if (validate && !validation.ok) {
    throw new Error(validation.reasons.join(' '));
  }
}

function translateBenchmarkOperation(
  translator: ReturnType<typeof createPostgresGraphTranslator>,
  operation: ReturnType<typeof createRecursiveClosureBenchmarkFixture>['benchmarkOperation'],
): TranslatedSqlQuery {
  const translation = translator.translate(operation);

  if (!translation.ok) {
    throw translation.error;
  }

  return translation.value;
}

async function measureBenchmark(input: {
  readonly sql: ReturnType<typeof createPostgresSqlClient>;
  readonly connectionString: string;
  readonly benchmarkQuery: TranslatedSqlQuery;
  readonly seedFacts: ReturnType<typeof createRecursiveClosureBenchmarkFixture>['seedFacts'];
  readonly contract: RecursiveClosureBenchmarkContract;
}): Promise<{
  readonly postgresMajorVersion: number;
  readonly closureRowCount: number;
  readonly executionTimesMs: number[];
}> {
  await prepareBenchmarkDatabase(input);

  const postgresMajorVersion = await readPostgresMajorVersion(input.sql);
  const closureRows = await executeTranslatedSql<{ closure_size: string }>(
    input.sql,
    input.benchmarkQuery,
  );

  return {
    postgresMajorVersion,
    closureRowCount: Number.parseInt(closureRows[0]?.closure_size ?? '0', 10),
    executionTimesMs: await measureExecutionTimes(input.sql, input.benchmarkQuery, input.contract),
  };
}

async function prepareBenchmarkDatabase(input: {
  readonly sql: ReturnType<typeof createPostgresSqlClient>;
  readonly connectionString: string;
  readonly seedFacts: ReturnType<typeof createRecursiveClosureBenchmarkFixture>['seedFacts'];
}): Promise<void> {
  await waitForPostgres(input.connectionString);
  await initializeGraphSchema(input.sql);
  await applyDatalogFacts({ sql: input.sql, mode: 'insert-facts', facts: input.seedFacts });
}

function createBenchmarkReport(input: {
  readonly contract: RecursiveClosureBenchmarkContract;
  readonly expectedClosureRowCount: number;
  readonly measurement: {
    readonly postgresMajorVersion: number;
    readonly closureRowCount: number;
    readonly executionTimesMs: readonly number[];
  };
  readonly validation: ReturnType<typeof validateRecursiveClosureBenchmark>;
}): RecursiveClosureBenchmarkReport {
  return {
    contract: {
      minimumPostgresVersion: input.contract.minimumPostgresVersion,
      postgresImage: input.contract.postgresImage,
      databaseName: input.contract.databaseName,
      dataset: input.contract.dataset,
      thresholds: input.contract.thresholds,
      evidenceFileName: input.contract.evidenceFileName,
    },
    expectedClosureRowCount: input.expectedClosureRowCount,
    measuredClosureRowCount: input.measurement.closureRowCount,
    postgresMajorVersion: input.measurement.postgresMajorVersion,
    executionTimesMs: [...input.measurement.executionTimesMs],
    validation: input.validation,
  };
}

async function measureExecutionTimes(
  sql: ReturnType<typeof createPostgresSqlClient>,
  benchmarkQuery: TranslatedSqlQuery,
  contract: RecursiveClosureBenchmarkContract,
): Promise<number[]> {
  for (let index = 0; index < contract.dataset.warmupRuns; index += 1) {
    await readExecutionTime(sql, benchmarkQuery);
  }

  const executionTimesMs: number[] = [];

  for (let index = 0; index < contract.dataset.measuredRuns; index += 1) {
    executionTimesMs.push(await readExecutionTime(sql, benchmarkQuery));
  }

  return executionTimesMs;
}

function writeBenchmarkReport(
  report: RecursiveClosureBenchmarkReport,
  contract: RecursiveClosureBenchmarkContract,
): void {
  const evidencePath = resolve(
    process.cwd(),
    '..',
    '..',
    '.sisyphus',
    'evidence',
    contract.evidenceFileName,
  );

  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
