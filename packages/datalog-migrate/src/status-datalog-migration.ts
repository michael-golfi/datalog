#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadDatalogMigrationProjectFiles } from './load-datalog-migration-project-files.js';
import type {
  AppliedMigrationState,
  MigrationReconciliation,
} from './reconcile-applied-migrations.js';
import { reconcileAppliedMigrations } from './reconcile-applied-migrations.js';
import { readAppliedMigrationStateFromDatabase } from './read-applied-migration-state.js';

type DatalogMigrationStatusCode =
  | 'clean'
  | 'current-uncommitted'
  | 'committed-applied'
  | 'committed-pending'
  | 'committed-pending-unknown'
  | 'committed-and-current';

export interface DatalogMigrationStatusOptions {
  readonly workspaceRoot?: string;
  readonly appliedMigrationState?: AppliedMigrationState;
}

export interface DatalogMigrationStatus {
  readonly committedMigrationCount: number;
  readonly hasCurrentChanges: boolean;
  readonly latestCommittedMigrationFileName: string | null;
  readonly canDeterminePendingCommittedMigrations: boolean;
  readonly pendingCommittedMigrations: boolean | null;
  readonly statusCode: DatalogMigrationStatusCode;
  readonly statusFlags: {
    readonly currentUncommitted: boolean;
    readonly committedPresent: boolean;
    readonly pendingCommittedUnknown: boolean;
  };
}

/** Inspect the current-vs-committed Datalog migration state using the flat migration workflow. */
export function readMigrationStatus(options: DatalogMigrationStatusOptions = {}): DatalogMigrationStatus {
  const projectFiles = loadDatalogMigrationProjectFiles(options);
  const currentSource = readFileSync(projectFiles.currentMigrationPath, 'utf8');
  const hasCurrentChanges = hasMeaningfulCurrentContent(currentSource);
  const committedPresent = projectFiles.committedMigrations.length > 0;
  const reconciliation = options.appliedMigrationState
    ? reconcileAppliedMigrations({
        committedMigrationFileNames: projectFiles.committedMigrations.map((migration) => migration.fileName),
        appliedMigrationState: options.appliedMigrationState,
      })
    : null;
  const pendingCommittedMigrations = getPendingCommittedMigrations(committedPresent, reconciliation);

  return {
    committedMigrationCount: projectFiles.committedMigrations.length,
    hasCurrentChanges,
    latestCommittedMigrationFileName: projectFiles.committedMigrations.at(-1)?.fileName ?? null,
    canDeterminePendingCommittedMigrations: reconciliation !== null,
    pendingCommittedMigrations,
    statusCode: getDatalogMigrationStatusCode(hasCurrentChanges, committedPresent, reconciliation),
    statusFlags: {
      currentUncommitted: hasCurrentChanges,
      committedPresent,
      pendingCommittedUnknown: reconciliation === null && committedPresent,
    },
  };
}

function getDatalogMigrationStatusCode(
  hasCurrentChanges: boolean,
  committedPresent: boolean,
  reconciliation: MigrationReconciliation | null,
): DatalogMigrationStatusCode {
  if (hasCurrentChanges && committedPresent) {
    return 'committed-and-current';
  }

  if (hasCurrentChanges) {
    return 'current-uncommitted';
  }

  if (!committedPresent) {
    return 'clean';
  }

  if (reconciliation !== null) {
    return reconciliation.allApplied ? 'committed-applied' : 'committed-pending';
  }

  return 'committed-pending-unknown';
}

function getPendingCommittedMigrations(
  committedPresent: boolean,
  reconciliation: MigrationReconciliation | null,
): boolean | null {
  if (reconciliation !== null) {
    return reconciliation.pendingMigrationFileNames.length > 0;
  }

  if (committedPresent) {
    return null;
  }

  return false;
}

function hasMeaningfulCurrentContent(source: string): boolean {
  return source
    .split('\n')
    .some((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('%');
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const connectionString = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;

  if (connectionString) {
    await runStatusCliWithDatabase(connectionString);
  } else {
    process.stdout.write(`${JSON.stringify(readMigrationStatus(), null, 2)}\n`);
  }
}

async function runStatusCliWithDatabase(connectionString: string): Promise<void> {
  try {
    const appliedMigrationState = await readAppliedMigrationStateFromDatabase({ connectionString });

    process.stdout.write(`${JSON.stringify(readMigrationStatus({ appliedMigrationState }), null, 2)}\n`);
  } catch {
    process.stdout.write(`${JSON.stringify(readMigrationStatus(), null, 2)}\n`);
  }
}
