import { describe, expect, it } from 'vitest';

import { splitDatalogFactBatches } from './split-datalog-fact-batches.js';

describe('splitDatalogFactBatches', () => {
  it('splits large fact sets before they exceed PostgreSQL parameter limits', () => {
    const facts = Array.from({ length: 21_000 }, (_, index) => ({
      kind: 'edge' as const,
      subjectId: `vertex/${index}`,
      predicateId: 'graph/reachable',
      objectId: `vertex/${index + 1}`,
    })) as [
      {
        readonly kind: 'edge';
        readonly subjectId: string;
        readonly predicateId: string;
        readonly objectId: string;
      },
      ...Array<{
        readonly kind: 'edge';
        readonly subjectId: string;
        readonly predicateId: string;
        readonly objectId: string;
      }>,
    ];

    const batches = splitDatalogFactBatches(facts);

    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(20_000);
    expect(batches[1]).toHaveLength(1_000);
  });
});
