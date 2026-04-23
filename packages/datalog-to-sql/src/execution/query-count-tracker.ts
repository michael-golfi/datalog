import type { PostgresSqlClient } from '../runtime/create-postgres-sql-client.js';

/** Wrap a postgres.js client and count how many translated queries execute through unsafe(). */
export function createQueryCountTracker(sql: PostgresSqlClient): {
  readonly sql: PostgresSqlClient;
  readonly getQueryCount: () => number;
} {
  let queryCount = 0;

  return {
    sql: new Proxy(sql, {
      get(target, property, receiver) {
        if (property !== 'unsafe') {
          return Reflect.get(target, property, receiver);
        }

        const unsafe = Reflect.get(target, property, receiver);

        if (typeof unsafe !== 'function') {
          throw new TypeError('Expected postgres client unsafe property to be a function.');
        }

        return new Proxy(unsafe, {
          apply(targetUnsafe, _thisArg, args) {
            queryCount += 1;
            return Reflect.apply(targetUnsafe, target, args);
          },
        });
      },
    }),
    getQueryCount: () => queryCount,
  };
}
