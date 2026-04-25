import type { DatalogQueryStatement } from '@datalog/ast';

import { compileSelectFactsLogicalPlan } from './compile-select-facts-logical-plan.js';
import { createSelectFactsOperationFromDatalogQuery } from './create-select-facts-operation-from-datalog-query.js';
import { DEFAULT_GRAPH_PREDICATE_CATALOG } from './default-graph-predicate-catalog.js';
import { renderLogicalPlanToSql } from './render-logical-plan-to-sql.js';

import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';
import type { TranslatedSqlQuery } from '../contracts/translated-sql-query.js';

/** Translate a Datalog fact query into a PostgreSQL leaf query via the shared logical-plan seam. */
export function translateDatalogFactQuery(
  operation: SelectFactsOperation | DatalogQueryStatement,
): TranslatedSqlQuery {
  const selectFactsOperation =
    operation.kind === 'query' ? createSelectFactsOperationFromDatalogQuery(operation) : operation;
  const logicalPlan = compileSelectFactsLogicalPlan(
    selectFactsOperation,
    DEFAULT_GRAPH_PREDICATE_CATALOG,
  );
  return renderLogicalPlanToSql(logicalPlan);
}
