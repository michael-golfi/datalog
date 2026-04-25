import { getCompoundSchemaDeclaration, parseDocument } from '@datalog/parser';

import {
  createCompoundFieldCompletions,
  createGraphPredicateCompletions,
  createNodeReferenceCompletions,
  createPredicateCompletions,
  createVariableCompletions,
} from './completion-items.js';
import { classifyCompletionSlot } from './completion-slots.js';

import type {
  LanguageServerCompletionItem,
  Position,
} from '../contracts/language-feature-types.js';
import type { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';

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

  if (slot.kind === 'suppressed') {
    return [];
  }

  if (slot.kind === 'graph-predicate-string') {
    return createGraphPredicateStringCompletions(parsed, context, prefix);
  }

  if (slot.kind === 'node-id-string') {
    return createNodeReferenceCompletions({
      localNodeIds: parsed.nodeIds,
      workspaceNodeIds: getWorkspaceNodeIds(context.workspaceIndex),
      prefix,
    });
  }

  if (slot.kind === 'compound-field-key') {
    return createCompoundFieldSlotCompletions({ parsed, predicateName: slot.predicateName, context, prefix });
  }

  if (slot.kind === 'variable-term') {
    return createVariableCompletions(slot.variables, prefix);
  }

  return createPredicateCompletions({
    parsed,
    prefix,
    ...(context.workspaceIndex ? { workspaceIndex: context.workspaceIndex } : {}),
  });
}

function createGraphPredicateStringCompletions(
  parsed: ReturnType<typeof parseDocument>,
  context: CompletionContext,
  prefix: string,
): LanguageServerCompletionItem[] {
  return createGraphPredicateCompletions(
    [...parsed.graphPredicateIds, ...(context.workspaceIndex?.getGraphPredicateIds() ?? [])],
    prefix,
  );
}

function createCompoundFieldSlotCompletions(options: {
  readonly parsed: ReturnType<typeof parseDocument>;
  readonly predicateName: string;
  readonly context: CompletionContext;
  readonly prefix: string;
}): LanguageServerCompletionItem[] {
  const localCompoundSchema = getCompoundSchemaDeclaration(
    options.parsed.schemaDeclarations,
    options.predicateName,
  )?.schema;

  return createCompoundFieldCompletions({
    localFields: localCompoundSchema?.kind === 'compound-schema' ? localCompoundSchema.fields : [],
    workspaceFields: options.context.workspaceIndex?.getCompoundFieldSchemas(options.predicateName) ?? [],
    prefix: options.prefix,
  });
}

function getWorkspaceNodeIds(workspaceIndex: DatalogWorkspaceIndex | undefined): readonly string[] {
  if (!workspaceIndex) {
    return [];
  }

  const nodeIds = new Set(workspaceIndex.getGraphNodeIds());
  for (const uri of workspaceIndex.getIndexedDocumentUris()) {
    const document = workspaceIndex.getDocument(uri);
    for (const nodeId of document?.parsedDocument.nodeIds ?? []) {
      nodeIds.add(nodeId);
    }
  }

  return [...nodeIds].sort((left, right) => left.localeCompare(right));
}
