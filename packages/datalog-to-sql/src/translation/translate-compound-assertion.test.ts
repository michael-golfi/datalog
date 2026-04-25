import {
  atom,
  constantTerm,
  defCompoundFieldSchema,
  defCompoundSchema,
  factStatement,
  namedTerm,
  variableTerm,
} from '@datalog/ast';
import { describe, expect, it } from 'vitest';

import { translateCompoundAssertion } from './translate-compound-assertion.js';
import { translateFactInsert } from './translate-fact-insert.js';

const INDICATION_SCHEMA = defCompoundSchema({
  compoundName: 'Indication',
  fields: [
    defCompoundFieldSchema({ fieldName: 'clinical/medication', cardinality: '1', domain: 'node' }),
    defCompoundFieldSchema({ fieldName: 'clinical/code', cardinality: '?', domain: 'text' }),
  ],
});

describe('translateCompoundAssertion', () => {
  it('lowers a compound assertion into a hub vertex plus field-edge inserts', () => {
    const operation = translateCompoundAssertion({
      kind: 'insert-compound-assertion',
      schema: INDICATION_SCHEMA,
      assertion: factStatement(atom('Indication', [
        namedTerm('cid', constantTerm('Indication:clinical/code=rxnorm%3A123,clinical/medication=drug/metformin')),
        namedTerm('clinical/medication', constantTerm('drug/metformin')),
        namedTerm('clinical/code', constantTerm('rxnorm:123')),
      ])),
    });

    expect(operation).toEqual({
      kind: 'insert-facts',
      facts: [
        {
          kind: 'vertex',
          id: 'Indication:clinical/code=rxnorm%3A123,clinical/medication=drug/metformin',
        },
        {
          kind: 'edge',
          subjectId: 'Indication:clinical/code=rxnorm%3A123,clinical/medication=drug/metformin',
          predicateId: 'clinical/medication',
          objectId: 'drug/metformin',
        },
        {
          kind: 'edge',
          subjectId: 'Indication:clinical/code=rxnorm%3A123,clinical/medication=drug/metformin',
          predicateId: 'clinical/code',
          objectId: 'rxnorm:123',
        },
      ],
    });
  });

  it('produces idempotent SQL inserts for duplicate compound assertions through the shared fact-insert path', () => {
    const lowered = translateCompoundAssertion({
      kind: 'insert-compound-assertion',
      schema: INDICATION_SCHEMA,
      assertion: factStatement(atom('Indication', [
        namedTerm('cid', constantTerm('Indication:clinical/code=rxnorm%3A123,clinical/medication=drug/metformin')),
        namedTerm('clinical/medication', constantTerm('drug/metformin')),
        namedTerm('clinical/code', constantTerm('rxnorm:123')),
      ])),
    });

    expect(translateFactInsert(lowered)).toEqual({
      operation: 'insert',
      text: 'with inserted_vertices as (insert into vertices (id) values ($1) on conflict do nothing returning id), inserted_edges as (insert into edges (subject_id, predicate_id, object_id) values ($2, $3, $4), ($5, $6, $7) on conflict do nothing returning subject_id, predicate_id, object_id) select 1;',
      values: [
        'Indication:clinical/code=rxnorm%3A123,clinical/medication=drug/metformin',
        'Indication:clinical/code=rxnorm%3A123,clinical/medication=drug/metformin',
        'clinical/medication',
        'drug/metformin',
        'Indication:clinical/code=rxnorm%3A123,clinical/medication=drug/metformin',
        'clinical/code',
        'rxnorm:123',
      ],
    });
  });

  it('derives the compound cid from field bindings when the cid term is a variable', () => {
    const operation = translateCompoundAssertion({
      kind: 'insert-compound-assertion',
      schema: INDICATION_SCHEMA,
      assertion: factStatement(atom('Indication', [
        namedTerm('clinical/code', constantTerm('rxnorm:123')),
        namedTerm('cid', variableTerm('Cid')),
        namedTerm('clinical/medication', constantTerm('drug/metformin')),
      ])),
    });

    expect(operation.facts[0]).toEqual({
      kind: 'vertex',
      id: 'Indication:clinical/code=rxnorm%3A123,clinical/medication=drug/metformin',
    });
  });
});
