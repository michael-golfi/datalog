import type { DatalogTypeName } from '@datalog/ast';

import type {
  ExternalResolverLookupRequest,
  ExternalResolverResult,
  ExternalResolverRow,
} from '../contracts/external-resolver-definition.js';
import type { SqlParameterValue } from '../contracts/physical-plan.js';
import type {
  PreparedSelectFactsExecution,
  PreparedSelectFactsHydrationInstruction,
  PreparedSelectFactsMaterializationStep,
} from '../contracts/prepared-select-facts-execution.js';
import type { RelationColumnBinding } from '../contracts/predicate-catalog.js';
import type { PostgresSqlClient } from '../runtime/create-postgres-sql-client.js';

import { executeTranslatedSql } from './execute-translated-sql.js';
import { hydrateExternalSelectFactsRows } from './hydrate-external-select-facts-rows.js';
import { materializeExternalResolverRelations } from './materialize-external-resolver-relations.js';

type PreparedExecutionSqlClient = Pick<PostgresSqlClient, 'unsafe'>;
type SqlWriteParameterValue = SqlParameterValue | null;

const POSTGRES_COLUMN_TYPE_BY_DATALOG_TYPE = {
  text: 'text',
  int8: 'int8',
  numeric: 'numeric',
  bool: 'bool',
  jsonb: 'jsonb',
  date: 'date',
  timestamp: 'timestamp',
  unknown: 'text',
} as const satisfies Readonly<Record<DatalogTypeName, string>>;

export interface ExecutePreparedSelectFactsInput<Row extends Record<string, unknown>> {
  readonly sql: PostgresSqlClient;
  readonly execution: PreparedSelectFactsExecution;
  readonly loadMaterializedRows?: (
    step: PreparedSelectFactsMaterializationStep,
    request: ExternalResolverLookupRequest,
  ) => Promise<ExternalResolverResult<readonly ExternalResolverRow[]>> | ExternalResolverResult<readonly ExternalResolverRow[]>;
  readonly hydrateRows?: (input: {
    readonly instruction: PreparedSelectFactsHydrationInstruction;
    readonly rows: readonly Row[];
  }) => Promise<readonly Row[]> | readonly Row[];
}

/** Execute a prepared select-facts request on one pinned PostgreSQL session/client. */
export async function executePreparedSelectFacts<Row extends Record<string, unknown>>(
  input: ExecutePreparedSelectFactsInput<Row>,
): Promise<readonly Row[]> {
  if (input.execution.materializationSteps.length === 0 && (input.execution.hydrationInstructions?.length ?? 0) === 0) {
    return executeTranslatedSql<Row>(input.sql, input.execution.finalSqlQuery);
  }

  return input.sql.begin(async (transactionSql) => {
    for (const step of input.execution.materializationSteps) {
      await createTemporaryWorkTable(transactionSql, step);
    }

    const materializedRelations = await materializeExternalResolverRelations(
      input.loadMaterializedRows === undefined
        ? {
            materializationSteps: input.execution.materializationSteps,
          }
        : {
            materializationSteps: input.execution.materializationSteps,
            loadMaterializedRows: input.loadMaterializedRows,
          },
    );

    for (const relation of materializedRelations) {
      const { step, rows } = relation;
      if (rows.length > 0) {
        await insertMaterializedRows(transactionSql, step, rows);
      }
    }

    let rows = await executeTranslatedSql<Row>(transactionSql, input.execution.finalSqlQuery);

    for (const instruction of input.execution.hydrationInstructions ?? []) {
      rows = await hydrateRows({
        instruction,
        rows,
        hydrateRows: input.hydrateRows,
      });
    }

    return rows;
  });
}

async function createTemporaryWorkTable(
  sql: PreparedExecutionSqlClient,
  step: PreparedSelectFactsMaterializationStep,
): Promise<void> {
  const columnDefinitions = step.columns
    .map((column) => `${quoteIdentifier(column.name)} ${renderPostgresColumnType(column.type)}`)
    .join(', ');

  await sql.unsafe(`create temporary table ${quoteIdentifier(step.relationName)} (${columnDefinitions}) on commit drop;`);
}

async function insertMaterializedRows(
  sql: PreparedExecutionSqlClient,
  step: PreparedSelectFactsMaterializationStep,
  rows: readonly ExternalResolverRow[],
): Promise<void> {
  const columnList = step.columns.map((column) => quoteIdentifier(column.name)).join(', ');
  const values = rows.flatMap((row) => getRowValues(step.columns, row));
  const placeholders = rows.map((_, rowIndex) => {
    const offset = rowIndex * step.columns.length;

    return `(${step.columns.map((_, columnIndex) => `$${offset + columnIndex + 1}`).join(', ')})`;
  });

  await sql.unsafe(
    `insert into ${quoteIdentifier(step.relationName)} (${columnList}) values ${placeholders.join(', ')};`,
    values as SqlParameterValue[],
  );
}

function getRowValues(
  columns: readonly RelationColumnBinding[],
  row: ExternalResolverRow,
): readonly SqlWriteParameterValue[] {
  return columns.map((column) => {
    if (Object.hasOwn(row.valuesByColumn, column.name)) {
      return row.valuesByColumn[column.name] ?? null;
    }

    throw new Error(`Materialized row is missing column ${column.name}.`);
  });
}

async function hydrateRows<Row extends Record<string, unknown>>(input: {
  readonly instruction: PreparedSelectFactsHydrationInstruction;
  readonly rows: readonly Row[];
  readonly hydrateRows: ExecutePreparedSelectFactsInput<Row>['hydrateRows'];
}): Promise<readonly Row[]> {
  if (input.hydrateRows !== undefined) {
    return input.hydrateRows({
      instruction: input.instruction,
      rows: input.rows,
    });
  }

  return hydrateExternalSelectFactsRows({
    instruction: input.instruction,
    rows: input.rows,
  });
}

function renderPostgresColumnType(type: DatalogTypeName): string {
  return POSTGRES_COLUMN_TYPE_BY_DATALOG_TYPE[type];
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
