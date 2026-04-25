import {
  createRenderContext,
  renderSelectedColumns,
  renderWhereClause,
} from './render-logical-plan-sql-context.js';
import { renderProjection } from './render-logical-plan-sql-expression.js';
import { getDistinctProjectRoot, renderSource } from './render-logical-plan-sql-source.js';

import type { LogicalPlan } from '../contracts/logical-plan.js';
import type { TranslatedSqlQuery } from '../contracts/translated-sql-query.js';

/** Render the shared logical-plan IR into a PostgreSQL SQL leaf query. */
export function renderLogicalPlanToSql(plan: LogicalPlan): TranslatedSqlQuery {
  const context = createRenderContext(plan);
  const { projectNode } = getDistinctProjectRoot(plan);
  const renderedSource = renderSource(projectNode.inputNodeId, context);
  const selectedColumns = renderSelectedColumns(projectNode, renderProjection, context);
  const whereClause = renderWhereClause(renderedSource.where);

  return {
    operation: 'select',
    text: `select distinct ${selectedColumns} from ${renderedSource.from}${whereClause};`,
    values: context.values,
  };
}
