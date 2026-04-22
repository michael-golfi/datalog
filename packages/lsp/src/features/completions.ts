import { BUILTIN_PREDICATE_NAMES, parseDocument } from '@datalog/parser';

import type { LanguageServerCompletionItem, Position } from '../contracts/language-feature-types.js';
import { BUILTIN_PREDICATE_DOCS } from './builtin-predicate-docs.js';

/** Compute context-aware completion items for the current cursor position. */
export function computeCompletions(source: string, position: Position): LanguageServerCompletionItem[] {
  const parsed = parseDocument(source);
  const context = getCompletionContext(source, position);

  if (context.edgePredicate) {
    return createGraphPredicateCompletions(parsed.graphPredicateIds);
  }

  if (context.stringReference) {
    return createNodeReferenceCompletions(parsed.nodeIds);
  }

  if (context.predicateStart) {
    return createPredicateCompletions(parsed, context.wordPrefix);
  }

  if (context.compoundPredicate) {
    return createCompoundFieldCompletions(parsed.compoundPredicates.get(context.compoundPredicate));
  }

  return [];
}

interface CompletionContext {
  readonly edgePredicate: boolean;
  readonly stringReference: boolean;
  readonly predicateStart: boolean;
  readonly compoundPredicate?: string;
  readonly wordPrefix: string;
}

function getCompletionContext(source: string, position: Position): CompletionContext {
  const lines = source.split('\n');
  const line = lines[position.line] ?? '';
  const prefix = line.slice(0, position.character);
  const predicateMatch = /([A-Za-z_][A-Za-z0-9_]*)@\([^)]*$/.exec(prefix);

  return {
    edgePredicate: isEdgePredicateContext(prefix),
    stringReference: isStringContext(prefix),
    predicateStart: isPredicateStartContext(prefix),
    ...(predicateMatch?.[1] ? { compoundPredicate: predicateMatch[1] } : {}),
    wordPrefix: /([A-Za-z_][A-Za-z0-9_/-]*)$/.exec(prefix)?.[1] ?? '',
  };
}

function isEdgePredicateContext(prefix: string): boolean {
  return /Edge\(\s*"[^"]*"\s*,\s*"[^"]*$/.test(prefix);
}

function isStringContext(prefix: string): boolean {
  return /"[^"]*$/.test(prefix);
}

function isPredicateStartContext(prefix: string): boolean {
  const trimmed = prefix.trimStart();
  return /:-\s*[A-Za-z_]*$/.test(prefix) || /^([A-Za-z_][A-Za-z0-9_]*)?$/.test(trimmed);
}

function createGraphPredicateCompletions(predicateIds: readonly string[]): LanguageServerCompletionItem[] {
  return predicateIds.map((predicateId) => ({
    label: predicateId,
    kind: 'reference',
    detail: 'Graph predicate id',
    insertText: predicateId,
  }));
}

function createNodeReferenceCompletions(nodeIds: readonly string[]): LanguageServerCompletionItem[] {
  return nodeIds.map((nodeId) => ({
    label: nodeId,
    kind: 'reference',
    detail: 'Known graph node id',
    insertText: nodeId,
  }));
}

function createPredicateCompletions(
  parsed: ReturnType<typeof parseDocument>,
  wordPrefix: string,
): LanguageServerCompletionItem[] {
  const predicateItems: LanguageServerCompletionItem[] = [
    ...[...BUILTIN_PREDICATE_NAMES].map(createBuiltinCompletionItem),
    ...createDerivedPredicateCompletions(parsed.derivedPredicates.keys()),
    ...createCompoundPredicateCompletions(parsed.compoundPredicates.keys()),
  ];

  return dedupe(predicateItems)
    .filter((item) => wordPrefix.length === 0 || item.label.startsWith(wordPrefix));
}

function createDerivedPredicateCompletions(
  predicateNames: IterableIterator<string>,
): LanguageServerCompletionItem[] {
  return [...predicateNames].map((name) => ({
    label: name,
    kind: 'value',
    detail: 'Derived predicate',
    insertText: name,
  }));
}

function createCompoundPredicateCompletions(
  predicateNames: IterableIterator<string>,
): LanguageServerCompletionItem[] {
  return [...predicateNames].map((name) => ({
    label: `${name}@`,
    kind: 'snippet',
    detail: 'Compound fact or projection',
    insertText: `${name}@`,
  }));
}

function createCompoundFieldCompletions(
  fields: ReadonlySet<string> | undefined,
): LanguageServerCompletionItem[] {
  return [...(fields ?? [])]
    .sort()
    .map((field) => ({
      label: `${field}=`,
      kind: 'property',
      detail: 'Compound field',
      insertText: `${field}=`,
    }));
}

function createBuiltinCompletionItem(name: string): LanguageServerCompletionItem {
  const documentation = BUILTIN_PREDICATE_DOCS.get(name)?.detail;

  return {
    label: name,
    kind: 'keyword',
    detail: BUILTIN_PREDICATE_DOCS.get(name)?.summary ?? 'Built-in predicate',
    insertText: name,
    ...(documentation ? { documentation } : {}),
  };
}

function dedupe(items: readonly LanguageServerCompletionItem[]): LanguageServerCompletionItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.label)) {
      return false;
    }

    seen.add(item.label);
    return true;
  });
}
