import { GraphTranslationError } from '../contracts/graph-translation-error.js';
import type {
  ExternalResolverHydrateRequest,
  ExternalResolverResult,
  ExternalResolverRow,
} from '../contracts/external-resolver-definition.js';
import type { PredicateSignature } from '../contracts/datalog-program.js';
import type { SqlParameterValue } from '../contracts/physical-plan.js';
import type { PreparedSelectFactsHydrationInstruction } from '../contracts/prepared-select-facts-execution.js';

type HydrationKeyValue = SqlParameterValue | null;

export interface HydrateExternalSelectFactsRowsInput<Row extends Record<string, unknown>> {
  readonly instruction: PreparedSelectFactsHydrationInstruction;
  readonly rows: readonly Row[];
  readonly loadHydratedRows?: (
    instruction: PreparedSelectFactsHydrationInstruction,
    request: ExternalResolverHydrateRequest,
  ) => Promise<ExternalResolverResult<readonly ExternalResolverRow[]>> | ExternalResolverResult<readonly ExternalResolverRow[]>;
}

/** Hydrate final select-facts rows after SQL execution without changing row count or ordering. */
export async function hydrateExternalSelectFactsRows<Row extends Record<string, unknown>>(
  input: HydrateExternalSelectFactsRowsInput<Row>,
): Promise<readonly Row[]> {
  if (input.rows.length === 0) { return input.rows; }

  const request = createHydrationRequest(input.instruction, input.rows);
  const hydratedRows = await loadHydratedRows({
    instruction: input.instruction,
    request,
    loadHydratedRows: input.loadHydratedRows,
  });
  const payloadByKey = createPayloadByKey({
    instruction: input.instruction,
    requestedKeyRows: request.rows,
    hydratedRows,
  });

  return input.rows.map((row) => {
    const serializedKey = serializeKey(
      input.instruction.keyColumns,
      createProjectedKeyRow(input.instruction, row),
    );
    const payload = payloadByKey.get(serializedKey);

    if (payload === undefined) {
      throw new GraphTranslationError(
        'EXTERNAL_PROVIDER_FAILURE',
        `Hydrated external predicate ${input.instruction.predicateName}/${input.instruction.terms.length} returned no payload for a requested key tuple.`,
      );
    }

    return { ...row, [input.instruction.hydratedFieldName]: payload };
  });
}

async function loadHydratedRows(input: {
  readonly instruction: PreparedSelectFactsHydrationInstruction;
  readonly request: ExternalResolverHydrateRequest;
  readonly loadHydratedRows: HydrateExternalSelectFactsRowsInput<Record<string, unknown>>['loadHydratedRows'];
}): Promise<readonly ExternalResolverRow[]> {
  const result = input.loadHydratedRows !== undefined
    ? await input.loadHydratedRows(input.instruction, input.request)
    : await input.instruction.resolver.hydrateRows(input.request);

  if (result.ok) {
    return result.value;
  }
  throw new GraphTranslationError(result.error.code, result.error.message);
}

function createHydrationRequest<Row extends Record<string, unknown>>(
  instruction: PreparedSelectFactsHydrationInstruction,
  rows: readonly Row[],
): ExternalResolverHydrateRequest {
  const keyRowsByTuple = new Map<string, ExternalResolverRow>();

  for (const row of rows) {
    const keyRow = createProjectedKeyRow(instruction, row);
    keyRowsByTuple.set(serializeKey(instruction.keyColumns, keyRow), keyRow);
  }

  return {
    context: {
      requestId: 'prepared-select-facts',
      dedupeScope: 'request',
    },
    predicate: createPredicateSignature(instruction),
    columns: instruction.columns,
    keyColumns: instruction.keyColumns,
    hydratedFieldName: instruction.hydratedFieldName,
    rows: Array.from(keyRowsByTuple.values()),
  };
}

function createPredicateSignature(instruction: PreparedSelectFactsHydrationInstruction): PredicateSignature {
  return {
    name: instruction.predicateName,
    arity: instruction.terms.length,
    kind: 'edb',
    outputTypes: instruction.columns
      .slice()
      .sort((left, right) => left.ordinal - right.ordinal)
      .map((column) => column.type),
  };
}

function createProjectedKeyRow<Row extends Record<string, unknown>>(
  instruction: PreparedSelectFactsHydrationInstruction,
  row: Row,
): ExternalResolverRow {
  const valuesByColumn = Object.fromEntries(
    instruction.projectedKeyBindings.map((binding) => {
      if (Object.hasOwn(row, binding.outputFieldName)) {
        return [binding.keyColumn, normalizeHydrationValue(row[binding.outputFieldName])];
      }

      throw new GraphTranslationError(
        'EXTERNAL_ROW_SHAPE_MISMATCH',
        `Hydrated external predicate ${instruction.predicateName}/${instruction.terms.length} expected projected output column ${binding.outputFieldName} in the final SQL result row.`,
      );
    }),
  );

  return { valuesByColumn };
}

