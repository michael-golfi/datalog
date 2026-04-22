export interface MigrationReconciliation {
  readonly appliedMigrationFileNames: readonly string[];
  readonly pendingMigrationFileNames: readonly string[];
  readonly allApplied: boolean;
}

export interface AppliedMigrationState {
  readonly appliedMigrationFileNames: readonly string[];
}

/** Compare committed migration file names against an applied state and identify pending migrations. */
export function reconcileAppliedMigrations(input: {
  readonly committedMigrationFileNames: readonly string[];
  readonly appliedMigrationState: AppliedMigrationState;
}): MigrationReconciliation {
  const appliedSet = new Set(input.appliedMigrationState.appliedMigrationFileNames);
  const pendingMigrationFileNames = input.committedMigrationFileNames.filter(
    (fileName) => !appliedSet.has(fileName),
  );

  return {
    appliedMigrationFileNames: input.committedMigrationFileNames.filter((fileName) => appliedSet.has(fileName)),
    pendingMigrationFileNames,
    allApplied: pendingMigrationFileNames.length === 0,
  };
}
