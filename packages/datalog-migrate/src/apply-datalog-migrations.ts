#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  vertexFact,
  type DatalogFact,
  type DatalogSchema,
  type DefCompoundSchema,
  type EdgeFact,
  type VertexFact,
} from '@datalog/ast';
import { parseDatalogProgram, parseDocument, type ParsedClause } from '@datalog/parser';

import { applyFactsAndRecordMigrations } from './apply-facts-to-database.js';
import { loadDatalogMigrationProjectFiles } from './load-datalog-migration-project-files.js';
import { extractStandardGraphFacts } from './extract-datalog-graph-facts.js';
import {
  extractDatalogSchemaFromMigrations,
  getDefCompoundSchemasByCompoundName,
  getDefPredSchemasByPredicateName,
} from './extract-datalog-schema-from-migrations.js';
import {
  extractCompoundBacklinksFromClauses,
  validateDatalogMigrationFactStatements,
  type DatalogMigrationSchemaMaps,
} from './validate-datalog-migration-facts.js';

export interface CompoundBacklinkExpansionContext {
  readonly clause: ParsedClause;
  readonly schema: DefCompoundSchema;
  readonly schemas: readonly DatalogSchema[];
}

export type CompoundBacklinkExpander = (context: CompoundBacklinkExpansionContext) => EdgeFact | null;

export interface ApplyDatalogMigrationsOptions {
  readonly workspaceRoot?: string;
  readonly connectionString: string;
  readonly compoundBacklinkExpander?: CompoundBacklinkExpander;
}

export interface ApplyDatalogMigrationsResult {
  readonly appliedMigrationCount: number;
  readonly appliedFactCount: number;
  readonly workspaceRoot: string;
}

export interface DatalogMigrationFactExtraction {
  readonly vertexCount: number;
  readonly edgeCount: number;
  readonly vertices: readonly VertexFact[];
  readonly edges: readonly EdgeFact[];
}

export interface ExtractDatalogFactsOptions {
  readonly schemas?: readonly DatalogSchema[];
  readonly compoundBacklinkExpander?: CompoundBacklinkExpander;
}

/** Extract Datalog edge and vertex facts from committed migration document bodies. */
export function extractDatalogFactsFromMigrations(
  migrations: ReadonlyArray<{ readonly body: string }>,
  options: ExtractDatalogFactsOptions = {},
): DatalogMigrationFactExtraction {
  const schemas = options.schemas ?? extractDatalogSchemaFromMigrations(migrations);
  const schemaMaps = buildSchemaMaps(schemas);
  const extraction = collectGraphFacts({ migrations, schemas, schemaMaps, options });
  const vertices = [...extraction.vertexIds].map<VertexFact>((id) => vertexFact(id));

  return {
    vertexCount: vertices.length,
    edgeCount: extraction.edges.length,
    vertices,
    edges: extraction.edges,
  };
}

/** Apply committed Datalog edge and vertex facts from a workspace into PostgreSQL graph tables. */
export async function applyDatalogMigrations(
  options: ApplyDatalogMigrationsOptions,
): Promise<ApplyDatalogMigrationsResult> {
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const projectFiles = loadCommittedProjectFilesOrThrow(workspaceRoot);
  const migrationFileNames = projectFiles.committedMigrations.map((migration) => migration.fileName);
  const schemas = extractDatalogSchemaFromMigrations(projectFiles.committedMigrations);
  const extraction = extractDatalogFactsFromMigrations(projectFiles.committedMigrations, createExtractFactsOptions({
    schemas,
    compoundBacklinkExpander: options.compoundBacklinkExpander,
  }));
  const facts: DatalogFact[] = [...extraction.vertices, ...extraction.edges];
  await applyFactsAndRecordMigrations(options.connectionString, facts, migrationFileNames);

  return {
    appliedMigrationCount: projectFiles.committedMigrations.length,
    appliedFactCount: facts.length,
    workspaceRoot,
  };
}

function buildSchemaMaps(schemas: readonly DatalogSchema[]): DatalogMigrationSchemaMaps {
  return {
    predicateSchemas: getDefPredSchemasByPredicateName(schemas),
    compoundSchemas: getDefCompoundSchemasByCompoundName(schemas),
  };
}

