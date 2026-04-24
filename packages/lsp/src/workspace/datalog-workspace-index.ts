import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseDocument } from '@datalog/parser';
import type {
  DatalogPredicateSymbolIdentity,
  ParsedDocument,
  Range,
} from '@datalog/parser';

import type {
  DatalogDocumentStore,
  DatalogTextDocumentSnapshot,
} from './datalog-document-store.js';
import { listDatalogWorkspaceFiles } from './datalog-workspace-files.js';
import {
  buildCompoundFieldNames,
  buildGraphNodeIds,
  buildPredicateDefinitions,
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

/** Aggregate parser facts for `.dl` files in a single-root workspace plus open buffers. */
export class DatalogWorkspaceIndex {
  readonly #documentStore: DatalogDocumentStore;
  readonly #parseDocument: typeof parseDocument;
  readonly #listWorkspaceFiles: typeof listDatalogWorkspaceFiles;
  readonly #readFile: typeof readFile;

  #workspaceRootPath: string | null = null;
  #diskDocumentsByUri = new Map<string, DatalogWorkspaceDocument>();
  #indexedDocumentsByUri = new Map<string, DatalogWorkspaceDocument>();
  #predicateDefinitionsByIdentity = new Map<string, readonly DatalogWorkspacePredicateDefinition[]>();
  #workspacePredicateIdentities = new Map<string, DatalogPredicateSymbolIdentity>();
  #graphNodeIds: readonly string[] = [];
  #compoundFieldNamesByPredicate = new Map<string, readonly string[]>();

  constructor(options: {
    readonly documentStore: DatalogDocumentStore;
    readonly parseDocument?: typeof parseDocument;
    readonly listWorkspaceFiles?: typeof listDatalogWorkspaceFiles;
    readonly readFile?: typeof readFile;
  }) {
    this.#documentStore = options.documentStore;
    this.#parseDocument = options.parseDocument ?? parseDocument;
    this.#listWorkspaceFiles = options.listWorkspaceFiles ?? listDatalogWorkspaceFiles;
    this.#readFile = options.readFile ?? readFile;
  }

  async setWorkspaceRootPath(workspaceRootPath: string | null): Promise<void> {
    this.#workspaceRootPath = workspaceRootPath;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.#diskDocumentsByUri = await this.#loadDiskDocuments();
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

  getPredicateDefinitions(identityKey: string): readonly DatalogWorkspacePredicateDefinition[] {
    return this.#predicateDefinitionsByIdentity.get(identityKey) ?? [];
  }

  getWorkspacePredicateIdentities(): readonly DatalogPredicateSymbolIdentity[] {
    return [...this.#workspacePredicateIdentities.values()].sort((left, right) => left.key.localeCompare(right.key));
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
    }));

    return new Map(documents);
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
    this.#predicateDefinitionsByIdentity = buildPredicateDefinitions(documents);
    this.#workspacePredicateIdentities = buildWorkspacePredicateIdentities(this.#predicateDefinitionsByIdentity);
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
