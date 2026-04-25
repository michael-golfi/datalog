import type { DatalogTypeName } from '@datalog/ast';

import type { PredicateSignature } from './datalog-program.js';
import type { SqlParameterValue } from './physical-plan.js';
import type { RelationColumnBinding } from './predicate-catalog.js';

export type ExternalResolverMode = 'sql_pushdown' | 'materialize_before_sql' | 'post_query_hydrate';
export type ExternalResolverRuntimeErrorCode =
  | 'EXTERNAL_PROVIDER_TIMEOUT'
  | 'EXTERNAL_PROVIDER_FAILURE'
  | 'EXTERNAL_DUPLICATE_KEY'
  | 'EXTERNAL_ROW_SHAPE_MISMATCH';
export type ExternalResolverDefinitionErrorCode =
  | 'EXTERNAL_RESOLVER_INVALID_HANDLER_COMBINATION'
  | 'EXTERNAL_RESOLVER_INVALID_KEY_COLUMNS'
  | 'EXTERNAL_RESOLVER_INVALID_HYDRATED_FIELD_NAME';

export interface ExternalResolverCapabilitySet {
  readonly supportsSqlPushdown: boolean;
  readonly supportsMaterializeBeforeSql: boolean;
  readonly supportsPostQueryHydration: boolean;
}

export const EXTERNAL_RESOLVER_CAPABILITY_MATRIX: Readonly<Record<ExternalResolverMode, ExternalResolverCapabilitySet>> = {
  sql_pushdown: { supportsSqlPushdown: true, supportsMaterializeBeforeSql: false, supportsPostQueryHydration: false },
  materialize_before_sql: { supportsSqlPushdown: false, supportsMaterializeBeforeSql: true, supportsPostQueryHydration: false },
  post_query_hydrate: { supportsSqlPushdown: false, supportsMaterializeBeforeSql: false, supportsPostQueryHydration: true },
};

export interface ExternalResolverKey { readonly valuesByColumn: Readonly<Record<string, SqlParameterValue | null>>; }
export interface ExternalResolverRow { readonly valuesByColumn: Readonly<Record<string, SqlParameterValue | null>>; }
export interface ExternalResolverRequestContext { readonly requestId: string; readonly dedupeScope: 'request'; }
export interface ExternalResolverLookupRequest {
  readonly context: ExternalResolverRequestContext;
  readonly predicate: PredicateSignature;
  readonly columns: readonly RelationColumnBinding[];
  readonly keyColumns: readonly [string, ...string[]];
  readonly keys: readonly ExternalResolverKey[];
}
export interface ExternalResolverHydrateRequest {
  readonly context: ExternalResolverRequestContext;
  readonly predicate: PredicateSignature;
  readonly columns: readonly RelationColumnBinding[];
  readonly keyColumns: readonly [string, ...string[]];
  readonly hydratedFieldName: string;
  readonly rows: readonly ExternalResolverRow[];
}
export interface ExternalResolverSuccess<TPayload> { readonly ok: true; readonly value: TPayload; }
export interface ExternalResolverFailure {
  readonly ok: false;
  readonly error: { readonly code: ExternalResolverRuntimeErrorCode; readonly message: string };
}
export type ExternalResolverResult<TPayload> = ExternalResolverSuccess<TPayload> | ExternalResolverFailure;
export type MaterializeRowsHandler = (
  request: ExternalResolverLookupRequest,
) => Promise<ExternalResolverResult<readonly ExternalResolverRow[]>> | ExternalResolverResult<readonly ExternalResolverRow[]>;
export type HydrateRowsHandler = (
  request: ExternalResolverHydrateRequest,
) => Promise<ExternalResolverResult<readonly ExternalResolverRow[]>> | ExternalResolverResult<readonly ExternalResolverRow[]>;

export interface ExternalResolverDefinitionBase {
  readonly version: 1;
  readonly provider: string;
  readonly mode: ExternalResolverMode;
  readonly keyColumns: readonly [string, ...string[]];
  readonly requestScopedDedupe: 'by-key';
  readonly expectedRowShape: 'values-by-column';
  readonly expectedColumnTypes?: Readonly<Record<string, DatalogTypeName>>;
}

export interface SqlPushdownExternalResolverDefinition extends ExternalResolverDefinitionBase {
  readonly mode: 'sql_pushdown';
  readonly resolveSqlBinding?: undefined;
  readonly materializeRows?: undefined;
  readonly hydrateRows?: undefined;
  readonly hydratedFieldName?: undefined;
}

export interface MaterializeBeforeSqlExternalResolverDefinition extends ExternalResolverDefinitionBase {
  readonly mode: 'materialize_before_sql';
  readonly resolveSqlBinding?: undefined;
  readonly materializeRows: MaterializeRowsHandler;
  readonly hydrateRows?: undefined;
  readonly hydratedFieldName?: undefined;
}

export interface PostQueryHydrateExternalResolverDefinition extends ExternalResolverDefinitionBase {
  readonly mode: 'post_query_hydrate';
  readonly resolveSqlBinding?: undefined;
  readonly materializeRows?: undefined;
  readonly hydrateRows: HydrateRowsHandler;
  readonly hydratedFieldName: string;
}

