import { describe, expect, it } from 'vitest';

import { parseDocument } from '@datalog/parser';

import { collectDuplicateSchemaClauses } from './diagnostic-duplicate-defpred-schemas.js';

describe('collectDuplicateSchemaClauses', () => {
  it('flags duplicate DefPred clauses in the target source when earlier sources already declared the predicate', () => {
    const duplicates = collectDuplicateSchemaClauses({
      targetSourceId: 'current.dl',
      sources: [
        {
          sourceId: '001-foundation.dl',
          parsedDocument: parseDocument(
            'DefPred("graph/shared", "0", "class/Entity", "0", "class/Target").',
          ),
        },
        {
          sourceId: 'current.dl',
          parsedDocument: parseDocument(
            [
              'DefPred("graph/shared", "0", "class/Entity", "0", "class/Target").',
              'DefPred("graph/unique", "0", "class/Entity", "0", "class/Target").',
              'DefPred("graph/shared", "0", "class/Entity", "0", "class/Target").',
            ].join('\n'),
          ),
        },
      ],
    });

    expect([...duplicates].map((clause) => clause.references[0]?.value)).toEqual([
      'graph/shared',
      'graph/shared',
    ]);
  });

  it('does not report false positives when all DefPred predicate ids are unique', () => {
    const duplicates = collectDuplicateSchemaClauses({
      targetSourceId: 'current.dl',
      sources: [
        {
          sourceId: '001-foundation.dl',
          parsedDocument: parseDocument(
            'DefPred("graph/foundation", "0", "class/Entity", "0", "class/Target").',
          ),
        },
        {
          sourceId: 'current.dl',
          parsedDocument: parseDocument(
            [
              'DefPred("graph/current", "0", "class/Entity", "0", "class/Target").',
              'Edge("concept/a", "graph/current", "concept/b").',
            ].join('\n'),
          ),
        },
      ],
    });

    expect(duplicates).toEqual(new Set());
  });
});
