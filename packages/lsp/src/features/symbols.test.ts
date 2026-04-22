import { describe, expect, it } from 'vitest';

import { DATALOG_SAMPLE } from './datalog-sample.js';
import { computeDocumentSymbols } from './symbols.js';

describe('computeDocumentSymbols', () => {
  it('surfaces schema, compound, and rule symbols', () => {
    const symbols = computeDocumentSymbols(DATALOG_SAMPLE);

    expect(symbols.map((symbol) => symbol.name)).toContain('DefPred');
    expect(symbols.map((symbol) => symbol.name)).toContain('Serving@');
    expect(symbols.map((symbol) => symbol.name)).toContain('ClassAncestor');
  });
});
