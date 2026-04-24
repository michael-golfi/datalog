#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  edgeFact,
  vertexFact,
  type DatalogFact,
  type DatalogFactStatement,
  type DatalogAtomArgument,
  type EdgeFact,
  type VertexFact,
 } from '@datalog/ast';
import { parseDatalogProgram, parseDocument, type ParsedClause } from '@datalog/parser';

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
  const extraction = collectGraphFacts(migrations, options);
  const vertices = [...extraction.vertexIds].map<VertexFact>((id) => vertexFact(id));

  return {
    vertexCount: vertices.length,
    edgeCount: extraction.edges.length,
    vertices,
    edges: extraction.edges,
  };
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

function collectGraphFacts(
  migrations: ReadonlyArray<{ readonly body: string }>,
  options: ExtractDatalogFactsOptions,
): {
  readonly vertexIds: Set<string>;
  readonly edges: EdgeFact[];
} {
  const vertexIds = new Set<string>();
  const edges: EdgeFact[] = [];

  for (const migration of migrations) {
    const facts = extractFactsFromBody(migration.body, options);

    for (const fact of facts) {
      addGraphFactToExtraction(fact, vertexIds, edges);
    }
  }

  return { vertexIds, edges };
}

function extractFactsFromBody(body: string, options: ExtractDatalogFactsOptions): readonly DatalogFact[] {
  return [
    ...extractStandardGraphFacts(body),
    ...extractCompoundBacklinksFromBody(body, options),
  ];
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

function extractStandardGraphFacts(body: string): readonly DatalogFact[] {
  const facts: DatalogFact[] = [];

  for (const statement of parseDatalogProgram(body).statements) {
    const fact = tryExtractGraphFact(statement);

    if (fact !== null) {
      facts.push(fact);
    }
  }

  return facts;
}

function extractCompoundBacklinksFromBody(
  body: string,
  options: ExtractDatalogFactsOptions,
): readonly EdgeFact[] {
  if (options.compoundBacklinkExpander === undefined) {
    return [];
  }

  const edges: EdgeFact[] = [];

  for (const clause of parseDocument(body).clauses) {
    const compoundBacklink = tryExpandCompoundBacklink(clause, options.compoundBacklinkExpander);

    if (compoundBacklink === null) {
      continue;
    }

    if (compoundBacklink !== undefined) {
      edges.push(compoundBacklink);
    }
  }

  return edges;
}

function tryExtractGraphFact(statement: ReturnType<typeof parseDatalogProgram>['statements'][number]): DatalogFact | null {
  if (statement.kind !== 'fact') {
    return null;
  }

  if (isEdgeFactStatement(statement)) {
    return toEdgeFact(statement);
  }

  if (isVertexFactStatement(statement)) {
    return toVertexFact(statement);
  }

  return null;
}

function isEdgeFactStatement(statement: DatalogFactStatement): boolean {
  return statement.atom.predicate === 'Edge' && statement.atom.terms.length === 3;
}

function isVertexFactStatement(statement: DatalogFactStatement): boolean {
  return (statement.atom.predicate === 'Vertex' || statement.atom.predicate === 'Node')
    && statement.atom.terms.length === 1;
}

function toEdgeFact(statement: DatalogFactStatement): EdgeFact | null {
  const [subject, predicate, object] = statement.atom.terms;
  const subjectId = getQuotedGraphId(subject);
  const predicateId = getQuotedGraphId(predicate);
  const objectId = getQuotedGraphId(object);

  if (subjectId === undefined || predicateId === undefined || objectId === undefined) {
    return null;
  }

  return edgeFact({ subjectId, predicateId, objectId });
}

function toVertexFact(statement: DatalogFactStatement): VertexFact | null {
  const [vertexIdTerm] = statement.atom.terms;
  const id = getQuotedGraphId(vertexIdTerm);

  if (id === undefined) {
    return null;
  }

  return vertexFact(id);
}

function getQuotedGraphId(term: DatalogAtomArgument | undefined): string | undefined {
  if (term === undefined || term.kind === 'named' || term.kind !== 'constant' || typeof term.value !== 'string') {
    return undefined;
  }

  return term.value;
}

function tryExpandCompoundBacklink(
  clause: ParsedClause,
  compoundBacklinkExpander: CompoundBacklinkExpander,
): EdgeFact | null | undefined {
  if (!clause.isCompound || clause.predicate === 'DefCompound') {
    return undefined;
  }

  return compoundBacklinkExpander(clause);
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
