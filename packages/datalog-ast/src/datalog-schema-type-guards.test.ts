import { describe, expect, it } from 'vitest';

import {
  defCompoundFieldSchema,
  defCompoundSchema,
  defPredSchema,
} from './datalog-schema-builders.js';
import {
  isCardinality,
  isDatalogSchema,
  isDefCompoundFieldSchema,
  isDefCompoundSchema,
  isDefPredSchema,
  isScalarDomain,
} from './datalog-schema-type-guards.js';

describe('datalog schema type guards', () => {
  it('accepts supported cardinalities and scalar domains', () => {
    expect(isCardinality('1')).toBe(true);
    expect(isCardinality('*')).toBe(true);
    expect(isCardinality('many')).toBe(false);
    expect(isScalarDomain('node')).toBe(true);
    expect(isScalarDomain('text')).toBe(true);
    expect(isScalarDomain('unknown')).toBe(false);
  });

  it('accepts valid predicate schemas and rejects invalid shapes', () => {
    expect(isDefPredSchema(defPredSchema({
      predicateName: 'graph/likes',
      subjectCardinality: '1',
      subjectDomain: 'node',
      objectCardinality: '*',
      objectDomain: 'node',
    }))).toBe(true);
    expect(isDefPredSchema({
      kind: 'predicate-schema',
      predicateName: 'graph/likes',
      subjectCardinality: 'one',
      subjectDomain: 'node',
      objectCardinality: '*',
      objectDomain: 'node',
    })).toBe(false);
  });

  it('accepts compound field and compound schemas only when their shapes match', () => {
    const field = defCompoundFieldSchema({
      fieldName: 'clinical/code',
      cardinality: '1',
      domain: 'text',
    });
    const schema = defCompoundSchema({
      compoundName: 'Indication',
      fields: [field],
    });

    expect(isDefCompoundFieldSchema(field)).toBe(true);
    expect(isDefCompoundFieldSchema({ fieldName: 'clinical/code', cardinality: '1', domain: 'unknown' })).toBe(false);
    expect(isDefCompoundSchema(schema)).toBe(true);
    expect(isDefCompoundSchema({
      kind: 'compound-schema',
      compoundName: 'Indication',
      fields: [{ fieldName: 'clinical/code', cardinality: '1', domain: 'unknown' }],
    })).toBe(false);
    expect(isDatalogSchema(schema)).toBe(true);
  });
});
