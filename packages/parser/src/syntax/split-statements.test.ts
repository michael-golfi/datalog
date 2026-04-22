import { describe, expect, it } from 'vitest';

import { splitStatements } from './split-statements.js';

describe('splitStatements', () => {
  it('skips leading comments and keeps multiline rules intact', () => {
    const source = `% comment
Edge("node/a", "graph/likes", "node/b").

Reachable(node_a, node_b) :-
  Edge(node_a, "graph/likes", node_b).
`;

    expect(splitStatements(source)).toEqual([
      {
        text: 'Edge("node/a", "graph/likes", "node/b").',
        startOffset: 10,
      },
      {
        text: 'Reachable(node_a, node_b) :-\n  Edge(node_a, "graph/likes", node_b).',
        startOffset: 52,
      },
    ]);
  });
});
