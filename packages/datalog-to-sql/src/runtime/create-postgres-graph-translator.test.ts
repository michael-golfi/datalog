import { describe, expect, it } from 'vitest';

import { createPostgresGraphTranslator } from './create-postgres-graph-translator.js';

describe('createPostgresGraphTranslator', () => {
  it('creates a translator explicitly targeting PostgreSQL 13+ edges and vertices tables', () => {
    const translator = createPostgresGraphTranslator();

    expect(translator.target).toEqual({
      dialect: 'postgresql',
      minimumVersion: 13,
      edgeTable: 'edges',
      vertexTable: 'vertices',
    });
  });

  it('exposes a translate function for graph operations', () => {
    const translator = createPostgresGraphTranslator();

    expect(
      translator.translate({
        kind: 'select-vertex-by-id',
        vertexId: 'vertex/alice',
      }),
    ).toEqual({
      ok: true,
      value: {
        operation: 'select',
        text: 'select * from vertices where id = $1;',
        values: ['vertex/alice'],
      },
    });
  });
});
