export { createImmutableDatalogProject } from './project/create-immutable-datalog-project.js';
export { assertImmutableMigrationHistory } from './project/assert-immutable-migration-history.js';
export { loadDatalogFixture } from './mappings/load-datalog-fixture.js';
export { representativeOntologyMigrations } from './migrations/representative-ontology-migrations.js';
export { resolveMedicalOntologyWorkspacePath } from './project/resolve-medical-ontology-workspace-path.js';
export type {
  AppliedImmutableDatalogMigration,
  ImmutableDatalogMigration,
} from './contracts/immutable-datalog-migration.js';
export type { ImmutableDatalogProject } from './contracts/immutable-datalog-project.js';