export interface ExternalResolverDefinitionInput extends ExternalResolverDefinitionBase {
  readonly materializeRows?: MaterializeRowsHandler | undefined;
  readonly hydrateRows?: HydrateRowsHandler | undefined;
  readonly hydratedFieldName?: string | undefined;
}

export type ExternalResolverDefinition =
  | SqlPushdownExternalResolverDefinition
  | MaterializeBeforeSqlExternalResolverDefinition
  | PostQueryHydrateExternalResolverDefinition;

/** Validate one raw external resolver object and return the narrowed v1 contract. */
export class ExternalResolverDefinitionError extends Error {
  constructor(readonly code: ExternalResolverDefinitionErrorCode, message: string) {
    super(message);
    this.name = 'ExternalResolverDefinitionError';
  }
}

/** Validate one raw external resolver object and return the narrowed v1 contract. */
export function defineExternalResolverDefinition(definition: ExternalResolverDefinitionInput): ExternalResolverDefinition {
  assertUniqueKeyColumns(definition.keyColumns);
  if (definition.mode === 'sql_pushdown') {
    return createSqlPushdownDefinition(definition);
  }
  if (definition.mode === 'materialize_before_sql') {
    return createMaterializeBeforeSqlDefinition(definition);
  }
  return createPostQueryHydrateDefinition(definition);
}

/** Reject duplicate key-column declarations so request dedupe stays deterministic. */
function assertUniqueKeyColumns(keyColumns: readonly [string, ...string[]]): void {
  if (new Set(keyColumns).size === keyColumns.length) {
    return;
  }
  throw new ExternalResolverDefinitionError(
    'EXTERNAL_RESOLVER_INVALID_KEY_COLUMNS',
    `External resolver key columns must be unique. Received: ${keyColumns.join(', ')}.`,
  );
}

function createSqlPushdownDefinition(definition: ExternalResolverDefinitionInput): SqlPushdownExternalResolverDefinition {
  assertNoHydratedFieldName(definition.hydratedFieldName);
  if (definition.materializeRows !== undefined || definition.hydrateRows !== undefined) {
    throwInvalidHandlerCombination('sql_pushdown');
  }
  return { ...definition, mode: 'sql_pushdown', resolveSqlBinding: undefined, materializeRows: undefined, hydrateRows: undefined, hydratedFieldName: undefined };
}

function createMaterializeBeforeSqlDefinition(
  definition: ExternalResolverDefinitionInput,
): MaterializeBeforeSqlExternalResolverDefinition {
  assertNoHydratedFieldName(definition.hydratedFieldName);
  if (typeof definition.materializeRows !== 'function') {
    throwInvalidHandlerCombination('materialize_before_sql');
  }
  if (definition.hydrateRows !== undefined) {
    throwInvalidHandlerCombination('materialize_before_sql');
  }
  return { ...definition, mode: 'materialize_before_sql', resolveSqlBinding: undefined, materializeRows: definition.materializeRows, hydrateRows: undefined, hydratedFieldName: undefined };
}

function createPostQueryHydrateDefinition(
  definition: ExternalResolverDefinitionInput,
): PostQueryHydrateExternalResolverDefinition {
  if (definition.hydratedFieldName === undefined || definition.hydratedFieldName.trim().length === 0) {
    throw new ExternalResolverDefinitionError(
      'EXTERNAL_RESOLVER_INVALID_HYDRATED_FIELD_NAME',
      'post_query_hydrate resolvers must declare a non-empty hydratedFieldName.',
    );
  }
  if (typeof definition.hydrateRows !== 'function') {
    throwInvalidHandlerCombination('post_query_hydrate');
  }
  if (definition.materializeRows !== undefined) {
    throwInvalidHandlerCombination('post_query_hydrate');
  }
  return { ...definition, mode: 'post_query_hydrate', resolveSqlBinding: undefined, materializeRows: undefined, hydrateRows: definition.hydrateRows, hydratedFieldName: definition.hydratedFieldName };
}

function assertNoHydratedFieldName(hydratedFieldName: string | undefined): void {
  if (hydratedFieldName === undefined) {
    return;
  }
  throw new ExternalResolverDefinitionError(
    'EXTERNAL_RESOLVER_INVALID_HYDRATED_FIELD_NAME',
    'Only post_query_hydrate resolvers may declare hydratedFieldName.',
  );
}

function throwInvalidHandlerCombination(mode: ExternalResolverMode): never {
  const messages: Readonly<Record<ExternalResolverMode, string>> = {
    sql_pushdown: 'sql_pushdown resolvers must define no provider handlers.',
    materialize_before_sql: 'materialize_before_sql resolvers must define materializeRows and no other resolver handlers.',
    post_query_hydrate: 'post_query_hydrate resolvers must define hydrateRows and no other resolver handlers.',
  };
  throw new ExternalResolverDefinitionError('EXTERNAL_RESOLVER_INVALID_HANDLER_COMBINATION', messages[mode]);
}
