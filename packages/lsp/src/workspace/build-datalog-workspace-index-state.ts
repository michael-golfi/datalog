import type { DefCompoundFieldSchema } from '@datalog/ast';
import type { loadDatalogMigrationProjectFiles } from '@datalog/datalog-migrate/load-datalog-migration-project-files';
import type { DatalogPredicateSymbolIdentity, ParsedDatalogProgramSources } from '@datalog/parser';

import {
  buildNodeSummaryTargets,
  buildGraphPredicateIds,
  buildGraphNodeIds,
  buildPredicateDefinitions,
  buildWorkspacePredicateIdentities,
} from './datalog-workspace-index-builders.js';
import { buildDatalogWorkspaceProgram } from './datalog-workspace-program.js';
import {
  buildCompoundFieldNames,
  buildCompoundFieldSchemas,
  buildCompoundSchemaTargets,
  buildPredicateSchemaTargets,
} from './datalog-workspace-schema-index-builders.js';

import type {
  DatalogWorkspaceNodeSummaryTarget,
  DatalogWorkspacePredicateDefinition,
} from './datalog-workspace-index.js';
import type {
  DatalogWorkspaceCompoundSchemaTarget,
  DatalogWorkspacePredicateSchemaTarget,
} from './datalog-workspace-schema-targets.js';
import type { DatalogWorkspaceDocument } from './load-datalog-workspace-documents.js';

export interface DatalogWorkspaceIndexState {
  readonly indexedDocumentsByUri: Map<string, DatalogWorkspaceDocument>;
  readonly workspaceProgram: ParsedDatalogProgramSources | null;
  readonly predicateDefinitionsByIdentity: Map<
    string,
    readonly DatalogWorkspacePredicateDefinition[]
  >;
  readonly workspacePredicateIdentities: Map<string, DatalogPredicateSymbolIdentity>;
  readonly graphPredicateIds: readonly string[];
  readonly predicateSchemaTargetsById: Map<
    string,
    readonly DatalogWorkspacePredicateSchemaTarget[]
  >;
  readonly compoundSchemaTargetsByName: Map<
    string,
    readonly DatalogWorkspaceCompoundSchemaTarget[]
  >;
  readonly nodeSummaryTargetsById: Map<string, readonly DatalogWorkspaceNodeSummaryTarget[]>;
  readonly graphNodeIds: readonly string[];
  readonly compoundFieldSchemasByPredicate: Map<string, readonly DefCompoundFieldSchema[]>;
  readonly compoundFieldNamesByPredicate: Map<string, readonly string[]>;
}

/** Build all parser-derived workspace indexes from the current document set. */
export function buildDatalogWorkspaceIndexState(options: {
  readonly documents: readonly DatalogWorkspaceDocument[];
  readonly workspaceRootPath: string | null;
  readonly loadMigrationProjectFiles: typeof loadDatalogMigrationProjectFiles;
}): DatalogWorkspaceIndexState {
  const indexedDocumentsByUri = new Map(
    options.documents.map((document) => [document.uri, document] as const),
  );
  const predicateDefinitionsByIdentity = buildPredicateDefinitions(options.documents);

  return {
    indexedDocumentsByUri,
    workspaceProgram: buildDatalogWorkspaceProgram({
      documents: options.documents,
      workspaceRootPath: options.workspaceRootPath,
      loadMigrationProjectFiles: options.loadMigrationProjectFiles,
    }),
    predicateDefinitionsByIdentity,
    workspacePredicateIdentities: buildWorkspacePredicateIdentities(predicateDefinitionsByIdentity),
    graphPredicateIds: buildGraphPredicateIds(options.documents),
    predicateSchemaTargetsById: buildPredicateSchemaTargets(options.documents),
    compoundSchemaTargetsByName: buildCompoundSchemaTargets(options.documents),
    nodeSummaryTargetsById: buildNodeSummaryTargets(options.documents),
    graphNodeIds: buildGraphNodeIds(options.documents),
    compoundFieldSchemasByPredicate: buildCompoundFieldSchemas(options.documents),
    compoundFieldNamesByPredicate: buildCompoundFieldNames(options.documents),
  };
}
