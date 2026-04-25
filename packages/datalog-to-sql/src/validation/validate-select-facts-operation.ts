import type { DatalogTerm } from '@datalog/ast';

import { GraphTranslationError } from '../contracts/graph-translation-error.js';

import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';

/** Validate that a select-facts operation uses non-empty constants and variable names. */
export function validateSelectFactsOperation(operation: SelectFactsOperation): void {
  for (const pattern of operation.match) {
    validateFactPattern(pattern);
  }
}

function validateFactPattern(pattern: SelectFactsOperation['match'][number]): void {
  if (pattern.kind === 'vertex') {
    validateTerm(pattern.id);
    return;
  }

  if (pattern.kind === 'predicate') {
    for (const term of pattern.terms) {
      validateTerm(term);
    }

    return;
  }

  validateTerm(pattern.subject);
  validateTerm(pattern.predicate);
  validateTerm(pattern.object);
}

function validateTerm(term: DatalogTerm | undefined): void {
  if (term === undefined) {
    throw new GraphTranslationError(
      'datalog-to-sql.query.invalid-term',
      'Query fact patterns must include all required terms.',
    );
  }

  if (term.kind === 'constant') {
    if (typeof term.value === 'string' && term.value.trim().length > 0) {
      return;
    }

    throw new GraphTranslationError(
      'datalog-to-sql.query.invalid-term',
      'Query constants must use non-empty string values.',
    );
  }

  if (term.kind === 'wildcard') {
    return;
  }

  if (term.name.trim().length > 0) {
    return;
  }

  throw new GraphTranslationError(
    'datalog-to-sql.query.invalid-term',
    'Query variables must use non-empty names.',
  );
}
