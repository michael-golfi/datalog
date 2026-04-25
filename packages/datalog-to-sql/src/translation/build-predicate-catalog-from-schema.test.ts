import { defCompoundFieldSchema, defCompoundSchema, defPredSchema } from '@datalog/ast';
import { describe, expect, it } from 'vitest';

import type { GraphTranslationError } from '../contracts/graph-translation-error.js';

import { buildPredicateCatalogFromSchema } from './build-predicate-catalog-from-schema.js';

describe('buildPredicateCatalogFromSchema', () => {
  it('recreates the legacy graph catalog bindings from graph DefPred schemas', () => {
    expect(buildPredicateCatalogFromSchema([
      defPredSchema({
        predicateName: 'vertex',
        subjectCardinality: '1',
        subjectDomain: 'node',
        objectCardinality: '0',
        objectDomain: 'node',
      }),
      defPredSchema({
        predicateName: 'edge',
        subjectCardinality: '0',
        subjectDomain: 'node',
        objectCardinality: '0',
        objectDomain: 'node',
      }),
    ])).toEqual({
      version: 1,
      predicates: [
        {
          signature: {
            name: 'vertex',
            arity: 1,
            kind: 'edb',
            outputTypes: ['text'],
          },
          source: 'catalog',
          storage: {
            kind: 'postgres-table',
            relationName: 'vertices',
            columns: [
              {
                name: 'id',
                ordinal: 0,
                type: 'text',
              },
            ],
          },
          constraints: [],
          indexes: [],
          capabilities: {
            readable: true,
            writable: false,
            supportsPredicatePushdown: true,
            supportsJoinPushdown: true,
            supportsAggregationPushdown: false,
            supportsRecursionSeedPushdown: false,
            supportsDeltaScan: false,
          },
        },
        {
          signature: {
            name: 'edge',
            arity: 3,
            kind: 'edb',
            outputTypes: ['text', 'text', 'text'],
          },
          source: 'catalog',
          storage: {
            kind: 'postgres-table',
            relationName: 'edges',
            columns: [
              {
                name: 'subject_id',
                ordinal: 0,
                type: 'text',
              },
              {
                name: 'predicate_id',
                ordinal: 1,
                type: 'text',
              },
              {
                name: 'object_id',
                ordinal: 2,
                type: 'text',
              },
            ],
          },
          constraints: [],
          indexes: [],
          capabilities: {
            readable: true,
            writable: false,
            supportsPredicatePushdown: true,
            supportsJoinPushdown: true,
            supportsAggregationPushdown: false,
            supportsRecursionSeedPushdown: false,
            supportsDeltaScan: false,
          },
        },
      ],
    });
  });

  it('builds compound schema bindings as inline SQL views with field columns', () => {
    const catalog = buildPredicateCatalogFromSchema([
      defCompoundSchema({
        compoundName: 'Indication',
        fields: [
          defCompoundFieldSchema({
            fieldName: 'clinical/medication',
            cardinality: '1',
            domain: 'node',
          }),
          defCompoundFieldSchema({
            fieldName: 'clinical/code',
            cardinality: '?',
            domain: 'text',
          }),
        ],
      }),
    ]);

    expect(catalog.predicates).toEqual([
      {
        signature: {
          name: 'Indication',
          arity: 2,
          kind: 'edb',
          outputTypes: ['text', 'text'],
        },
        source: 'catalog',
        storage: {
          kind: 'postgres-view',
          relationName: 'Indication',
          columns: [
            {
              name: 'clinical/medication',
              ordinal: 0,
              type: 'text',
              nullable: false,
            },
            {
              name: 'clinical/code',
              ordinal: 1,
              type: 'text',
              nullable: true,
            },
          ],
          definitionSql: `select field_1.object_id as "clinical/medication", field_2.object_id as "clinical/code" from vertices hub join edges field_1 on field_1.subject_id = hub.id and field_1.predicate_id = 'clinical/medication' left join edges field_2 on field_2.subject_id = hub.id and field_2.predicate_id = 'clinical/code' where hub.id like 'Indication:%'`,
        },
        constraints: [],
        indexes: [],
        capabilities: {
          readable: true,
          writable: false,
          supportsPredicatePushdown: true,
          supportsJoinPushdown: true,
          supportsAggregationPushdown: false,
          supportsRecursionSeedPushdown: false,
          supportsDeltaScan: false,
        },
      },
    ]);
  });

  it('throws a structured error for unsupported scalar domains', () => {
    expect(() => buildPredicateCatalogFromSchema([
      {
        kind: 'predicate-schema',
        predicateName: 'graph/likes',
        subjectCardinality: '1',
        subjectDomain: 'node',
        objectCardinality: '0',
        objectDomain: 'uuid' as never,
      },
    ])).toThrowError(
      expect.objectContaining<Partial<GraphTranslationError>>({
        name: 'GraphTranslationError',
        code: 'datalog-to-sql.schema.unsupported-scalar-domain',
        message: 'Unsupported scalar domain uuid for graph/likes object.',
      }),
    );
  });
});
