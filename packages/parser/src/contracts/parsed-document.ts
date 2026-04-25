import type { DatalogSchema } from '@datalog/ast';

import type { Range } from './position.js';
import type { DatalogSymbols } from './datalog-symbol-identity.js';

export interface NodeSummary {
  readonly id: string;
  readonly label?: string;
  readonly classes: readonly string[];
  readonly range: Range;
}

export interface ParsedSchemaDeclaration {
  readonly schema: DatalogSchema;
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
  readonly arity: number;
  readonly range: Range;
}

export interface ParsedCompoundFieldOccurrence {
  readonly predicateName: string;
  readonly name: string;
  readonly range: Range;
}

export interface ParsedClause {
  readonly predicate: string;
  readonly isCompound: boolean;
  readonly isRule: boolean;
  readonly arity: number;
  readonly compoundFields: readonly string[];
  readonly compoundFieldOccurrences: readonly ParsedCompoundFieldOccurrence[];
  readonly range: Range;
  readonly predicateRange: Range;
  readonly occurrences: readonly ParsedPredicateOccurrence[];
  readonly references: readonly ParsedReference[];
}

export interface ParsedDocument {
  readonly clauses: readonly ParsedClause[];
  readonly schemaDeclarations: readonly ParsedSchemaDeclaration[];
  readonly derivedPredicates: ReadonlyMap<string, readonly ParsedClause[]>;
  readonly nodeSummaries: ReadonlyMap<string, NodeSummary>;
  readonly graphPredicateIds: readonly string[];
  readonly nodeIds: readonly string[];
  readonly datalogSymbols: DatalogSymbols;
  readonly lineStarts: readonly number[];
}

export type ParseDocumentResult = ParsedDocument;
