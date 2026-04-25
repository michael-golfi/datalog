import type { parseDocument } from '@datalog/parser';

import type { LanguageServerHover } from '../contracts/language-feature-types.js';
import type { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';

type ParsedDocument = ReturnType<typeof parseDocument>;
type HoverRange = NonNullable<LanguageServerHover['range']>;

interface UserPredicateIdentity {
  readonly key: string;
  readonly name: string;
  readonly arity: number;
}

/** Build hover content for user-defined predicates and their workspace provenance. */
export function getUserPredicateHover(options: {
  readonly parsed: ParsedDocument;
  readonly identity: UserPredicateIdentity;
  readonly range: HoverRange;
  readonly targetUri?: string;
  readonly workspaceIndex?: DatalogWorkspaceIndex;
}): LanguageServerHover | null {
  const definitions = [
    ...getLocalPredicateDefinitions(options.parsed, options.identity, options.targetUri),
    ...getWorkspacePredicateDefinitions(
      options.workspaceIndex,
      options.identity,
      options.targetUri,
    ),
  ];
  if (definitions.length === 0) {
    return null;
  }

  return {
    contents: formatUserPredicateHoverContents(options.identity, definitions),
    range: options.range,
  };
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

  return workspaceIndex
    .getPredicateDefinitions(identity.key)
    .filter((definition) => definition.uri !== targetUri)
    .map((definition) => ({
      uri: definition.uri,
      range: definition.range,
    }));
}

function formatDefinitionProvenance(definition: PredicateDefinitionProvenance): string {
  return `- \`${definition.uri}\`:${definition.range.start.line + 1}:${
    definition.range.start.character + 1
  }`;
}

interface PredicateDefinitionProvenance {
  readonly uri: string;
  readonly range: HoverRange;
}
