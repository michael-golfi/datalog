import type { DatalogTerm } from '@datalog/ast';

import type { LogicalPlan } from './logical-plan.js';
import type {
  MaterializeBeforeSqlExternalResolverDefinition,
  PostQueryHydrateExternalResolverDefinition,
} from './external-resolver-definition.js';
import type { RelationColumnBinding } from './predicate-catalog.js';
import type { TranslatedSqlQuery } from './translated-sql-query.js';

export interface PreparedSelectFactsMaterializationStep {
  readonly kind: 'materialize-external-predicate';
  readonly patternIndex: number;
  readonly predicateName: string;
  readonly relationName: string;
  readonly columns: readonly RelationColumnBinding[];
  readonly keyColumns: readonly [string, ...string[]];
  readonly terms: readonly DatalogTerm[];
  readonly resolver: MaterializeBeforeSqlExternalResolverDefinition;
}

export interface PreparedSelectFactsHydrationInstruction {
  readonly kind: 'hydrate-external-predicate';
  readonly patternIndex: number;
  readonly predicateName: string;
  readonly columns: readonly RelationColumnBinding[];
  readonly keyColumns: readonly [string, ...string[]];
  readonly projectedKeyBindings: readonly [
    PreparedSelectFactsProjectedHydrationKeyBinding,
    ...PreparedSelectFactsProjectedHydrationKeyBinding[],
  ];
  readonly terms: readonly DatalogTerm[];
  readonly hydratedFieldName: string;
  readonly resolver: PostQueryHydrateExternalResolverDefinition;
}

export interface PreparedSelectFactsProjectedHydrationKeyBinding {
  readonly keyColumn: string;
  readonly outputFieldName: string;
}

export interface PreparedSelectFactsExecution {
  readonly kind: 'prepared-select-facts-execution';
  readonly logicalPlan: LogicalPlan;
  readonly materializationSteps: readonly PreparedSelectFactsMaterializationStep[];
  readonly finalSqlQuery: TranslatedSqlQuery;
  readonly hydrationInstructions?: readonly PreparedSelectFactsHydrationInstruction[];
}
