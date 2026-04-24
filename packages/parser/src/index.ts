export { collectDatalogSymbols } from './analysis/collect-datalog-symbols.js';
export { getStringReferenceAtPosition } from './analysis/get-string-reference-at-position.js';
export { parseDocument } from './analysis/parse-document.js';
export { computeLineStarts } from './syntax/line-starts.js';
export {
  getWordRangeAtPosition,
  offsetToPosition,
  positionToOffset,
} from './syntax/position-tools.js';
export { BUILTIN_PREDICATE_NAMES } from './semantics/graph-vocabulary.js';
export type {
  DatalogCompoundFieldSymbol,
  DatalogCompoundFieldSymbolIdentity,
  DatalogGraphNodeSymbol,
  DatalogGraphNodeSymbolIdentity,
  DatalogPredicateIdentityKind,
  DatalogPredicateSymbol,
  DatalogPredicateSymbolIdentity,
  DatalogPredicateSymbolOccurrence,
  DatalogSymbols,
} from './contracts/datalog-symbol-identity.js';
export type {
  NodeSummary,
  ParsedClause,
  ParsedCompoundFieldOccurrence,
  ParsedDocument,
  ParseDocumentResult,
  ParsedPredicateOccurrence,
  ParsedReference,
  ParsedReferenceRole,
  PredicateSchema,
} from './contracts/parsed-document.js';
export type { Position, Range } from './contracts/position.js';
