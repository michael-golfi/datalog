import { describe, expect, it, vi } from 'vitest';

import { hydrateExternalSelectFactsRows } from './hydrate-external-select-facts-rows.js';
import { defineExternalResolverDefinition } from '../contracts/external-resolver-definition.js';

import type {
  ExternalResolverHydrateRequest,
  ExternalResolverResult,
  ExternalResolverRow,
  PostQueryHydrateExternalResolverDefinition,
} from '../contracts/external-resolver-definition.js';
import type { PreparedSelectFactsHydrationInstruction } from '../contracts/prepared-select-facts-execution.js';


describe('hydrateExternalSelectFactsRows', () => {
  it('preserves row count and ordering while deduping projected hydration keys', async () => {
    const hydrateRows = vi.fn(
      (request: ExternalResolverHydrateRequest): ExternalResolverResult<readonly ExternalResolverRow[]> => {
        expect(request.rows).toEqual([
          { valuesByColumn: { account_id: 'account-2' } },
          { valuesByColumn: { account_id: 'account-1' } },
        ]);

        return {
          ok: true,
          value: [
            { valuesByColumn: { account_id: 'account-2', account_profile: 'profile-silver' } },
            { valuesByColumn: { account_id: 'account-1', account_profile: 'profile-gold' } },
          ],
        };
      },
    );

    const rows = await hydrateExternalSelectFactsRows({
      instruction: createHydrationInstruction(hydrateRows),
      rows: [
        { accountId: 'account-2', person: 'vertex/bob' },
        { accountId: 'account-1', person: 'vertex/alice' },
        { accountId: 'account-2', person: 'vertex/carol' },
      ],
    });

    expect(hydrateRows).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([
      {
        accountId: 'account-2',
        person: 'vertex/bob',
        accountProfile: 'profile-silver',
      },
      {
        accountId: 'account-1',
        person: 'vertex/alice',
        accountProfile: 'profile-gold',
      },
      {
        accountId: 'account-2',
        person: 'vertex/carol',
        accountProfile: 'profile-silver',
      },
    ]);
  });

  it('fails fast when the hydration provider times out', async () => {
    await expect(
      hydrateExternalSelectFactsRows({
        instruction: createHydrationInstruction(() => ({
          ok: false,
          error: {
            code: 'EXTERNAL_PROVIDER_TIMEOUT',
            message: 'Hydration provider timed out.',
          },
        })),
        rows: [{ accountId: 'account-1', person: 'vertex/alice' }],
      }),
    ).rejects.toThrowError(
      expect.objectContaining({
        name: 'GraphTranslationError',
        code: 'EXTERNAL_PROVIDER_TIMEOUT',
        message: 'Hydration provider timed out.',
      }),
    );
  });

  it('fails fast when the hydration provider omits a requested payload', async () => {
    await expect(
      hydrateExternalSelectFactsRows({
        instruction: createHydrationInstruction(() => ({
          ok: true,
          value: [{ valuesByColumn: { account_id: 'account-1', account_profile: 'profile-gold' } }],
        })),
        rows: [
          { accountId: 'account-1', person: 'vertex/alice' },
          { accountId: 'account-2', person: 'vertex/bob' },
        ],
      }),
    ).rejects.toThrowError(
      expect.objectContaining({
        name: 'GraphTranslationError',
        code: 'EXTERNAL_PROVIDER_FAILURE',
        message:
          'Hydrated external predicate crmAccountHydration/2 returned no payload for a requested key tuple.',
      }),
    );
  });
});

function createHydrationInstruction(
  hydrateRows: PostQueryHydrateExternalResolverDefinition['hydrateRows'],
): PreparedSelectFactsHydrationInstruction {
  return {
    kind: 'hydrate-external-predicate',
    patternIndex: 2,
    predicateName: 'crmAccountHydration',
    columns: [
      { name: 'account_id', ordinal: 0, type: 'text' },
      { name: 'account_profile', ordinal: 1, type: 'jsonb' },
    ],
    keyColumns: ['account_id'],
    projectedKeyBindings: [{ keyColumn: 'account_id', outputFieldName: 'accountId' }],
    terms: [
      { kind: 'variable', name: 'accountId' },
      { kind: 'variable', name: 'accountProfile' },
    ],
    hydratedFieldName: 'accountProfile',
    resolver: createHydrationResolver(hydrateRows),
  };
}

function createHydrationResolver(
  hydrateRows: PostQueryHydrateExternalResolverDefinition['hydrateRows'],
): PostQueryHydrateExternalResolverDefinition {
  const resolver = defineExternalResolverDefinition({
    version: 1,
    provider: 'crm-api',
    mode: 'post_query_hydrate',
    keyColumns: ['account_id'],
    requestScopedDedupe: 'by-key',
    expectedRowShape: 'values-by-column',
    hydratedFieldName: 'accountProfile',
    hydrateRows,
  });

  if (resolver.mode !== 'post_query_hydrate') {
    throw new Error('Expected a post_query_hydrate resolver fixture.');
  }

  return resolver;
}
