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
- Committed migrations use flat dated `.dl` files, with `current.dl` reserved as the mutable working area consumed by the package migration CLI scripts.
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
- `test/fixtures/localhost-postgres-fixture.ts` and live-postgres proof fixtures own localhost PostgreSQL verification support.
- `test/fixtures/ontology-graph-rag-*.ts` owns package-local GraphRAG query and assertion fixtures.
- Graphile-Migrate-style workflow tooling now lives in `@datalog/datalog-migrate` and this package consumes it through scripts/tests instead of owning the implementation directly.
- Consumer-side tests should generate chains by writing current-state step bodies and committing them through the public CLI seam, then prove outcomes from the generated `migrations/` state rather than inspecting migration internals directly.

## Verification

- Default suite, including the localhost ontology happy/failure-path tests, must stay available through `yarn workspace @datalog/medical-ontology-e2e test`.
- Keep the worker-collision proof opt-in behind `MEDICAL_ONTOLOGY_E2E_RUN_WORKER_COLLISION_PROOF=1`; it is verification-only and must not run as part of the default suite.
- Preserve `MEDICAL_ONTOLOGY_E2E_ADMIN_POSTGRES_URL` as the localhost admin override for verification against a local PostgreSQL instance.
- `yarn workspace @datalog/medical-ontology-e2e lint`
- `yarn workspace @datalog/medical-ontology-e2e typecheck`
- `yarn workspace @datalog/medical-ontology-e2e build`
- `yarn workspace @datalog/medical-ontology-e2e test`
- `yarn workspace @datalog/medical-ontology-e2e test:worker-collision-proof`
- Simultaneous package-run safety proof: start two `yarn workspace @datalog/medical-ontology-e2e test` invocations at the same time and confirm both pass without database-name collisions.
