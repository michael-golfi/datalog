import {
  defPredSchema,
} from '@datalog/ast';

import type {
  ParsedClause,
  ParsedSchemaDeclaration,
} from '../contracts/parsed-document.js';

import {
  createDefCompoundSchemaEntry,
  getDefPredReferences,
  normalizeDefPredSchema,
  type CompoundSchemaEntry,
} from './extract-datalog-schema-helpers.js';

/** Extract predicate and compound schema declarations from parsed clauses. */
export function extractDatalogSchema(clauses: readonly ParsedClause[]): readonly ParsedSchemaDeclaration[] {
  const schemaDeclarations: ParsedSchemaDeclaration[] = [];

  for (const clause of clauses) {
    const predicateSchema = extractDefPredSchema(clause);

    if (predicateSchema !== null) {
      schemaDeclarations.push(predicateSchema);
    }
  }

  schemaDeclarations.push(...extractDefCompoundSchemas(clauses));
  return schemaDeclarations;
}

/** Extract a single DefPred schema declaration when the clause matches the expected shape. */
export function extractDefPredSchema(clause: ParsedClause): ParsedSchemaDeclaration | null {
  const references = getDefPredReferences(clause);

  if (references === null) {
    return null;
  }

  const normalizedSchema = normalizeDefPredSchema(references);

  if (normalizedSchema === null) {
    return null;
  }

  const [predicateName] = references;

  return {
    schema: defPredSchema({
      predicateName: predicateName.value,
      ...normalizedSchema,
    }),
    range: predicateName.range,
  };
}

/** Extract DefCompound schema declarations keyed by compound name. */
export function extractDefCompoundSchemas(clauses: readonly ParsedClause[]): readonly ParsedSchemaDeclaration[] {
  const schemasByCompoundName = new Map<string, CompoundSchemaEntry>();

  for (const clause of clauses) {
    const nextEntry = createDefCompoundSchemaEntry(clause, schemasByCompoundName);

    if (nextEntry === null) {
      continue;
    }

    schemasByCompoundName.set(nextEntry.schema.compoundName, nextEntry);
  }

  return [...schemasByCompoundName.values()].map((declaration) => ({
    schema: declaration.schema,
    range: declaration.range,
  }));
}
