import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  applyDatalogFacts,
  createPostgresSqlClient,
  executeTranslatedSql,
  initializeGraphSchema,
  startRecursiveClosurePostgresRuntime,
  translateGraphOperation,
  waitForPostgres,
} from '@datalog/datalog-to-sql';

import { loadCommittedOntologyFacts } from './load-committed-ontology-facts.js';

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

describe('flat migration ontology e2e', () => {
  const runtime = startRecursiveClosurePostgresRuntime(runtimeContract);
  const sql = createPostgresSqlClient(runtime.connectionString);
  const facts = loadCommittedOntologyFacts();

  beforeAll(async () => {
    await waitForPostgres(runtime.connectionString);
  });

  beforeEach(async () => {
    await initializeGraphSchema(sql);
    await applyDatalogFacts({
      sql,
      mode: 'insert-facts',
      facts,
    });
  });

  afterAll(async () => {
    await sql.end({ timeout: 1 });
    runtime.cleanup();
  });

  it('proves flat committed migrations drive canonical backlink, hierarchy, and relation-role queries', async () => {
    const canonicalIngredientResult = await executeQuery<{
      foreign_identifier: string;
      source_graph: string;
    }>(sql, {
      kind: 'select-facts',
      match: [
        {
          kind: 'edge',
          subject: { kind: 'constant', value: 'concept/acetaminophen' },
          predicate: { kind: 'constant', value: 'graph/has_foreign_identifier' },
          object: { kind: 'variable', name: 'foreign_identifier' },
        },
        {
          kind: 'edge',
          subject: { kind: 'variable', name: 'foreign_identifier' },
          predicate: { kind: 'constant', value: 'graph/in_source_graph' },
          object: { kind: 'variable', name: 'source_graph' },
        },
      ],
    });
    const canonicalDisorderResult = await executeQuery<{ parent: string }>(sql, {
      kind: 'select-facts',
      match: [
        {
          kind: 'edge',
          subject: { kind: 'constant', value: 'concept/acute-bronchitis' },
          predicate: { kind: 'constant', value: 'graph/is_a' },
          object: { kind: 'variable', name: 'parent' },
        },
      ],
    });
    const medicationPresentationResult = await executeQuery<{
      ingredient: string;
      relation: string;
      strength_unit: string;
      strength_value: string;
    }>(sql, {
      kind: 'select-facts',
      match: [
        {
          kind: 'edge',
          subject: { kind: 'constant', value: 'concept/acetaminophen-500mg-oral-tablet' },
          predicate: { kind: 'constant', value: 'graph/has_ingredient_relation' },
          object: { kind: 'variable', name: 'relation' },
        },
        {
          kind: 'edge',
          subject: { kind: 'variable', name: 'relation' },
          predicate: { kind: 'constant', value: 'graph/relation_ingredient' },
          object: { kind: 'variable', name: 'ingredient' },
        },
        {
          kind: 'edge',
          subject: { kind: 'variable', name: 'relation' },
          predicate: { kind: 'constant', value: 'graph/relation_strength_unit' },
          object: { kind: 'variable', name: 'strength_unit' },
        },
        {
          kind: 'edge',
          subject: { kind: 'variable', name: 'relation' },
          predicate: { kind: 'constant', value: 'graph/relation_strength_value' },
          object: { kind: 'variable', name: 'strength_value' },
        },
      ],
    });

    expect(canonicalIngredientResult.map((row) => row.source_graph).sort()).toEqual(['source-graph/rxnorm', 'source-graph/umls']);
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

  it('proves broken canonical state after load is observable through the same flat-migration-backed SQL query flow', async () => {
    await applyDatalogFacts({
      sql,
      mode: 'delete-facts',
      facts: [{
        kind: 'edge',
        subjectId: 'relation/acetaminophen-500mg-tablet-ingredient',
        predicateId: 'graph/relation_strength_unit',
        objectId: 'unit/mg',
      }],
    });

    const result = await executeQuery<{
      ingredient: string;
      relation: string;
      strength_unit: string;
      strength_value: string;
    }>(sql, {
      kind: 'select-facts',
      match: [
        {
          kind: 'edge',
          subject: { kind: 'constant', value: 'concept/acetaminophen-500mg-oral-tablet' },
          predicate: { kind: 'constant', value: 'graph/has_ingredient_relation' },
          object: { kind: 'variable', name: 'relation' },
        },
        {
          kind: 'edge',
          subject: { kind: 'variable', name: 'relation' },
          predicate: { kind: 'constant', value: 'graph/relation_ingredient' },
          object: { kind: 'variable', name: 'ingredient' },
        },
        {
          kind: 'edge',
          subject: { kind: 'variable', name: 'relation' },
          predicate: { kind: 'constant', value: 'graph/relation_strength_unit' },
          object: { kind: 'variable', name: 'strength_unit' },
        },
        {
          kind: 'edge',
          subject: { kind: 'variable', name: 'relation' },
          predicate: { kind: 'constant', value: 'graph/relation_strength_value' },
          object: { kind: 'variable', name: 'strength_value' },
        },
      ],
    });

    expect(result).toHaveLength(0);
  });
});

async function executeQuery<Row extends Record<string, unknown>>(
  sql: ReturnType<typeof createPostgresSqlClient>,
  operation: Parameters<typeof translateGraphOperation>[0],
): Promise<readonly Row[]> {
  const translated = translateGraphOperation(operation);

  expect(translated.ok).toBe(true);
  if (!translated.ok) {
    throw translated.error;
  }

  return executeTranslatedSql<Row>(sql, translated.value);
}
