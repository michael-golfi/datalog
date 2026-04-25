import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { DefCompoundFieldSchema } from '@datalog/ast';
import {
  parseDocument,
  type DatalogPredicateSymbolIdentity,
  type NodeSummary,
  type ParsedDatalogProgramSources,
  type Range,
} from '@datalog/parser';
import {
  loadDatalogMigrationProjectFiles,
} from '@datalog/datalog-migrate/load-datalog-migration-project-files';

import type {
  DatalogDocumentStore,
  DatalogTextDocumentSnapshot,
} from './datalog-document-store.js';
import { buildDatalogWorkspaceIndexState } from './build-datalog-workspace-index-state.js';
import { listDatalogWorkspaceFiles } from './datalog-workspace-files.js';
import { isPathInsideWorkspaceRoot } from './datalog-workspace-index-builders.js';
import { loadDatalogWorkspaceDocuments, type DatalogWorkspaceDocument } from './load-datalog-workspace-documents.js';
import type {
  DatalogWorkspaceCompoundSchemaTarget,
  DatalogWorkspacePredicateSchemaTarget,
} from './datalog-workspace-schema-targets.js';

export interface DatalogWorkspacePredicateDefinition {
  readonly uri: string;
  readonly identity: DatalogPredicateSymbolIdentity;
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
  #compoundSchemaTargetsByName = new Map<string, readonly DatalogWorkspaceCompoundSchemaTarget[]>();
  #nodeSummaryTargetsById = new Map<string, readonly DatalogWorkspaceNodeSummaryTarget[]>();
  #graphNodeIds: readonly string[] = [];
  #compoundFieldSchemasByPredicate = new Map<string, readonly DefCompoundFieldSchema[]>();
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
    const diskDocumentsByUri = await loadDatalogWorkspaceDocuments({
      workspaceRootPath: this.#workspaceRootPath,
      listWorkspaceFiles: this.#listWorkspaceFiles,
      readWorkspaceFile: this.#readFile,
      parseWorkspaceDocument: this.#parseDocument,
    });

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

  getCompoundSchemaTargets(compoundName: string): readonly DatalogWorkspaceCompoundSchemaTarget[] {
    return this.#compoundSchemaTargetsByName.get(compoundName) ?? [];
  }

  getNodeSummaryTargets(nodeId: string): readonly DatalogWorkspaceNodeSummaryTarget[] {
    return this.#nodeSummaryTargetsById.get(nodeId) ?? [];
  }

  getGraphNodeIds(): readonly string[] {
    return this.#graphNodeIds;
  }

  getCompoundFieldSchemas(predicateName: string): readonly DefCompoundFieldSchema[] {
    return this.#compoundFieldSchemasByPredicate.get(predicateName) ?? [];
  }

  getCompoundFieldNames(predicateName: string): readonly string[] {
    return this.#compoundFieldNamesByPredicate.get(predicateName) ?? [];
  }

  #rebuildIndex(): void {
    const documentsByUri = new Map(this.#diskDocumentsByUri);

    for (const openDocument of this.#getOpenWorkspaceDocuments()) {
      documentsByUri.set(openDocument.uri, {
        uri: openDocument.uri,
        source: openDocument.source,
        parsedDocument: this.#parseDocument(openDocument.source),
      });
    }

    const documents = [...documentsByUri.values()].sort((left, right) => left.uri.localeCompare(right.uri));
    const nextState = buildDatalogWorkspaceIndexState({
      documents,
      workspaceRootPath: this.#workspaceRootPath,
      loadMigrationProjectFiles: this.#loadMigrationProjectFiles,
    });

    this.#applyIndexState(nextState);
  }

  #applyIndexState(nextState: ReturnType<typeof buildDatalogWorkspaceIndexState>): void {
    this.#indexedDocumentsByUri = nextState.indexedDocumentsByUri;
    this.#workspaceProgram = nextState.workspaceProgram;
    this.#predicateDefinitionsByIdentity = nextState.predicateDefinitionsByIdentity;
    this.#workspacePredicateIdentities = nextState.workspacePredicateIdentities;
    this.#graphPredicateIds = nextState.graphPredicateIds;
    this.#predicateSchemaTargetsById = nextState.predicateSchemaTargetsById;
    this.#compoundSchemaTargetsByName = nextState.compoundSchemaTargetsByName;
    this.#nodeSummaryTargetsById = nextState.nodeSummaryTargetsById;
    this.#graphNodeIds = nextState.graphNodeIds;
    this.#compoundFieldSchemasByPredicate = nextState.compoundFieldSchemasByPredicate;
    this.#compoundFieldNamesByPredicate = nextState.compoundFieldNamesByPredicate;
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
