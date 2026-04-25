import type { DatalogQueryStatement } from '@datalog/ast';

import type { PredicateCatalog } from '../contracts/predicate-catalog.js';
import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';
import type { TranslatedSqlQuery } from '../contracts/translated-sql-query.js';

import { compileSelectFactsLogicalPlan } from './compile-select-facts-logical-plan.js';
import { createSelectFactsOperationFromDatalogQuery } from './create-select-facts-operation-from-datalog-query.js';
import { renderLogicalPlanToSql } from './render-logical-plan-to-sql.js';

/** Translate a Datalog fact query into a PostgreSQL leaf query via the shared logical-plan seam. */
export function translateDatalogFactQuery(
  operation: SelectFactsOperation | DatalogQueryStatement,
  predicateCatalog?: PredicateCatalog,
): TranslatedSqlQuery {
  const selectFactsOperation = operation.kind === 'query'
    ? createSelectFactsOperationFromDatalogQuery(operation, requirePredicateCatalog(predicateCatalog))
    : operation;
  const logicalPlan = compileSelectFactsLogicalPlan(selectFactsOperation, selectFactsOperation.predicateCatalog);
  return renderLogicalPlanToSql(logicalPlan);
}

function requirePredicateCatalog(predicateCatalog: PredicateCatalog | undefined): PredicateCatalog {
  if (predicateCatalog !== undefined) {
    return predicateCatalog;
  }

  throw new Error('translateDatalogFactQuery requires a predicate catalog for query AST translation.');
}
