import { validateDatalogFacts } from '../validation/validate-datalog-facts.js';

import type { InsertFactsOperation } from '../contracts/postgres-graph-operation.js';
import type { TranslatedSqlQuery } from '../contracts/translated-sql-query.js';

/** Translate a fact-insertion operation into SQL over vertices and edges. */
export function translateFactInsert(operation: InsertFactsOperation): TranslatedSqlQuery {
  validateDatalogFacts(operation.facts, 'insert');

  const values: string[] = [];
  const vertices = operation.facts.filter((fact) => fact.kind === 'vertex');
  const edges = operation.facts.filter((fact) => fact.kind === 'edge');
  const ctes: string[] = [];

  if (vertices.length > 0) {
    const placeholders = vertices.map((fact) => {
      values.push(fact.id);
      return `($${values.length})`;
    });

    ctes.push(
      `inserted_vertices as (insert into vertices (id) values ${placeholders.join(
        ', ',
      )} on conflict do nothing returning id)`,
    );
  }

  if (edges.length > 0) {
    const placeholders = edges.map((fact) => {
      values.push(fact.subjectId, fact.predicateId, fact.objectId);
      return `($${values.length - 2}, $${values.length - 1}, $${values.length})`;
    });

    ctes.push(
      `inserted_edges as (insert into edges (subject_id, predicate_id, object_id) values ${placeholders.join(
        ', ',
      )} on conflict do nothing returning subject_id, predicate_id, object_id)`,
    );
  }

  return {
    operation: 'insert',
    text: `with ${ctes.join(', ')} select 1;`,
    values,
  };
}
