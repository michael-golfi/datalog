# @datalog/medical-ontology-e2e

## Ownership

- This package owns the canonical medical ontology e2e fixture schema, compounds, n-ary edges, foreign-relation backlinks, mappings, and e2e assertions used to prove ontology behavior.
- It may define immutable fixture data, package-local test helpers, and assertion-oriented analysis seams that support end-to-end ontology verification.
- It must not take ownership of production SQL execution, database connection/runtime concerns, or PostgreSQL adapter behavior.
- It must not depend on VS Code, LanguageClient, extension-host code, or editor/LSP runtime wiring.

## Package shape

- Keep `src/index.ts` export-only.
- Organize code by aspect under `src/contracts`, `src/project`, `src/migrations`, `src/mappings`, and `src/queries`.
- Keep immutable source slices under `migrations/<migration-id>/` with colocated metadata and `ontology.dl` files.
- Keep tests colocated as `*.test.ts` beside the module they prove.
- Avoid deep imports into other workspaces; use `@datalog/*` package surfaces when cross-workspace dependencies become necessary in later tasks.

## Not here

- No production SQL runtime code.
- No `postgres`/`postgres.js` client usage in production sources.
- No VS Code APIs, `vscode-languageclient`, or editor runtime concerns in production sources.
- No production ownership of generic SQL/runtime helpers that belong in `@datalog/datalog-to-sql`.

## Current ownership seams

- `src/contracts/*` defines immutable migration/project contracts and local structural types.
- `src/project/*` owns immutable project construction and applied-history validation.
- `src/migrations/*` loads immutable migration metadata and records.
- `src/mappings/*` owns ontology fixture loading and mapping-oriented helper logic.
- `src/queries/*` owns ontology-specific query builders and DB-backed ontology assertions.
- Tests may call generic SQL helpers from `@datalog/datalog-to-sql`, but production ontology modules must not depend on SQL package types or runtime ownership.

## Verification

- `yarn workspace @datalog/medical-ontology-e2e lint`
- `yarn workspace @datalog/medical-ontology-e2e typecheck`
- `yarn workspace @datalog/medical-ontology-e2e build`
- `yarn workspace @datalog/medical-ontology-e2e test`
