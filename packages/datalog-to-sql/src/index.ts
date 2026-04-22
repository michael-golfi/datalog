export { createPostgresGraphTranslator } from './runtime/create-postgres-graph-translator.js';
export { createPostgresSqlClient } from './runtime/create-postgres-sql-client.js';
export { initializeGraphSchema, startRecursiveClosurePostgresRuntime, waitForPostgres } from './runtime/recursive-closure-postgres-runtime.js';
export { applyDatalogFacts } from './execution/apply-datalog-facts.js';
export { executeTranslatedSql } from './execution/execute-translated-sql.js';
export { translateGraphOperation } from './translation/translate-graph-operation.js';
export type {
  DatalogConstantTerm,
  DatalogFact,
  DatalogFactPattern,
  DatalogTerm,
  DatalogVariableTerm,
  DeleteFactsOperation,
  EdgeFact,
  EdgeFactPattern,
  InsertFactsOperation,
  PostgresGraphOperation,
  SelectFactsOperation,
  SelectRecursiveClosureCountOperation,
  SelectEdgesOperation,
  SelectVertexByIdOperation,
  VertexFact,
  VertexFactPattern,
} from './contracts/postgres-graph-operation.js';
export { GraphTranslationError } from './contracts/graph-translation-error.js';
export type { GraphTranslationResult } from './contracts/graph-translation-result.js';
export type { PostgresGraphTarget } from './contracts/postgres-graph-target.js';
export type { PostgresGraphTranslator } from './contracts/postgres-graph-translator.js';
export type { PostgresSqlClient } from './runtime/create-postgres-sql-client.js';
export type { TranslatedSqlQuery } from './contracts/translated-sql-query.js';
