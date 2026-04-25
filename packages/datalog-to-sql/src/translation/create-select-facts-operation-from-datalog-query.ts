import type {
  DatalogAtom,
  DatalogAtomArgument,
  DatalogQueryStatement,
  DatalogTerm,
} from '@datalog/ast';

import { getSelectFactsPredicateBinding } from './select-facts-logical-plan-pattern-predicate.js';
import { GraphTranslationError } from '../contracts/graph-translation-error.js';

import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';
import type { PredicateCatalog } from '../contracts/predicate-catalog.js';


/** Convert a shared Datalog query AST into the SQL package's select-facts operation envelope. */
export function createSelectFactsOperationFromDatalogQuery(
  query: DatalogQueryStatement,
  predicateCatalog: PredicateCatalog,
): SelectFactsOperation {
  const firstPattern = createFirstPattern(query.body, predicateCatalog);
  const [, ...remainingLiterals] = query.body;
  const remainingPatterns = remainingLiterals.map((literal) => createPatternFromLiteral(literal, predicateCatalog));

  return {
    kind: 'select-facts',
    predicateCatalog,
    match: [firstPattern, ...remainingPatterns],
  };
}

function createFirstPattern(
  body: ReadonlyArray<DatalogQueryStatement['body'][number]>,
  predicateCatalog: PredicateCatalog,
): SelectFactsOperation['match'][number] {
  const [firstLiteral] = body;

  if (firstLiteral === undefined) {
    throw new GraphTranslationError(
      'datalog-to-sql.query.empty-body',
      'Select-facts queries require at least one atom.',
    );
  }

  return createPatternFromLiteral(firstLiteral, predicateCatalog);
}

function createPatternFromLiteral(
  literal: DatalogQueryStatement['body'][number],
  predicateCatalog: PredicateCatalog,
): SelectFactsOperation['match'][number] {
  if (literal.kind !== 'atom') {
    throw new GraphTranslationError(
      'datalog-to-sql.query.unsupported-literal',
      'Select-facts queries only support positive atom literals.',
    );
  }

  return createFactPatternFromAtom(literal, predicateCatalog);
}

function createFactPatternFromAtom(atom: DatalogAtom, catalog: PredicateCatalog): SelectFactsOperation['match'][number] {
  const terms = createQueryTerms(atom);
  const pattern = {
    kind: 'predicate' as const,
    predicate: atom.predicate,
    terms,
  } satisfies SelectFactsOperation['match'][number];

  const predicate = getSelectFactsPredicateBinding(pattern, catalog);

  return {
    ...pattern,
    predicate: predicate.signature.name,
  };
}

function createQueryTerms(atom: DatalogAtom): readonly [DatalogTerm, ...DatalogTerm[]] {
  const [firstTerm, ...remainingTerms] = atom.terms;

  return [
    getQueryTerm(firstTerm, atom.predicate),
    ...remainingTerms.map((term) => getQueryTerm(term, atom.predicate)),
  ];
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
