import type { DatalogQueryStatement } from '@datalog/ast';

import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';
import type { PredicateCatalog } from '../contracts/predicate-catalog.js';
import type { TranslatedSqlQuery } from '../contracts/translated-sql-query.js';

import { compileSelectFactsLogicalPlan } from './compile-select-facts-logical-plan.js';
import { createSelectFactsOperationFromDatalogQuery } from './create-select-facts-operation-from-datalog-query.js';
import { renderLogicalPlanToSql } from './render-logical-plan-to-sql.js';

/** Translate a Datalog fact query into a PostgreSQL leaf query via the shared logical-plan seam. */
export function translateDatalogFactQuery(input: {
  readonly operation: SelectFactsOperation | DatalogQueryStatement;
  readonly catalog: PredicateCatalog;
}): TranslatedSqlQuery {
  const selectFactsOperation = input.operation.kind === 'query'
    ? createSelectFactsOperationFromDatalogQuery(input.operation, input.catalog)
    : input.operation;
  const logicalPlan = compileSelectFactsLogicalPlan(selectFactsOperation, input.catalog);
  return renderLogicalPlanToSql(logicalPlan);
}
