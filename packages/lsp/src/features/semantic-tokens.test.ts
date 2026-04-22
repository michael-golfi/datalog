import { describe, expect, it } from 'vitest';

import { DATALOG_SAMPLE } from './datalog-sample.js';
import { computeSemanticTokens, encodeSemanticTokens } from './semantic-tokens.js';

describe('computeSemanticTokens', () => {
  it('tokenizes comments, predicate definitions, and graph ids', () => {
    const tokens = computeSemanticTokens(DATALOG_SAMPLE);

    expect(tokens.some((token) => token.tokenType === 'comment')).toBe(true);
    expect(tokens.some((token) => token.tokenType === 'function')).toBe(true);
    expect(tokens.some((token) => token.tokenType === 'variable')).toBe(true);
  });

  it('encodes semantic tokens in LSP delta format', () => {
    const encoded = encodeSemanticTokens(computeSemanticTokens(DATALOG_SAMPLE));

    expect(encoded.length).toBeGreaterThan(0);
    expect(encoded.length % 5).toBe(0);
  });
});
