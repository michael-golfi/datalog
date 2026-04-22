import { describe, expect, it } from 'vitest';

import { createOntologyLivePostgresProofFixture } from './fixtures/ontology-live-postgres-proof-fixture.js';
import { medicalOntologyE2EAdminPostgresUrlEnvVar } from './fixtures/localhost-postgres-fixture.js';

describe('ontology live postgres failure', () => {
  it('reports actionable guidance when the localhost admin database is unreachable', async () => {
    const originalAdminUrl = process.env[medicalOntologyE2EAdminPostgresUrlEnvVar];
    process.env[medicalOntologyE2EAdminPostgresUrlEnvVar] = 'postgresql://postgres:postgres@localhost:1/postgres';

    try {
      const thrownError = await readThrownError();

      expect(thrownError).toBeInstanceOf(Error);
      expect(thrownError?.message).toContain('Unable to reach the local PostgreSQL admin database');
      expect(thrownError?.message).toContain('Start PostgreSQL on localhost');
      expect(thrownError?.message).toContain(`set ${medicalOntologyE2EAdminPostgresUrlEnvVar}`);
    } finally {
      if (originalAdminUrl === undefined) {
        delete process.env[medicalOntologyE2EAdminPostgresUrlEnvVar];
      } else {
        process.env[medicalOntologyE2EAdminPostgresUrlEnvVar] = originalAdminUrl;
      }
    }
  });
});

async function readThrownError(): Promise<Error | undefined> {
  try {
    const fixture = await createOntologyLivePostgresProofFixture();
    await fixture.cleanup();
    return undefined;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
