---
globs: ["**/*.test.ts", "**/*.spec.ts"]
alwaysApply: false
description: "Enforces testing standards: colocated tests, no barrel imports, runtime-safe constraints, structured assertions"
---

# Testing Enforcement Rules

Tests are the safety net for parser, language-server, and extension behavior. A broken or misleading test is worse than no test.

## File Placement

- **Colocated tests only.** Test files live next to the implementation they test: `parser.ts` → `parser.test.ts`.
- No top-level `test/` or `__tests__/` directories except for workspace-level fixture harnesses documented in a local `AGENTS.md`.
- Workspace AGENTS.md files may designate fixture-only directories. Follow those designations exactly.

## Import Discipline

- **Tests import implementation files directly**, never through barrel exports (`index.ts`).
- If a test needs a type from a barrel, import the type from the implementation file that defines it, or use `import type` from the barrel if the type is re-exported but not defined elsewhere.
- Never hide the unit under test behind an unrelated package entrypoint. Import the implementation module or the package surface the test is intentionally proving.

```ts
// Good: direct import
import { parseDocument } from '../src/lib/parser.js';

// Bad: broad package import when the test is really about one module
import { parseDocument } from '@datalog/parser';
```

## Runtime Safety

- Test files that run in runtime-safe contexts (`*.browser.test.ts`, `*.edge.test.ts`, `*.native.test.ts`) must not import Node-only modules (`fs`, `path`, `node:*`).
- Keep runtime-specific stubs close to the package that uses them. Do not add ad hoc mocks when a shared fixture already exists.

## Test Structure

- Use descriptive test names that state the expected behavior, not the implementation detail.

```ts
// Good: behavior-focused
it('reports an error for an unterminated rule');

// Bad: implementation-focused
it('calls parse error branch');
```

- Group related tests with `describe` blocks named after the unit under test and the scenario.
- No implicit shared mutable state between tests. Each test sets up its own world.
- If setup is expensive and must be shared, use `beforeAll`/`afterAll` with immutable fixtures. Document why sharing is safe.

## Assertions

- **No snapshot tests for parser or diagnostic semantics.** Parser results, diagnostics, completions, and semantic behavior must use structured assertions against explicit expected values. Snapshots hide semantic regressions behind text diffs.
- Snapshot tests are acceptable for serialization format stability, transport shape compatibility, and rendering output where the exact string matters.
- Assert on the specific property or behavior you intend to verify, not on the entire object shape unless the full shape is the contract under test.

## What Not To Test

- **Do not test glue surfaces** (`extension.ts`, server bootstrap files, `index.ts`) unless the task explicitly requires it. These are wiring layers verified by integration or smoke validation.
- **Do not test framework behavior** that the framework already tests. Test your integration with the framework, not the framework itself.
- **Do not test private methods directly.** Test through the public API. If a private method needs direct testing, consider whether it should be a separate module with its own public contract.

## Coverage Expectations

- Every exported function in a package should have at least one test covering the happy path and one covering a known failure mode.
- Boundary validation logic (input parsing, schema enforcement) must have tests for valid input, invalid input, and edge cases (missing fields, wrong types, extra fields).
- Error handling paths must be tested — a catch block without a test proving it executes is a gap.

## Conventions

- Test file naming: `*.test.ts`. Do not use `*.spec.ts` unless a workspace AGENTS.md explicitly requires it.
- One test file per implementation file. If an implementation file is split, split the test file correspondingly.
- Use the project's configured test runner and assertion library. Do not introduce new testing dependencies without explicit approval.
