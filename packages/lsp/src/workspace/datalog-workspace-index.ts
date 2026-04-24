import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  parseDocument,
  type DatalogPredicateSymbolIdentity,
  type NodeSummary,
  type ParsedDocument,
  type ParsedDatalogProgramSources,
  type PredicateSchema,
  type Range,
} from '@datalog/parser';
import {
  loadDatalogMigrationProjectFiles,
} from '@datalog/datalog-migrate/load-datalog-migration-project-files';

import type {
  DatalogDocumentStore,
  DatalogTextDocumentSnapshot,
} from './datalog-document-store.js';
import { buildDatalogWorkspaceProgram } from './datalog-workspace-program.js';
import { listDatalogWorkspaceFiles } from './datalog-workspace-files.js';
import {
  buildCompoundFieldNames,
  buildGraphPredicateIds,
  buildGraphNodeIds,
  buildNodeSummaryTargets,
  buildPredicateDefinitions,
  buildPredicateSchemaTargets,
  buildWorkspacePredicateIdentities,
  isPathInsideWorkspaceRoot,
} from './datalog-workspace-index-builders.js';

export interface DatalogWorkspaceDocument {
  readonly uri: string;
  readonly source: string;
  readonly parsedDocument: ParsedDocument;
}

export interface DatalogWorkspacePredicateDefinition {
  readonly uri: string;
  readonly identity: DatalogPredicateSymbolIdentity;
  readonly range: Range;
}

export interface DatalogWorkspacePredicateSchemaTarget {
  readonly uri: string;
  readonly schema: PredicateSchema;
  readonly range: Range;
}

export interface DatalogWorkspaceNodeSummaryTarget {
  readonly uri: string;
  readonly summary: NodeSummary;
  readonly range: Range;
}

/** Aggregate parser facts for `.dl` files in a single-root workspace plus open buffers. */
export class DatalogWorkspaceIndex {
  readonly #documentStore: DatalogDocumentStore;
  readonly #parseDocument: typeof parseDocument;
  readonly #listWorkspaceFiles: typeof listDatalogWorkspaceFiles;
  readonly #readFile: typeof readFile;
  readonly #loadMigrationProjectFiles: typeof loadDatalogMigrationProjectFiles;

  #workspaceRootPath: string | null = null;
  #diskDocumentsByUri = new Map<string, DatalogWorkspaceDocument>();
  #indexedDocumentsByUri = new Map<string, DatalogWorkspaceDocument>();
  #workspaceProgram: ParsedDatalogProgramSources | null = null;
  #predicateDefinitionsByIdentity = new Map<string, readonly DatalogWorkspacePredicateDefinition[]>();
  #workspacePredicateIdentities = new Map<string, DatalogPredicateSymbolIdentity>();
  #graphPredicateIds: readonly string[] = [];
  #predicateSchemaTargetsById = new Map<string, readonly DatalogWorkspacePredicateSchemaTarget[]>();
  #nodeSummaryTargetsById = new Map<string, readonly DatalogWorkspaceNodeSummaryTarget[]>();
  #graphNodeIds: readonly string[] = [];
  #compoundFieldNamesByPredicate = new Map<string, readonly string[]>();
  #refreshGeneration = 0;

  constructor(options: {
    readonly documentStore: DatalogDocumentStore;
    readonly parseDocument?: typeof parseDocument;
    readonly listWorkspaceFiles?: typeof listDatalogWorkspaceFiles;
    readonly readFile?: typeof readFile;
    readonly loadMigrationProjectFiles?: typeof loadDatalogMigrationProjectFiles;
  }) {
    this.#documentStore = options.documentStore;
    this.#parseDocument = options.parseDocument ?? parseDocument;
    this.#listWorkspaceFiles = options.listWorkspaceFiles ?? listDatalogWorkspaceFiles;
    this.#readFile = options.readFile ?? readFile;
    this.#loadMigrationProjectFiles = options.loadMigrationProjectFiles ?? loadDatalogMigrationProjectFiles;
  }

  async setWorkspaceRootPath(workspaceRootPath: string | null): Promise<void> {
    this.#workspaceRootPath = workspaceRootPath;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const refreshGeneration = ++this.#refreshGeneration;
    const diskDocumentsByUri = await this.#loadDiskDocuments();

    if (refreshGeneration !== this.#refreshGeneration) {
      return;
    }

    this.#diskDocumentsByUri = diskDocumentsByUri;
    this.#rebuildIndex();
  }

  upsertOpenDocument(document: DatalogTextDocumentSnapshot): void {
    this.#documentStore.upsertDocument(document);
    this.#rebuildIndex();
  }

  removeOpenDocument(uri: string): void {
    this.#documentStore.removeDocument(uri);
    this.#rebuildIndex();
  }

