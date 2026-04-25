import type { PostgresSqlClient } from '../runtime/create-postgres-sql-client.js';
import { executeTranslatedSql } from './execute-translated-sql.js';
import type { DatalogFact } from '@datalog/ast';
import { splitDatalogFactBatches } from './split-datalog-fact-batches.js';
import { translateFactDelete } from '../translation/translate-fact-delete.js';
import { translateFactInsert } from '../translation/translate-fact-insert.js';

/** Apply a non-empty batch of Datalog facts through the generic SQL translation surface. */
export async function applyDatalogFacts(input: {
  readonly sql: PostgresSqlClient;
  readonly mode: 'insert-facts' | 'delete-facts';
  readonly facts: readonly [DatalogFact, ...DatalogFact[]];
}): Promise<void> {
  for (const batch of splitDatalogFactBatches(input.facts)) {
    const translation = input.mode === 'insert-facts'
      ? translateFactInsert({ kind: input.mode, facts: batch })
      : translateFactDelete({ kind: input.mode, facts: batch });

    await executeTranslatedSql(input.sql, translation);
  }
}
