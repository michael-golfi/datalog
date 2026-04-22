import { expect, it } from 'vitest';

import { createLocalhostPostgresFixture } from './fixtures/localhost-postgres-fixture.js';
import {
  cleanupLocalhostPostgresWorkerProof,
  readFreshLocalhostPostgresWorkerProofs,
  writeLocalhostPostgresWorkerProof,
} from './fixtures/localhost-postgres-worker-proof-support.js';

const freshnessWindowMs = 15_000;
const peerObservationTimeoutMs = 2_000;
const workerProofLabels = ['worker-a', 'worker-b'] as const;
const workerProofLabel = 'worker-b';
const workerCollisionProofEnabled = process.env.MEDICAL_ONTOLOGY_E2E_RUN_WORKER_COLLISION_PROOF === '1';

(workerCollisionProofEnabled ? it : it.skip)('records a second worker-specific database name for the two-worker collision proof', async () => {
  const fixture = await createLocalhostPostgresFixture();

  try {
    writeLocalhostPostgresWorkerProof(workerProofLabel, {
      databaseName: fixture.databaseName,
      workerId: fixture.workerId,
      writtenAt: Date.now(),
    });

    const proofDeadline = Date.now() + peerObservationTimeoutMs;
    let proofPayloads = readFreshProofPayloads();

    while (proofPayloads.length < 2 && Date.now() < proofDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      proofPayloads = readFreshProofPayloads();
    }

    if (proofPayloads.length === 1) {
      expect(proofPayloads[0]?.databaseName).toBe(fixture.databaseName);
      expect(fixture.databaseName).toContain(`_w${fixture.workerId}_`);
      return;
    }

    expect(proofPayloads).toHaveLength(2);
    expect(new Set(proofPayloads.map((payload) => payload.databaseName)).size).toBe(2);
    expect(new Set(proofPayloads.map((payload) => payload.workerId)).size).toBe(2);
  } finally {
    cleanupLocalhostPostgresWorkerProof(workerProofLabel);
    await fixture.cleanup();
  }
}, freshnessWindowMs);

function readFreshProofPayloads(): Array<{ databaseName: string; workerId: string; writtenAt: number }> {
  return readFreshLocalhostPostgresWorkerProofs(workerProofLabels, Date.now() - freshnessWindowMs);
}
