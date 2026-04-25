import { describe, expect, it } from 'vitest';

import { BUILTIN_PREDICATE_DOCS } from './builtin-predicate-docs.js';

describe('BUILTIN_PREDICATE_DOCS', () => {
  it('contains documentation for the core builtins surfaced by the LSP', () => {
    expect(BUILTIN_PREDICATE_DOCS.get('DefPred')).toMatchObject({
      name: 'DefPred',
      summary: expect.stringContaining('graph predicate contract'),
    });
    expect(BUILTIN_PREDICATE_DOCS.get('Edge')).toMatchObject({
      name: 'Edge',
      summary: expect.stringContaining('typed graph edge'),
    });
    expect(BUILTIN_PREDICATE_DOCS.get('TypeAndCardinality')).toMatchObject({
      name: 'TypeAndCardinality',
      summary: expect.stringContaining('type/cardinality pairs'),
    });
  });

  it('gives every builtin entry non-empty summary, detail, and example text', () => {
    for (const [name, doc] of BUILTIN_PREDICATE_DOCS.entries()) {
      expect(doc.name).toBe(name);
      expect(doc.summary.trim().length).toBeGreaterThan(0);
      expect(doc.detail.trim().length).toBeGreaterThan(0);
      expect(doc.example.trim().length).toBeGreaterThan(0);
    }
  });
});
