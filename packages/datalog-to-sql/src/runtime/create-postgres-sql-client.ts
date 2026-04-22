import postgres from 'postgres';

export type PostgresSqlClient = ReturnType<typeof postgres>;

/** Create the package's shared postgres.js client with conservative benchmark-safe defaults. */
export function createPostgresSqlClient(connectionString: string): PostgresSqlClient {
  return postgres(connectionString, {
    idle_timeout: 1,
    max: 1,
    onnotice: () => undefined,
  });
}
