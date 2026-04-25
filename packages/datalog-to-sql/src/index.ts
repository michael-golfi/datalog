export { createPostgresSqlClient } from './runtime/create-postgres-sql-client.js';
export { initializeGraphSchema, startRecursiveClosurePostgresRuntime, waitForPostgres } from './runtime/recursive-closure-postgres-runtime.js';
export { applyDatalogFacts } from './execution/apply-datalog-facts.js';
export { executeTranslatedSql } from './execution/execute-translated-sql.js';
export { executePreparedSelectFacts } from './execution/execute-prepared-select-facts.js';
export { prepareSelectFactsExecution } from './execution/prepare-select-facts-execution.js';
export { DEFAULT_SELECT_FACTS_PREDICATE_CATALOG } from './translation/default-graph-predicate-catalog.js';
export { buildPredicateCatalogFromSchema } from './translation/build-predicate-catalog-from-schema.js';
export { createSelectFactsOperationFromDatalogQuery } from './translation/create-select-facts-operation-from-datalog-query.js';
export { translateCompoundAssertion } from './translation/translate-compound-assertion.js';
export type {
  DeleteFactsOperation,
  InsertCompoundAssertionOperation,
  InsertFactsOperation,
  PostgresGraphOperation,
  SelectFactPattern,
  SelectFactsOperation,
  SelectPredicatePattern,
  SelectRecursiveClosureCountOperation,
  SelectEdgesOperation,
  SelectVertexByIdOperation,
} from './contracts/postgres-graph-operation.js';
export { GraphTranslationError } from './contracts/graph-translation-error.js';
export type { GraphTranslationResult } from './contracts/graph-translation-result.js';
export type { PostgresSqlClient } from './runtime/create-postgres-sql-client.js';
export type { TranslatedSqlQuery } from './contracts/translated-sql-query.js';
export type {
  PreparedSelectFactsExecution,
  PreparedSelectFactsHydrationInstruction,
  PreparedSelectFactsMaterializationStep,
} from './contracts/prepared-select-facts-execution.js';
export type {
  NormalizedAtom,
  NormalizedFact,
  NormalizedFunctionCall,
  NormalizedLiteral,
  NormalizedProgram,
  NormalizedQuery,
  NormalizedRule,
  NormalizedVariable,
  PredicateSignature,
} from './contracts/datalog-program.js';
export type {
  ExternalResolverCapabilitySet,
  ExternalResolverDefinition,
  ExternalResolverDefinitionErrorCode,
  ExternalResolverFailure,
  ExternalResolverHydrateRequest,
  ExternalResolverKey,
  ExternalResolverLookupRequest,
  ExternalResolverMode,
  ExternalResolverRequestContext,
  ExternalResolverResult,
  ExternalResolverRow,
  ExternalResolverRuntimeErrorCode,
  ExternalResolverSuccess,
  HydrateRowsHandler,
  MaterializeBeforeSqlExternalResolverDefinition,
  MaterializeRowsHandler,
  PostQueryHydrateExternalResolverDefinition,
  SqlPushdownExternalResolverDefinition,
} from './contracts/external-resolver-definition.js';
export {
  EXTERNAL_RESOLVER_CAPABILITY_MATRIX,
  ExternalResolverDefinitionError,
  defineExternalResolverDefinition,
} from './contracts/external-resolver-definition.js';
export type {
  BuiltinPredicateBinding,
  ExternalPredicateBinding,
  ExternalPredicateExecutionBinding,
  MemoryRelationBinding,
  PostgresTableBinding,
  PostgresViewBinding,
  PredicateBinding,
  PredicateCapabilities,
  PredicateCatalog,
  PredicateCatalogLookup,
  PredicateConstraint,
  PredicateIndex,
  PredicateStatistics,
  PredicateStorageBinding,
  RelationColumnBinding,
  StoredPredicateBinding,
  WorkTableBinding,
} from './contracts/predicate-catalog.js';
export { getPredicateColumns } from './contracts/predicate-catalog.js';
export type {
  AggregateBinding,
  BooleanExpression,
  ColumnReference,
  ComparisonExpression,
  FunctionExpression,
  JoinCondition,
  LogicalAggregateNode,
  LogicalColumnId,
  LogicalDistinctNode,
  LogicalExpression,
  LogicalFilterNode,
  LogicalJoinNode,
  LogicalLimitNode,
  LogicalMaterializeNode,
  LogicalNodeId,
  LogicalPlan,
  LogicalPlanNode,
  LogicalProjectNode,
  LogicalScanNode,
  LogicalSortNode,
  LogicalUnionNode,
  LogicalValuesNode,
  LogicalWorkRelationScanNode,
  OutputColumn,
  ParameterReference,
  PlanDiagnostic,
  PlanParameter,
  PlanParameterId,
  ProjectionBinding,
  ScalarLiteral,
  SharedSubplan,
  SortKey,
} from './contracts/logical-plan.js';
export type {
  RecursiveDeduplication,
  RecursiveDeltaExpansion,
  RecursiveFixpoint,
  RecursiveRulePlan,
  RecursiveScc,
  RecursiveTermination,
  TransitiveClosureFastPath,
  WorkRelationDefinition,
} from './contracts/recursive-fixpoint.js';
export type {
  BackendKind,
  MemoryBuildIndexStep,
  MemoryEmitResultStep,
  MemoryIterativeFixpointStep,
  MemoryLoadRelationStep,
  MemoryPhysicalPlan,
  PhysicalPlan,
  PhysicalStepId,
  PostgresAnalyzeWorkRelationStep,
  PostgresCreateWorkRelationStep,
  PostgresEmitResultStep,
  PostgresExecuteStatementStep,
  PostgresIterativeFixpointStep,
  PostgresPhysicalPlan,
  PreparedStatementTemplate,
  SqlParameterValue,
} from './contracts/physical-plan.js';
export type {
  CompilerArtifacts,
  DatalogCompiler,
  DatalogCompilerOptions,
} from './contracts/compiler-pipeline.js';
