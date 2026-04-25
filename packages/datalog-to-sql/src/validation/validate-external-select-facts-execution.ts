import type { DatalogQueryStatement } from '@datalog/ast';

import {
  addPatternVariables,
  getKeyColumnTerm,
  getPredicateBinding,
  isExternalLiteral,
  isExternalPredicateBinding,
  isMaterializationKeyBound,
} from './external-select-facts-pattern-support.js';
import { GraphTranslationError } from '../contracts/graph-translation-error.js';

import type { LogicalPlan, LogicalPlanNode } from '../contracts/logical-plan.js';
import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';
import type { ExternalPredicateBinding, PredicateCatalog } from '../contracts/predicate-catalog.js';

const EXTERNAL_SELECT_FACTS_UNSUPPORTED_NEGATION = 'EXTERNAL_SELECT_FACTS_UNSUPPORTED_NEGATION';
const EXTERNAL_SELECT_FACTS_UNSUPPORTED_AGGREGATE = 'EXTERNAL_SELECT_FACTS_UNSUPPORTED_AGGREGATE';
const EXTERNAL_SELECT_FACTS_UNSUPPORTED_RECURSION = 'EXTERNAL_SELECT_FACTS_UNSUPPORTED_RECURSION';
const EXTERNAL_SELECT_FACTS_UNSUPPORTED_MUTATION = 'EXTERNAL_SELECT_FACTS_UNSUPPORTED_MUTATION';
const EXTERNAL_SELECT_FACTS_UNBOUND_MATERIALIZATION_KEY = 'EXTERNAL_SELECT_FACTS_UNBOUND_MATERIALIZATION_KEY';
const EXTERNAL_SELECT_FACTS_UNPROJECTED_HYDRATION_KEY = 'EXTERNAL_SELECT_FACTS_UNPROJECTED_HYDRATION_KEY';

/** Reject external predicates in non-positive query bodies before translation or execution proceeds. */
export function validateExternalSelectFactsQueryContext(query: DatalogQueryStatement, catalog: PredicateCatalog): void {
  if (!query.body.some((literal) => isExternalLiteral(literal, catalog))) {
    return;
  }

  if (query.body.some((literal) => literal.kind === 'not')) {
    throw new GraphTranslationError(
      EXTERNAL_SELECT_FACTS_UNSUPPORTED_NEGATION,
      'External predicates are only supported in positive select-facts queries; negated query literals are not supported.',
    );
  }
}

/** Enforce v1 external execution semantics after the prepared query shape is known. */
export function validateExternalSelectFactsExecution(input: {
  readonly operation: SelectFactsOperation;
  readonly catalog: PredicateCatalog;
  readonly logicalPlan: LogicalPlan;
}): void {
  if (!hasExternalPredicatePattern(input.operation, input.catalog)) {
    return;
  }

  assertQueryMode(input.logicalPlan);
  assertNoAggregateNodes(input.logicalPlan.nodes);
  assertNoRecursiveNodes(input.logicalPlan.nodes);
  assertExternalPatternKeys(input.operation, input.catalog, input.logicalPlan);
}

function hasExternalPredicatePattern(operation: SelectFactsOperation, catalog: PredicateCatalog): boolean {
  return operation.match.some((pattern) => {
    const predicate = getPredicateBinding(pattern, catalog);
    return isExternalPredicateBinding(predicate);
  });
}

function assertQueryMode(logicalPlan: LogicalPlan): void {
  if (logicalPlan.mode === 'query') {
    return;
  }

  throw new GraphTranslationError(
    EXTERNAL_SELECT_FACTS_UNSUPPORTED_MUTATION,
    'External predicates are only supported in select-facts query plans; mutation plans are not supported.',
  );
}

