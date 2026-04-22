import { createPostgresSqlClient } from '@datalog/datalog-to-sql';

import { describe } from 'vitest';

export const localPostgresConnectionString = 'postgresql://postgres:postgres@localhost:5432/datalog_benchmark';
const localPostgresAdminConnectionString = 'postgresql://postgres:postgres@localhost:5432/postgres';

/** Ensure the local workflow test database exists before the e2e connects to it. */
export async function ensureLocalWorkflowDatabaseExists(): Promise<void> {
  const adminSql = createPostgresSqlClient(localPostgresAdminConnectionString);

  try {
    const existing = await adminSql<Array<{ exists: boolean }>>`
      select exists(select 1 from pg_database where datname = 'datalog_benchmark') as exists
    `;

    if (existing[0]?.exists) {
      return;
    }

    await adminSql.unsafe('create database datalog_benchmark');
  } finally {
    await adminSql.end({ timeout: 1 });
  }
}

describe.skip('datalog migration workflow test database support', () => {});
