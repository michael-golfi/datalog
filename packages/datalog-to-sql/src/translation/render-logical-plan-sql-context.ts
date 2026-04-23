import type { LogicalPlan, LogicalProjectNode } from '../contracts/logical-plan.js';

export interface RenderContext {
  readonly plan: LogicalPlan;
  readonly values: string[];
  readonly columnReferences: ReadonlyMap<string, string>;
}

/** Create the reusable SQL-render context for one logical plan. */
export function createRenderContext(plan: LogicalPlan): RenderContext {
  return {
    plan,
    values: [],
    columnReferences: createColumnReferenceMap(plan),
  };
}

/** Render the select list for the project node, or `1` for empty projections. */
export function renderSelectedColumns(
  projectNode: LogicalProjectNode,
  renderProjection: (projection: LogicalProjectNode['projections'][number], context: RenderContext) => string,
  context: RenderContext,
): string {
  if (projectNode.projections.length === 0) {
    return '1';
  }

  return projectNode.projections.map((projection) => renderProjection(projection, context)).join(', ');
}

/** Render a SQL `where` clause from already-rendered predicates. */
export function renderWhereClause(conditions: readonly string[]): string {
  if (conditions.length === 0) {
    return '';
  }

  return ` where ${conditions.join(' and ')}`;
}

function createColumnReferenceMap(plan: LogicalPlan): ReadonlyMap<string, string> {
  const references = new Map<string, string>();

  for (const node of Object.values(plan.nodes)) {
    if (node.kind !== 'scan') {
      continue;
    }

    for (const column of node.output) {
      references.set(column.id, `${node.id}.${column.name}`);
    }
  }

  return references;
}