function assertNoAggregateNodes(nodes: Readonly<Record<string, LogicalPlanNode>>): void {
  for (const node of Object.values(nodes)) {
    if (node.kind !== 'aggregate') {
      continue;
    }

    throw new GraphTranslationError(
      EXTERNAL_SELECT_FACTS_UNSUPPORTED_AGGREGATE,
      'External predicates are not supported in aggregate select-facts plans.',
    );
  }
}

function assertNoRecursiveNodes(nodes: Readonly<Record<string, LogicalPlanNode>>): void {
  for (const node of Object.values(nodes)) {
    if (node.kind === 'work-relation-scan') {
      throw new GraphTranslationError(
        EXTERNAL_SELECT_FACTS_UNSUPPORTED_RECURSION,
        'External predicates are not supported in recursive select-facts plans.',
      );
    }

    if (node.kind === 'materialize' && node.reason === 'recursive-frontier') {
      throw new GraphTranslationError(
        EXTERNAL_SELECT_FACTS_UNSUPPORTED_RECURSION,
        'External predicates are not supported in recursive select-facts plans.',
      );
    }
  }
}

function assertExternalPatternKeys(
  operation: SelectFactsOperation,
  catalog: PredicateCatalog,
  logicalPlan: LogicalPlan,
): void {
  const earlierPatternVariables = new Set<string>();
  const projectedVariables = new Set(logicalPlan.output.map((column) => column.name));

  for (const [patternIndex, pattern] of operation.match.entries()) {
    const predicate = getPredicateBinding(pattern, catalog);
    if (!isExternalPredicateBinding(predicate)) {
      addPatternVariables(pattern, earlierPatternVariables);
      continue;
    }

    assertMaterializationKeysAreBound({
      pattern,
      predicate,
      patternIndex,
      earlierPatternVariables,
    });
    assertHydrationKeysAreProjected({
      pattern,
      predicate,
      patternIndex,
      projectedVariables,
    });

    addPatternVariables(pattern, earlierPatternVariables);
  }
}

function assertMaterializationKeysAreBound(input: {
  readonly pattern: SelectFactsOperation['match'][number];
  readonly predicate: ExternalPredicateBinding;
  readonly patternIndex: number;
  readonly earlierPatternVariables: ReadonlySet<string>;
}): void {
  if (input.predicate.execution.resolver.mode !== 'materialize_before_sql') {
    return;
  }

  for (const keyColumn of input.predicate.execution.resolver.keyColumns) {
    const keyTerm = getKeyColumnTerm(input.pattern, input.predicate, keyColumn);
    if (isMaterializationKeyBound(keyTerm, input.earlierPatternVariables)) {
      continue;
    }

    throw new GraphTranslationError(
      EXTERNAL_SELECT_FACTS_UNBOUND_MATERIALIZATION_KEY,
      `Materialized external predicate ${String(input.predicate.signature.name)}/${input.predicate.signature.arity} at match index ${input.patternIndex + 1} requires key column ${keyColumn} to be bound by a constant or by a variable introduced by an earlier pattern.`,
    );
  }
}

function assertHydrationKeysAreProjected(input: {
  readonly pattern: SelectFactsOperation['match'][number];
  readonly predicate: ExternalPredicateBinding;
  readonly patternIndex: number;
  readonly projectedVariables: ReadonlySet<string>;
}): void {
  if (input.predicate.execution.resolver.mode !== 'post_query_hydrate') {
    return;
  }

  for (const keyColumn of input.predicate.execution.resolver.keyColumns) {
    const keyTerm = getKeyColumnTerm(input.pattern, input.predicate, keyColumn);
    if (keyTerm.kind === 'variable' && input.projectedVariables.has(keyTerm.name)) {
      continue;
    }

    throw new GraphTranslationError(
      EXTERNAL_SELECT_FACTS_UNPROJECTED_HYDRATION_KEY,
      `Hydrated external predicate ${String(input.predicate.signature.name)}/${input.predicate.signature.arity} at match index ${input.patternIndex + 1} requires key column ${keyColumn} to be projected in the final result set.`,
    );
  }
}
