import type { NodeSummary, PredicateSchema } from '@datalog/parser';
import { getStringReferenceAtPosition, parseDocument } from '@datalog/parser';

import type { LanguageServerHover, Position } from '../contracts/language-feature-types.js';
import type { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';
import { BUILTIN_PREDICATE_DOCS } from './builtin-predicate-docs.js';

export interface HoverContext {
  readonly targetUri?: string;
  readonly workspaceIndex?: DatalogWorkspaceIndex;
}

type ParsedDocument = ReturnType<typeof parseDocument>;
type HoverRange = NonNullable<LanguageServerHover['range']>;
interface PredicateOccurrence {
  readonly identity: ParsedDocument['datalogSymbols']['predicates'][number]['identity'];
  readonly range: HoverRange;
}

interface UserPredicateIdentity { readonly key: string; readonly name: string; readonly arity: number; }

/** Compute hover content for parser-backed graph ids, predicates, and rules. */
export function computeHover(
  source: string,
  position: Position,
  context: HoverContext = {},
): LanguageServerHover | null {
  const parsed = parseDocument(source);
  const stringReferenceHover = getStringReferenceHover({ parsed, source, position, context });
  if (stringReferenceHover) {
    return stringReferenceHover;
  }

  const occurrence = findPredicateOccurrence(parsed, position);
  if (!occurrence) {
    return null;
  }

  if (occurrence.identity.kind === 'user-predicate') {
    const identity: UserPredicateIdentity = occurrence.identity;
    return getUserPredicateHover({ parsed, identity, range: occurrence.range, context });
  }

  return getBuiltinHover(occurrence.identity.name, occurrence.range);
}

function getStringReferenceHover(
  options: {
    readonly parsed: ParsedDocument;
    readonly source: string;
    readonly position: Position;
    readonly context: HoverContext;
  },
): LanguageServerHover | null {
  const stringReference = getStringReferenceAtPosition(options.source, options.position);
  if (!stringReference) {
    return null;
  }

  const contents = getStringReferenceHoverContents(options.parsed, stringReference.value, options.context);
  return contents ? { contents, range: stringReference.range } : null;
}

function getStringReferenceHoverContents(
  parsed: ParsedDocument,
  referenceId: string,
  context: HoverContext,
): string | null {
  return getLocalStringReferenceHoverContents(parsed, referenceId)
    ?? getWorkspaceStringReferenceHoverContents(context, referenceId)
    ?? null;
}

function getLocalStringReferenceHoverContents(parsed: ParsedDocument, referenceId: string): string | null {
  const schema = parsed.predicateSchemas.get(referenceId);
  if (schema) {
    return formatPredicateSchemaHover(schema);
  }

  const node = parsed.nodeSummaries.get(referenceId);
  return node ? formatNodeSummaryHover(node) : null;
}

function getWorkspaceStringReferenceHoverContents(context: HoverContext, referenceId: string): string | null {
  if (!context.workspaceIndex) {
    return null;
  }

  const schema = context.workspaceIndex.getPredicateSchemaTargets(referenceId)
    .find((target) => target.uri !== context.targetUri)?.schema;
  if (schema) {
    return formatPredicateSchemaHover(schema);
  }

  const node = context.workspaceIndex.getNodeSummaryTargets(referenceId)
    .find((target) => target.uri !== context.targetUri)?.summary;
  return node ? formatNodeSummaryHover(node) : null;
}

function formatPredicateSchemaHover(schema: PredicateSchema): string {
  return [
    `**${schema.predicateId}**`,
    '',
    'Graph predicate contract.',
    '',
    `- subject: \`${schema.subjectType}\` (cardinality \`${schema.subjectCardinality}\`)`,
    `- object: \`${schema.objectType}\` (cardinality \`${schema.objectCardinality}\`)`,
  ].join('\n');
}

function formatNodeSummaryHover(node: NodeSummary): string {
  return [
    `**${node.id}**`,
    '',
    node.label ? `Preferred label: ${node.label}` : 'Graph node id.',
    getNodeClassLine(node.classes),
  ].join('\n');
}

function findPredicateOccurrence(
  parsed: ParsedDocument,
  position: Position,
): PredicateOccurrence | null {
  for (const predicate of parsed.datalogSymbols.predicates) {
    const occurrence = predicate.occurrences.find((candidate) => containsPosition(position, candidate.range));
    if (occurrence) {
      return {
        identity: predicate.identity,
        range: occurrence.range,
      };
    }
  }

  return null;
}

function getUserPredicateHover(
  options: {
    readonly parsed: ParsedDocument;
    readonly identity: UserPredicateIdentity;
    readonly range: HoverRange;
    readonly context: HoverContext;
  },
): LanguageServerHover | null {
  const definitions = getPredicateDefinitions(options);

  if (definitions.length === 0) {
    return null;
  }

  return {
    contents: formatUserPredicateHoverContents(options.identity, definitions),
    range: options.range,
  };
}

function getPredicateDefinitions(options: {
  readonly parsed: ParsedDocument;
  readonly identity: UserPredicateIdentity;
  readonly context: HoverContext;
}): readonly PredicateDefinitionProvenance[] {
  return [
    ...getLocalPredicateDefinitions(options.parsed, options.identity, options.context.targetUri),
    ...getWorkspacePredicateDefinitions(options.context.workspaceIndex, options.identity, options.context.targetUri),
  ];
}

function formatUserPredicateHoverContents(
  identity: UserPredicateIdentity,
  definitions: readonly PredicateDefinitionProvenance[],
): string {
  return [
    `**${identity.name}/${identity.arity}**`,
    '',
    `${definitions.length} definition${definitions.length === 1 ? '' : 's'} across the workspace.`,
    `Arity: \`${identity.arity}\``,
    '',
    'Definitions:',
    ...definitions.map(formatDefinitionProvenance),
  ].join('\n');
}

function getBuiltinHover(
  word: string,
  range: NonNullable<LanguageServerHover['range']>,
): LanguageServerHover | null {
  const builtin = BUILTIN_PREDICATE_DOCS.get(word);
  if (builtin) {
    return {
      contents: `**${builtin.name}**\n\n${builtin.detail}\n\nExample: \`${builtin.example}\``,
      range,
    };
  }

  return null;
}

function getLocalPredicateDefinitions(
  parsed: ParsedDocument,
  identity: UserPredicateIdentity,
  targetUri?: string,
): readonly PredicateDefinitionProvenance[] {
  return (parsed.derivedPredicates.get(identity.name) ?? [])
    .filter((clause) => clause.arity === identity.arity)
    .map((clause) => ({
      uri: targetUri ?? 'current document',
      range: clause.predicateRange,
    }));
}

function getWorkspacePredicateDefinitions(
  workspaceIndex: DatalogWorkspaceIndex | undefined,
  identity: UserPredicateIdentity,
  targetUri?: string,
): readonly PredicateDefinitionProvenance[] {
  if (!workspaceIndex) {
    return [];
  }

  return workspaceIndex.getPredicateDefinitions(identity.key)
    .filter((definition) => definition.uri !== targetUri)
    .map((definition) => ({
      uri: definition.uri,
      range: definition.range,
    }));
}

function formatDefinitionProvenance(definition: PredicateDefinitionProvenance): string {
  return `- \`${definition.uri}\`:${definition.range.start.line + 1}:${definition.range.start.character + 1}`;
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

function getNodeClassLine(classes: readonly string[]): string {
  return classes.length > 0
    ? `- class: ${classes.map((value: string) => `\`${value}\``).join(', ')}`
    : '- class: not declared in this document';
}

interface PredicateDefinitionProvenance { readonly uri: string; readonly range: HoverRange; }
