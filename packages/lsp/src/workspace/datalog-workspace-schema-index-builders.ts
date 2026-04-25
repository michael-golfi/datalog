import type { DefCompoundFieldSchema } from '@datalog/ast';

import type { DatalogWorkspaceDocument } from './load-datalog-workspace-documents.js';
import type {
  DatalogWorkspaceCompoundSchemaTarget,
  DatalogWorkspacePredicateSchemaTarget,
} from './datalog-workspace-schema-targets.js';

/** Collect predicate schema definitions across documents, keyed by graph predicate ID. */
export function buildPredicateSchemaTargets(
  documents: readonly DatalogWorkspaceDocument[],
): Map<string, readonly DatalogWorkspacePredicateSchemaTarget[]> {
  const targetsByPredicateId = new Map<string, DatalogWorkspacePredicateSchemaTarget[]>();

  for (const schemaTarget of getPredicateSchemaEntries(documents)) {
    const targets = targetsByPredicateId.get(schemaTarget.schema.predicateName) ?? [];
    targets.push(schemaTarget);
    targetsByPredicateId.set(schemaTarget.schema.predicateName, targets);
  }

  return sortTargetEntries(targetsByPredicateId);
}

/** Collect compound schema definitions across documents, keyed by compound name. */
export function buildCompoundSchemaTargets(
  documents: readonly DatalogWorkspaceDocument[],
): Map<string, readonly DatalogWorkspaceCompoundSchemaTarget[]> {
  const targetsByCompoundName = new Map<string, DatalogWorkspaceCompoundSchemaTarget[]>();

  for (const schemaTarget of getCompoundSchemaEntries(documents)) {
    const targets = targetsByCompoundName.get(schemaTarget.schema.compoundName) ?? [];
    targets.push(schemaTarget);
    targetsByCompoundName.set(schemaTarget.schema.compoundName, targets);
  }

  return sortTargetEntries(targetsByCompoundName);
}

/** Index compound field names by their parent predicate, deduplicated and sorted. */
export function buildCompoundFieldNames(documents: readonly DatalogWorkspaceDocument[]): Map<string, readonly string[]> {
  return new Map(
    [...buildCompoundFieldSchemas(documents).entries()].map(([predicateName, fields]) => [
      predicateName,
      fields.map((field) => field.fieldName),
    ]),
  );
}

/** Index compound field schemas by their parent predicate, deduplicated by field name. */
export function buildCompoundFieldSchemas(
  documents: readonly DatalogWorkspaceDocument[],
): Map<string, readonly DefCompoundFieldSchema[]> {
  const fieldSchemasByPredicate = new Map<string, Map<string, DefCompoundFieldSchema>>();

  for (const declaration of getCompoundSchemaEntries(documents)) {
    const fieldSchemas = fieldSchemasByPredicate.get(declaration.schema.compoundName) ?? new Map<string, DefCompoundFieldSchema>();
    addMissingFieldSchemas(fieldSchemas, declaration.schema.fields);
    fieldSchemasByPredicate.set(declaration.schema.compoundName, fieldSchemas);
  }

  return new Map(
    [...fieldSchemasByPredicate.entries()].map(([predicateName, fieldSchemas]) => [
      predicateName,
      [...fieldSchemas.values()].sort(compareFieldSchemas),
    ]),
  );
}

function getPredicateSchemaEntries(
  documents: readonly DatalogWorkspaceDocument[],
): readonly DatalogWorkspacePredicateSchemaTarget[] {
  return documents.flatMap((document) => document.parsedDocument.schemaDeclarations.flatMap((schemaDeclaration) => (
    schemaDeclaration.schema.kind === 'predicate-schema'
      ? [{ uri: document.uri, schema: schemaDeclaration.schema, range: schemaDeclaration.range }]
      : []
  )));
}

function getCompoundSchemaEntries(
  documents: readonly DatalogWorkspaceDocument[],
): readonly DatalogWorkspaceCompoundSchemaTarget[] {
  return documents.flatMap((document) => document.parsedDocument.schemaDeclarations.flatMap((schemaDeclaration) => (
    schemaDeclaration.schema.kind === 'compound-schema'
      ? [{ uri: document.uri, schema: schemaDeclaration.schema, range: schemaDeclaration.range }]
      : []
  )));
}

function addMissingFieldSchemas(
  fieldSchemas: Map<string, DefCompoundFieldSchema>,
  fields: readonly DefCompoundFieldSchema[],
): void {
  for (const field of fields) {
    if (fieldSchemas.has(field.fieldName)) {
      continue;
    }

    fieldSchemas.set(field.fieldName, field);
  }
}

function sortTargetEntries<TTarget extends { readonly uri: string; readonly range: DatalogWorkspacePredicateSchemaTarget['range'] }>(
  targetsById: Map<string, TTarget[]>,
): Map<string, readonly TTarget[]> {
  return new Map(
    [...targetsById.entries()].map(([id, targets]) => [id, targets.sort(compareTargets)]),
  );
}

function compareTargets(
  left: { readonly uri: string; readonly range: DatalogWorkspacePredicateSchemaTarget['range'] },
  right: { readonly uri: string; readonly range: DatalogWorkspacePredicateSchemaTarget['range'] },
): number {
  return left.uri.localeCompare(right.uri) || compareRanges(left.range, right.range);
}

function compareFieldSchemas(left: DefCompoundFieldSchema, right: DefCompoundFieldSchema): number {
  return left.fieldName.localeCompare(right.fieldName);
}

function compareRanges(
  left: DatalogWorkspacePredicateSchemaTarget['range'],
  right: DatalogWorkspacePredicateSchemaTarget['range'],
): number {
  return comparePositions(left.start, right.start) || comparePositions(left.end, right.end);
}

function comparePositions(
  left: DatalogWorkspacePredicateSchemaTarget['range']['start'],
  right: DatalogWorkspacePredicateSchemaTarget['range']['start'],
): number {
  return left.line - right.line || left.character - right.character;
}
