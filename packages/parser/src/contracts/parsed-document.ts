import type { Range } from './position.js';

export interface PredicateSchema {
  readonly predicateId: string;
  readonly subjectCardinality: string;
  readonly subjectType: string;
  readonly objectCardinality: string;
  readonly objectType: string;
  readonly range: Range;
}

export interface NodeSummary {
  readonly id: string;
  readonly label?: string;
  readonly classes: readonly string[];
  readonly range: Range;
}

export type ParsedReferenceRole = 'graph-predicate' | 'node-id' | 'label';

export interface ParsedReference {
  readonly value: string;
  readonly role: ParsedReferenceRole;
  readonly range: Range;
}

export interface ParsedPredicateOccurrence {
  readonly name: string;
  readonly kind: 'head' | 'body';
  readonly range: Range;
}

export interface ParsedClause {
  readonly predicate: string;
  readonly isCompound: boolean;
  readonly isRule: boolean;
  readonly arity: number;
  readonly compoundFields: readonly string[];
  readonly range: Range;
  readonly predicateRange: Range;
  readonly occurrences: readonly ParsedPredicateOccurrence[];
  readonly references: readonly ParsedReference[];
}

export interface ParsedDocument {
  readonly clauses: readonly ParsedClause[];
  readonly predicateSchemas: ReadonlyMap<string, PredicateSchema>;
  readonly derivedPredicates: ReadonlyMap<string, readonly ParsedClause[]>;
  readonly compoundPredicates: ReadonlyMap<string, ReadonlySet<string>>;
  readonly nodeSummaries: ReadonlyMap<string, NodeSummary>;
  readonly graphPredicateIds: readonly string[];
  readonly nodeIds: readonly string[];
  readonly lineStarts: readonly number[];
}

export type ParseDocumentResult = ParsedDocument;
