import type {
  DefCompoundSchema,
  DefPredSchema,
} from '@datalog/ast';

import type { ParsedSchemaDeclaration } from '../contracts/parsed-document.js';

/** Find the parsed predicate schema declaration for the given predicate name, if present. */
export function getPredicateSchemaDeclaration(
  schemaDeclarations: readonly ParsedSchemaDeclaration[],
  predicateName: string,
): (ParsedSchemaDeclaration & { readonly schema: DefPredSchema }) | undefined {
  return schemaDeclarations.find(
    (declaration): declaration is ParsedSchemaDeclaration & { readonly schema: DefPredSchema } => (
      declaration.schema.kind === 'predicate-schema' && declaration.schema.predicateName === predicateName
    ),
  );
}

/** Find the parsed compound schema declaration for the given compound name, if present. */
export function getCompoundSchemaDeclaration(
  schemaDeclarations: readonly ParsedSchemaDeclaration[],
  compoundName: string,
): (ParsedSchemaDeclaration & { readonly schema: DefCompoundSchema }) | undefined {
  return schemaDeclarations.find(
    (declaration): declaration is ParsedSchemaDeclaration & { readonly schema: DefCompoundSchema } => (
      declaration.schema.kind === 'compound-schema' && declaration.schema.compoundName === compoundName
    ),
  );
}

/** Return compound field names for the requested schema, or an empty list when absent. */
export function getCompoundFieldNames(
  schemaDeclarations: readonly ParsedSchemaDeclaration[],
  compoundName: string,
): readonly string[] {
  const declaration = getCompoundSchemaDeclaration(schemaDeclarations, compoundName);

  return declaration?.schema.fields.map((field) => field.fieldName) ?? [];
}
