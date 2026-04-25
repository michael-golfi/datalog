import { describe, expect, it } from 'vitest';

import { extractCompoundFields } from './extract-compound-fields.js';

describe('extractCompoundFields', () => {
  it('extracts unique top-level field names from compound syntax', () => {
    expect(extractCompoundFields('id=X, unit="g", note="ok", id=Y')).toEqual(['id', 'unit', 'note']);
  });

  it('ignores field-like text inside escaped quoted values', () => {
    expect(extractCompoundFields('id="serv/chickpea", note="quoted unit=grams and \\"fake=value\\"", unit="g"')).toEqual([
      'id',
      'note',
      'unit',
    ]);
  });
});
