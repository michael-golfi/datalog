import type { DatalogQueryStatement } from '@datalog/ast';

import { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';
import type { PredicateBinding, PredicateCatalog } from '../contracts/predicate-catalog.js';
import type {
  PreparedSelectFactsExecution,
  PreparedSelectFactsMaterializationStep,
} from '../contracts/prepared-select-facts-execution.js';

import { compileSelectFactsLogicalPlan } from '../translation/compile-select-facts-logical-plan.js';
import { createSelectFactsOperationFromDatalogQuery } from '../translation/create-select-facts-operation-from-datalog-query.js';
import { renderLogicalPlanToSql } from '../translation/render-logical-plan-to-sql.js';
import {
  validateExternalSelectFactsExecution,
  validateExternalSelectFactsQueryContext,
} from '../validation/validate-external-select-facts-execution.js';
import {
  appendPreparedPattern,
  createPreparedPatternState,
} from './prepare-select-facts-pattern-support.js';
import {
  linkHydrationInstructions,
  type PendingPreparedSelectFactsHydrationInstruction,
} from './prepare-select-facts-hydration-support.js';

/** Prepare unified select-facts execution by separating pre-SQL work, final SQL, and optional hydration metadata. */
export function prepareSelectFactsExecution(input: {
  readonly operation: SelectFactsOperation | DatalogQueryStatement;
  readonly catalog: PredicateCatalog;
}): PreparedSelectFactsExecution {
  if (input.operation.kind === 'query') {
    validateExternalSelectFactsQueryContext(input.operation, input.catalog);
  }

  const selectFactsOperation = input.operation.kind === 'query'
    ? createSelectFactsOperationFromDatalogQuery(input.operation, input.catalog)
    : input.operation;
  const preparedInput = prepareSelectFactsPatterns(selectFactsOperation, input.catalog);
  const logicalPlan = compileSelectFactsLogicalPlan(preparedInput.operation, preparedInput.catalog);

  validateExternalSelectFactsExecution({
    operation: selectFactsOperation,
    catalog: input.catalog,
    logicalPlan,
  });

  const preparedExecution: PreparedSelectFactsExecution = {
    kind: 'prepared-select-facts-execution',
    logicalPlan,
    materializationSteps: preparedInput.materializationSteps,
    finalSqlQuery: renderLogicalPlanToSql(logicalPlan),
  };

  const hydrationInstructions = linkHydrationInstructions({
    hydrationInstructions: preparedInput.hydrationInstructions,
    outputColumnNames: new Set(logicalPlan.output.map((column) => column.name)),
  });

  if (hydrationInstructions.length > 0) {
    return {
      ...preparedExecution,
      hydrationInstructions,
    };
  }

  return preparedExecution;
}

function prepareSelectFactsPatterns(operation: SelectFactsOperation, catalog: PredicateCatalog): {
  readonly operation: SelectFactsOperation;
  readonly catalog: PredicateCatalog;
  readonly materializationSteps: readonly PreparedSelectFactsMaterializationStep[];
  readonly hydrationInstructions: readonly PendingPreparedSelectFactsHydrationInstruction[];
} {
  const state = createPreparedPatternState(catalog);

  for (const [patternIndex, pattern] of operation.match.entries()) {
    appendPreparedPattern({
      state,
      patternIndex,
      pattern,
      catalog,
    });
  }

  if (state.sqlMatch.length === 0) {
    throw new GraphTranslationError(
      'UNSUPPORTED_GRAPH_PREDICATE',
      'Prepared select-facts execution requires at least one SQL-plannable predicate pattern.',
    );
  }

  return {
    operation: {
      kind: 'select-facts',
      match: asNonEmptyMatch(state.sqlMatch),
    },
    catalog: createPreparedCatalog(catalog, Array.from(state.predicateByNameAndArity.values())),
    materializationSteps: state.materializationSteps,
    hydrationInstructions: state.hydrationInstructions,
  };
}

function createPreparedCatalog(catalog: PredicateCatalog, predicates: readonly PredicateBinding[]): PredicateCatalog {
  return {
    version: catalog.version,
    predicates,
    ...(catalog.builtins === undefined ? {} : { builtins: catalog.builtins }),
    ...(catalog.aliases === undefined ? {} : { aliases: catalog.aliases }),
  };
}

function asNonEmptyMatch(match: Array<SelectFactsOperation['match'][number]>): SelectFactsOperation['match'] {
  return match as unknown as SelectFactsOperation['match'];
}
