import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe } from 'vitest';

const currentMigrationBody = 'Edge("vertex/alpha", "graph/links_to", "vertex/beta").\n';

export const invalidCurrentMigrationBody = '% migration.previous: none\nEdge("vertex/example", "graph/label", "value/example").\n';

/** Create a temporary workspace fixture seeded with a mutable current.dl file. */
export function createDatalogMigrationWorkflowWorkspaceFixture(temporaryRoots: string[]): string {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'datalog-migration-workflow-'));
  temporaryRoots.push(workspaceRoot);
  mkdirSync(path.join(workspaceRoot, 'migrations'), { recursive: true });
  writeFileSync(path.join(workspaceRoot, 'current.dl'), currentMigrationBody, 'utf8');
  return workspaceRoot;
}

/** Return the canonical current.dl body used by the workflow e2e fixture. */
export function getCurrentMigrationBody(): string {
  return currentMigrationBody;
}

/** Remove any temporary workflow fixture workspaces created during the test run. */
export function cleanupTemporaryWorkspaceRoots(temporaryRoots: string[]): void {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
}

describe.skip('datalog migration workflow test fixture support', () => {});
