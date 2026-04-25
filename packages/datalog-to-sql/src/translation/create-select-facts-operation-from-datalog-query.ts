import type {
  DatalogAtom,
  DatalogAtomArgument,
  DatalogQueryStatement,
  DatalogTerm,
} from '@datalog/ast';

import { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type { PredicateCatalog } from '../contracts/predicate-catalog.js';
import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';

import { getSelectFactsPredicateBinding } from './select-facts-logical-plan-pattern-predicate.js';

/** Convert a shared Datalog query AST into the SQL package's select-facts operation envelope. */
export function createSelectFactsOperationFromDatalogQuery(
  query: DatalogQueryStatement,
  predicateCatalog: PredicateCatalog,
): SelectFactsOperation {
  const [firstPattern, ...remainingPatterns] = query.body.map((literal) => {
    if (literal.kind !== 'atom') {
      throw new GraphTranslationError(
        'datalog-to-sql.query.unsupported-literal',
        'Select-facts queries only support positive atom literals.',
      );
    }

    return createFactPatternFromAtom(literal, predicateCatalog);
  });

  if (firstPattern === undefined) {
    throw new GraphTranslationError(
      'datalog-to-sql.query.empty-body',
      'Select-facts queries require at least one atom.',
    );
  }

  return {
    kind: 'select-facts',
    predicateCatalog,
    match: [firstPattern, ...remainingPatterns],
  };
}

function createFactPatternFromAtom(atom: DatalogAtom, catalog: PredicateCatalog): SelectFactsOperation['match'][number] {
  const pattern = {
    kind: 'predicate' as const,
    predicate: atom.predicate,
    terms: atom.terms.map((term) => getQueryTerm(term, atom.predicate)),
  } satisfies SelectFactsOperation['match'][number];

  const predicate = getSelectFactsPredicateBinding(pattern, catalog);

  return {
    ...pattern,
    predicate: predicate.signature.name,
  };
}

function getQueryTerm(term: DatalogAtomArgument | undefined, predicate: string): DatalogTerm {
  if (term === undefined) {
    throw new GraphTranslationError(
      'datalog-to-sql.query.invalid-atom-arity',
      `Query atom ${predicate} is missing required terms.`,
    );
  }

  if (term.kind === 'named') {
    throw new GraphTranslationError(
      'datalog-to-sql.query.unsupported-term',
      'Select-facts queries do not support named terms.',
    );
  }

  return term;
}
