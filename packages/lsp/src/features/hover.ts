import {
  getStringReferenceAtPosition,
  parseDocument,
} from '@datalog/parser';

import type { LanguageServerHover, Position } from '../contracts/language-feature-types.js';
import type { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';
import { BUILTIN_PREDICATE_DOCS } from './builtin-predicate-docs.js';

export interface HoverContext {
  readonly targetUri?: string;
  readonly workspaceIndex?: DatalogWorkspaceIndex;
}

/** Compute hover content for parser-backed graph ids, predicates, and rules. */
export function computeHover(
  source: string,
  position: Position,
  context: HoverContext = {},
): LanguageServerHover | null {
  const parsed = parseDocument(source);
  const stringReferenceHover = getStringReferenceHover(parsed, source, position);
  if (stringReferenceHover) {
    return stringReferenceHover;
  }

  const occurrence = findPredicateOccurrence(parsed, position);
  if (!occurrence) {
    return null;
  }

  if (occurrence.identity.kind === 'user-predicate') {
    return getUserPredicateHover(parsed, occurrence, context);
  }

  return getBuiltinHover(occurrence.identity.name, occurrence.range);
}

function getStringReferenceHover(
  parsed: ReturnType<typeof parseDocument>,
  source: string,
  position: Position,
): LanguageServerHover | null {
  const stringReference = getStringReferenceAtPosition(source, position);
  if (!stringReference) {
    return null;
  }

  const schema = parsed.predicateSchemas.get(stringReference.value);
  if (schema) {
    return {
      contents: [
        `**${schema.predicateId}**`,
        '',
        'Graph predicate contract.',
        '',
        `- subject: \`${schema.subjectType}\` (cardinality \`${schema.subjectCardinality}\`)`,
        `- object: \`${schema.objectType}\` (cardinality \`${schema.objectCardinality}\`)`,
      ].join('\n'),
      range: stringReference.range,
    };
  }

  const node = parsed.nodeSummaries.get(stringReference.value);
  if (node) {
    return {
      contents: [
        `**${node.id}**`,
        '',
        node.label ? `Preferred label: ${node.label}` : 'Graph node id.',
        getNodeClassLine(node.classes),
      ].join('\n'),
      range: stringReference.range,
    };
  }

  return null;
}

function findPredicateOccurrence(
  parsed: ReturnType<typeof parseDocument>,
  position: Position,
): {
  readonly identity: NonNullable<ReturnType<typeof parseDocument>['datalogSymbols']['predicates'][number]>['identity'];
  readonly range: NonNullable<LanguageServerHover['range']>;
} | null {
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
  parsed: ReturnType<typeof parseDocument>,
  occurrence: NonNullable<ReturnType<typeof findPredicateOccurrence>>,
  context: HoverContext,
): LanguageServerHover | null {
  const definitions = [
    ...getLocalPredicateDefinitions({
      parsed,
      identity: occurrence.identity,
      ...(context.targetUri ? { targetUri: context.targetUri } : {}),
    }),
    ...getWorkspacePredicateDefinitions({
      workspaceIndex: context.workspaceIndex,
      identity: occurrence.identity,
      ...(context.targetUri ? { targetUri: context.targetUri } : {}),
    }),
  ];

  if (definitions.length === 0) {
    return null;
  }

  return {
    contents: [
      `**${occurrence.identity.name}/${occurrence.identity.arity}**`,
      '',
      `${definitions.length} definition${definitions.length === 1 ? '' : 's'} across the workspace.`,
      `Arity: \`${occurrence.identity.arity}\``,
      '',
      'Definitions:',
      ...definitions.map(formatDefinitionProvenance),
    ].join('\n'),
    range: occurrence.range,
  };
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

function getLocalPredicateDefinitions(options: {
  readonly parsed: ReturnType<typeof parseDocument>;
  readonly identity: {
    readonly key: string;
    readonly name: string;
    readonly arity: number;
  };
  readonly targetUri?: string;
}): readonly PredicateDefinitionProvenance[] {
  return (options.parsed.derivedPredicates.get(options.identity.name) ?? [])
    .filter((clause) => clause.arity === options.identity.arity)
    .map((clause) => ({
      uri: options.targetUri ?? 'current document',
      range: clause.predicateRange,
    }));
}

function getWorkspacePredicateDefinitions(options: {
  readonly workspaceIndex: DatalogWorkspaceIndex | undefined;
  readonly identity: {
    readonly key: string;
    readonly name: string;
    readonly arity: number;
  };
  readonly targetUri?: string;
}): readonly PredicateDefinitionProvenance[] {
  if (!options.workspaceIndex) {
    return [];
  }

  return options.workspaceIndex.getPredicateDefinitions(options.identity.key)
    .filter((definition) => definition.uri !== options.targetUri)
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
  range: NonNullable<LanguageServerHover['range']>,
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

interface PredicateDefinitionProvenance {
  readonly uri: string;
  readonly range: NonNullable<LanguageServerHover['range']>;
}
