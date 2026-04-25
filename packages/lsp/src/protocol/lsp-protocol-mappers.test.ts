import { describe, expect, it } from 'vitest';
import { CompletionItemKind, FoldingRangeKind, SymbolKind } from 'vscode-languageserver/node.js';

import {
  toLspCompletionItem,
  toLspDocumentSymbol,
  toLspFoldingRange,
} from './lsp-protocol-mappers.js';

describe('toLspCompletionItem', () => {
  it('maps internal completion items to the expected LSP shape', () => {
    expect(
      toLspCompletionItem({
        label: 'Edge',
        kind: 'reference',
        detail: 'Builtin predicate',
        documentation: 'Writes a typed graph edge.',
        insertText: 'Edge($1, $2, $3)',
        sortText: '1:builtin:Edge/3',
      }),
    ).toEqual({
      label: 'Edge',
      kind: CompletionItemKind.Reference,
      detail: 'Builtin predicate',
      documentation: 'Writes a typed graph edge.',
      insertText: 'Edge($1, $2, $3)',
      sortText: '1:builtin:Edge/3',
    });
  });
});

describe('toLspDocumentSymbol', () => {
  it('maps nested internal symbols to recursive LSP document symbols', () => {
    expect(
      toLspDocumentSymbol({
        name: 'RuleName',
        kind: 'function',
        detail: 'Clause head',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 2, character: 1 },
        },
        selectionRange: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 8 },
        },
        children: [
          {
            name: 'subject_id',
            kind: 'variable',
            range: {
              start: { line: 0, character: 9 },
              end: { line: 0, character: 19 },
            },
            selectionRange: {
              start: { line: 0, character: 9 },
              end: { line: 0, character: 19 },
            },
          },
        ],
      }),
    ).toEqual({
      name: 'RuleName',
      kind: SymbolKind.Function,
      detail: 'Clause head',
      range: {
        start: { line: 0, character: 0 },
        end: { line: 2, character: 1 },
      },
      selectionRange: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 8 },
      },
      children: [
        {
          name: 'subject_id',
          kind: SymbolKind.Key,
          range: {
            start: { line: 0, character: 9 },
            end: { line: 0, character: 19 },
          },
          selectionRange: {
            start: { line: 0, character: 9 },
            end: { line: 0, character: 19 },
          },
        },
      ],
    });
  });
});

describe('toLspFoldingRange', () => {
  it('maps comment folding ranges to LSP comment ranges', () => {
    expect(
      toLspFoldingRange({
        startLine: 3,
        endLine: 5,
        kind: 'comment',
      }),
    ).toEqual({
      startLine: 3,
      endLine: 5,
      kind: FoldingRangeKind.Comment,
    });
  });

  it('maps region folding ranges to the LSP region kind', () => {
    expect(
      toLspFoldingRange({
        startLine: 7,
        endLine: 10,
        kind: 'region',
      }),
    ).toEqual({
      startLine: 7,
      endLine: 10,
      kind: FoldingRangeKind.Region,
    });
  });
});
