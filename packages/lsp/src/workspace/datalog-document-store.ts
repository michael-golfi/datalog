export interface DatalogTextDocumentSnapshot {
  readonly uri: string;
  readonly source: string;
}

/** Store open file-backed Datalog documents so workspace state can override disk content. */
export class DatalogDocumentStore {
  readonly #documentsByUri = new Map<string, DatalogTextDocumentSnapshot>();

  upsertDocument(document: DatalogTextDocumentSnapshot): void {
    this.#documentsByUri.set(document.uri, document);
  }

  removeDocument(uri: string): void {
    this.#documentsByUri.delete(uri);
  }

  getDocument(uri: string): DatalogTextDocumentSnapshot | undefined {
    return this.#documentsByUri.get(uri);
  }

  getDocuments(): readonly DatalogTextDocumentSnapshot[] {
    return [...this.#documentsByUri.values()].sort((left, right) =>
      left.uri.localeCompare(right.uri),
    );
  }
}
