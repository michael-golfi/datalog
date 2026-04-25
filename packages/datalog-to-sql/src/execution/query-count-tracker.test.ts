import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryCountTracker } from './query-count-tracker.js';

import type { PostgresSqlClient } from '../runtime/create-postgres-sql-client.js';

const sqlQuery = vi.fn();
const sqlUnsafe = vi.fn();
const sqlEnd = vi.fn();
const createPostgresSqlClient = vi.fn((connectionString: string) => {
  expect(connectionString).toBeTypeOf('string');
  return Object.assign(sqlQuery, {
    unsafe: sqlUnsafe,
    end: sqlEnd,
  }) as unknown as PostgresSqlClient;
});

vi.mock('../runtime/create-postgres-sql-client.js', () => ({
  createPostgresSqlClient,
}));

describe('createQueryCountTracker', () => {
  beforeEach(() => {
    sqlQuery.mockReset();
    sqlUnsafe.mockReset();
    sqlEnd.mockReset();
    createPostgresSqlClient.mockClear();
  });

  it('counts each unsafe call while delegating to the wrapped client', async () => {
    sqlUnsafe.mockResolvedValueOnce([{ id: 'vertex/alice' }]);
    const sql = createPostgresSqlClient('postgresql://example');

    const tracker = createQueryCountTracker(sql);

    await expect(
      tracker.sql.unsafe('select * from vertices where id = $1;', ['vertex/alice']),
    ).resolves.toEqual([{ id: 'vertex/alice' }]);
    expect(tracker.getQueryCount()).toBe(1);
    expect(sqlUnsafe).toHaveBeenCalledWith('select * from vertices where id = $1;', [
      'vertex/alice',
    ]);
  });

  it('preserves the wrapped client template tag and end methods', async () => {
    sqlQuery.mockResolvedValueOnce([{ count: '1' }]);
    sqlEnd.mockResolvedValueOnce(undefined);
    const sql = createPostgresSqlClient('postgresql://example');

    const tracker = createQueryCountTracker(sql);

    await expect(tracker.sql`select count(*)::text as count from vertices`).resolves.toEqual([
      { count: '1' },
    ]);
    await expect(tracker.sql.end({ timeout: 1 })).resolves.toBeUndefined();
    expect(tracker.getQueryCount()).toBe(0);
  });
});
