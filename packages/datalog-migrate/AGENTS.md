# @datalog/datalog-migrate

## Ownership

- This package owns generic Datalog migration workflow tooling.
- It is the home for commit/status/uncommit/watch command logic and committed-migration metadata helpers.
- It must remain independent from ontology domain modeling and production SQL execution ownership.

## Package shape

- Keep `src/index.ts` export-only.
- Keep the package small and CLI/tooling-oriented.
- Prefer filesystem-driven helpers over code-heavy project modeling.
- If a module exists only to support tests or relies on dev-only imports, keep it test-scoped with `*.test.ts` naming instead of plain `src/**/*.ts`.

## What belongs here

- Flat committed migration discovery.
- Embedded migration metadata reading/validation.
- Current-vs-committed command workflows.
- Tooling-oriented tests for commit/status/uncommit/watch behavior.

## What does not belong here

- Canonical ontology content or domain-specific query logic.
- Production SQL execution helpers.
- VS Code, LSP, or extension runtime concerns.
- Consumer-facing tests must not force production-source classification for test-only support modules.

## Verification

- `yarn workspace @datalog/datalog-migrate lint`
- `yarn workspace @datalog/datalog-migrate typecheck`
- `yarn workspace @datalog/datalog-migrate build`
- `yarn workspace @datalog/datalog-migrate test`
