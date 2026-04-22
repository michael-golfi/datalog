import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { OntologyDatalogFact } from '../contracts/ontology-fixture-facts.js';
import type { ImmutableDatalogProject } from '../contracts/immutable-datalog-project.js';
import { createImmutableDatalogProject } from '../project/create-immutable-datalog-project.js';
import { resolveMedicalOntologyWorkspacePath } from '../project/resolve-medical-ontology-workspace-path.js';
import { representativeOntologyMigrations } from '../migrations/representative-ontology-migrations.js';
import { loadDatalogFixture } from '../mappings/load-datalog-fixture.js';
import type { OntologyQueryOperation } from '../contracts/ontology-query-operation.js';
import {
  createCanonicalIngredientBacklinkQuery,
  createCanonicalDisorderHierarchyQuery,
  createCrossMappingDeletionCheck,
  createMedicationPresentationRelationQuery,
} from './representative-ontology-queries.js';

const runtimeContract = {
  minimumPostgresVersion: 13,
  postgresImage: 'postgres:13-alpine',
  databaseName: 'datalog_benchmark',
  username: 'postgres',
  password: 'postgres',
  dataset: {
    rootVertexId: 'vertex/root',
    predicateId: 'graph/reachable',
    depth: 7,
    branchFactor: 4,
    warmupRuns: 1,
    measuredRuns: 5,
  },
  thresholds: {
    maxMedianExecutionTimeMs: 125,
    maxExecutionTimeMs: 175,
  },
  evidenceFileName: 'task-16-recursive-closure-benchmark.json',
} as const;

