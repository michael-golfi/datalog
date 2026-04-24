import { BUILTIN_PREDICATE_NAMES } from '@datalog/parser';
import type { parseDocument } from '@datalog/parser';

import type { LanguageServerCompletionItem } from '../contracts/language-feature-types.js';
import type { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';
import { BUILTIN_PREDICATE_DOCS } from './builtin-predicate-docs.js';

/** Build predicate and builtin completion items with local-first deduping. */
export function createPredicateCompletions(options: {
  readonly parsed: ReturnType<typeof parseDocument>;
  readonly workspaceIndex?: DatalogWorkspaceIndex;
  readonly prefix: string;
}): LanguageServerCompletionItem[] {
  const items = new Map<string, LanguageServerCompletionItem>();
  appendLocalPredicateCompletions(items, options.parsed, options.prefix);
  appendWorkspacePredicateCompletions(items, options.workspaceIndex, options.prefix);
  appendBuiltinCompletions(items, options.prefix);
  return [...items.values()].sort(compareCompletionItems);
}

function appendLocalPredicateCompletions(
  items: Map<string, LanguageServerCompletionItem>,
  parsed: ReturnType<typeof parseDocument>,
  prefix: string,
): void {
  const localPredicateNames = [...parsed.derivedPredicates.keys()].sort((left, right) => left.localeCompare(right));

  for (const predicateName of localPredicateNames) {
    const clauses = parsed.derivedPredicates.get(predicateName) ?? [];

    for (const clause of clauses) {
      appendLocalClauseCompletions({ items, parsed, predicateName, arity: clause.arity, prefix });
    }
  }
}

function appendLocalClauseCompletions(options: {
  readonly items: Map<string, LanguageServerCompletionItem>;
  readonly parsed: ReturnType<typeof parseDocument>;
  readonly predicateName: string;
  readonly arity: number;
  readonly prefix: string;
}): void {
  addCompletionItem(options.items, createUserPredicateCompletionItem({
    predicateName: options.predicateName,
    arity: options.arity,
    prefix: options.prefix,
    sortGroup: '0',
    detail: 'Local predicate',
  }));
  if (!options.parsed.compoundPredicates.has(options.predicateName)) {
    return;
  }

  addCompletionItem(options.items, createCompoundPredicateCompletionItem({
    predicateName: options.predicateName,
    arity: options.arity,
    prefix: options.prefix,
    sortGroup: '1',
    detail: 'Local compound predicate',
  }));
}

function appendWorkspacePredicateCompletions(
  items: Map<string, LanguageServerCompletionItem>,
  workspaceIndex: DatalogWorkspaceIndex | undefined,
  prefix: string,
): void {
  for (const identity of workspaceIndex?.getWorkspacePredicateIdentities() ?? []) {
    addCompletionItem(items, createUserPredicateCompletionItem({
      predicateName: identity.name,
      arity: identity.arity,
      prefix,
      sortGroup: '2',
      detail: 'Workspace predicate',
      dedupeKey: `predicate:${identity.key}`,
    }));

    if ((workspaceIndex?.getCompoundFieldNames(identity.name).length ?? 0) === 0) {
      continue;
    }

    addCompletionItem(items, createCompoundPredicateCompletionItem({
      predicateName: identity.name,
      arity: identity.arity,
      prefix,
      sortGroup: '3',
      detail: 'Workspace compound predicate',
      dedupeKey: `compound:${identity.key}`,
    }));
  }
}

function appendBuiltinCompletions(
  items: Map<string, LanguageServerCompletionItem>,
  prefix: string,
): void {
  for (const name of [...BUILTIN_PREDICATE_NAMES].sort((left, right) => left.localeCompare(right))) {
    addCompletionItem(items, createBuiltinCompletionItem(name, prefix));
  }
}

function createUserPredicateCompletionItem(options: {
  readonly predicateName: string;
  readonly arity: number;
  readonly prefix: string;
  readonly sortGroup: string;
  readonly detail: string;
  readonly dedupeKey?: string;
}): { readonly dedupeKey: string; readonly item: LanguageServerCompletionItem } | null {
  if (options.prefix.length > 0 && !options.predicateName.startsWith(options.prefix)) {
    return null;
  }

  const identityKey = `user-predicate:${options.predicateName}/${options.arity}`;
  return {
    dedupeKey: options.dedupeKey ?? `predicate:${identityKey}`,
    item: {
      label: options.predicateName,
      kind: 'value',
      detail: options.detail,
      insertText: options.predicateName,
      sortText: `${options.sortGroup}:predicate:${identityKey}`,
    },
  };
}

function createCompoundPredicateCompletionItem(options: {
  readonly predicateName: string;
  readonly arity: number;
  readonly prefix: string;
  readonly sortGroup: string;
  readonly detail: string;
  readonly dedupeKey?: string;
}): { readonly dedupeKey: string; readonly item: LanguageServerCompletionItem } | null {
  if (options.prefix.length > 0 && !options.predicateName.startsWith(options.prefix)) {
    return null;
  }

  const identityKey = `user-predicate:${options.predicateName}/${options.arity}`;
  return {
    dedupeKey: options.dedupeKey ?? `compound:${identityKey}`,
    item: {
      label: `${options.predicateName}@`,
      kind: 'snippet',
      detail: options.detail,
      insertText: `${options.predicateName}@`,
      sortText: `${options.sortGroup}:compound:${identityKey}`,
    },
  };
}

function createBuiltinCompletionItem(
  name: string,
  prefix: string,
): { readonly dedupeKey: string; readonly item: LanguageServerCompletionItem } | null {
  if (prefix.length > 0 && !name.startsWith(prefix)) {
    return null;
  }

  const builtin = BUILTIN_PREDICATE_DOCS.get(name);
  return {
    dedupeKey: `builtin:${name}`,
    item: {
      label: name,
      kind: 'keyword',
      detail: builtin?.summary ?? 'Built-in predicate',
      insertText: name,
      sortText: `4:builtin:${name}`,
      ...(builtin?.detail ? { documentation: builtin.detail } : {}),
    },
  };
}

function addCompletionItem(
  items: Map<string, LanguageServerCompletionItem>,
  candidate: { readonly dedupeKey: string; readonly item: LanguageServerCompletionItem } | null,
): void {
  if (!candidate || items.has(candidate.dedupeKey)) {
    return;
  }

  items.set(candidate.dedupeKey, candidate.item);
}

function compareCompletionItems(left: LanguageServerCompletionItem, right: LanguageServerCompletionItem): number {
  return (left.sortText ?? left.label).localeCompare(right.sortText ?? right.label) || left.label.localeCompare(right.label);
}
