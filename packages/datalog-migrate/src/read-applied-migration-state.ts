import { createPostgresSqlClient, type PostgresSqlClient } from '@datalog/datalog-to-sql';

import type { AppliedMigrationState } from './reconcile-applied-migrations.js';

export interface ReadAppliedMigrationStateOptions {
  readonly connectionString: string;
}

/** Read the applied migration ledger from the database. */
export async function readAppliedMigrationStateFromDatabase(
  options: ReadAppliedMigrationStateOptions,
): Promise<AppliedMigrationState> {
  const sql: PostgresSqlClient = createPostgresSqlClient(options.connectionString);

  try {
    const rows = await readLedgerRows(sql);

    return { appliedMigrationFileNames: rows.map((row) => row.migration_file_name) };
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function readLedgerRows(
  sql: PostgresSqlClient,
): Promise<ReadonlyArray<{ readonly migration_file_name: string }>> {
  try {
    return await sql<Array<{ migration_file_name: string }>>`
      SELECT migration_file_name FROM _datalog_applied_migrations ORDER BY migration_file_name ASC
    `;
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return [];
    }

    throw error;
  }
}

function isUndefinedTableError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return (error as { readonly code?: unknown }).code === '42P01';
  }

  return false;
}
