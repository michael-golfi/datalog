import type { DatalogScalarValue, DatalogTerm } from '@datalog/ast';

import {
  assertMaterializedResolverRows,
  serializeExternalResolverKey,
} from './materialize-external-resolver-row-support.js';
import { GraphTranslationError } from '../contracts/graph-translation-error.js';

import type { PredicateSignature } from '../contracts/datalog-program.js';
import type {
  ExternalResolverKey,
  ExternalResolverLookupRequest,
  ExternalResolverResult,
  ExternalResolverRow,
} from '../contracts/external-resolver-definition.js';
import type { SqlParameterValue } from '../contracts/physical-plan.js';
import type { PreparedSelectFactsMaterializationStep } from '../contracts/prepared-select-facts-execution.js';

type BindingValue = SqlParameterValue | null;
type BindingContext = ReadonlyMap<string, BindingValue>;

export interface MaterializedExternalResolverRelation {
  readonly step: PreparedSelectFactsMaterializationStep;
  readonly request: ExternalResolverLookupRequest;
  readonly rows: readonly ExternalResolverRow[];
}

export interface MaterializeExternalResolverRelationsInput {
  readonly materializationSteps: readonly PreparedSelectFactsMaterializationStep[];
  readonly loadMaterializedRows?: (
    step: PreparedSelectFactsMaterializationStep,
    request: ExternalResolverLookupRequest,
  ) => Promise<ExternalResolverResult<readonly ExternalResolverRow[]>> | ExternalResolverResult<readonly ExternalResolverRow[]>;
}

/** Materialize external resolver work relations in pattern order with request-scoped key dedupe. */
export async function materializeExternalResolverRelations(
  input: MaterializeExternalResolverRelationsInput,
): Promise<readonly MaterializedExternalResolverRelation[]> {
  const relations: MaterializedExternalResolverRelation[] = [];
  let bindingContexts: readonly BindingContext[] = [new Map()];

  for (const step of input.materializationSteps) {
    const request = createLookupRequest(step, bindingContexts);
    const rows = await loadRows({ step, request, loadMaterializedRows: input.loadMaterializedRows });

    assertNonEmptyRows(step, request, rows);
    assertMaterializedResolverRows({ step, requestedKeys: request.keys, rows });

    relations.push({ step, request, rows });
    bindingContexts = extendBindingContexts(bindingContexts, step, rows);
  }

  return relations;
}

async function loadRows(input: {
  readonly step: PreparedSelectFactsMaterializationStep;
  readonly request: ExternalResolverLookupRequest;
  readonly loadMaterializedRows: MaterializeExternalResolverRelationsInput['loadMaterializedRows'];
}): Promise<readonly ExternalResolverRow[]> {
  const result = input.loadMaterializedRows !== undefined
    ? await input.loadMaterializedRows(input.step, input.request)
    : await input.step.resolver.materializeRows(input.request);

  if (result.ok) {
    return result.value;
  }

  throw new GraphTranslationError(result.error.code, result.error.message);
}

function createLookupRequest(
  step: PreparedSelectFactsMaterializationStep,
  bindingContexts: readonly BindingContext[],
): ExternalResolverLookupRequest {
  const keysByTuple = new Map<string, ExternalResolverKey>();

  for (const bindingContext of bindingContexts) {
    const key = createLookupKey(step, bindingContext);
    keysByTuple.set(serializeExternalResolverKey(step.keyColumns, key), key);
  }

  return {
    context: {
      requestId: 'prepared-select-facts',
      dedupeScope: 'request',
    },
    predicate: createPredicateSignature(step),
    columns: step.columns,
    keyColumns: step.keyColumns,
    keys: Array.from(keysByTuple.values()),
  };
}

function createPredicateSignature(step: PreparedSelectFactsMaterializationStep): PredicateSignature {
  return {
    name: step.predicateName,
    arity: step.terms.length,
    kind: 'edb',
    outputTypes: step.columns
      .slice()
      .sort((left, right) => left.ordinal - right.ordinal)
      .map((column) => column.type),
  };
}

