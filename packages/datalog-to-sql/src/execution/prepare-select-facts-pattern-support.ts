import type { DatalogTerm } from '@datalog/ast';

import { GraphTranslationError } from '../contracts/graph-translation-error.js';
import { getPredicateColumns } from '../contracts/predicate-catalog.js';
import type {
  ExternalPredicateBinding,
  PredicateBinding,
  PredicateCatalog,
  SqlPushdownExternalPredicateBinding,
  StoredPredicateBinding,
} from '../contracts/predicate-catalog.js';
import type {
  MaterializeBeforeSqlExternalResolverDefinition,
  PostQueryHydrateExternalResolverDefinition,
} from '../contracts/external-resolver-definition.js';
import type { PreparedSelectFactsMaterializationStep } from '../contracts/prepared-select-facts-execution.js';
import type { SelectFactsOperation } from '../contracts/postgres-graph-operation.js';
import { getSelectFactsPredicateBinding } from '../translation/select-facts-logical-plan-pattern-predicate.js';
import type { PendingPreparedSelectFactsHydrationInstruction } from './prepare-select-facts-hydration-support.js';
export interface PreparedPatternState {
  readonly materializationSteps: PreparedSelectFactsMaterializationStep[];
  readonly hydrationInstructions: PendingPreparedSelectFactsHydrationInstruction[];
  readonly predicateByNameAndArity: Map<string, PredicateBinding>;
  readonly sqlMatch: Array<SelectFactsOperation['match'][number]>;
}

type MaterializeBeforeSqlPredicateBinding = ExternalPredicateBinding & {
  readonly execution: {
    readonly kind: 'external-resolver';
    readonly resolver: MaterializeBeforeSqlExternalResolverDefinition;
  };
};

