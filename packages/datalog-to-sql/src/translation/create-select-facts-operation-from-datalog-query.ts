import type {
  DatalogAtom,
  DatalogAtomArgument,
  DatalogFactPattern,
  DatalogQueryStatement,
  DatalogTerm,
} from '@datalog/ast';

import { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';

/** Convert a shared Datalog query AST into the SQL package's select-facts operation envelope. */
export function createSelectFactsOperationFromDatalogQuery(query: DatalogQueryStatement): SelectFactsOperation {
  const [firstPattern, ...remainingPatterns] = query.body.map((literal) => {
    if (literal.kind !== 'atom') {
      throw new GraphTranslationError(
        'datalog-to-sql.query.unsupported-literal',
        'Select-facts queries only support graph atom literals.',
      );
    }

    return createFactPatternFromAtom(literal);
  });

  if (firstPattern === undefined) {
    throw new GraphTranslationError(
      'datalog-to-sql.query.empty-body',
      'Select-facts queries require at least one graph atom.',
    );
  }

  return {
    kind: 'select-facts',
    match: [firstPattern, ...remainingPatterns],
  };
}

function createFactPatternFromAtom(atom: DatalogAtom): DatalogFactPattern {
  if ((atom.predicate === 'Vertex' || atom.predicate === 'Node') && atom.terms.length === 1) {
    return {
      kind: 'vertex',
      id: getGraphQueryTerm(atom.terms[0], atom.predicate),
    };
  }

  if (atom.predicate === 'Edge' && atom.terms.length === 3) {
    return {
      kind: 'edge',
      subject: getGraphQueryTerm(atom.terms[0], atom.predicate),
      predicate: getGraphQueryTerm(atom.terms[1], atom.predicate),
      object: getGraphQueryTerm(atom.terms[2], atom.predicate),
    };
  }

  throw new GraphTranslationError(
    'datalog-to-sql.query.unsupported-atom',
    `Select-facts queries only support Edge/3 and Vertex/1 graph atoms, received ${atom.predicate}/${atom.terms.length}.`,
  );
}

function getGraphQueryTerm(term: DatalogAtomArgument | undefined, predicate: string): DatalogTerm {
  if (term === undefined) {
    throw new GraphTranslationError(
      'datalog-to-sql.query.invalid-atom-arity',
      `Graph query atom ${predicate} is missing required terms.`,
    );
  }

  if (term.kind === 'named') {
    throw new GraphTranslationError(
      'datalog-to-sql.query.unsupported-term',
      'Select-facts queries do not support named graph terms.',
    );
  }

  return term;
}