interface SqlRuntimeModule {
  readonly applyDatalogFacts: (input: {
    readonly sql: ReturnType<SqlRuntimeModule['createPostgresSqlClient']>;
    readonly mode: 'insert-facts' | 'delete-facts';
    readonly facts: readonly [OntologyDatalogFact, ...OntologyDatalogFact[]];
  }) => Promise<void>;
  readonly createPostgresSqlClient: (connectionString: string) => {
    end(options: { timeout: number }): Promise<void>;
    unsafe<Row>(text: string, values: readonly string[]): Promise<Row>;
  } & ((strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<unknown>);
  readonly executeTranslatedSql: <Row extends Record<string, unknown>>(
    sql: ReturnType<SqlRuntimeModule['createPostgresSqlClient']>,
    query: { readonly text: string; readonly values: readonly string[] },
  ) => Promise<readonly Row[]>;
  readonly initializeGraphSchema: (sql: ReturnType<SqlRuntimeModule['createPostgresSqlClient']>) => Promise<void>;
  readonly startRecursiveClosurePostgresRuntime: (
    contract: typeof runtimeContract,
  ) => { readonly connectionString: string; readonly cleanup: () => void };
  readonly translateGraphOperation: (operation: OntologyQueryOperation) =>
    | { readonly ok: true; readonly value: { readonly text: string; readonly values: readonly string[] } }
    | { readonly ok: false; readonly error: Error };
  readonly waitForPostgres: (connectionString: string) => Promise<void>;
}

async function loadSqlRuntime(): Promise<SqlRuntimeModule> {
  const packageName = ['@datalog', 'datalog-to-sql'].join('/');
  return import(packageName) as Promise<SqlRuntimeModule>;
}

describe('representative ontology e2e', () => {
  let sqlRuntime: SqlRuntimeModule;
  let runtime: ReturnType<SqlRuntimeModule['startRecursiveClosurePostgresRuntime']>;
  let sql: ReturnType<SqlRuntimeModule['createPostgresSqlClient']>;
  const project = createImmutableDatalogProject({
    name: 'representative-ontologies',
    migrationsDirectory: resolveMedicalOntologyWorkspacePath('migrations'),
    migrations: [...representativeOntologyMigrations],
  });
  const loadedFacts = new Map<string, readonly [OntologyDatalogFact, ...OntologyDatalogFact[]]>();

  beforeAll(async () => {
    sqlRuntime = await loadSqlRuntime();
    runtime = sqlRuntime.startRecursiveClosurePostgresRuntime(runtimeContract);
    sql = sqlRuntime.createPostgresSqlClient(runtime.connectionString);
    await sqlRuntime.waitForPostgres(runtime.connectionString);
  });

  beforeEach(async () => {
    await loadProjectMigrationsIntoDatabase(sql, sqlRuntime, project, loadedFacts);
  });

  afterAll(async () => {
    await sql.end({ timeout: 1 });
    runtime.cleanup();
  });

  it('proves postgres.js-backed canonical ontology behavior across normalized RxNorm, UMLS, and SNOMED concepts', async () => {
    const canonicalIngredientResult = await executeCanonicalQuery<{
      foreign_identifier: string;
      source_graph: string;
    }>(sql, sqlRuntime, createCanonicalIngredientBacklinkQuery());
    const canonicalDisorderResult = await executeCanonicalQuery<{ parent: string }>(
      sql,
      sqlRuntime,
      createCanonicalDisorderHierarchyQuery(),
    );
    const medicationPresentationResult = await executeCanonicalQuery<{
      ingredient: string;
      relation: string;
      strength_unit: string;
      strength_value: string;
    }>(sql, sqlRuntime, createMedicationPresentationRelationQuery());

    const sourceGraphs = canonicalIngredientResult.map((row) => row.source_graph).sort();

    expect(sourceGraphs).toEqual(['source-graph/rxnorm', 'source-graph/umls']);
    expect(canonicalIngredientResult.some((row) => row.foreign_identifier === 'foreign-id/rxnorm-rxcui-161')).toBe(true);
    expect(canonicalIngredientResult.some((row) => row.foreign_identifier === 'foreign-id/umls-cui-C0000970')).toBe(true);
    expect(canonicalDisorderResult[0]?.parent).toBe('concept/bronchitis-disorder');
    expect(medicationPresentationResult[0]).toMatchObject({
      relation: 'relation/acetaminophen-500mg-tablet-ingredient',
      ingredient: 'concept/acetaminophen',
      strength_unit: 'unit/mg',
      strength_value: 'quantity/500',
    });
  });

  it('proves missing foreign relations break the canonical backlink query', async () => {
    const mappedFacts = loadedFacts.get('2026-04-21-ontology-b-core');
    const mappedEdge = mappedFacts?.find(
      (fact) => fact.kind === 'edge'
        && fact.predicateId === 'graph/has_foreign_identifier'
        && fact.objectId === 'foreign-id/umls-cui-C0000970',
    );

    expect(mappedEdge).toBeDefined();
    if (mappedEdge?.kind !== 'edge') {
      throw new Error('Expected loaded fixture to include graph/has_foreign_identifier edge for the UMLS backlink.');
    }

    await sqlRuntime.applyDatalogFacts({
      sql,
      mode: 'delete-facts',
      facts: [mappedEdge],
    });

    const result = await executeCanonicalQuery<{ foreign_identifier: string; source_graph: string }>(
      sql,
      sqlRuntime,
      createCrossMappingDeletionCheck(),
    );

    expect(result).toHaveLength(0);
  });

  it('proves malformed n-ary relation state breaks the canonical medication presentation query', async () => {
    await sqlRuntime.applyDatalogFacts({
      sql,
      mode: 'delete-facts',
      facts: [{
        kind: 'edge',
        subjectId: 'relation/acetaminophen-500mg-tablet-ingredient',
        predicateId: 'graph/relation_strength_unit',
        objectId: 'unit/mg',
      }],
    });

    const result = await executeCanonicalQuery<{
      ingredient: string;
      relation: string;
      strength_unit: string;
      strength_value: string;
    }>(sql, sqlRuntime, createMedicationPresentationRelationQuery());
  
    expect(result).toHaveLength(0);
  });
});

async function loadProjectMigrationsIntoDatabase(
  sql: ReturnType<SqlRuntimeModule['createPostgresSqlClient']>,
  sqlRuntime: SqlRuntimeModule,
  project: ImmutableDatalogProject,
  loadedFacts: Map<string, readonly [OntologyDatalogFact, ...OntologyDatalogFact[]]>,
): Promise<void> {
  await sqlRuntime.initializeGraphSchema(sql);
  loadedFacts.clear();

  for (const migration of project.migrations) {
    const facts = loadDatalogFixture(migration.fixturePath);
    loadedFacts.set(migration.id, facts);
    await sqlRuntime.applyDatalogFacts({
      sql,
      mode: 'insert-facts',
      facts,
    });
  }
}

async function executeCanonicalQuery<Row extends Record<string, unknown>>(
  sql: ReturnType<SqlRuntimeModule['createPostgresSqlClient']>,
  sqlRuntime: SqlRuntimeModule,
  operation: OntologyQueryOperation,
): Promise<readonly Row[]> {
  const translated = sqlRuntime.translateGraphOperation(operation);

  expect(translated.ok).toBe(true);
  if (!translated.ok) {
    throw new Error('Expected translated canonical ontology query.');
  }

  return sqlRuntime.executeTranslatedSql<Row>(sql, translated.value);
}
