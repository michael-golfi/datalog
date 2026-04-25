# @datalog/medical-ontology-e2e

## Ownership

- This package owns the canonical medical ontology e2e fixture schema, compounds, n-ary edges, foreign-relation backlinks, mappings, and e2e assertions used to prove ontology behavior.
- It may define immutable fixture data, package-local test helpers, and assertion-oriented analysis seams that support end-to-end ontology verification.
- It must not take ownership of production SQL execution, database connection/runtime concerns, or PostgreSQL adapter behavior.
- It must not depend on VS Code, LanguageClient, extension-host code, or editor/LSP runtime wiring.

## Package shape

- Do not keep a package-style `src/` tree or export surface here; this workspace is fixture/test-owned.
- Keep helper code test-scoped and package-local under `test/fixtures/` with explicit fixture-oriented names.
- Keep ontology meaning in Datalog files under `migrations/` rather than expanding TypeScript modeling layers.
- Committed migrations are moving to flat dated `.dl` files, with `current.dl` reserved as the mutable working area for later CLI tasks.
- Keep workspace test suites under `test/**/*.test.ts` and package-local support modules under `test/fixtures/**/*.ts`.
- Avoid deep imports into other workspaces; use `@datalog/*` package surfaces when cross-workspace dependencies become necessary in later tasks.
- When invoking migration tooling, use `@datalog/datalog-migrate` package exports or public binaries only; do not deep-link into sibling `dist/` output or private source files.

## Not here

- No production SQL runtime code.
- No `postgres`/`postgres.js` client usage in production sources.
- No VS Code APIs, `vscode-languageclient`, or editor runtime concerns in production sources.
- No production ownership of generic SQL/runtime helpers that belong in `@datalog/datalog-to-sql`.

## Current ownership seams

- `test/fixtures/medical-ontology-workspace-path-support.ts` owns package-local path resolution for tests and workspace helpers.
- `test/fixtures/committed-ontology-facts-fixture.ts` owns domain-specific loading of committed ontology edge facts for SQL-backed verification.
- `test/fixtures/ontology-migration-chain-fixture.ts` owns the package-local CLI workspace fixture and canonical migration-chain replay used by consumer-side tests.
- Graphile-Migrate-style workflow tooling now lives in `@datalog/datalog-migrate` and this package consumes it through scripts/tests instead of owning the implementation directly.
- Consumer-side tests should generate chains by writing current-state step bodies and committing them through the public CLI seam, then prove outcomes from the generated `migrations/` state rather than inspecting migration internals directly.

## Verification

- GraphRAG coverage is intentionally split by intent between `test/ontology-graph-rag-live-e2e.test.ts` for the PostgreSQL-backed happy path and `test/ontology-graph-rag-edge-cases.test.ts` for plain no-LLM and invalid-metadata edge cases; both must remain available through `yarn workspace @datalog/medical-ontology-e2e test`.
- Keep `test/ontology-graph-rag-live-e2e.test.ts` as the only suite that exercises live OpenAI answering, and keep that block declaration-time gated through the existing opt-in `OPENAI_API_KEY` availability check instead of treating it as unconditional default coverage.
- Preserve `MEDICAL_ONTOLOGY_E2E_ADMIN_POSTGRES_URL` as the admin PostgreSQL override for verification against the live fixture seam used by the live GraphRAG suite.
- `yarn workspace @datalog/medical-ontology-e2e lint`
- `yarn workspace @datalog/medical-ontology-e2e typecheck`
- `yarn workspace @datalog/medical-ontology-e2e build`
- `yarn workspace @datalog/medical-ontology-e2e test`
