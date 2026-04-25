import { GraphTranslationError } from '../contracts/graph-translation-error.js';

import type { RenderContext } from './render-logical-plan-sql-context.js';
import type {
  BooleanExpression,
  ColumnReference,
  JoinCondition,
  LogicalExpression,
  ParameterReference,
  ScalarLiteral,
} from '../contracts/logical-plan.js';

/** Render one project binding into a SQL select-list entry. */
export function renderProjection(
  projection: { readonly name: string; readonly expression: LogicalExpression },
  context: RenderContext,
): string {
  return `${renderExpression(projection.expression, context)} as ${quoteIdentifier(
    projection.name,
  )}`;
}

/** Render a logical join condition into SQL. */
export function renderJoinCondition(condition: JoinCondition, context: RenderContext): string {
  if (condition.kind === 'equi') {
    if (condition.left !== undefined && condition.right !== undefined) {
      return `${renderColumnReference(condition.left, context)} = ${renderColumnReference(
        condition.right,
        context,
      )}`;
    }

    throw new GraphTranslationError(
      'UNSUPPORTED_LOGICAL_PLAN_NODE',
      'Join equi condition must include both sides.',
    );
  }

  if (condition.predicate !== undefined) {
    return renderExpression(condition.predicate, context);
  }

  throw new GraphTranslationError(
    'UNSUPPORTED_LOGICAL_PLAN_NODE',
    'Join predicate condition must include a predicate.',
  );
}

/** Render a supported logical expression into SQL. */
export function renderExpression(expression: LogicalExpression, context: RenderContext): string {
  switch (expression.kind) {
    case 'column':
      return renderColumnReference(expression, context);
    case 'literal':
      return renderLiteral(expression, context);
    case 'comparison':
      return `${renderExpression(expression.left, context)} ${
        expression.operator
      } ${renderExpression(expression.right, context)}`;
    case 'boolean':
      return renderBooleanExpression(expression, context);
    case 'parameter':
      return renderParameterReference(expression, context);
    case 'function':
      throw new GraphTranslationError(
        'UNSUPPORTED_LOGICAL_PLAN_NODE',
        `Unsupported logical expression kind ${expression.kind}.`,
      );
  }
}

function renderBooleanExpression(expression: BooleanExpression, context: RenderContext): string {
  if (expression.operator === 'not') {
    return renderNotExpression(expression.args, context);
  }

  return expression.args
    .map((argument) => `(${renderExpression(argument, context)})`)
    .join(` ${expression.operator} `);
}

function renderNotExpression(args: readonly LogicalExpression[], context: RenderContext): string {
  const [argument] = args;

  if (argument !== undefined) {
    return `not (${renderExpression(argument, context)})`;
  }

  throw new GraphTranslationError(
    'UNSUPPORTED_LOGICAL_PLAN_NODE',
    'Boolean not requires an argument.',
  );
}

function renderParameterReference(reference: ParameterReference, context: RenderContext): string {
  const parameterIndex = context.plan.parameters.findIndex(
    (parameter) => parameter.id === reference.parameterId,
  );

  if (parameterIndex >= 0) {
    return `$${parameterIndex + 1}`;
  }

  throw new GraphTranslationError(
    'UNSUPPORTED_LOGICAL_PLAN_NODE',
    `Missing parameter binding ${reference.parameterId}.`,
  );
}

function renderLiteral(literal: ScalarLiteral, context: RenderContext): string {
  if (literal.value === null) {
    return 'null';
  }

  if (typeof literal.value === 'boolean') {
    return literal.value ? 'true' : 'false';
  }

  context.values.push(String(literal.value));
  return `$${context.values.length}`;
}

function renderColumnReference(reference: ColumnReference, context: RenderContext): string {
  const renderedReference = context.columnReferences.get(reference.columnId);

  if (renderedReference !== undefined) {
    return renderedReference;
  }

  throw new GraphTranslationError(
    'UNSUPPORTED_LOGICAL_PLAN_NODE',
    `Missing SQL column binding for logical column ${reference.columnId} on node ${reference.nodeId}.`,
  );
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
