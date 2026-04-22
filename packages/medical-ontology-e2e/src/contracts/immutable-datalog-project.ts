import type { ImmutableDatalogMigration } from './immutable-datalog-migration.js';

export interface ImmutableDatalogProject {
  readonly name: string;
  readonly migrationsDirectory: string;
  readonly migrations: readonly [ImmutableDatalogMigration, ...ImmutableDatalogMigration[]];
}
