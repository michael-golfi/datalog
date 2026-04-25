import { describe, expect, it, vi } from 'vitest';

import {
  EXTERNAL_RESOLVER_CAPABILITY_MATRIX,
  defineExternalResolverDefinition,
  type ExternalResolverDefinition,
} from './external-resolver-definition.js';

describe('defineExternalResolverDefinition', () => {
  it('accepts sql_pushdown resolvers with the v1 capability matrix', () => {
    const resolver = defineExternalResolverDefinition({
      version: 1,
      provider: 'crm-search',
      mode: 'sql_pushdown',
      keyColumns: ['account_id'],
      requestScopedDedupe: 'by-key',
      expectedRowShape: 'values-by-column',
      expectedColumnTypes: {
        account_id: 'text',
      },
    });

    expect(resolver).toMatchObject({
      mode: 'sql_pushdown',
      keyColumns: ['account_id'],
      requestScopedDedupe: 'by-key',
      expectedRowShape: 'values-by-column',
    });
    expect(EXTERNAL_RESOLVER_CAPABILITY_MATRIX[resolver.mode]).toEqual({
      supportsSqlPushdown: true,
      supportsMaterializeBeforeSql: false,
      supportsPostQueryHydration: false,
    });
  });

  it('accepts materialize_before_sql resolvers', () => {
    const resolver = defineExternalResolverDefinition({
      version: 1,
      provider: 'customer-api',
      mode: 'materialize_before_sql',
      keyColumns: ['customer_id'],
      requestScopedDedupe: 'by-key',
      expectedRowShape: 'values-by-column',
      materializeRows: vi.fn(() => ({
        ok: true,
        value: [
          {
            valuesByColumn: {
              customer_id: 'cust_1',
            },
          },
        ],
      } as const)),
    });

    expect(EXTERNAL_RESOLVER_CAPABILITY_MATRIX[resolver.mode]).toEqual({
      supportsSqlPushdown: false,
      supportsMaterializeBeforeSql: true,
      supportsPostQueryHydration: false,
    });
  });

  it('accepts post_query_hydrate resolvers with an explicit hydrated field name', () => {
    const resolver = defineExternalResolverDefinition({
      version: 1,
      provider: 'user-profile-service',
      mode: 'post_query_hydrate',
      keyColumns: ['user_id'],
      requestScopedDedupe: 'by-key',
      expectedRowShape: 'values-by-column',
      hydratedFieldName: 'profile',
      hydrateRows: vi.fn(() => ({
        ok: true,
        value: [
          {
            valuesByColumn: {
              user_id: 'user_1',
              profile: '{"tier":"gold"}',
            },
          },
        ],
      } as const)),
    });

    expect(resolver).toMatchObject({
      mode: 'post_query_hydrate',
      hydratedFieldName: 'profile',
    });
    expect(EXTERNAL_RESOLVER_CAPABILITY_MATRIX[resolver.mode]).toEqual({
      supportsSqlPushdown: false,
      supportsMaterializeBeforeSql: false,
      supportsPostQueryHydration: true,
    });
  });

  it('rejects duplicate key columns', () => {
    expect(() =>
      defineExternalResolverDefinition({
        version: 1,
        provider: 'customer-api',
        mode: 'materialize_before_sql',
        keyColumns: ['customer_id', 'customer_id'],
        requestScopedDedupe: 'by-key',
        expectedRowShape: 'values-by-column',
        materializeRows: vi.fn(),
      } as unknown as ExternalResolverDefinition),
    ).toThrowError(
      expect.objectContaining({
        name: 'ExternalResolverDefinitionError',
        code: 'EXTERNAL_RESOLVER_INVALID_KEY_COLUMNS',
        message: 'External resolver key columns must be unique. Received: customer_id, customer_id.',
      }),
    );
  });

  it('rejects sql_pushdown resolvers with non-sql handlers', () => {
    expect(() =>
      defineExternalResolverDefinition({
        version: 1,
        provider: 'crm-search',
        mode: 'sql_pushdown',
        keyColumns: ['account_id'],
        requestScopedDedupe: 'by-key',
        expectedRowShape: 'values-by-column',
        materializeRows: vi.fn(),
      } as unknown as ExternalResolverDefinition),
    ).toThrowError(
      expect.objectContaining({
        name: 'ExternalResolverDefinitionError',
        code: 'EXTERNAL_RESOLVER_INVALID_HANDLER_COMBINATION',
        message: 'sql_pushdown resolvers must define no provider handlers.',
      }),
    );
  });

  it('rejects post_query_hydrate resolvers without a hydrated field name', () => {
    expect(() =>
      defineExternalResolverDefinition({
        version: 1,
        provider: 'user-profile-service',
        mode: 'post_query_hydrate',
        keyColumns: ['user_id'],
        requestScopedDedupe: 'by-key',
        expectedRowShape: 'values-by-column',
        hydratedFieldName: '   ',
        hydrateRows: vi.fn(),
      } as unknown as ExternalResolverDefinition),
    ).toThrowError(
      expect.objectContaining({
        name: 'ExternalResolverDefinitionError',
        code: 'EXTERNAL_RESOLVER_INVALID_HYDRATED_FIELD_NAME',
        message: 'post_query_hydrate resolvers must declare a non-empty hydratedFieldName.',
      }),
    );
  });

  it('rejects non-hydrate resolvers that declare hydratedFieldName', () => {
    expect(() =>
      defineExternalResolverDefinition({
        version: 1,
        provider: 'customer-api',
        mode: 'materialize_before_sql',
        keyColumns: ['customer_id'],
        requestScopedDedupe: 'by-key',
        expectedRowShape: 'values-by-column',
        hydratedFieldName: 'profile',
        materializeRows: vi.fn(),
      } as unknown as ExternalResolverDefinition),
    ).toThrowError(
      expect.objectContaining({
        name: 'ExternalResolverDefinitionError',
        code: 'EXTERNAL_RESOLVER_INVALID_HYDRATED_FIELD_NAME',
        message: 'Only post_query_hydrate resolvers may declare hydratedFieldName.',
      }),
    );
  });
});
