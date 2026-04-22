import { describe, expect, it } from 'vitest';

import { classifyReferenceRole } from '../semantics/reference-role-classifier.js';
import { computeLineStarts } from '../syntax/line-starts.js';
import { parseClause } from '../syntax/parse-clause.js';
import { splitStatements } from '../syntax/split-statements.js';

import { collectGraphSemantics } from './collect-graph-semantics.js';

describe('collectGraphSemantics', () => {
  it('collects graph vocab-derived summaries and ids from parsed clauses', () => {
    const source = `
Edge("class/Thing", "food/preferred_label", "Thing").
Edge("concept/soup", "food/instance_of", "class/Thing").
Edge("predicate/likes", "food/instance_of", "meta/domain_class").
`;
    const lineStarts = computeLineStarts(source);
    const clauses = splitStatements(source)
      .map((statement) => parseClause(statement, lineStarts, classifyReferenceRole))
      .filter((clause): clause is NonNullable<typeof clause> => clause !== null);

    const semantics = collectGraphSemantics(clauses);

    expect(semantics.nodeSummaries.get('class/Thing')).toMatchObject({
      label: 'Thing',
      classes: [],
    });
    expect(semantics.nodeSummaries.get('concept/soup')).toMatchObject({
      classes: ['class/Thing'],
    });
    expect(semantics.nodeIds).toContain('meta/domain_class');
  });
});
