import { getStringReferenceAtPosition, parseDocument } from '@datalog/parser';

import type { LanguageServerDefinition, Position } from '../contracts/language-feature-types.js';

/** Resolve a definition target for the symbol or reference at the given position. */
export function computeDefinition(
  source: string,
  position: Position,
  targetUri?: string,
): LanguageServerDefinition | null {
  const parsed = parseDocument(source);
  const stringReferenceDefinition = getStringReferenceDefinition({
    parsed,
    source,
    position,
    ...(targetUri ? { targetUri } : {}),
  });
  if (stringReferenceDefinition) {
    return stringReferenceDefinition;
  }

  return getDerivedPredicateDefinition(parsed, position, targetUri);
}

function getStringReferenceDefinition(
  options: {
    readonly parsed: ReturnType<typeof parseDocument>;
    readonly source: string;
    readonly position: Position;
    readonly targetUri?: string;
  },
): LanguageServerDefinition | null {
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
  targetUri?: string,
): LanguageServerDefinition | null {
  const occurrenceName = findOccurrenceNameAtPosition(parsed, position);

  if (!occurrenceName) {
    return null;
  }

  const definition = parsed.derivedPredicates.get(occurrenceName)?.[0];
  if (!definition) {
    return null;
  }

  return createDefinitionResult(definition.predicateRange, targetUri);
}

function findOccurrenceNameAtPosition(
  parsed: ReturnType<typeof parseDocument>,
  position: Position,
): string | null {
  for (const clauses of parsed.derivedPredicates.values()) {
    const matchingClause = clauses.find((clause) => clause.occurrences.some((occurrence) => containsPosition(position, occurrence.range)));
    const matchingOccurrence = matchingClause?.occurrences.find((occurrence) => containsPosition(position, occurrence.range));

    if (matchingOccurrence) {
      return matchingOccurrence.name;
    }
  }

  return null;
}

function containsPosition(position: Position, range: LanguageServerDefinition['targetSelectionRange']): boolean {
  const startsBefore = position.line > range.start.line
    || (position.line === range.start.line && position.character >= range.start.character);
  const endsAfter = position.line < range.end.line
    || (position.line === range.end.line && position.character <= range.end.character);

  return startsBefore && endsAfter;
}

function createDefinitionResult(
  targetSelectionRange: LanguageServerDefinition['targetSelectionRange'],
  targetUri?: string,
): LanguageServerDefinition {
  return {
    targetSelectionRange,
    ...(targetUri ? { targetUri } : {}),
  };
}
