import { parseDocument } from '@datalog/parser';

import type { LanguageServerCompletionItem, Position } from '../contracts/language-feature-types.js';
import type { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';
import { createCompoundFieldCompletions, createGraphPredicateCompletions, createNodeReferenceCompletions, createPredicateCompletions, createVariableCompletions } from './completion-items.js';
import { classifyCompletionSlot } from './completion-slots.js';

export interface CompletionContext {
  readonly workspaceIndex?: DatalogWorkspaceIndex;
}

/** Compute context-aware completion items for the current cursor position. */
export function computeCompletions(
  source: string,
  position: Position,
  context: CompletionContext = {},
): LanguageServerCompletionItem[] {
  const parsed = parseDocument(source);
  const slot = classifyCompletionSlot(source, position, parsed);

  return getCompletionItemsForSlot(parsed, slot, context);
}

function getCompletionItemsForSlot(
  parsed: ReturnType<typeof parseDocument>,
  slot: ReturnType<typeof classifyCompletionSlot>,
  context: CompletionContext,
): LanguageServerCompletionItem[] {
  const prefix = 'prefix' in slot ? slot.prefix : '';

  return {
    suppressed: (): LanguageServerCompletionItem[] => [],
    'graph-predicate-string': (): LanguageServerCompletionItem[] => createGraphPredicateCompletions(parsed.graphPredicateIds, prefix),
    'node-id-string': (): LanguageServerCompletionItem[] => createNodeReferenceCompletions({
      localNodeIds: parsed.nodeIds,
      workspaceNodeIds: context.workspaceIndex?.getGraphNodeIds() ?? [],
      prefix,
    }),
    'compound-field-key': (): LanguageServerCompletionItem[] => createCompoundFieldCompletions({
      localFields: slot.kind === 'compound-field-key' ? parsed.compoundPredicates.get(slot.predicateName) : undefined,
      workspaceFields: slot.kind === 'compound-field-key' ? (context.workspaceIndex?.getCompoundFieldNames(slot.predicateName) ?? []) : [],
      prefix,
    }),
    'variable-term': (): LanguageServerCompletionItem[] => createVariableCompletions(slot.kind === 'variable-term' ? slot.variables : [], prefix),
    predicate: (): LanguageServerCompletionItem[] => createPredicateCompletions({
      parsed,
      prefix,
      ...(context.workspaceIndex ? { workspaceIndex: context.workspaceIndex } : {}),
    }),
  }[slot.kind]();
}
