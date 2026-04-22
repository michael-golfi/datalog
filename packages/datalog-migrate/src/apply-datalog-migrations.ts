#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type DatalogFact,
  type EdgeFact,
  type VertexFact,
} from '@datalog/datalog-to-sql';
import { parseDocument, type ParsedClause } from '@datalog/parser';

import { applyFactsAndRecordMigrations } from './apply-facts-to-database.js';
import { loadDatalogMigrationProjectFiles } from './load-datalog-migration-project-files.js';

export type CompoundBacklinkExpander = (clause: ParsedClause) => EdgeFact | null;

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
  readonly compoundBacklinkExpander?: CompoundBacklinkExpander;
}

/** Extract Datalog Edge facts from committed migration document bodies. */
export function extractDatalogFactsFromMigrations(
  migrations: ReadonlyArray<{ readonly body: string }>,
  options: ExtractDatalogFactsOptions = {},
): DatalogMigrationFactExtraction {
  const edges: EdgeFact[] = collectEdgeFacts(migrations, options);
  const vertexIds = collectVertexIds(edges);
  const vertices = [...vertexIds].map<VertexFact>((id) => ({ kind: 'vertex', id }));

  return { vertexCount: vertices.length, edgeCount: edges.length, vertices, edges };
}

/** Apply committed Datalog Edge facts from a workspace into PostgreSQL graph tables. */
export async function applyDatalogMigrations(
  options: ApplyDatalogMigrationsOptions,
): Promise<ApplyDatalogMigrationsResult> {
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const projectFiles = loadCommittedProjectFilesOrThrow(workspaceRoot);
  const migrationFileNames = projectFiles.committedMigrations.map((migration) => migration.fileName);
  const extractionOptions = options.compoundBacklinkExpander === undefined
    ? undefined
    : { compoundBacklinkExpander: options.compoundBacklinkExpander };
  const extraction = extractDatalogFactsFromMigrations(projectFiles.committedMigrations, extractionOptions);
  const facts: DatalogFact[] = [...extraction.vertices, ...extraction.edges];
  await applyFactsAndRecordMigrations(options.connectionString, facts, migrationFileNames);

  return {
    appliedMigrationCount: projectFiles.committedMigrations.length,
    appliedFactCount: facts.length,
    workspaceRoot,
  };
}

function collectEdgeFacts(
  migrations: ReadonlyArray<{ readonly body: string }>,
  options: ExtractDatalogFactsOptions,
): EdgeFact[] {
  const edges: EdgeFact[] = [];

  for (const migration of migrations) {
    edges.push(...extractEdgesFromBody(migration.body, options));
  }

  return edges;
}

function extractEdgesFromBody(body: string, options: ExtractDatalogFactsOptions): readonly EdgeFact[] {
  const edges: EdgeFact[] = [];

  for (const clause of parseDocument(body).clauses) {
    const compoundBacklink = tryExpandCompoundBacklink(clause, options);

    if (compoundBacklink === null) {
      continue;
    }

    if (compoundBacklink !== undefined) {
      edges.push(compoundBacklink);
      continue;
    }

    const edge = tryExtractEdge(clause);

    if (edge !== null) {
      edges.push(edge);
    }
  }

  return edges;
}

function collectVertexIds(edges: readonly EdgeFact[]): Set<string> {
  const vertexIds = new Set<string>();

  for (const edge of edges) {
    vertexIds.add(edge.subjectId);
    vertexIds.add(edge.objectId);
  }

  return vertexIds;
}

function tryExtractEdge(clause: ParsedClause): EdgeFact | null {
  if (!isEdgeFactClause(clause)) {
    return null;
  }

  const subjectId = clause.references[0]?.value;
  const predicateId = clause.references[1]?.value;
  const objectId = clause.references[2]?.value;

  if (subjectId === undefined || predicateId === undefined || objectId === undefined) {
    return null;
  }

  return { kind: 'edge', subjectId, predicateId, objectId };
}

function isEdgeFactClause(clause: ParsedClause): boolean {
  if (clause.isCompound || clause.isRule) {
    return false;
  }

  if (clause.predicate === 'DefCompound' || clause.predicate === 'DefPred') {
    return false;
  }

  return clause.predicate === 'Edge';
}

function tryExpandCompoundBacklink(
  clause: ParsedClause,
  options: ExtractDatalogFactsOptions,
): EdgeFact | null | undefined {
  if (!clause.isCompound || clause.predicate === 'DefCompound') {
    return undefined;
  }

  if (options.compoundBacklinkExpander === undefined) {
    return undefined;
  }

  return options.compoundBacklinkExpander(clause);
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
