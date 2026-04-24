import type {
  DatalogCompoundFieldSymbol,
  DatalogGraphNodeSymbol,
  DatalogPredicateIdentityKind,
  DatalogPredicateSymbol,
  DatalogSymbols,
} from '../contracts/datalog-symbol-identity.js';
import type { ParsedClause } from '../contracts/parsed-document.js';
import type { Range } from '../contracts/position.js';
import { BUILTIN_PREDICATE_NAMES } from '../semantics/graph-vocabulary.js';

interface PredicateSymbolState {
  readonly identity: DatalogPredicateSymbol['identity'];
  readonly mutableOccurrences: Array<DatalogPredicateSymbol['occurrences'][number]>;
}

interface GraphNodeSymbolState {
  readonly identity: DatalogGraphNodeSymbol['identity'];
  readonly id: string;
  readonly mutableReferences: Range[];
}

interface CompoundFieldSymbolState {
  readonly identity: DatalogCompoundFieldSymbol['identity'];
  readonly predicateName: string;
  readonly fieldName: string;
  readonly mutableReferences: Range[];
}

/** Collect deterministic parser-owned Datalog symbol identities from parsed clauses. */
export function collectDatalogSymbols(clauses: readonly ParsedClause[]): DatalogSymbols {
  const predicateSymbols = new Map<string, PredicateSymbolState>();
  const graphNodeSymbols = new Map<string, GraphNodeSymbolState>();
  const compoundFieldSymbols = new Map<string, CompoundFieldSymbolState>();

  for (const clause of clauses) {
    collectPredicateSymbols(clause, predicateSymbols);
    collectGraphNodeSymbols(clause, graphNodeSymbols);
    collectCompoundFieldSymbols(clause, compoundFieldSymbols);
  }

  return {
    predicates: finalizePredicateSymbols(predicateSymbols),
    graphNodes: finalizeGraphNodeSymbols(graphNodeSymbols),
    compoundFields: finalizeCompoundFieldSymbols(compoundFieldSymbols),
  };
}

function collectPredicateSymbols(
  clause: ParsedClause,
  predicateSymbols: Map<string, PredicateSymbolState>,
): void {
  for (const occurrence of clause.occurrences) {
    const kind: DatalogPredicateIdentityKind = BUILTIN_PREDICATE_NAMES.has(occurrence.name)
      ? 'builtin-predicate'
      : 'user-predicate';
    const key = `${kind}:${occurrence.name}/${occurrence.arity}`;
    const existing = predicateSymbols.get(key) ?? {
      identity: {
        key,
        kind,
        name: occurrence.name,
        arity: occurrence.arity,
      },
      mutableOccurrences: [],
    };

    existing.mutableOccurrences.push({
      kind: occurrence.kind,
      range: occurrence.range,
    });
    predicateSymbols.set(key, existing);
  }
}

function collectGraphNodeSymbols(
  clause: ParsedClause,
  graphNodeSymbols: Map<string, GraphNodeSymbolState>,
): void {
  for (const reference of clause.references) {
    if (reference.role !== 'node-id') {
      continue;
    }

    const key = `graph-node:${reference.value}`;
    const existing = graphNodeSymbols.get(key) ?? {
      identity: {
        key,
        id: reference.value,
      },
      id: reference.value,
      mutableReferences: [],
    };

    existing.mutableReferences.push(reference.range);
    graphNodeSymbols.set(key, existing);
  }
}

function collectCompoundFieldSymbols(
  clause: ParsedClause,
  compoundFieldSymbols: Map<string, CompoundFieldSymbolState>,
): void {
  for (const fieldOccurrence of clause.compoundFieldOccurrences) {
    const key = `compound-field:${fieldOccurrence.predicateName}.${fieldOccurrence.name}`;
    const existing = compoundFieldSymbols.get(key) ?? {
      identity: {
        key,
        predicateName: fieldOccurrence.predicateName,
        fieldName: fieldOccurrence.name,
      },
      predicateName: fieldOccurrence.predicateName,
      fieldName: fieldOccurrence.name,
      mutableReferences: [],
    };

    existing.mutableReferences.push(fieldOccurrence.range);
    compoundFieldSymbols.set(key, existing);
  }
}

function finalizePredicateSymbols(
  predicateSymbols: Map<string, PredicateSymbolState>,
): DatalogSymbols['predicates'] {
  return [...predicateSymbols.values()]
    .map(({ identity, mutableOccurrences }) => ({
      identity,
      occurrences: [...mutableOccurrences].sort((left, right) => compareRanges(left.range, right.range)),
    }))
    .sort((left, right) => left.identity.key.localeCompare(right.identity.key));
}

function finalizeGraphNodeSymbols(
  graphNodeSymbols: Map<string, GraphNodeSymbolState>,
): DatalogSymbols['graphNodes'] {
  return [...graphNodeSymbols.values()]
    .map(({ identity, id, mutableReferences }) => ({
      identity,
      id,
      references: [...mutableReferences].sort(compareRanges),
    }))
    .sort((left, right) => left.identity.key.localeCompare(right.identity.key));
}

function finalizeCompoundFieldSymbols(
  compoundFieldSymbols: Map<string, CompoundFieldSymbolState>,
): DatalogSymbols['compoundFields'] {
  return [...compoundFieldSymbols.values()]
    .map(({ identity, predicateName, fieldName, mutableReferences }) => ({
      identity,
      predicateName,
      fieldName,
      references: [...mutableReferences].sort(compareRanges),
    }))
    .sort((left, right) => left.identity.key.localeCompare(right.identity.key));
}

function compareRanges(left: Range, right: Range): number {
  return comparePositions(left.start, right.start) || comparePositions(left.end, right.end);
}

function comparePositions(left: Range['start'], right: Range['start']): number {
  return left.line - right.line || left.character - right.character;
}
