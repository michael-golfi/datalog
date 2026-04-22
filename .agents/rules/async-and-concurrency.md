# Async and Concurrency Coding Style

This repo contains parser, language-server, and extension code. Async correctness is not optional because races or hidden concurrency bugs can produce stale diagnostics, duplicate requests, or confusing editor behavior.

## Parallel by Default

- **Independent async operations must run in parallel** via `Promise.all` or `Promise.allSettled`.
- Sequential `await` calls on independent operations are a code smell. If operation B does not need the result of operation A, run them concurrently.

```ts
// Good: independent lookups run in parallel
const [user, preferences, recentEvents] = await Promise.all([
  userRepo.findById(userId),
  preferenceRepo.findByUserId(userId),
  eventRepo.findRecent(userId, { limit: 10 }),
]);

// Bad: independent lookups run sequentially for no reason
const user = await userRepo.findById(userId);
const preferences = await preferenceRepo.findByUserId(userId);
const recentEvents = await eventRepo.findRecent(userId, { limit: 10 });
```

- When operations are dependent, make the dependency explicit in the code structure. A reader should be able to tell what depends on what without tracing variable usage.

## Error Handling in Parallel Work

- `Promise.all` rejects on the first failure. Use it when all operations must succeed or the entire batch should fail.
- `Promise.allSettled` when individual failures should not cancel the batch. Inspect each settlement explicitly.

```ts
const results = await Promise.allSettled([
  recordEvent(eventA),
  recordEvent(eventB),
  recordEvent(eventC),
]);

for (const result of results) {
  if (result.status === 'rejected') {
    logger.warn('Event recording failed', { error: result.reason });
  }
}
```

- When using `Promise.all`, ensure each promise captures its own error context. Unhandled rejections from parallel work are hard to diagnose after the fact.

```ts
// Good: each promise captures context
await Promise.all([
  processChannel(channelA).catch(err => { throw new ChannelError('channel-a failed', err); }),
  processChannel(channelB).catch(err => { throw new ChannelError('channel-b failed', err); }),
]);
```

## Mutable State and Concurrency

- **Never share mutable state across concurrent operations.** Use immutable inputs and collect results.
- If two concurrent operations must coordinate, use an explicit coordination mechanism — not implicit timing assumptions.

```ts
// Bad: shared mutable array
const results: Capture[] = [];
await Promise.all(ids.map(id =>
  fetchCapture(id).then(c => results.push(c)) // race condition on push
));

// Good: immutable collection
const results = await Promise.all(ids.map(id => fetchCapture(id)));
```

## Request Deduplication

- Repeated editor or protocol requests should be safe to retry or collapse when the same input is processed more than once.
- Use stable request keys, cache checks, or document-version guards where appropriate.
- Design deduplication at the handler level, not at the caller level. The handler owns its retry and replay contract.

```ts
// Good: document-version guard
async function publishIfCurrent(request: DiagnosticsRequest): Promise<void> {
  if (request.version !== documents.get(request.uri)?.version) return;
  await diagnostics.publish(request);
}
```

## Database Concurrency

- Operations that touch the same mutable document state must not run concurrently without explicit locking or serialization.
- Use stable ownership and version checks as the last line of defense against stale concurrent updates.

## Async Flow Clarity

- **Keep async flow top-to-bottom.** A reader should trace execution order by reading the file from top to bottom.
- **Do not mix async styles.** Pick `async/await` or `.then()` — do not mix both in one function.
- **Do not create promises you do not await or return.** Fire-and-forget must be explicitly documented.

```ts
// Bad: fire-and-forget without documentation
auditLog.record(event); // returns a Promise, but nobody awaits it

// Acceptable: documented fire-and-forget
// Audit recording is non-blocking; loss is acceptable for this path.
void auditLog.record(event);
```

## What Not To Do

- **Do not use `Promise.race` for timeout semantics** unless the runner handles cleanup of the losing promise. Leaking unresolved promises wastes resources.
- **Do not nest `Promise.all` inside `Promise.all`** without clear structural boundaries. Flatten or extract named sub-operations.
- **Do not use `await` inside loops** when the iterations are independent. Collect promises and `await Promise.all(promises)`.
- **Do not use `setTimeout` or `setInterval`** for coordination of core editor or language-server flows when explicit task management is available.
