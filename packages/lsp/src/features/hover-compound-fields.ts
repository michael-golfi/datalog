import type { DefCompoundFieldSchema } from '@datalog/ast';
import { getCompoundSchemaDeclaration } from '@datalog/parser';
import type { parseDocument } from '@datalog/parser';

import type { LanguageServerHover, Position } from '../contracts/language-feature-types.js';
import type { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';

type ParsedDocument = ReturnType<typeof parseDocument>;
type HoverRange = NonNullable<LanguageServerHover['range']>;

/** Resolve hover content for compound field declarations and usages. */
export function getCompoundFieldHover(options: {
  readonly parsed: ParsedDocument;
  readonly position: Position;
  readonly workspaceIndex?: DatalogWorkspaceIndex;
}): LanguageServerHover | null {
  const compoundField = findCompoundFieldAtPosition(options.parsed, options.position)
    ?? findDefCompoundFieldAtPosition(options.parsed, options.position);
  if (!compoundField) {
    return null;
  }

  const fieldSchema = getCompoundFieldSchema({
    parsed: options.parsed,
    compoundName: compoundField.compoundName,
    fieldName: compoundField.fieldName,
    ...(options.workspaceIndex ? { workspaceIndex: options.workspaceIndex } : {}),
  });
  if (!fieldSchema) {
    return null;
  }

  return {
    contents: formatCompoundFieldHover({
      compoundName: compoundField.compoundName,
      fieldSchema,
    }),
    range: compoundField.range,
  };
}

function findCompoundFieldAtPosition(
  parsed: ParsedDocument,
  position: Position,
): { readonly compoundName: string; readonly fieldName: string; readonly range: HoverRange } | null {
  for (const clause of parsed.clauses) {
    const fieldOccurrence = clause.compoundFieldOccurrences.find((candidate) => containsPosition(position, candidate.range));
    if (fieldOccurrence) {
      return {
        compoundName: fieldOccurrence.predicateName,
        fieldName: fieldOccurrence.name,
        range: fieldOccurrence.range,
      };
    }
  }

  return null;
}

function findDefCompoundFieldAtPosition(
  parsed: ParsedDocument,
  position: Position,
): { readonly compoundName: string; readonly fieldName: string; readonly range: HoverRange } | null {
  for (const clause of parsed.clauses) {
    if (clause.predicate !== 'DefCompound') {
      continue;
    }

    const compoundReference = clause.references[0];
    const fieldReference = clause.references[1];
    if (compoundReference && fieldReference && containsPosition(position, fieldReference.range)) {
      return {
        compoundName: compoundReference.value,
        fieldName: fieldReference.value,
        range: fieldReference.range,
      };
    }
  }

  return null;
}

function getCompoundFieldSchema(options: {
  readonly parsed: ParsedDocument;
  readonly workspaceIndex?: DatalogWorkspaceIndex;
  readonly compoundName: string;
  readonly fieldName: string;
}): DefCompoundFieldSchema | undefined {
  return getLocalCompoundFieldSchema(options.parsed, options.compoundName, options.fieldName)
    ?? options.workspaceIndex?.getCompoundFieldSchemas(options.compoundName)
      .find((field) => field.fieldName === options.fieldName);
}

function getLocalCompoundFieldSchema(
  parsed: ParsedDocument,
  compoundName: string,
  fieldName: string,
): DefCompoundFieldSchema | undefined {
  const schema = getCompoundSchemaDeclaration(parsed.schemaDeclarations, compoundName)?.schema;
  return schema?.kind === 'compound-schema'
    ? schema.fields.find((field) => field.fieldName === fieldName)
    : undefined;
}

function formatCompoundFieldHover(options: {
  readonly compoundName: string;
  readonly fieldSchema: DefCompoundFieldSchema;
}): string {
  return [
    `**${options.fieldSchema.fieldName}**`,
    '',
    `Compound field on \`${options.compoundName}@\`.`,
    '',
    `- domain: \`${options.fieldSchema.domain}\``,
    `- cardinality: \`${options.fieldSchema.cardinality}\``,
  ].join('\n');
}

function containsPosition(
  position: Position,
  range: HoverRange,
): boolean {
  const startsBefore = position.line > range.start.line
    || (position.line === range.start.line && position.character >= range.start.character);
  const endsAfter = position.line < range.end.line
    || (position.line === range.end.line && position.character <= range.end.character);

  return startsBefore && endsAfter;
}
