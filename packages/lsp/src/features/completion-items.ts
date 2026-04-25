import type { DefCompoundFieldSchema } from '@datalog/ast';
import type { parseDocument } from '@datalog/parser';

import { createPredicateCompletions as createPredicateCompletionItems } from './completion-predicate-items.js';

import type { LanguageServerCompletionItem } from '../contracts/language-feature-types.js';
import type { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';

/** Build graph predicate-id completions for quoted predicate references. */
export function createGraphPredicateCompletions(
  predicateIds: readonly string[],
  prefix: string,
): LanguageServerCompletionItem[] {
  return [...new Set(predicateIds)]
    .sort((left, right) => left.localeCompare(right))
    .filter((predicateId) => prefix.length === 0 || predicateId.startsWith(prefix))
    .map((predicateId) => ({
      label: predicateId,
      kind: 'reference',
      detail: 'Graph predicate id',
      insertText: predicateId,
      sortText: `0:graph-predicate:${predicateId}`,
    }));
}

/** Build node-id completions with local items ranked ahead of workspace items. */
export function createNodeReferenceCompletions(options: {
  readonly localNodeIds: readonly string[];
  readonly workspaceNodeIds: readonly string[];
  readonly prefix: string;
}): LanguageServerCompletionItem[] {
  const items = new Map<string, LanguageServerCompletionItem>();
  appendNodeReferenceCompletions(items, {
    nodeIds: options.localNodeIds,
    prefix: options.prefix,
    sortGroup: '0',
  });
  appendNodeReferenceCompletions(items, {
    nodeIds: options.workspaceNodeIds,
    prefix: options.prefix,
    sortGroup: '1',
  });
  return [...items.values()].sort(compareCompletionItems);
}

/** Build compound-field key completions with local fields ranked ahead of workspace fields. */
export function createCompoundFieldCompletions(options: {
  readonly localFields: readonly DefCompoundFieldSchema[];
  readonly workspaceFields: readonly DefCompoundFieldSchema[];
  readonly prefix: string;
}): LanguageServerCompletionItem[] {
  const items = new Map<string, LanguageServerCompletionItem>();
  const localFields = [...options.localFields].sort((left, right) =>
    left.fieldName.localeCompare(right.fieldName),
  );
  appendCompoundFieldCompletions(items, {
    fields: localFields,
    prefix: options.prefix,
    sortGroup: '0',
  });
  appendCompoundFieldCompletions(items, {
    fields: options.workspaceFields,
    prefix: options.prefix,
    sortGroup: '1',
  });
  return [...items.values()].sort(compareCompletionItems);
}

/** Build variable completions from previously seen clause-local variable names. */
export function createVariableCompletions(
  variables: readonly string[],
  prefix: string,
): LanguageServerCompletionItem[] {
  return variables
    .filter((name) => prefix.length === 0 || name.startsWith(prefix))
    .map((name) => ({
      label: name,
      kind: 'value',
      detail: 'Clause-scoped variable',
      insertText: name,
      sortText: `0:variable:${name}`,
    }));
}

/** Build predicate and builtin completions for clause predicate positions. */
export function createPredicateCompletions(options: {
  readonly parsed: ReturnType<typeof parseDocument>;
  readonly prefix: string;
  readonly workspaceIndex?: DatalogWorkspaceIndex;
}): LanguageServerCompletionItem[] {
  return createPredicateCompletionItems(options);
}

function appendNodeReferenceCompletions(
  items: Map<string, LanguageServerCompletionItem>,
  options: {
    readonly nodeIds: readonly string[];
    readonly prefix: string;
    readonly sortGroup: string;
  },
): void {
  for (const nodeId of options.nodeIds) {
    if (items.has(nodeId) || (options.prefix.length > 0 && !nodeId.startsWith(options.prefix))) {
      continue;
    }

    items.set(nodeId, {
      label: nodeId,
      kind: 'reference',
      detail: 'Known graph node id',
      insertText: nodeId,
      sortText: `${options.sortGroup}:node-id:${nodeId}`,
    });
  }
}

function appendCompoundFieldCompletions(
  items: Map<string, LanguageServerCompletionItem>,
  options: {
    readonly fields: readonly DefCompoundFieldSchema[];
    readonly prefix: string;
    readonly sortGroup: string;
  },
): void {
  for (const field of options.fields) {
    if (
      items.has(field.fieldName) ||
      (options.prefix.length > 0 && !field.fieldName.startsWith(options.prefix))
    ) {
      continue;
    }

    items.set(field.fieldName, {
      label: `${field.fieldName}=`,
      kind: 'property',
      detail: `Compound field · ${field.domain} · ${field.cardinality}`,
      insertText: `${field.fieldName}=`,
      sortText: `${options.sortGroup}:compound-field:${field.fieldName}`,
    });
  }
}

function compareCompletionItems(
  left: LanguageServerCompletionItem,
  right: LanguageServerCompletionItem,
): number {
  return (
    (left.sortText ?? left.label).localeCompare(right.sortText ?? right.label) ||
    left.label.localeCompare(right.label)
  );
}
