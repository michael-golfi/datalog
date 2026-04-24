import type { DatalogFact } from '@datalog/ast';
import {
  applyDatalogFacts,
  createPostgresSqlClient,
  type PostgresSqlClient,
} from '@datalog/datalog-to-sql';

/** Apply facts and record migrations inside a single database transaction. */
export async function applyFactsAndRecordMigrations(
  connectionString: string,
  facts: readonly DatalogFact[],
  migrationFileNames: readonly string[],
): Promise<void> {
  const sql: PostgresSqlClient = createPostgresSqlClient(connectionString);

  try {
    await initializeApplySchema(sql);
    await executeTransactionalApply(sql, facts, migrationFileNames);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function initializeApplySchema(sql: PostgresSqlClient): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS vertices (id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS edges (
      subject_id TEXT NOT NULL,
      predicate_id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      PRIMARY KEY (subject_id, predicate_id, object_id)
    );
    CREATE INDEX IF NOT EXISTS edges_predicate_subject_idx ON edges (predicate_id, subject_id);
    CREATE TABLE IF NOT EXISTS _datalog_applied_migrations (
      migration_file_name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function executeTransactionalApply(
  sql: PostgresSqlClient,
  facts: readonly DatalogFact[],
  migrationFileNames: readonly string[],
): Promise<void> {
  await sql.unsafe('BEGIN');

  try {
    const nonEmptyFacts = toNonEmptyFacts(facts);

    if (nonEmptyFacts !== null) {
      await applyDatalogFacts({ sql, mode: 'insert-facts', facts: nonEmptyFacts });
    }

    await recordAppliedMigrations(sql, migrationFileNames);
    await sql.unsafe('COMMIT');
  } catch (error) {
    await sql.unsafe('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

async function recordAppliedMigrations(
  sql: PostgresSqlClient,
  migrationFileNames: readonly string[],
): Promise<void> {
  if (migrationFileNames.length === 0) {
    return;
  }

  await sql`
    INSERT INTO _datalog_applied_migrations (migration_file_name)
    VALUES ${sql(migrationFileNames.map((name) => [name]))}
    ON CONFLICT (migration_file_name) DO NOTHING
  `;
}

function toNonEmptyFacts(facts: readonly DatalogFact[]): readonly [DatalogFact, ...DatalogFact[]] | null {
  const [firstFact, ...remainingFacts] = facts;

  if (firstFact === undefined) {
    return null;
  }

  return [firstFact, ...remainingFacts];
}
