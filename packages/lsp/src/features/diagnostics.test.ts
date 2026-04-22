import { describe, expect, it } from 'vitest';

import { DATALOG_SAMPLE } from './datalog-sample.js';
import { computeDiagnostics } from './diagnostics.js';

describe('computeDiagnostics', () => {
  it('accepts valid graph-oriented datalog', () => {
    expect(computeDiagnostics(DATALOG_SAMPLE)).toHaveLength(0);
  });

  it('reports wrong builtin arity and duplicate DefPred contracts', () => {
    const source = [
      'DefPred("food/has_cuisine", "0", "liquid/node", "0", "liquid/node").',
      'DefPred("food/has_cuisine", "0", "liquid/node", "0", "liquid/node").',
      'Edge("concept/chickpea_bowl", "food/has_cuisine").',
    ].join('\n');
    const diagnostics = computeDiagnostics(source);

    expect(diagnostics.map((diagnostic) => diagnostic.message)).toContain('Duplicate DefPred for food/has_cuisine.');
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toContain('Edge expects arity 3, found 2.');
  });

  it('does not flag a one-line interactive query for missing trailing period', () => {
    expect(computeDiagnostics('ManagesReach(actor_id, manager_id, depth, path)')).toHaveLength(0);
  });
});
