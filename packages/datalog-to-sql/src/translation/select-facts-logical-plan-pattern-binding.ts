import type { DatalogTerm } from '@datalog/ast';

import { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type { LogicalExpression, LogicalNodeId } from '../contracts/logical-plan.js';
import type { RelationColumnBinding } from '../contracts/predicate-catalog.js';

import {
  createColumnReference,
  createEqualityExpression,
  createLiteral,
  createScanColumnId,
  type VariableBinding,
} from './select-facts-logical-plan-node-factory.js';

export interface PendingJoinCondition {
  readonly left: VariableBinding;
  readonly right: VariableBinding;
}

export interface PatternTermBinding {
  readonly term: DatalogTerm;
  readonly column: RelationColumnBinding;
}

/** Bind one pattern term into local filters, promoted variables, or pending joins. */
export function bindPatternTerm(input: {
  readonly scanNodeId: LogicalNodeId;
  readonly binding: PatternTermBinding;
  readonly variableBindings: ReadonlyMap<string, VariableBinding>;
  readonly variableOrder: string[];
  readonly localBindings: Map<string, VariableBinding>;
  readonly localFilters: LogicalExpression[];
  readonly pendingJoinConditions: PendingJoinCondition[];
  readonly pendingVariables: Array<readonly [string, VariableBinding]>;
}): void {
  const scanReference = createColumnReference(
    input.scanNodeId,
    createScanColumnId(input.scanNodeId, input.binding.column.name),
  );

  if (input.binding.term.kind === 'constant') {
    if (typeof input.binding.term.value !== 'string') {
      throw new GraphTranslationError(
        'datalog-to-sql.query.invalid-term',
        'Query constants must use string graph identifiers.',
      );
    }

    input.localFilters.push(
      createEqualityExpression(scanReference, createLiteral(input.binding.term.value, input.binding.column.type)),
    );
    return;
  }

  if (input.binding.term.kind === 'wildcard') {
    return;
  }

  bindVariableTerm({
    ...input,
    term: input.binding.term,
    scanReference,
  });
}

function bindVariableTerm(input: {
  readonly scanNodeId: LogicalNodeId;
  readonly term: Extract<DatalogTerm, { kind: 'variable' }>;
  readonly scanReference: ReturnType<typeof createColumnReference>;
  readonly variableBindings: ReadonlyMap<string, VariableBinding>;
  readonly variableOrder: string[];
  readonly localBindings: Map<string, VariableBinding>;
  readonly localFilters: LogicalExpression[];
  readonly pendingJoinConditions: PendingJoinCondition[];
  readonly pendingVariables: Array<readonly [string, VariableBinding]>;
}): void {
  const localBinding = input.localBindings.get(input.term.name);
  if (localBinding !== undefined) {
    input.localFilters.push(
      createEqualityExpression(input.scanReference, createColumnReference(localBinding.nodeId, localBinding.columnId)),
    );
    return;
  }

  const nextBinding = {
    nodeId: input.scanNodeId,
    columnId: input.scanReference.columnId,
    type: 'text',
  } satisfies VariableBinding;

  input.localBindings.set(input.term.name, nextBinding);

  const existingBinding = input.variableBindings.get(input.term.name);
  if (existingBinding === undefined) {
    input.variableOrder.push(input.term.name);
    input.pendingVariables.push([input.term.name, nextBinding] as const);
    return;
  }

  input.pendingJoinConditions.push({
    left: existingBinding,
    right: nextBinding,
  });
}
