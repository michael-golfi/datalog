import {
  getStringReferenceAtPosition,
  getWordRangeAtPosition,
  parseDocument,
} from '@datalog/parser';

import type { LanguageServerHover, Position } from '../contracts/language-feature-types.js';
import { BUILTIN_PREDICATE_DOCS } from './builtin-predicate-docs.js';

/** Compute hover content for parser-backed graph ids, predicates, and rules. */
export function computeHover(source: string, position: Position): LanguageServerHover | null {
  const parsed = parseDocument(source);
  const stringReferenceHover = getStringReferenceHover(parsed, source, position);
  if (stringReferenceHover) {
    return stringReferenceHover;
  }

  const word = getHoverWord(parsed, source, position);
  if (!word) {
    return null;
  }

  return getWordHover(parsed, word.value, word.range);
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

function getHoverWord(
  parsed: ReturnType<typeof parseDocument>,
  source: string,
  position: Position,
): { value: string; range: NonNullable<LanguageServerHover['range']> } | null {
  const wordRange = getWordRangeAtPosition(source, position, parsed.lineStarts);
  if (!wordRange) {
    return null;
  }

  return {
    value: getWordValue(source, parsed.lineStarts, wordRange),
    range: wordRange,
  };
}

function getWordHover(
  parsed: ReturnType<typeof parseDocument>,
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

  const derived = parsed.derivedPredicates.get(word);
  if (derived) {
    return {
      contents: [
        `**${word}**`,
        '',
        `Derived predicate with ${derived.length} clause${derived.length === 1 ? '' : 's'}.`,
        `Arity: \`${derived[0]?.arity ?? 0}\``,
      ].join('\n'),
      range,
    };
  }

  return null;
}

function getWordValue(
  source: string,
  lineStarts: readonly number[],
  range: NonNullable<LanguageServerHover['range']>,
): string {
  const wordStartOffset = lineStarts[range.start.line] ?? 0;
  const wordEndOffset = lineStarts[range.end.line] ?? 0;
  return source.slice(
    wordStartOffset + range.start.character,
    wordEndOffset + range.end.character,
  );
}

function getNodeClassLine(classes: readonly string[]): string {
  return classes.length > 0
    ? `- class: ${classes.map((value: string) => `\`${value}\``).join(', ')}`
    : '- class: not declared in this document';
}
