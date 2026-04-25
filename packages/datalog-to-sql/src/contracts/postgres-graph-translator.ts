import type { GraphTranslationResult } from './graph-translation-result.js';
import type { PostgresGraphOperation } from './postgres-graph-operation.js';
import type { PostgresGraphTarget } from './postgres-graph-target.js';

export interface PostgresGraphTranslator {
  readonly target: PostgresGraphTarget;
  translate(operation: PostgresGraphOperation): GraphTranslationResult;
}