function createPayloadByKey(input: {
  readonly instruction: PreparedSelectFactsHydrationInstruction;
  readonly requestedKeyRows: readonly ExternalResolverRow[];
  readonly hydratedRows: readonly ExternalResolverRow[];
}): ReadonlyMap<string, unknown> {
  const payloadByKey = new Map<string, unknown>();
  const requestedKeys = new Set(input.requestedKeyRows.map((row) => serializeKey(input.instruction.keyColumns, row)));

  for (const row of input.hydratedRows) {
    assertHydratedRowShape(input.instruction, row);

    const serializedKey = serializeKey(input.instruction.keyColumns, createHydratedRowKey(input.instruction, row));
    if (!requestedKeys.has(serializedKey)) {
      throw new GraphTranslationError(
        'EXTERNAL_PROVIDER_FAILURE',
        `Hydrated external predicate ${input.instruction.predicateName}/${input.instruction.terms.length} returned an unexpected key tuple.`,
      );
    }

    if (payloadByKey.has(serializedKey)) {
      throw new GraphTranslationError(
        'EXTERNAL_DUPLICATE_KEY',
        `Hydrated external predicate ${input.instruction.predicateName}/${input.instruction.terms.length} returned duplicate provider rows for key columns ${input.instruction.keyColumns.join(', ')}.`,
      );
    }

    payloadByKey.set(serializedKey, createHydratedPayload(input.instruction, row));
  }

  for (const requestedKeyRow of input.requestedKeyRows) {
    const serializedKey = serializeKey(input.instruction.keyColumns, requestedKeyRow);
    if (!payloadByKey.has(serializedKey)) {
      throw new GraphTranslationError(
        'EXTERNAL_PROVIDER_FAILURE',
        `Hydrated external predicate ${input.instruction.predicateName}/${input.instruction.terms.length} returned no payload for a requested key tuple.`,
      );
    }
  }

  return payloadByKey;
}

function assertHydratedRowShape(
  instruction: PreparedSelectFactsHydrationInstruction,
  row: ExternalResolverRow,
): void {
  const expectedColumnNames = new Set(instruction.columns.map((column) => column.name));
  const rowColumnNames = Object.keys(row.valuesByColumn);

  if (rowColumnNames.length !== expectedColumnNames.size) {
    throwRowShapeMismatch(
      instruction,
      `expected ${expectedColumnNames.size} columns but received ${rowColumnNames.length}`,
    );
  }

  for (const columnName of rowColumnNames) {
    if (!expectedColumnNames.has(columnName)) {
      throwRowShapeMismatch(instruction, `received unexpected column ${columnName}`);
    }
  }

  for (const column of instruction.columns) {
    if (!Object.hasOwn(row.valuesByColumn, column.name)) {
      throwRowShapeMismatch(instruction, `row is missing column ${column.name}`);
    }
  }
}

function createHydratedRowKey(
  instruction: PreparedSelectFactsHydrationInstruction,
  row: ExternalResolverRow,
): ExternalResolverRow {
  const valuesByColumn = Object.fromEntries(
    instruction.keyColumns.map((keyColumn) => {
      if (Object.hasOwn(row.valuesByColumn, keyColumn)) {
        return [keyColumn, row.valuesByColumn[keyColumn] ?? null] as const;
      }

      throwRowShapeMismatch(instruction, `row is missing key column ${keyColumn}`);
    }),
  );

  return { valuesByColumn };
}

function createHydratedPayload(
  instruction: PreparedSelectFactsHydrationInstruction,
  row: ExternalResolverRow,
): unknown {
  const payloadColumns = instruction.columns.filter((column) => !instruction.keyColumns.includes(column.name));
  if (payloadColumns.length === 0) { throwRowShapeMismatch(instruction, 'expected at least one non-key payload column'); }
  if (payloadColumns.length === 1) {
    return row.valuesByColumn[payloadColumns[0]!.name] ?? null;
  }
  return Object.fromEntries(
    payloadColumns.map((column) => [column.name, row.valuesByColumn[column.name] ?? null]),
  );
}

function normalizeHydrationValue(value: unknown): HydrationKeyValue {
  if (value === undefined) {
    return null;
  }
  return value as SqlParameterValue;
}

function serializeKey(
  keyColumns: readonly [string, ...string[]],
  row: Pick<ExternalResolverRow, 'valuesByColumn'>,
): string {
  return JSON.stringify(keyColumns.map((columnName) => row.valuesByColumn[columnName] ?? null));
}

function throwRowShapeMismatch(
  instruction: PreparedSelectFactsHydrationInstruction,
  detail: string,
): never {
  throw new GraphTranslationError(
    'EXTERNAL_ROW_SHAPE_MISMATCH',
    `Hydrated external predicate ${instruction.predicateName}/${instruction.terms.length} returned a row-shape mismatch: ${detail}.`,
  );
}