function collectGraphFacts(input: {
  readonly migrations: ReadonlyArray<{ readonly body: string }>;
  readonly schemas: readonly DatalogSchema[];
  readonly schemaMaps: DatalogMigrationSchemaMaps;
  readonly options: ExtractDatalogFactsOptions;
}): {
  readonly vertexIds: Set<string>;
  readonly edges: EdgeFact[];
} {
  const vertexIds = new Set<string>();
  const edges: EdgeFact[] = [];

  for (const migration of input.migrations) {
    const facts = extractFactsFromBody({
      body: migration.body,
      schemas: input.schemas,
      schemaMaps: input.schemaMaps,
      options: input.options,
    });

    for (const fact of facts) {
      addGraphFactToExtraction(fact, vertexIds, edges);
    }
  }

  return { vertexIds, edges };
}

function extractFactsFromBody(input: {
  readonly body: string;
  readonly schemas: readonly DatalogSchema[];
  readonly schemaMaps: DatalogMigrationSchemaMaps;
  readonly options: ExtractDatalogFactsOptions;
}): readonly DatalogFact[] {
  const parsedProgram = parseDatalogProgram(input.body);
  const parsedDocument = parseDocument(input.body);

  validateDatalogMigrationFactStatements({
    statements: parsedProgram.statements,
    clauses: parsedDocument.clauses,
    schemaMaps: input.schemaMaps,
  });

  return [
    ...extractStandardGraphFacts(parsedProgram.statements),
    ...extractCompoundBacklinksFromClauses(createCompoundBacklinkInput({
      clauses: parsedDocument.clauses,
      schemas: input.schemas,
      compoundSchemas: input.schemaMaps.compoundSchemas,
      compoundBacklinkExpander: input.options.compoundBacklinkExpander,
    })),
  ];
}

function createExtractFactsOptions(input: {
  readonly schemas: readonly DatalogSchema[];
  readonly compoundBacklinkExpander: CompoundBacklinkExpander | undefined;
}): ExtractDatalogFactsOptions {
  return {
    schemas: input.schemas,
    ...(input.compoundBacklinkExpander === undefined
      ? {}
      : { compoundBacklinkExpander: input.compoundBacklinkExpander }),
  };
}

function createCompoundBacklinkInput(input: {
  readonly clauses: readonly ParsedClause[];
  readonly schemas: readonly DatalogSchema[];
  readonly compoundSchemas: ReadonlyMap<string, DefCompoundSchema>;
  readonly compoundBacklinkExpander: CompoundBacklinkExpander | undefined;
}): Parameters<typeof extractCompoundBacklinksFromClauses>[0] {
  return {
    clauses: input.clauses,
    schemas: input.schemas,
    compoundSchemas: input.compoundSchemas,
    ...(input.compoundBacklinkExpander === undefined
      ? {}
      : { compoundBacklinkExpander: input.compoundBacklinkExpander }),
  };
}

function addGraphFactToExtraction(fact: DatalogFact, vertexIds: Set<string>, edges: EdgeFact[]): void {
  if (fact.kind === 'vertex') {
    vertexIds.add(fact.id);
    return;
  }

  vertexIds.add(fact.subjectId);
  vertexIds.add(fact.objectId);
  edges.push(fact);
}

function loadCommittedProjectFilesOrThrow(workspaceRoot: string) {
  if (!existsSync(path.join(workspaceRoot, 'migrations'))) {
    throw new Error('No committed migrations found in the workspace.');
  }

  const projectFiles = loadDatalogMigrationProjectFiles({ workspaceRoot });

  if (projectFiles.committedMigrations.length === 0) {
    throw new Error('No committed migrations found in the workspace.');
  }

  return projectFiles;
}

async function runCli(): Promise<void> {
  const connectionString = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;

  if (!connectionString) {
    process.stderr.write('DATABASE_URL or TEST_DATABASE_URL must be set.\n');
    process.exitCode = 1;
    return;
  }

  try {
    const result = await applyDatalogMigrations({ connectionString });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runCli();
}
