import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const workerProofDirectory = path.join(
  os.tmpdir(),
  'datalog-medical-ontology-e2e',
  'localhost-postgres-proof',
  `run-${process.ppid}`,
);

export interface LocalhostPostgresWorkerProofPayload {
  readonly databaseName: string;
  readonly workerId: string;
  readonly writtenAt: number;
}

export function writeLocalhostPostgresWorkerProof(
  label: string,
  payload: LocalhostPostgresWorkerProofPayload,
): string {
  mkdirSync(workerProofDirectory, {
    recursive: true,
    mode: 0o700,
  });

  const filePath = resolveWorkerProofPath(label);
  writeFileSync(filePath, JSON.stringify(payload), {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'w',
  });
  return filePath;
}

export function readFreshLocalhostPostgresWorkerProofs(
  labels: readonly string[],
  freshnessCutoff: number,
): LocalhostPostgresWorkerProofPayload[] {
  return labels.flatMap((label) => {
    try {
      const payload = JSON.parse(readFileSync(resolveWorkerProofPath(label), 'utf8')) as LocalhostPostgresWorkerProofPayload;
      return payload.writtenAt >= freshnessCutoff ? [payload] : [];
    } catch {
      return [];
    }
  });
}

export function cleanupLocalhostPostgresWorkerProof(label: string): void {
  rmSync(resolveWorkerProofPath(label), { force: true });
}

function resolveWorkerProofPath(label: string): string {
  return path.join(workerProofDirectory, `${label}.json`);
}
