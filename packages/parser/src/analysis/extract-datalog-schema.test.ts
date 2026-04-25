import { describe, expect, it } from 'vitest';

import type { ParsedClause } from '../contracts/parsed-document.js';
import { classifyReferenceRole } from '../semantics/reference-role-classifier.js';
import { computeLineStarts } from '../syntax/line-starts.js';
import { parseClause } from '../syntax/parse-clause.js';
import { splitStatements } from '../syntax/split-statements.js';

import {
  extractDatalogSchema,
  extractDefCompoundSchemas,
  extractDefPredSchema,
} from './extract-datalog-schema.js';

describe('extractDatalogSchema', () => {
  it('extracts a typed predicate schema from DefPred clauses', () => {
    const clause = getFirstClause('DefPred("graph/likes", "1", "graph/node", "0", "liquid/node").');

    expect(extractDefPredSchema(clause)).toEqual({
      schema: {
        kind: 'predicate-schema',
        predicateName: 'graph/likes',
        subjectCardinality: '1',
        subjectDomain: 'node',
        objectCardinality: '0',
        objectDomain: 'node',
      },
      range: clause.references[0]?.range,
    });
  });

  it('merges multi-field DefCompound declarations into one compound schema', () => {
    const clauses = parseClauses([
      'DefCompound("Indication", "clinical/medication", "1", "liquid/node").',
      'DefCompound("Indication", "clinical/code", "?", "liquid/string").',
    ].join('\n'));

    expect(extractDefCompoundSchemas(clauses)).toEqual([
      {
        schema: {
          kind: 'compound-schema',
          compoundName: 'Indication',
          fields: [
            { fieldName: 'clinical/medication', cardinality: '1', domain: 'node' },
            { fieldName: 'clinical/code', cardinality: '?', domain: 'text' },
          ],
        },
        range: clauses[0]?.references[0]?.range,
      },
    ]);
  });

  it('ignores unsupported arity and unknown type declarations', () => {
    const clauses = parseClauses([
      'DefCompound("Serving", "serv/id", "graph/node").',
      'DefPred("graph/likes", "one", "graph/node", "0", "liquid/node").',
      'DefCompound("Serving", "serv/unit", "1", "liquid/mystery").',
    ].join('\n'));

    expect(extractDatalogSchema(clauses)).toEqual([]);
  });
});

function parseClauses(source: string): readonly ParsedClause[] {
  const lineStarts = computeLineStarts(source);

  return splitStatements(source)
    .map((statement) => parseClause(statement, lineStarts, classifyReferenceRole))
    .filter((clause): clause is ParsedClause => clause !== null);
}

function getFirstClause(source: string): ParsedClause {
  const [clause] = parseClauses(source);

  if (clause === undefined) {
    throw new Error('Expected one parsed clause.');
  }

  return clause;
}
