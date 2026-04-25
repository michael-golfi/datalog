import type { TranslatedSqlQuery } from '../contracts/translated-sql-query.js';
import type { PostgresSqlClient } from '../runtime/create-postgres-sql-client.js';

type PostgresUnsafeSqlClient = Pick<PostgresSqlClient, 'unsafe'>;

/** Execute a translated SQL query through the package's postgres.js client surface. */
export async function executeTranslatedSql<Row extends Record<string, unknown>>(
  sql: PostgresUnsafeSqlClient,
  query: TranslatedSqlQuery,
): Promise<readonly Row[]> {
  return sql.unsafe<Row[]>(query.text, [...query.values]);
}
