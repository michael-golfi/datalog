import { GraphTranslationError } from '../contracts/graph-translation-error.js';

import type {
  PreparedSelectFactsHydrationInstruction,
  PreparedSelectFactsProjectedHydrationKeyBinding,
} from '../contracts/prepared-select-facts-execution.js';

export interface PendingPreparedSelectFactsHydrationInstruction
  extends Omit<PreparedSelectFactsHydrationInstruction, 'projectedKeyBindings'> {}

/** Link pending hydration instructions to projected output-column names. */
export function linkHydrationInstructions(input: {
  readonly hydrationInstructions: readonly PendingPreparedSelectFactsHydrationInstruction[];
  readonly outputColumnNames: ReadonlySet<string>;
}): readonly PreparedSelectFactsHydrationInstruction[] {
  return input.hydrationInstructions.map((instruction) => ({
    ...instruction,
    projectedKeyBindings: instruction.keyColumns.map((keyColumn) => ({
      keyColumn,
      outputFieldName: resolveHydrationOutputFieldName({
        instruction,
        keyColumn,
        outputColumnNames: input.outputColumnNames,
      }),
    })) as unknown as readonly [
      PreparedSelectFactsProjectedHydrationKeyBinding,
      ...PreparedSelectFactsProjectedHydrationKeyBinding[],
    ],
  }));
}

function resolveHydrationOutputFieldName(input: {
  readonly instruction: PendingPreparedSelectFactsHydrationInstruction;
  readonly keyColumn: string;
  readonly outputColumnNames: ReadonlySet<string>;
}): string {
  const column = input.instruction.columns.find((candidate) => candidate.name === input.keyColumn);
  if (column === undefined) {
    throw new GraphTranslationError(
      'EXTERNAL_SELECT_FACTS_INVALID_KEY_COLUMN',
      `External predicate ${input.instruction.predicateName}/${input.instruction.terms.length} declares unknown key column ${input.keyColumn}.`,
    );
  }

  const term = input.instruction.terms[column.ordinal];
  if (term?.kind === 'variable' && input.outputColumnNames.has(term.name)) {
    return term.name;
  }

  throw new GraphTranslationError(
    'EXTERNAL_SELECT_FACTS_UNPROJECTED_HYDRATION_KEY',
    `Hydrated external predicate ${input.instruction.predicateName}/${input.instruction.terms.length} at match index ${input.instruction.patternIndex + 1} requires key column ${input.keyColumn} to be projected in the final result set.`,
  );
}
