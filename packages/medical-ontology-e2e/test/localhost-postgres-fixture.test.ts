import { createPostgresSqlClient } from '@datalog/datalog-to-sql';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createLocalhostPostgresFixture,
  medicalOntologyE2EAdminPostgresUrlEnvVar,
} from './fixtures/localhost-postgres-fixture.js';

const fixturesToCleanup: Array<Awaited<ReturnType<typeof createLocalhostPostgresFixture>>> = [];

afterEach(async () => {
  await Promise.all(fixturesToCleanup.splice(0).map(async (fixture) => fixture.cleanup()));
});

describe('createLocalhostPostgresFixture', () => {
  it('creates an initialized isolated database and drops it during cleanup', async () => {
    const fixture = await createLocalhostPostgresFixture();
    fixturesToCleanup.push(fixture);

    const adminSql = createPostgresSqlClient(fixture.adminConnectionString);

    try {
      const visibleDatabases = await adminSql<Array<{ exists: boolean }>>`
        select exists(select 1 from pg_database where datname = ${fixture.databaseName}) as exists
      `;
      const initializedTables = await fixture.sql<Array<{
        vertices_exists: boolean;
        edges_exists: boolean;
      }>>`
        select
          to_regclass('public.vertices') is not null as vertices_exists,
          to_regclass('public.edges') is not null as edges_exists
      `;

      expect(visibleDatabases[0]?.exists).toBe(true);
      expect(initializedTables[0]).toEqual({
        vertices_exists: true,
        edges_exists: true,
      });
    } finally {
      await adminSql.end({ timeout: 1 }).catch(() => undefined);
    }

    await fixture.cleanup();

    const verificationSql = createPostgresSqlClient(fixture.adminConnectionString);

    try {
      const remainingDatabases = await verificationSql<Array<{ exists: boolean }>>`
        select exists(select 1 from pg_database where datname = ${fixture.databaseName}) as exists
      `;

      expect(remainingDatabases[0]?.exists).toBe(false);
    } finally {
      await verificationSql.end({ timeout: 1 }).catch(() => undefined);
    }
  });

  it('builds names with a stable run segment and the current worker id', async () => {
    const firstFixture = await createLocalhostPostgresFixture();
    const secondFixture = await createLocalhostPostgresFixture();

    fixturesToCleanup.push(firstFixture, secondFixture);

    const firstMatch = /^medical_ontology_e2e_([a-z0-9]+)_w([a-z0-9_]+)_([a-z0-9]+)$/u.exec(firstFixture.databaseName);
    const secondMatch = /^medical_ontology_e2e_([a-z0-9]+)_w([a-z0-9_]+)_([a-z0-9]+)$/u.exec(secondFixture.databaseName);

    expect(firstMatch).not.toBeNull();
    expect(secondMatch).not.toBeNull();
    expect(firstFixture.databaseName).not.toBe(secondFixture.databaseName);
    expect(firstMatch?.[1]).toBe(secondMatch?.[1]);
    expect(firstMatch?.[2]).toBe(firstFixture.workerId);
    expect(secondMatch?.[2]).toBe(secondFixture.workerId);
  });

  it('reports an actionable localhost error when the admin database is unreachable', async () => {
    const originalAdminUrl = process.env[medicalOntologyE2EAdminPostgresUrlEnvVar];
    process.env[medicalOntologyE2EAdminPostgresUrlEnvVar] = 'postgresql://postgres:postgres@127.0.0.1:1/postgres';

    try {
      await expect(createLocalhostPostgresFixture()).rejects.toThrow(
        `set ${medicalOntologyE2EAdminPostgresUrlEnvVar}`,
      );
      await expect(createLocalhostPostgresFixture()).rejects.toThrow(
        'The default admin URL is',
      );
    } finally {
      if (originalAdminUrl === undefined) {
        delete process.env[medicalOntologyE2EAdminPostgresUrlEnvVar];
      } else {
        process.env[medicalOntologyE2EAdminPostgresUrlEnvVar] = originalAdminUrl;
      }
    }
  });
});
