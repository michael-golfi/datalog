import { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type {
  DatalogFactPattern,
  DatalogTerm,
  SelectFactsOperation,
} from '../contracts/postgres-graph-operation.js';

/** Validate that a select-facts operation uses non-empty constants and variable names. */
export function validateSelectFactsOperation(operation: SelectFactsOperation): void {
  for (const pattern of operation.match) {
    validateFactPattern(pattern);
  }
}

function validateFactPattern(pattern: DatalogFactPattern): void {
  if (pattern.kind === 'vertex') {
    validateTerm(pattern.id);
    return;
  }

  validateTerm(pattern.subject);
  validateTerm(pattern.predicate);
  validateTerm(pattern.object);
}

function validateTerm(term: DatalogTerm): void {
  if (term.kind === 'constant') {
    if (term.value.trim().length > 0) {
      return;
    }

    throw new GraphTranslationError(
      'datalog-to-sql.query.invalid-term',
      'Query constants must use non-empty values.',
    );
  }

  if (term.name.trim().length > 0) {
    return;
  }

  throw new GraphTranslationError(
    'datalog-to-sql.query.invalid-term',
    'Query variables must use non-empty names.',
  );
}
