import { createPostgresGraphTranslator } from '../runtime/create-postgres-graph-translator.js';
import type { PostgresSqlClient } from '../runtime/create-postgres-sql-client.js';
import { executeTranslatedSql } from './execute-translated-sql.js';
import type { DatalogFact } from '@datalog/ast';
import { splitDatalogFactBatches } from './split-datalog-fact-batches.js';

/** Apply a non-empty batch of Datalog facts through the generic SQL translation surface. */
export async function applyDatalogFacts(input: {
  readonly sql: PostgresSqlClient;
  readonly mode: 'insert-facts' | 'delete-facts';
  readonly facts: readonly [DatalogFact, ...DatalogFact[]];
}): Promise<void> {
  const translator = createPostgresGraphTranslator();

  for (const batch of splitDatalogFactBatches(input.facts)) {
    const translation = translator.translate({
      kind: input.mode,
      facts: batch,
    });

    if (!translation.ok) {
      throw translation.error;
    }

    await executeTranslatedSql(input.sql, translation.value);
  }
}
