# @datalog/medical-ontology-e2e

## Ownership

- This package owns the canonical medical ontology e2e fixture schema, compounds, n-ary edges, foreign-relation backlinks, mappings, and e2e assertions used to prove ontology behavior.
- It may define immutable fixture data, package-local test helpers, and assertion-oriented analysis seams that support end-to-end ontology verification.
- It must not take ownership of production SQL execution, database connection/runtime concerns, or PostgreSQL adapter behavior.
- It must not depend on VS Code, LanguageClient, extension-host code, or editor/LSP runtime wiring.

## Package shape

- Keep `src/index.ts` export-only.
- Keep runtime code minimal: small path-resolution and migration-discovery helpers only.
- Keep ontology meaning in Datalog files under `migrations/` rather than expanding TypeScript modeling layers.
- Committed migrations are moving to flat dated `.dl` files, with `current.dl` reserved as the mutable working area for later CLI tasks.
- Keep tests colocated as `*.test.ts` beside the module they prove.
- Avoid deep imports into other workspaces; use `@datalog/*` package surfaces when cross-workspace dependencies become necessary in later tasks.

## Not here

- No production SQL runtime code.
- No `postgres`/`postgres.js` client usage in production sources.
- No VS Code APIs, `vscode-languageclient`, or editor runtime concerns in production sources.
- No production ownership of generic SQL/runtime helpers that belong in `@datalog/datalog-to-sql`.

## Current ownership seams

- `src/resolve-medical-ontology-workspace-path.ts` owns package-root path resolution.
- `src/load-ontology-project-files.ts` owns minimal committed-migration/current-work-area discovery for future CLI support.
- Later tasks will add commit metadata/hashing and the actual commit CLI workflow on top of the flat/current layout.

## Verification

- `yarn workspace @datalog/medical-ontology-e2e lint`
- `yarn workspace @datalog/medical-ontology-e2e typecheck`
- `yarn workspace @datalog/medical-ontology-e2e build`
- `yarn workspace @datalog/medical-ontology-e2e test`
