import { getStringReferenceAtPosition, parseDocument } from '@datalog/parser';

import type {
  LanguageServerDefinition,
  LanguageServerDefinitionTarget,
  Position,
} from '../contracts/language-feature-types.js';
import type { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';

export interface DefinitionContext {
  readonly targetUri?: string;
  readonly workspaceIndex?: DatalogWorkspaceIndex;
}

type ParsedDocument = ReturnType<typeof parseDocument>;
interface StringReferenceDefinitionOptions {
  readonly parsed: ParsedDocument;
  readonly source: string;
  readonly position: Position;
  readonly targetUri?: string;
  readonly workspaceIndex?: DatalogWorkspaceIndex;
}

/** Resolve a definition target for the symbol or reference at the given position. */
export function computeDefinition(
  source: string,
  position: Position,
  context: DefinitionContext = {},
): LanguageServerDefinition | null {
  const parsed = parseDocument(source);
  const stringReferenceDefinition = getStringReferenceDefinition({
    parsed,
    source,
    position,
    ...(context.workspaceIndex ? { workspaceIndex: context.workspaceIndex } : {}),
    ...(context.targetUri ? { targetUri: context.targetUri } : {}),
  });
  if (stringReferenceDefinition) {
    return stringReferenceDefinition;
  }

  return getDerivedPredicateDefinition(parsed, position, context);
}

function getStringReferenceDefinition(
  options: StringReferenceDefinitionOptions,
): LanguageServerDefinition | null {
  const stringReference = getStringReferenceAtPosition(options.source, options.position);
  if (!stringReference) {
    return null;
  }

  return getLocalStringReferenceDefinition(options.parsed, stringReference.value, options.targetUri)
    ?? getWorkspaceStringReferenceDefinition(options.workspaceIndex, stringReference.value)
    ?? null;
}

function getLocalStringReferenceDefinition(
  parsed: ParsedDocument,
  referenceId: string,
  targetUri?: string,
): LanguageServerDefinition | null {
  const schema = parsed.predicateSchemas.get(referenceId);
  if (schema) {
    return [createDefinitionResult(schema.range, targetUri)];
  }

  const node = parsed.nodeSummaries.get(referenceId);
  return node ? [createDefinitionResult(node.range, targetUri)] : null;
}

function getWorkspaceStringReferenceDefinition(
  workspaceIndex: DatalogWorkspaceIndex | undefined,
  referenceId: string,
): LanguageServerDefinition | null {
  return mapDefinitionTargets(workspaceIndex?.getPredicateSchemaTargets(referenceId) ?? [])
    ?? mapDefinitionTargets(workspaceIndex?.getNodeSummaryTargets(referenceId) ?? [])
    ?? null;
}

function getDerivedPredicateDefinition(
  parsed: ParsedDocument,
  position: Position,
  context: DefinitionContext,
): LanguageServerDefinition | null {
  const occurrence = findPredicateOccurrence(parsed, position);
  if (occurrence?.identity.kind !== 'user-predicate') {
    return null;
  }

  const definitions = getPredicateDefinitions({
    parsed,
    context,
    identityKey: occurrence.identity.key,
    predicateName: occurrence.identity.name,
    arity: occurrence.identity.arity,
  });
  if (definitions.length === 0) {
    return null;
  }

  return definitions;
}

function findPredicateOccurrence(
  parsed: ParsedDocument,
  position: Position,
) {
  for (const predicate of parsed.datalogSymbols.predicates) {
    const occurrence = predicate.occurrences.find((candidate) => containsPosition(position, candidate.range));
    if (occurrence) {
      return {
        identity: predicate.identity,
        range: occurrence.range,
      };
    }
  }

  return null;
}

function getPredicateDefinitions(options: {
  readonly parsed: ParsedDocument;
  readonly identityKey: string;
  readonly predicateName: string;
  readonly arity: number;
  readonly context: DefinitionContext;
}): LanguageServerDefinition {
  const workspaceDefinitions = options.context.workspaceIndex?.getPredicateDefinitions(options.identityKey) ?? [];
  if (workspaceDefinitions.length > 0) {
    return workspaceDefinitions.map((definition) => createDefinitionResult(definition.range, definition.uri));
  }

  return [...(options.parsed.derivedPredicates.get(options.predicateName) ?? [])]
    .filter((clause) => clause.arity === options.arity)
    .sort((left, right) => compareRanges(left.predicateRange, right.predicateRange))
    .map((clause) => createDefinitionResult(clause.predicateRange, options.context.targetUri));
}

function mapDefinitionTargets(
  targets: ReadonlyArray<{ readonly range: LanguageServerDefinitionTarget['targetSelectionRange']; readonly uri: string }>,
): LanguageServerDefinition | null {
  return targets.length > 0 ? targets.map((target) => createDefinitionResult(target.range, target.uri)) : null;
}

function containsPosition(position: Position, range: LanguageServerDefinitionTarget['targetSelectionRange']): boolean {
  const startsBefore = position.line > range.start.line
    || (position.line === range.start.line && position.character >= range.start.character);
  const endsAfter = position.line < range.end.line
    || (position.line === range.end.line && position.character <= range.end.character);

  return startsBefore && endsAfter;
}

function createDefinitionResult(
  targetSelectionRange: LanguageServerDefinitionTarget['targetSelectionRange'],
  targetUri?: string,
): LanguageServerDefinitionTarget {
  return {
    targetSelectionRange,
    ...(targetUri ? { targetUri } : {}),
  };
}

function compareRanges(
  left: LanguageServerDefinitionTarget['targetSelectionRange'],
  right: LanguageServerDefinitionTarget['targetSelectionRange'],
): number {
  return comparePositions(left.start, right.start) || comparePositions(left.end, right.end);
}

function comparePositions(left: Position, right: Position): number {
  return left.line - right.line || left.character - right.character;
}
