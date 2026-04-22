import type { AppliedImmutableDatalogMigration } from '../contracts/immutable-datalog-migration.js';
import type { ImmutableDatalogProject } from '../contracts/immutable-datalog-project.js';

/** Reject applied-history snapshots that mutate or reorder immutable migrations. */
export function assertImmutableMigrationHistory(
  project: ImmutableDatalogProject,
  appliedMigrations: readonly AppliedImmutableDatalogMigration[],
): void {
  for (const [index, appliedMigration] of appliedMigrations.entries()) {
    const currentMigration = project.migrations[index];

    if (!currentMigration) {
      throw new Error(`Applied immutable migration ${appliedMigration.id} is missing from the current project definition.`);
    }

    if (currentMigration.id !== appliedMigration.id) {
      throw new Error(`Immutable migration order changed at position ${index + 1}: expected ${appliedMigration.id}, found ${currentMigration.id}.`);
    }

    if (currentMigration.fingerprint !== appliedMigration.fingerprint) {
      throw new Error(`Immutable migration ${appliedMigration.id} was modified after being applied.`);
    }
  }
}
