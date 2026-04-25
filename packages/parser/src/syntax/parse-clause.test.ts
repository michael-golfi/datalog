import { describe, expect, it } from 'vitest';

import { computeLineStarts } from './line-starts.js';
import { parseClause } from './parse-clause.js';
import { classifyReferenceRole } from '../semantics/reference-role-classifier.js';

describe('parseClause', () => {
  it('parses rule arity from the head instead of the trailing body clause', () => {
    const source = 'Related(subject, object) :- Edge(subject, "graph/likes", object).';
    const clause = parseClause(
      { text: source, startOffset: 0 },
      computeLineStarts(source),
      classifyReferenceRole,
    );

    expect(clause).toMatchObject({
      predicate: 'Related',
      isRule: true,
      arity: 2,
    });
    expect(clause?.occurrences.map((occurrence) => [occurrence.name, occurrence.kind])).toEqual([
      ['Related', 'head'],
      ['Edge', 'body'],
    ]);
  });

  it('extracts compound field names from compound heads', () => {
    const source = 'Serving@(serv/id="serv/chickpea", serv/unit="unit/serving").';
    const clause = parseClause(
      { text: source, startOffset: 0 },
      computeLineStarts(source),
      classifyReferenceRole,
    );

    expect(clause).toMatchObject({
      predicate: 'Serving',
      isCompound: true,
      compoundFields: ['serv/id', 'serv/unit'],
    });
  });
});
