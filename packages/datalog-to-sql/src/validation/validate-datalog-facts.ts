import type { DatalogFact } from '@datalog/ast';

import { GraphTranslationError } from '../contracts/graph-translation-error.js';

/** Validate that fact insert/delete operations contain only non-empty identifiers. */
export function validateDatalogFacts(facts: readonly DatalogFact[], mode: 'insert' | 'delete'): void {
  if (facts.length === 0) {
    throw new GraphTranslationError(
      `datalog-to-sql.${mode}.invalid-fact`,
      `${capitalize(mode)} facts require at least one fact.`,
    );
  }

  for (const fact of facts) {
    if (fact.kind === 'vertex') {
      assertIdentifier(fact.id, mode);
      continue;
    }

    assertIdentifier(fact.subjectId, mode);
    assertIdentifier(fact.predicateId, mode);
    assertIdentifier(fact.objectId, mode);
  }
}

function assertIdentifier(value: string, mode: 'insert' | 'delete'): void {
  if (value.trim().length > 0) {
    return;
  }

  throw new GraphTranslationError(
    `datalog-to-sql.${mode}.invalid-fact`,
    `${capitalize(mode)} facts must use non-empty identifiers.`,
  );
}

function capitalize(value: string): string {
  return `${value[0]!.toUpperCase()}${value.slice(1)}`;
}
