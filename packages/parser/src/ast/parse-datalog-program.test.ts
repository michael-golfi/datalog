import { describe, expect, it } from 'vitest';

import { parseDocument } from '../analysis/parse-document.js';

import { parseDatalogFacts } from './parse-datalog-facts.js';
import { parseDatalogProgram } from './parse-datalog-program.js';
import { parseDatalogProgramSources } from './parse-datalog-program-sources.js';
import { parseDatalogQuery } from './parse-datalog-query.js';

describe('parseDatalogProgram', () => {
  it('parses facts, compound facts, and rules into shared AST statements', () => {
    const source = [
      'Edge("node/alice", "graph/likes", "node/bob").',
      'Serving@(serv/id="serv/chickpea", serv/unit="unit/serving").',
      'Reachable(node_a, node_b) :-',
      '  Edge(node_a, "graph/likes", node_b),',
      '  node_b != _.',
      '',
    ].join('\n');

    const parsed = parseDatalogProgram(source);

    expect(parsed.kind).toBe('program');
    expect(parsed.statements).toHaveLength(3);
    expect(parsed.statements[0]).toMatchObject({
      kind: 'fact',
      atom: {
        predicate: 'Edge',
        terms: [
          { kind: 'constant', value: 'node/alice' },
          { kind: 'constant', value: 'graph/likes' },
          { kind: 'constant', value: 'node/bob' },
        ],
      },
    });
    expect(parsed.statements[1]).toMatchObject({
      kind: 'fact',
      atom: {
        predicate: 'Serving',
        terms: [
          {
            kind: 'named',
            name: 'serv/id',
            term: { kind: 'constant', value: 'serv/chickpea' },
          },
          {
            kind: 'named',
            name: 'serv/unit',
            term: { kind: 'constant', value: 'unit/serving' },
          },
        ],
      },
    });
    expect(parsed.statements[2]).toMatchObject({
      kind: 'rule',
      head: {
        predicate: 'Reachable',
        terms: [
          { kind: 'variable', name: 'node_a' },
          { kind: 'variable', name: 'node_b' },
        ],
      },
      body: [
        {
          kind: 'atom',
          predicate: 'Edge',
        },
        {
          kind: 'comparison',
          operator: '!=',
          left: { kind: 'variable', name: 'node_b' },
          right: { kind: 'wildcard' },
        },
      ],
    });
  });

  it('preserves zero-based source spans for statements and terms', () => {
    const source = 'Edge("😀", "graph/likes", _).';

    const parsed = parseDatalogProgram(source);
    const fact = parsed.statements[0];

    expect(fact?.kind).toBe('fact');

    expect(fact).toMatchObject({
      kind: 'fact',
      location: {
        startOffset: 0,
        endOffset: source.length,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: source.length },
        },
      },
    });
    expect(fact?.kind === 'fact' ? fact.atom.terms[0] : null).toMatchObject({
      kind: 'constant',
      value: '😀',
      location: {
        startOffset: 5,
        endOffset: 9,
        range: {
          start: { line: 0, character: 5 },
          end: { line: 0, character: 9 },
        },
      },
    });
  });

  it('keeps parseDocument clause ranges and predicate names in parity with the AST statements', () => {
    const source = [
      'Edge("node/alice", "graph/likes", "node/bob").',
      'Reachable(node_a, node_b) :-',
      '  Edge(node_a, "graph/likes", node_b).',
      '',
    ].join('\n');

    const document = parseDocument(source);
    const program = parseDatalogProgram(source);

    expect(program.statements).toHaveLength(document.clauses.length);
    expect(program.statements.map((statement) => {
      if (statement.kind === 'fact') {
        return statement.atom.predicate;
      }

      if (statement.kind === 'rule') {
        return statement.head.predicate;
      }

      return statement.kind;
    })).toEqual(document.clauses.map((clause) => clause.predicate));
    expect(program.statements.map((statement) => statement.location?.range)).toEqual(document.clauses.map((clause) => clause.range));
  });

  it('parses inline query statements inside a source document without leaking the query prefix into the body', () => {
    const querySource = '?- Edge(node_a, "graph/likes", _), not Edge(_, "graph/blocked", node_a).';
    const source = [
      'Edge("node/alice", "graph/likes", "node/bob").',
      querySource,
      '',
    ].join('\n');

    const parsed = parseDatalogProgram(source);
    const query = parsed.statements[1];

    expect(query).toMatchObject({
      kind: 'query',
      body: [
        {
          kind: 'atom',
          predicate: 'Edge',
          terms: [
            { kind: 'variable', name: 'node_a' },
            { kind: 'constant', value: 'graph/likes' },
            { kind: 'wildcard' },
          ],
        },
        {
          kind: 'not',
          atom: {
            kind: 'atom',
            predicate: 'Edge',
            terms: [
              { kind: 'wildcard' },
              { kind: 'constant', value: 'graph/blocked' },
              { kind: 'variable', name: 'node_a' },
            ],
          },
        },
      ],
    });
    expect(query?.location).toMatchObject({
      startOffset: source.indexOf('?- Edge'),
      endOffset: source.indexOf('?- Edge') + querySource.slice(0, -1).length,
    });
  });

  it('preserves source order when parsing multiple sources into one program surface', () => {
    const parsed = parseDatalogProgramSources([
      {
        sourceId: 'migrations/20260422.0001.foundation.dl',
        source: 'Foundation(node_a).',
      },
      {
        sourceId: 'current.dl',
        source: [
          'Current(node_b).',
          'Derived(node_b) :- Current(node_b).',
        ].join('\n'),
      },
    ]);

    expect(parsed.sources.map((source) => source.sourceId)).toEqual([
      'migrations/20260422.0001.foundation.dl',
      'current.dl',
    ]);
    expect(parsed.sources.map((source) => source.parsedDocument.clauses.map((clause) => clause.predicate))).toEqual([
      ['Foundation'],
      ['Current', 'Derived'],
    ]);
    expect(parsed.program.statements.map((statement) => {
      if (statement.kind === 'fact') {
        return statement.atom.predicate;
      }

      if (statement.kind === 'rule') {
        return statement.head.predicate;
      }

      return statement.kind;
    })).toEqual(['Foundation', 'Current', 'Derived']);
  });
});

