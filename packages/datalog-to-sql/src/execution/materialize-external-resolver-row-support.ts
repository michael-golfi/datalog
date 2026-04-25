import { GraphTranslationError } from '../contracts/graph-translation-error.js';

import type { ExternalResolverKey, ExternalResolverRow } from '../contracts/external-resolver-definition.js';
import type { SqlParameterValue } from '../contracts/physical-plan.js';
import type { PreparedSelectFactsMaterializationStep } from '../contracts/prepared-select-facts-execution.js';

type BindingValue = SqlParameterValue | null;

/** Validate materialized provider rows against requested keys and row-shape rules. */
export function assertMaterializedResolverRows(input: {
  readonly step: PreparedSelectFactsMaterializationStep;
  readonly requestedKeys: readonly ExternalResolverKey[];
  readonly rows: readonly ExternalResolverRow[];
}): void {
  const requestedKeyTuples = new Set(
    input.requestedKeys.map((key) => serializeExternalResolverKey(input.step.keyColumns, key)),
  );
  const seenProviderKeys = new Set<string>();
  const expectedColumnNames = new Set(input.step.columns.map((column) => column.name));

  for (const row of input.rows) {
    assertRowShape({ step: input.step, row, expectedColumnNames });

    const serializedKey = serializeExternalResolverKey(
      input.step.keyColumns,
      createMaterializedRowKey(input.step, row),
    );

    if (!requestedKeyTuples.has(serializedKey)) {
      throw new GraphTranslationError(
        'EXTERNAL_PROVIDER_FAILURE',
        `Materialized external predicate ${input.step.predicateName}/${input.step.terms.length} returned an unexpected key tuple.`,
      );
    }

    if (seenProviderKeys.has(serializedKey)) {
      throw new GraphTranslationError(
        'EXTERNAL_DUPLICATE_KEY',
        `Materialized external predicate ${input.step.predicateName}/${input.step.terms.length} returned duplicate provider rows for key columns ${input.step.keyColumns.join(', ')}.`,
      );
    }

    seenProviderKeys.add(serializedKey);
  }
}

/** Extract the configured key tuple from one materialized provider row. */
export function createMaterializedRowKey(
  step: PreparedSelectFactsMaterializationStep,
  row: ExternalResolverRow,
): ExternalResolverKey {
  const valuesByColumn: Readonly<Record<string, BindingValue>> = Object.fromEntries(
    step.keyColumns.map((keyColumn) => {
      if (Object.hasOwn(row.valuesByColumn, keyColumn)) {
        return [keyColumn, row.valuesByColumn[keyColumn] ?? null] as const;
      }

      throwRowShapeMismatch(step, `row is missing key column ${keyColumn}`);
    }),
  );

  return { valuesByColumn };
}

/** Serialize a resolver key tuple in declared key-column order. */
export function serializeExternalResolverKey(
  keyColumns: readonly [string, ...string[]],
  key: Pick<ExternalResolverKey, 'valuesByColumn'>,
): string {
  return JSON.stringify(keyColumns.map((columnName) => key.valuesByColumn[columnName] ?? null));
}

function assertRowShape(input: {
  readonly step: PreparedSelectFactsMaterializationStep;
  readonly row: ExternalResolverRow;
  readonly expectedColumnNames: ReadonlySet<string>;
}): void {
  const rowColumnNames = Object.keys(input.row.valuesByColumn);

  if (rowColumnNames.length !== input.expectedColumnNames.size) {
    throwRowShapeMismatch(
      input.step,
      `expected ${input.expectedColumnNames.size} columns but received ${rowColumnNames.length}`,
    );
  }

  assertKnownRowColumns(input.step, rowColumnNames, input.expectedColumnNames);
  assertExpectedColumnsPresent(input.step, input.row, input.expectedColumnNames);
}

function assertKnownRowColumns(
  step: PreparedSelectFactsMaterializationStep,
  rowColumnNames: readonly string[],
  expectedColumnNames: ReadonlySet<string>,
): void {
  for (const columnName of rowColumnNames) {
    if (expectedColumnNames.has(columnName)) {
      continue;
    }

    throwRowShapeMismatch(step, `received unexpected column ${columnName}`);
  }
}

function assertExpectedColumnsPresent(
  step: PreparedSelectFactsMaterializationStep,
  row: ExternalResolverRow,
  expectedColumnNames: ReadonlySet<string>,
): void {
  for (const columnName of expectedColumnNames) {
    if (Object.hasOwn(row.valuesByColumn, columnName)) {
      continue;
    }

    throwRowShapeMismatch(step, `row is missing column ${columnName}`);
  }
}

function throwRowShapeMismatch(step: PreparedSelectFactsMaterializationStep, detail: string): never {
  throw new GraphTranslationError(
    'EXTERNAL_ROW_SHAPE_MISMATCH',
    `Materialized external predicate ${step.predicateName}/${step.terms.length} returned a row-shape mismatch: ${detail}.`,
  );
}
