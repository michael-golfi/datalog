---
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: false
description: "Enforces consistent error/result patterns: Result types for expected outcomes, throws for exceptional cases, domain-qualified error codes"
---

# Error and Result Handling Rules

Incorrect error handling can hide parser failures, blur protocol behavior, or make editor diagnostics unreliable. Treat error and result design as part of the package contract, not as cosmetic style.

## Core Principle: Result for Expected, Throw for Exceptional

- **Expected domain outcomes** (validation failure, not found, already exists, ineligible) use a `Result` type — never throw, never return `null`.
- **Exceptional situations** (infrastructure failure, invariant violation, unreachable state) throw a typed domain error.

```ts
// Good: expected outcome → Result
type FindCaptureResult = 
  | { ok: true; value: Capture }
  | { ok: false; error: CaptureNotFound };

// Bad: expected outcome → null (caller must remember to check)
function findCapture(id: string): Capture | null;

// Bad: expected outcome → throw (control flow by exception)
function findCapture(id: string): Capture; // throws CaptureNotFound
```

## Result Type Convention

- Use discriminated union `{ ok: true; value: T } | { ok: false; error: E }` as the standard Result shape.
- The `error` field in a failed result must be a typed domain error, not a string or generic Error.
- Consumers must handle both branches explicitly. Use exhaustive `if (result.ok)` checks.

```ts
const result = await parseDocument(source);
if (!result.ok) {
  logger.warn('Document parsing failed', { error: result.error });
  return;
}
// result.value is now safely typed
```

## Domain Error Design

- Domain errors extend a base error class with a structured `code`, human-readable `message`, and optional `cause`.
- Error codes are **domain-qualified dot-separated strings** that identify the subsystem and the specific failure.

```ts
class DatalogDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ParseError extends DatalogDomainError {
  constructor(detail: string, cause?: unknown) {
    super('parser.parse.failed', detail, cause);
  }
}
```

- Error code format: `<domain>.<subsystem>.<specific-failure>`
  - Examples: `parser.token.unexpected`, `lsp.document.not-found`, `extension.command.failed`
- Never reuse an error code across different failure modes. Each distinct failure gets its own code.
- Error messages should be human-readable and safe for logs. Never include secrets, tokens, or raw user input in error messages.

## Error Propagation

- **Domain layers** throw or return Result types. They do not log errors (that is an orchestration concern).
- **Orchestration layers** catch domain errors, log them through the repo's logging surface, and translate them into protocol-appropriate responses.
- **Boundary layers** translate domain errors into editor diagnostics, protocol responses, or command failures. They must not define new error types, only map existing ones.
- **Never catch and swallow errors silently.** If you catch an error and continue, document why continuation is safe.

```ts
// Bad: swallowed error
try {
  await publishDiagnostics(document);
} catch {
  // ignore
}

// Acceptable: documented, justified
try {
  await publishDiagnostics(document);
} catch (err) {
  // Diagnostic publication is best-effort here; the parse result
  // already exists. Loss is acceptable and logged.
  logger.warn('Secondary diagnostic publication failed', { error: err });
}
```

## Forbidden Patterns

- **Never use `try/catch` for control flow.** Use type narrowing, Result checks, or validation guards instead.
- **Never mix error strategies within a single module.** Pick one (Result or throw) per function and be consistent within the file.
- **Never return `null` or `undefined` to signal expected failure.** Use a Result type.
- **Never throw raw `Error` from domain logic.** Throw a typed domain error with a qualified code.
- **Never catch a domain error and re-throw as a different type without preserving the original cause.**

## Catch Block Rules

- Catch variables are `unknown` (enforced by `useUnknownInCatchVariables`). Narrow explicitly.
- Every catch block must do at least one of: log, re-throw, wrap in a Result, or return a structured fallback. Empty catch blocks are forbidden.
- When wrapping a caught error, preserve the original as `cause`:

```ts
catch (err) {
  throw new ParseError('Failed to parse document', err);
}
```

## Logging Errors

- Logging an error is not handling it. If you log and continue, the calling code must still work correctly without the failed operation's result.
- Use structured logging through the repo's logging surface. Include the error code and relevant context, never raw error objects alone.
- Production code must not use `console.error` or `console.warn`.