function createLookupKey(step: PreparedSelectFactsMaterializationStep, bindingContext: BindingContext): ExternalResolverKey {
  const valuesByColumn: Readonly<Record<string, BindingValue>> = Object.fromEntries(
    step.keyColumns.map((keyColumn) => [keyColumn, resolveKeyColumnValue(step, keyColumn, bindingContext)]),
  );

  return { valuesByColumn };
}

function resolveKeyColumnValue(
  step: PreparedSelectFactsMaterializationStep,
  keyColumn: string,
  bindingContext: BindingContext,
): BindingValue {
  const column = step.columns.find((candidate) => candidate.name === keyColumn);
  if (column === undefined) {
    throw new GraphTranslationError(
      'EXTERNAL_SELECT_FACTS_INVALID_KEY_COLUMN',
      `Materialized external predicate ${step.predicateName}/${step.terms.length} declares unknown key column ${keyColumn}.`,
    );
  }

  const term = step.terms[column.ordinal];
  if (term === undefined || term.kind === 'wildcard') {
    throwUnboundMaterializationKey(step, keyColumn);
  }

  if (term.kind === 'constant') {
    return normalizeScalarValue(term.value);
  }

  if (bindingContext.has(term.name)) {
    return bindingContext.get(term.name) ?? null;
  }

  throwUnboundMaterializationKey(step, keyColumn);
}

function assertNonEmptyRows(
  step: PreparedSelectFactsMaterializationStep,
  request: ExternalResolverLookupRequest,
  rows: readonly ExternalResolverRow[],
): void {
  if (request.keys.length === 0 || rows.length > 0) {
    return;
  }

  throw new GraphTranslationError(
    'EXTERNAL_PROVIDER_FAILURE',
    `Materialized external predicate ${step.predicateName}/${step.terms.length} returned no rows for ${request.keys.length} bound key tuple(s).`,
  );
}

function extendBindingContexts(
  bindingContexts: readonly BindingContext[],
  step: PreparedSelectFactsMaterializationStep,
  rows: readonly ExternalResolverRow[],
): readonly BindingContext[] {
  const nextContexts: BindingContext[] = [];

  for (const bindingContext of bindingContexts) {
    for (const row of rows) {
      appendMergedContext(nextContexts, mergeBindingContext({
        bindingContext,
        terms: step.terms,
        valuesByColumn: row.valuesByColumn,
        columns: step.columns,
      }));
    }
  }

  return nextContexts;
}

function mergeBindingContext(input: {
  readonly bindingContext: BindingContext;
  readonly terms: readonly DatalogTerm[];
  readonly valuesByColumn: Readonly<Record<string, BindingValue>>;
  readonly columns: PreparedSelectFactsMaterializationStep['columns'];
}): BindingContext | undefined {
  const merged = new Map(input.bindingContext);

  for (const column of input.columns) {
    const term = input.terms[column.ordinal];
    if (term === undefined) {
      continue;
    }

    const rowValue = input.valuesByColumn[column.name] ?? null;
    if (!isTermCompatible(term, rowValue, merged)) {
      return undefined;
    }
  }

  return merged;
}

function appendMergedContext(nextContexts: BindingContext[], mergedContext: BindingContext | undefined): void {
  if (mergedContext !== undefined) {
    nextContexts.push(mergedContext);
  }
}

function isTermCompatible(term: DatalogTerm, rowValue: BindingValue, bindings: Map<string, BindingValue>): boolean {
  if (term.kind === 'wildcard') {
    return true;
  }

  if (term.kind === 'constant') {
    return normalizeScalarValue(term.value) === rowValue;
  }

  if (!bindings.has(term.name)) {
    bindings.set(term.name, rowValue);
    return true;
  }

  return bindings.get(term.name) === rowValue;
}

function normalizeScalarValue(value: DatalogScalarValue | undefined): BindingValue {
  return value ?? null;
}

function throwUnboundMaterializationKey(step: PreparedSelectFactsMaterializationStep, keyColumn: string): never {
  throw new GraphTranslationError(
    'EXTERNAL_SELECT_FACTS_UNBOUND_MATERIALIZATION_KEY',
    `Materialized external predicate ${step.predicateName}/${step.terms.length} requires key column ${keyColumn} to be bound before provider execution.`,
  );
}