type PostQueryHydratePredicateBinding = ExternalPredicateBinding & {
  readonly execution: {
    readonly kind: 'external-resolver';
    readonly resolver: PostQueryHydrateExternalResolverDefinition;
  };
};
/** Seed prepared select-facts state from the caller-provided predicate catalog. */
export function createPreparedPatternState(catalog: PredicateCatalog): PreparedPatternState {
  const predicateByNameAndArity = new Map<string, PredicateBinding>();

  for (const predicate of catalog.predicates) {
    predicateByNameAndArity.set(createPredicateLookupKey(predicate.signature.name, predicate.signature.arity), predicate);
  }

  return {
    materializationSteps: [],
    hydrationInstructions: [],
    predicateByNameAndArity,
    sqlMatch: [],
  };
}
/** Normalize one query pattern onto the prepared execution state. */
export function appendPreparedPattern(input: {
  readonly state: PreparedPatternState;
  readonly patternIndex: number;
  readonly pattern: SelectFactsOperation['match'][number];
  readonly catalog: PredicateCatalog;
}): void {
  const predicate = getSelectFactsPredicateBinding(input.pattern, input.catalog);

  if (!isExternalPredicateBinding(predicate)) {
    appendSqlPattern(input.state, input.pattern, predicate);
    return;
  }

  if (isSqlPushdownPredicateBinding(predicate)) {
    appendSqlPattern(input.state, input.pattern, createSqlPushdownPredicateBinding(predicate));
    return;
  }

  if (isMaterializeBeforeSqlPredicateBinding(predicate)) {
    appendMaterializationPattern(input, predicate);
    return;
  }

  if (isPostQueryHydratePredicateBinding(predicate)) {
    appendHydrationPattern(input, predicate);
    return;
  }

  appendSqlPattern(input.state, input.pattern, predicate);
}
function appendSqlPattern(
  state: PreparedPatternState,
  pattern: SelectFactsOperation['match'][number],
  predicate: PredicateBinding,
): void {
  state.sqlMatch.push(pattern);
  state.predicateByNameAndArity.set(createPatternLookupKey(pattern), predicate);
}
function appendMaterializationPattern(
  input: {
    readonly state: PreparedPatternState;
    readonly patternIndex: number;
    readonly pattern: SelectFactsOperation['match'][number];
  },
  predicate: MaterializeBeforeSqlPredicateBinding,
): void {
  const columns = getPredicateColumns(predicate);
  const relationName = `prepared_${predicate.signature.name}_${input.patternIndex + 1}`;
  const resolver = predicate.execution.resolver;

  input.state.materializationSteps.push({
    kind: 'materialize-external-predicate',
    patternIndex: input.patternIndex,
    predicateName: String(predicate.signature.name),
    relationName,
    columns,
    keyColumns: resolver.keyColumns,
    terms: getPatternTerms(input.pattern),
    resolver,
  });
  appendSqlPattern(input.state, input.pattern, {
    signature: predicate.signature,
    source: predicate.source,
    storage: {
      kind: 'work-table',
      relationName,
      columns,
      scope: 'statement',
    },
    constraints: predicate.constraints,
    indexes: predicate.indexes,
    ...(predicate.statistics === undefined ? {} : { statistics: predicate.statistics }),
    capabilities: predicate.capabilities,
  });
}
function appendHydrationPattern(
  input: {
    readonly state: PreparedPatternState;
    readonly patternIndex: number;
    readonly pattern: SelectFactsOperation['match'][number];
  },
  predicate: PostQueryHydratePredicateBinding,
): void {
  const resolver = predicate.execution.resolver;

  input.state.hydrationInstructions.push({
    kind: 'hydrate-external-predicate',
    patternIndex: input.patternIndex,
    predicateName: String(predicate.signature.name),
    columns: getPredicateColumns(predicate),
    keyColumns: resolver.keyColumns,
    terms: getPatternTerms(input.pattern),
    hydratedFieldName: resolver.hydratedFieldName,
    resolver,
  });
}
function isExternalPredicateBinding(predicate: PredicateBinding): predicate is ExternalPredicateBinding {
  return predicate.execution?.kind === 'external-resolver';
}
function isSqlPushdownPredicateBinding(
  predicate: ExternalPredicateBinding,
): predicate is SqlPushdownExternalPredicateBinding {
  return predicate.execution.resolver.mode === 'sql_pushdown';
}
function isMaterializeBeforeSqlPredicateBinding(
  predicate: ExternalPredicateBinding,
): predicate is MaterializeBeforeSqlPredicateBinding {
  return predicate.execution.resolver.mode === 'materialize_before_sql';
}
function isPostQueryHydratePredicateBinding(
  predicate: ExternalPredicateBinding,
): predicate is PostQueryHydratePredicateBinding {
  return predicate.execution.resolver.mode === 'post_query_hydrate';
}
function createSqlPushdownPredicateBinding(predicate: SqlPushdownExternalPredicateBinding): StoredPredicateBinding {
  return {
    signature: predicate.signature,
    source: predicate.source,
    storage: assertSqlPushdownStorage(predicate),
    constraints: predicate.constraints,
    indexes: predicate.indexes,
    ...(predicate.statistics === undefined ? {} : { statistics: predicate.statistics }),
    capabilities: predicate.capabilities,
  };
}
function assertSqlPushdownStorage(predicate: ExternalPredicateBinding): StoredPredicateBinding['storage'] {
  if (predicate.storage?.kind === 'postgres-table' || predicate.storage?.kind === 'postgres-view') {
    return predicate.storage;
  }

  throw new GraphTranslationError(
    'UNSUPPORTED_GRAPH_PREDICATE',
    `sql_pushdown external predicate ${String(predicate.signature.name)}/${predicate.signature.arity} requires postgres-table or postgres-view storage.`,
  );
}
function createPatternLookupKey(pattern: SelectFactsOperation['match'][number]): string {
  return createPredicateLookupKey(getPatternPredicateName(pattern), getPatternTerms(pattern).length);
}
function createPredicateLookupKey(predicateName: string, arity: number): string {
  return `${predicateName}/${arity}`;
}
function getPatternPredicateName(pattern: SelectFactsOperation['match'][number]): string {
  if (pattern.kind === 'predicate') {
    return String(pattern.predicate);
  }

  return pattern.kind;
}
function getPatternTerms(pattern: SelectFactsOperation['match'][number]): readonly DatalogTerm[] {
  if (pattern.kind === 'predicate') {
    return pattern.terms;
  }

  if (pattern.kind === 'vertex') {
    return [pattern.id] as const;
  }

  return [pattern.subject, pattern.predicate, pattern.object] as const;
}
