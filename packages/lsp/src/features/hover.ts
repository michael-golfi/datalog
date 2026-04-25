import type { DefPredSchema } from '@datalog/ast';
import type { NodeSummary } from '@datalog/parser';
import {
  getPredicateSchemaDeclaration,
  getStringReferenceAtPosition,
  parseDocument,
} from '@datalog/parser';

import { BUILTIN_PREDICATE_DOCS } from './builtin-predicate-docs.js';
import { getCompoundFieldHover } from './hover-compound-fields.js';
import { getUserPredicateHover } from './hover-user-predicate.js';

import type { LanguageServerHover, Position } from '../contracts/language-feature-types.js';
import type { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';

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

interface UserPredicateIdentity {
  readonly key: string;
  readonly name: string;
  readonly arity: number;
}

/** Compute hover content for parser-backed graph ids, predicates, and rules. */
export function computeHover(
  source: string,
  position: Position,
  context: HoverContext = {},
): LanguageServerHover | null {
  const parsed = parseDocument(source);
  const referenceHover = getReferenceHover({ parsed, source, position, context });
  if (referenceHover) {
    return referenceHover;
  }

  const occurrence = findPredicateOccurrence(parsed, position);
  if (!occurrence) {
    return null;
  }

  if (occurrence.identity.kind === 'user-predicate') {
    const identity: UserPredicateIdentity = occurrence.identity;
    return getUserPredicateHover({
      parsed,
      identity,
      range: occurrence.range,
      ...(context.targetUri ? { targetUri: context.targetUri } : {}),
      ...(context.workspaceIndex ? { workspaceIndex: context.workspaceIndex } : {}),
    });
  }

  return getBuiltinHover(occurrence.identity.name, occurrence.range);
}

function getReferenceHover(options: {
  readonly parsed: ParsedDocument;
  readonly source: string;
  readonly position: Position;
  readonly context: HoverContext;
}): LanguageServerHover | null {
  return (
    getStringReferenceHover(options) ??
    getCompoundFieldHover({
      parsed: options.parsed,
      position: options.position,
      ...(options.context.workspaceIndex ? { workspaceIndex: options.context.workspaceIndex } : {}),
    }) ??
    null
  );
}

function getStringReferenceHover(options: {
  readonly parsed: ParsedDocument;
  readonly source: string;
  readonly position: Position;
  readonly context: HoverContext;
}): LanguageServerHover | null {
  const stringReference = getStringReferenceAtPosition(options.source, options.position);
  if (!stringReference) {
    return null;
  }

  const contents = getStringReferenceHoverContents(
    options.parsed,
    stringReference.value,
    options.context,
  );
  return contents ? { contents, range: stringReference.range } : null;
}

function getStringReferenceHoverContents(
  parsed: ParsedDocument,
  referenceId: string,
  context: HoverContext,
): string | null {
  return (
    getLocalStringReferenceHoverContents(parsed, referenceId) ??
    getWorkspaceStringReferenceHoverContents(context, referenceId) ??
    null
  );
}

function getLocalStringReferenceHoverContents(
  parsed: ParsedDocument,
  referenceId: string,
): string | null {
  const schemaDeclaration = getPredicateSchemaDeclaration(parsed.schemaDeclarations, referenceId);
  if (schemaDeclaration?.schema.kind === 'predicate-schema') {
    return formatPredicateSchemaHover(schemaDeclaration.schema);
  }

  const node = parsed.nodeSummaries.get(referenceId);
  return node ? formatNodeSummaryHover(node) : null;
}

function getWorkspaceStringReferenceHoverContents(
  context: HoverContext,
  referenceId: string,
): string | null {
  if (!context.workspaceIndex) {
    return null;
  }

  const schema = context.workspaceIndex
    .getPredicateSchemaTargets(referenceId)
    .find((target) => target.uri !== context.targetUri)?.schema;
  if (schema) {
    return formatPredicateSchemaHover(schema);
  }

  const node = context.workspaceIndex
    .getNodeSummaryTargets(referenceId)
    .find((target) => target.uri !== context.targetUri)?.summary;
  return node ? formatNodeSummaryHover(node) : null;
}

function formatPredicateSchemaHover(schema: DefPredSchema): string {
  return [
    `**${schema.predicateName}**`,
    '',
    'Runtime predicate schema.',
    '',
    `- subject: \`${schema.subjectDomain}\` (cardinality \`${schema.subjectCardinality}\`)`,
    `- object: \`${schema.objectDomain}\` (cardinality \`${schema.objectCardinality}\`)`,
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
    const occurrence = predicate.occurrences.find((candidate) =>
      containsPosition(position, candidate.range),
    );
    if (occurrence) {
      return {
        identity: predicate.identity,
        range: occurrence.range,
      };
    }
  }

  return null;
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

function containsPosition(position: Position, range: HoverRange): boolean {
  const startsBefore =
    position.line > range.start.line ||
    (position.line === range.start.line && position.character >= range.start.character);
  const endsAfter =
    position.line < range.end.line ||
    (position.line === range.end.line && position.character <= range.end.character);

  return startsBefore && endsAfter;
}

function getNodeClassLine(classes: readonly string[]): string {
  return classes.length > 0
    ? `- class: ${classes.map((value: string) => `\`${value}\``).join(', ')}`
    : '- class: not declared in this document';
}
