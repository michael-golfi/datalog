# Zod and Validation Coding Style

All external input must be validated at the boundary before entering domain logic. This repo uses Zod as the schema validation library. Validation is the first line of defense, especially for parser inputs, protocol payloads, and extension-facing settings.

## General Principles

- **Validate at boundaries, not deep in domain logic.** Parser entrypoints, protocol handlers, and extension settings loaders validate input. Domain functions receive typed, already-validated data.
- Domain logic may assert invariants (e.g., "this grade must be one of the known grades"), but input parsing happens at the boundary.
- Validation failures produce a structured error, never a raw Zod error thrown to the caller.

## Schema Placement

- Shared transport or protocol schemas should live in the package that owns the contract.
- Package-specific input schemas may live next to the boundary that uses them.
- Domain invariant schemas should live in the package that owns the invariant.

## Naming

- Schema variables are named with a `Schema` suffix: `parseRequestSchema`, `configurationSchema`, `completionParamsSchema`.
- Inferred types use the corresponding name without `Schema`: `ParseRequest`, `Configuration`, `CompletionParams`.

```ts
export const parseRequestSchema = z.object({
  uri: z.string().url(),
  languageId: z.string().min(1),
  source: z.string().min(1),
});

export type ParseRequest = z.infer<typeof parseRequestSchema>;
```

## Schema Design

- **Never use `.nonstrict()` or `.passthrough()`** on inbound data. Use `.strip()` to remove unknown keys if needed, or `.strict()` to reject them outright.
- Prefer `.strict()` for external input (editor settings, protocol payloads) and `.strip()` for internal input where forward compatibility matters.
- Derived or transformed values (normalized dates, parsed enums, computed defaults) should be produced by schema transforms, not by post-parse mutation.

```ts
// Good: transform in schema
const parseOptionsSchema = z.object({
  tabSize: z.number().int().positive(),
  languageId: z.string().transform(id => id.toLowerCase()),
});

// Bad: post-parse mutation
const raw = parseOptionsSchema.parse(input);
raw.languageId = raw.languageId.trim(); // mutation after validation
```

- Use `.brand()` or `.refine()` for domain-specific validation that goes beyond structural checks (e.g., "end date must be after start date").

## Error Handling

- Schema parsing failures must be caught at the boundary and translated into a structured validation error — not allowed to propagate as a raw `ZodError`.

```ts
const result = parseRequestSchema.safeParse(raw);
if (!result.success) {
  const issues = result.error.issues.map(i => ({
    path: i.path.join('.'),
    message: i.message,
  }));
  return { ok: false, error: new ValidationError('parser.request.invalid', issues) };
}
```

- Validation errors should include enough context (field paths, expected types) for the caller to construct a useful error response.
- Never expose raw Zod error details directly to external consumers. Translate them into a stable error format.

## Runtime Safety

- Zod schemas in runtime-safe files (`*.shared.ts`, `*.browser.ts`, `*.edge.ts`, `*.native.ts`) must not use transforms that require Node-only APIs.
- Schema definitions are pure data descriptions. They should not import `fs`, make network calls, or access `process.env`.

## What Not To Do

- **Do not validate the same data twice** at different layers. If the boundary validates the input shape, the domain layer can trust the type.
- **Do not use Zod schemas as a replacement for domain types.** Schemas validate input; domain types define the business vocabulary. They work together but serve different purposes.
- **Do not define schemas inline in entrypoints or protocol handlers.** Name them, export them, and test them independently.
- **Do not use `.any()` or `.unknown()` without a comment explaining why the shape cannot be known.** If the shape is known, define it.