describe('parseDatalogQuery', () => {
  it('parses explicit query strings and plain fact-pattern conjunctions into query AST bodies', () => {
    const explicitQuery = parseDatalogQuery('?- Edge(node_a, "graph/likes", _), not Edge(_, "graph/blocked", node_a).');
    const factPatternQuery = parseDatalogQuery('Edge(node_a, "graph/likes", node_b), Edge(node_b, "graph/likes", _).');

    expect(explicitQuery).toMatchObject({
      kind: 'query',
      body: [
        {
          kind: 'atom',
          predicate: 'Edge',
          terms: [
            { kind: 'variable', name: 'node_a' },
            { kind: 'constant', value: 'graph/likes' },
            { kind: 'wildcard' },
          ],
        },
        {
          kind: 'not',
          atom: {
            predicate: 'Edge',
          },
        },
      ],
    });
    expect(factPatternQuery.body).toHaveLength(2);
    expect(factPatternQuery.body[1]).toMatchObject({ kind: 'atom', predicate: 'Edge' });
  });
});

describe('parseDatalogFacts', () => {
  it('parses quoted edge and vertex facts for migration-style sources', () => {
    const source = [
      'Edge("node/alice", "graph/likes", "node/bob").',
      'Vertex("node/alice").',
      '',
    ].join('\n');

    expect(parseDatalogFacts(source)).toEqual([
      {
        kind: 'edge',
        subjectId: 'node/alice',
        predicateId: 'graph/likes',
        objectId: 'node/bob',
      },
      {
        kind: 'vertex',
        id: 'node/alice',
      },
    ]);
  });
});
