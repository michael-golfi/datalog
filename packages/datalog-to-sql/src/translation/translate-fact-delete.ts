import { validateDatalogFacts } from '../validation/validate-datalog-facts.js';

import type { DeleteFactsOperation } from '../contracts/postgres-graph-operation.js';
import type { TranslatedSqlQuery } from '../contracts/translated-sql-query.js';

/** Translate a fact-deletion operation into SQL over vertices and edges. */
export function translateFactDelete(operation: DeleteFactsOperation): TranslatedSqlQuery {
  validateDatalogFacts(operation.facts, 'delete');

  const values: string[] = [];
  const vertices = operation.facts.filter((fact) => fact.kind === 'vertex');
  const edges = operation.facts.filter((fact) => fact.kind === 'edge');
  const ctes: string[] = [];

  if (vertices.length > 0) {
    const placeholders = vertices.map((fact) => {
      values.push(fact.id);
      return `$${values.length}`;
    });

    ctes.push(
      `deleted_vertices as (delete from vertices where id in (${placeholders.join(
        ', ',
      )}) returning id)`,
    );
  }

  if (edges.length > 0) {
    const clauses = edges.map((fact) => {
      values.push(fact.subjectId, fact.predicateId, fact.objectId);
      return `(subject_id = $${values.length - 2} and predicate_id = $${
        values.length - 1
      } and object_id = $${values.length})`;
    });

    ctes.push(
      `deleted_edges as (delete from edges where ${clauses.join(
        ' or ',
      )} returning subject_id, predicate_id, object_id)`,
    );
  }

  return {
    operation: 'delete',
    text: `with ${ctes.join(', ')} select 1;`,
    values,
  };
}
