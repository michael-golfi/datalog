import { randomUUID } from 'node:crypto';

import {
  createPostgresSqlClient,
  initializeGraphSchema,
  type PostgresSqlClient,
} from '@datalog/datalog-to-sql';

export const medicalOntologyE2EAdminPostgresUrlEnvVar = 'MEDICAL_ONTOLOGY_E2E_ADMIN_POSTGRES_URL';
export const defaultMedicalOntologyE2EAdminPostgresUrl = 'postgresql://postgres:postgres@localhost:5432/postgres';

const databaseNamePrefix = 'medical_ontology_e2e';
const fixtureRunId = randomUUID().replace(/-/gu, '').slice(0, 12);

let nextDatabaseSequence = 0;

export interface LocalhostPostgresFixture {
  readonly adminConnectionString: string;
  readonly connectionString: string;
  readonly databaseName: string;
  readonly workerId: string;
  readonly sql: PostgresSqlClient;
  cleanup: () => Promise<void>;
}

export async function createLocalhostPostgresFixture(): Promise<LocalhostPostgresFixture> {
  const adminConnectionString = process.env[medicalOntologyE2EAdminPostgresUrlEnvVar]
    ?? defaultMedicalOntologyE2EAdminPostgresUrl;
  const workerId = resolveVitestWorkerId();
  const databaseName = createDatabaseName({
    workerId,
    sequence: nextDatabaseSequence,
  });

  nextDatabaseSequence += 1;

  await createDatabase({ adminConnectionString, databaseName });

  const connectionString = createDatabaseConnectionString(adminConnectionString, databaseName);
  const sql = createPostgresSqlClient(connectionString);

  try {
    await initializeGraphSchema(sql);
  } catch (error) {
    await sql.end({ timeout: 1 }).catch(() => undefined);
    await dropDatabase({ adminConnectionString, databaseName }).catch(() => undefined);
    throw toLocalhostPostgresFixtureError(error, {
      adminConnectionString,
      databaseName,
      operation: 'initialize the graph schema',
    });
  }

  return {
    adminConnectionString,
    connectionString,
    databaseName,
    workerId,
    sql,
    cleanup: async () => {
      let sqlEndError: unknown;

      try {
        await sql.end({ timeout: 1 });
      } catch (error) {
        sqlEndError = error;
      }

      await dropDatabase({ adminConnectionString, databaseName });

      if (sqlEndError !== undefined) {
        throw toLocalhostPostgresFixtureError(sqlEndError, {
          adminConnectionString,
          databaseName,
          operation: 'close the fixture database client during cleanup',
        });
      }
    },
  };
}

function resolveVitestWorkerId(): string {
  const rawWorkerId = process.env.VITEST_WORKER_ID ?? `pid${process.pid}`;
  const sanitizedWorkerId = rawWorkerId.toLowerCase().replace(/[^a-z0-9]+/gu, '_').replace(/^_+|_+$/gu, '');

  return sanitizedWorkerId.slice(0, 12) || 'unknown';
}

function createDatabaseName(input: { workerId: string; sequence: number }): string {
  const sequenceLabel = input.sequence.toString(36).padStart(2, '0');
  return `${databaseNamePrefix}_${fixtureRunId}_w${input.workerId}_${sequenceLabel}`;
}

async function createDatabase(input: { adminConnectionString: string; databaseName: string }): Promise<void> {
  const adminSql = createPostgresSqlClient(input.adminConnectionString);

  try {
    await adminSql`select 1`;
    await adminSql.unsafe(`create database ${input.databaseName}`);
  } catch (error) {
    throw toLocalhostPostgresFixtureError(error, {
      adminConnectionString: input.adminConnectionString,
      databaseName: input.databaseName,
      operation: 'create the fixture database',
    });
  } finally {
    await adminSql.end({ timeout: 1 }).catch(() => undefined);
  }
}

async function dropDatabase(input: { adminConnectionString: string; databaseName: string }): Promise<void> {
  const adminSql = createPostgresSqlClient(input.adminConnectionString);

  try {
    await adminSql`
      select pg_terminate_backend(pid)
      from pg_stat_activity
      where datname = ${input.databaseName}
        and pid <> pg_backend_pid()
    `;
    await adminSql.unsafe(`drop database if exists ${input.databaseName}`);
  } finally {
    await adminSql.end({ timeout: 1 }).catch(() => undefined);
  }
}

function createDatabaseConnectionString(adminConnectionString: string, databaseName: string): string {
  const connectionUrl = new URL(adminConnectionString);
  connectionUrl.pathname = `/${databaseName}`;
  return connectionUrl.toString();
}

function toLocalhostPostgresFixtureError(
  error: unknown,
  input: { adminConnectionString: string; databaseName: string; operation: string },
): Error {
  const redactedAdminConnectionString = redactConnectionString(input.adminConnectionString);
  const errorMessage = readErrorMessage(error);
  const errorCode = readErrorCode(error);

  if (isUnreachablePostgresError(errorCode, errorMessage)) {
    return new Error(
      `Unable to reach the local PostgreSQL admin database at ${redactedAdminConnectionString}. Start PostgreSQL on localhost or set ${medicalOntologyE2EAdminPostgresUrlEnvVar}. The default admin URL is ${redactConnectionString(defaultMedicalOntologyE2EAdminPostgresUrl)}.`,
      { cause: error },
    );
  }

  if (isCreateDatabasePrivilegeError(errorCode, errorMessage)) {
    return new Error(
      `The PostgreSQL role behind ${redactedAdminConnectionString} cannot create the medical ontology e2e database ${input.databaseName}. Grant CREATEDB or set ${medicalOntologyE2EAdminPostgresUrlEnvVar} to an admin-capable connection string.`,
      { cause: error },
    );
  }

  return new Error(
    `Failed to ${input.operation} for medical ontology e2e database ${input.databaseName} using ${redactedAdminConnectionString}: ${errorMessage}`,
    { cause: error },
  );
}

function isUnreachablePostgresError(errorCode: string | undefined, errorMessage: string): boolean {
  return errorCode === 'ECONNREFUSED'
    || errorCode === 'ENOTFOUND'
    || errorCode === 'EHOSTUNREACH'
    || /connect ECONNREFUSED|connection terminated unexpectedly|getaddrinfo ENOTFOUND|timeout expired/u.test(errorMessage);
}

function isCreateDatabasePrivilegeError(errorCode: string | undefined, errorMessage: string): boolean {
  return errorCode === '42501'
    || /permission denied to create database|must be superuser/u.test(errorMessage);
}

function redactConnectionString(connectionString: string): string {
  try {
    const connectionUrl = new URL(connectionString);

    if (connectionUrl.username.length > 0) {
      connectionUrl.username = '***';
    }

    if (connectionUrl.password.length > 0) {
      connectionUrl.password = '***';
    }

    connectionUrl.search = '';

    return connectionUrl.toString();
  } catch {
    return '<invalid connection string>';
  }
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function readErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}
