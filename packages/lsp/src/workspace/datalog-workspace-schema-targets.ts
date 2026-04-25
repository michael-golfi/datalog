import type { DatalogSchema, DefCompoundSchema, DefPredSchema } from '@datalog/ast';
import type { Range } from '@datalog/parser';

interface DatalogWorkspaceSchemaTarget<TSchema extends DatalogSchema> {
  readonly uri: string;
  readonly schema: TSchema;
  readonly range: Range;
}

export type DatalogWorkspacePredicateSchemaTarget = DatalogWorkspaceSchemaTarget<DefPredSchema>;

export type DatalogWorkspaceCompoundSchemaTarget = DatalogWorkspaceSchemaTarget<DefCompoundSchema>;
