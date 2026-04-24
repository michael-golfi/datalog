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
    ...(context.targetUri ? { targetUri: context.targetUri } : {}),
  });
  if (stringReferenceDefinition) {
    return [stringReferenceDefinition];
  }

  return getDerivedPredicateDefinition(parsed, position, context);
}

function getStringReferenceDefinition(
  options: {
    readonly parsed: ReturnType<typeof parseDocument>;
    readonly source: string;
    readonly position: Position;
    readonly targetUri?: string;
  },
): LanguageServerDefinitionTarget | null {
  const stringReference = getStringReferenceAtPosition(options.source, options.position);
  if (!stringReference) {
    return null;
  }

  const schema = options.parsed.predicateSchemas.get(stringReference.value);
  if (schema) {
    return createDefinitionResult(schema.range, options.targetUri);
  }

  const node = options.parsed.nodeSummaries.get(stringReference.value);
  if (node) {
    return createDefinitionResult(node.range, options.targetUri);
  }

  return null;
}

function getDerivedPredicateDefinition(
  parsed: ReturnType<typeof parseDocument>,
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
  parsed: ReturnType<typeof parseDocument>,
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
  readonly parsed: ReturnType<typeof parseDocument>;
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
