import { describe, expect, it } from 'vitest';

import {
  defCompoundFieldSchema,
  defCompoundSchema,
  defPredSchema,
  generateCompoundIdentity,
} from './datalog-schema-builders.js';

describe('datalog schema builders', () => {
  it('builds predicate schemas with Liquid-style cardinality and domain metadata', () => {
    expect(defPredSchema({
      predicateName: 'graph/likes',
      subjectCardinality: '1',
      subjectDomain: 'node',
      objectCardinality: '*',
      objectDomain: 'node',
    })).toEqual({
      kind: 'predicate-schema',
      predicateName: 'graph/likes',
      subjectCardinality: '1',
      subjectDomain: 'node',
      objectCardinality: '*',
      objectDomain: 'node',
    });
  });

  it('builds compound schemas with cloned field metadata', () => {
    const fields = [
      defCompoundFieldSchema({ fieldName: 'clinical/medication', cardinality: '1', domain: 'node' }),
      defCompoundFieldSchema({ fieldName: 'clinical/code', cardinality: '1', domain: 'text' }),
    ];

    const schema = defCompoundSchema({
      compoundName: 'Indication',
      fields,
      mutable: false,
    });

    fields.push(defCompoundFieldSchema({ fieldName: 'clinical/ignored', cardinality: '?', domain: 'text' }));

    expect(schema).toEqual({
      kind: 'compound-schema',
      compoundName: 'Indication',
      fields: [
        { fieldName: 'clinical/medication', cardinality: '1', domain: 'node' },
        { fieldName: 'clinical/code', cardinality: '1', domain: 'text' },
      ],
      mutable: false,
    });
    expect(schema.fields).not.toBe(fields);
  });

  it('generates deterministic compound identities with alphabetical field ordering regardless of schema or map order', () => {
    const schema = defCompoundSchema({
      compoundName: 'Indication',
      fields: [
        defCompoundFieldSchema({ fieldName: 'clinical/code', cardinality: '1', domain: 'text' }),
        defCompoundFieldSchema({ fieldName: 'clinical/medication', cardinality: '1', domain: 'node' }),
      ],
    });

    const ordered = generateCompoundIdentity(
      schema,
      new Map([
        ['clinical/medication', 'medication/metformin'],
        ['clinical/code', '6809'],
      ]),
    );
    const reversed = generateCompoundIdentity(
      schema,
      new Map([
        ['clinical/code', '6809'],
        ['clinical/medication', 'medication/metformin'],
      ]),
    );

    expect(ordered).toBe('Indication:clinical/code=6809,clinical/medication=medication/metformin');
    expect(reversed).toBe(ordered);
  });

  it('encodes only compound identity values that contain Liquid separators', () => {
    const schema = defCompoundSchema({
      compoundName: 'ExternalMapping',
      fields: [
        defCompoundFieldSchema({ fieldName: 'mapping/code', cardinality: '1', domain: 'text' }),
        defCompoundFieldSchema({ fieldName: 'mapping/source', cardinality: '1', domain: 'text' }),
      ],
    });

    expect(generateCompoundIdentity(
      schema,
      new Map([
        ['mapping/source', 'rxnorm:2026'],
        ['mapping/code', 'alpha,beta'],
      ]),
    )).toBe('ExternalMapping:mapping/code=alpha%2Cbeta,mapping/source=rxnorm%3A2026');
  });

  it('throws when a compound identity field value is missing', () => {
    const schema = defCompoundSchema({
      compoundName: 'Indication',
      fields: [
        defCompoundFieldSchema({ fieldName: 'clinical/medication', cardinality: '1', domain: 'node' }),
      ],
    });

    expect(() => generateCompoundIdentity(schema, new Map())).toThrow('Missing compound identity field value for clinical/medication.');
  });
});
