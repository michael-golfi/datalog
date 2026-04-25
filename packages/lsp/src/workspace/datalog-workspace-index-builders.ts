import { posix, win32 } from 'node:path';

import type {
  DatalogPredicateSymbolIdentity,
  Range,
} from '@datalog/parser';

import type { DatalogWorkspaceDocument } from './load-datalog-workspace-documents.js';
import type { DatalogWorkspaceNodeSummaryTarget, DatalogWorkspacePredicateDefinition } from './datalog-workspace-index.js';

/** Check whether `filePath` is at or beneath `workspaceRootPath`, handling both POSIX and Windows separators. */
export function isPathInsideWorkspaceRoot(options: {
  readonly filePath: string;
  readonly workspaceRootPath: string;
}): boolean {
  if (options.filePath === options.workspaceRootPath) {
    return true;
  }

  const pathModule = usesWindowsPathSemantics(options)
    ? win32
    : posix;
  const relativePath = pathModule.relative(options.workspaceRootPath, options.filePath);
  return relativePath !== '' && !relativePath.startsWith('..') && !relativePath.startsWith(`..${'\\'}`);
}

function usesWindowsPathSemantics(options: {
  readonly filePath: string;
  readonly workspaceRootPath: string;
}): boolean {
  return options.filePath.includes('\\') || options.workspaceRootPath.includes('\\');
}

/** Collect head-occurrence predicate definitions across documents, keyed by identity. */
export function buildPredicateDefinitions(
  documents: readonly DatalogWorkspaceDocument[],
): Map<string, readonly DatalogWorkspacePredicateDefinition[]> {
  const predicateDefinitions = new Map<string, DatalogWorkspacePredicateDefinition[]>();

  for (const document of documents) {
    for (const definition of getDocumentPredicateDefinitions(document)) {
      const definitions = predicateDefinitions.get(definition.identity.key) ?? [];
      definitions.push(definition);
      predicateDefinitions.set(definition.identity.key, definitions);
    }
  }

  return new Map(
    [...predicateDefinitions.entries()].map(([identityKey, definitions]) => [
      identityKey,
      definitions.sort(comparePredicateDefinitions),
    ]),
  );
}

function getDocumentPredicateDefinitions(
  document: DatalogWorkspaceDocument,
): DatalogWorkspacePredicateDefinition[] {
  const definitions: DatalogWorkspacePredicateDefinition[] = [];

  for (const predicate of document.parsedDocument.datalogSymbols.predicates) {
    if (predicate.identity.kind !== 'user-predicate') {
      continue;
    }

    for (const occurrence of predicate.occurrences.filter((candidate: typeof predicate.occurrences[number]) => candidate.kind === 'head')) {
      definitions.push({
        uri: document.uri,
        identity: predicate.identity,
        range: occurrence.range,
      });
    }
  }

  return definitions;
}

/** Derive a deduplicated map of predicate identities from their grouped definitions. */
export function buildWorkspacePredicateIdentities(
  predicateDefinitionsByIdentity: ReadonlyMap<string, readonly DatalogWorkspacePredicateDefinition[]>,
): Map<string, DatalogPredicateSymbolIdentity> {
  return new Map(
    [...predicateDefinitionsByIdentity.entries()]
      .filter(([, definitions]) => definitions.length > 0)
      .map(([identityKey, definitions]) => [identityKey, definitions[0]!.identity] as const),
  );
}

/** Collect deduplicated, sorted graph node IDs across all workspace documents. */
export function buildGraphPredicateIds(documents: readonly DatalogWorkspaceDocument[]): readonly string[] {
  return [...new Set(
    documents.flatMap((document) => document.parsedDocument.graphPredicateIds),
  )].sort((left, right) => left.localeCompare(right));
}

/** Collect graph node summaries across documents, keyed by graph node ID. */
export function buildNodeSummaryTargets(
  documents: readonly DatalogWorkspaceDocument[],
): Map<string, readonly DatalogWorkspaceNodeSummaryTarget[]> {
  const targetsByNodeId = new Map<string, DatalogWorkspaceNodeSummaryTarget[]>();

  for (const document of documents) {
    for (const summary of document.parsedDocument.nodeSummaries.values()) {
      const targets = targetsByNodeId.get(summary.id) ?? [];
      targets.push({
        uri: document.uri,
        summary,
        range: summary.range,
      });
      targetsByNodeId.set(summary.id, targets);
    }
  }

  return new Map(
    [...targetsByNodeId.entries()].map(([nodeId, targets]) => [
      nodeId,
      targets.sort(compareNodeSummaryTargets),
    ]),
  );
}

/** Collect deduplicated, sorted graph node IDs across all workspace documents. */
export function buildGraphNodeIds(documents: readonly DatalogWorkspaceDocument[]): readonly string[] {
  return [...new Set(
    documents.flatMap((document) => document.parsedDocument.datalogSymbols.graphNodes.map((graphNode: typeof document.parsedDocument.datalogSymbols.graphNodes[number]) => graphNode.id)),
  )].sort((left, right) => left.localeCompare(right));
}

function comparePredicateDefinitions(
  left: DatalogWorkspacePredicateDefinition,
  right: DatalogWorkspacePredicateDefinition,
): number {
  return left.uri.localeCompare(right.uri) || compareRanges(left.range, right.range);
}

function compareNodeSummaryTargets(
  left: DatalogWorkspaceNodeSummaryTarget,
  right: DatalogWorkspaceNodeSummaryTarget,
): number {
  return left.uri.localeCompare(right.uri) || compareRanges(left.range, right.range);
}

function compareRanges(left: Range, right: Range): number {
  return comparePositions(left.start, right.start) || comparePositions(left.end, right.end);
}

function comparePositions(left: Range['start'], right: Range['start']): number {
  return left.line - right.line || left.character - right.character;
}
