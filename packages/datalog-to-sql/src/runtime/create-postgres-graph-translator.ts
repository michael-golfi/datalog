import { POSTGRES_GRAPH_TARGET } from '../contracts/postgres-graph-target.js';
import { translateGraphOperation } from '../translation/translate-graph-operation.js';

import type { PostgresGraphTranslator } from '../contracts/postgres-graph-translator.js';

/** Create the generic PostgreSQL graph translator for vertices and edges tables. */
export function createPostgresGraphTranslator(): PostgresGraphTranslator {
  return {
    target: POSTGRES_GRAPH_TARGET,
    translate: translateGraphOperation,
  };
}