  getDocument(uri: string): DatalogWorkspaceDocument | undefined {
    return this.#indexedDocumentsByUri.get(uri);
  }

  getIndexedDocumentUris(): readonly string[] {
    return [...this.#indexedDocumentsByUri.keys()].sort((left, right) => left.localeCompare(right));
  }

  getProgram(): ParsedDatalogProgramSources | null {
    return this.#workspaceProgram;
  }

  getPredicateDefinitions(identityKey: string): readonly DatalogWorkspacePredicateDefinition[] {
    return this.#predicateDefinitionsByIdentity.get(identityKey) ?? [];
  }

  getWorkspacePredicateIdentities(): readonly DatalogPredicateSymbolIdentity[] {
    return [...this.#workspacePredicateIdentities.values()].sort((left, right) => left.key.localeCompare(right.key));
  }

  getGraphPredicateIds(): readonly string[] {
    return this.#graphPredicateIds;
  }

  getPredicateSchemaTargets(predicateId: string): readonly DatalogWorkspacePredicateSchemaTarget[] {
    return this.#predicateSchemaTargetsById.get(predicateId) ?? [];
  }

  getNodeSummaryTargets(nodeId: string): readonly DatalogWorkspaceNodeSummaryTarget[] {
    return this.#nodeSummaryTargetsById.get(nodeId) ?? [];
  }

  getGraphNodeIds(): readonly string[] {
    return this.#graphNodeIds;
  }

  getCompoundFieldNames(predicateName: string): readonly string[] {
    return this.#compoundFieldNamesByPredicate.get(predicateName) ?? [];
  }

  async #loadDiskDocuments(): Promise<Map<string, DatalogWorkspaceDocument>> {
    if (!this.#workspaceRootPath) {
      return new Map();
    }

    const filePaths = await this.#listWorkspaceFiles(this.#workspaceRootPath);
    const documents = await Promise.all(filePaths.map(async (filePath) => {
      try {
        const source = await this.#readFile(filePath, 'utf8');
        const uri = pathToFileURL(filePath).href;

        return [
          uri,
          {
            uri,
            source,
            parsedDocument: this.#parseDocument(source),
          },
        ] as const;
      } catch (error) {
        if (isSkippableWorkspaceFsError(error)) {
          return null;
        }

        throw error;
      }
    }));

    return new Map(documents.filter((document): document is NonNullable<typeof document> => document !== null));
  }

  #rebuildIndex(): void {
    const indexedDocuments = [...this.#diskDocumentsByUri.values()];
    const documentsByUri = new Map(indexedDocuments.map((document) => [document.uri, document] as const));

    for (const openDocument of this.#getOpenWorkspaceDocuments()) {
      documentsByUri.set(openDocument.uri, {
        uri: openDocument.uri,
        source: openDocument.source,
        parsedDocument: this.#parseDocument(openDocument.source),
      });
    }

    const documents = [...documentsByUri.values()].sort((left, right) => left.uri.localeCompare(right.uri));
    this.#indexedDocumentsByUri = new Map(documents.map((document) => [document.uri, document] as const));
    this.#workspaceProgram = buildDatalogWorkspaceProgram({
      documents,
      workspaceRootPath: this.#workspaceRootPath,
      loadMigrationProjectFiles: this.#loadMigrationProjectFiles,
    });
    this.#predicateDefinitionsByIdentity = buildPredicateDefinitions(documents);
    this.#workspacePredicateIdentities = buildWorkspacePredicateIdentities(this.#predicateDefinitionsByIdentity);
    this.#graphPredicateIds = buildGraphPredicateIds(documents);
    this.#predicateSchemaTargetsById = buildPredicateSchemaTargets(documents);
    this.#nodeSummaryTargetsById = buildNodeSummaryTargets(documents);
    this.#graphNodeIds = buildGraphNodeIds(documents);
    this.#compoundFieldNamesByPredicate = buildCompoundFieldNames(documents);
  }

  #getOpenWorkspaceDocuments(): readonly DatalogTextDocumentSnapshot[] {
    return this.#documentStore.getDocuments().filter((document) => this.#isWorkspaceFileUri(document.uri));
  }

  #isWorkspaceFileUri(uri: string): boolean {
    if (!uri.startsWith('file://')) {
      return false;
    }

    if (!this.#workspaceRootPath) {
      return true;
    }

    const filePath = fileURLToPath(uri);
    return isPathInsideWorkspaceRoot({
      filePath,
      workspaceRootPath: this.#workspaceRootPath,
    });
  }
}

function isSkippableWorkspaceFsError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) {
    return false;
  }

  return error.code === 'ENOENT'
    || error.code === 'ENOTDIR'
    || error.code === 'EACCES'
    || error.code === 'EPERM';
}
