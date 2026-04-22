import { describe, expect, it } from 'vitest';

import { createOntologyLivePostgresProofFixture } from './fixtures/ontology-live-postgres-proof-fixture.js';

describe('ontology graph schema persistence', () => {
  it('verifies the graph schema has exactly the vertices and edges tables with correct structure', async () => {
    const fixture = await createOntologyLivePostgresProofFixture();

    try {
      const vertexColumns = await fixture.sql<Array<{
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>>`
        select column_name, data_type, is_nullable
        from information_schema.columns
        where table_schema = 'public' and table_name = 'vertices'
        order by ordinal_position
      `;

      expect(vertexColumns).toEqual([
        {
          column_name: 'id',
          data_type: 'text',
          is_nullable: 'NO',
        },
      ]);

      const edgeColumns = await fixture.sql<Array<{
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>>`
        select column_name, data_type, is_nullable
        from information_schema.columns
        where table_schema = 'public' and table_name = 'edges'
        order by ordinal_position
      `;

      expect(edgeColumns).toEqual([
        {
          column_name: 'subject_id',
          data_type: 'text',
          is_nullable: 'NO',
        },
        {
          column_name: 'predicate_id',
          data_type: 'text',
          is_nullable: 'NO',
        },
        {
          column_name: 'object_id',
          data_type: 'text',
          is_nullable: 'NO',
        },
      ]);

      const vertexPrimaryKeys = await fixture.sql<Array<{ constraint_type: string }>>`
        select tc.constraint_type
        from information_schema.table_constraints tc
        where tc.table_schema = 'public'
          and tc.table_name = 'vertices'
          and tc.constraint_type = 'PRIMARY KEY'
      `;

      expect(vertexPrimaryKeys).toEqual([{ constraint_type: 'PRIMARY KEY' }]);

      const edgePrimaryKeys = await fixture.sql<Array<{ constraint_type: string }>>`
        select tc.constraint_type
        from information_schema.table_constraints tc
        where tc.table_schema = 'public'
          and tc.table_name = 'edges'
          and tc.constraint_type = 'PRIMARY KEY'
      `;

      expect(edgePrimaryKeys).toEqual([{ constraint_type: 'PRIMARY KEY' }]);

      const edgeIndexes = await fixture.sql<Array<{ indexname: string }>>`
        select indexname
        from pg_indexes
        where schemaname = 'public' and tablename = 'edges'
        order by indexname
      `;

      expect(edgeIndexes.map((index) => index.indexname)).toContain('edges_predicate_subject_idx');

      const publicTables = await fixture.sql<Array<{ tablename: string }>>`
        select tablename
        from pg_tables
        where schemaname = 'public'
        order by tablename
      `;

      expect(publicTables.map((table) => table.tablename)).toEqual(['edges', 'vertices']);
    } finally {
      await fixture.cleanup();
    }
  });
});
