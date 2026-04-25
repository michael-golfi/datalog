# @datalog/datalog-to-sql

## Ownership

- This package owns Datalog-to-SQL translation for PostgreSQL 13+ graph operations.
- It targets the `vertices` and `edges` tables only.
- It must not depend on editor, LSP, or VS Code extension concerns.

## Package shape

- Keep `src/index.ts` export-only.
- Organize code by aspect under `src/contracts`, `src/translation`, `src/validation`, `src/execution`, `src/runtime`, and `src/benchmarks`.
- Keep the benchmark CLI entry at `src/benchmarks/run-recursive-closure-benchmark.ts` thin and executable, with reusable benchmark logic in sibling benchmark modules.
- Keep tests colocated as `*.test.ts` beside the implementation they prove.

## Boundaries

- This package owns only generic SQL/runtime/translation helpers.
- It must not own canonical medical ontology migrations, ontology fixture source-of-truth files, or ontology-specific assertion logic.

## Benchmark seams

- Keep recursive-closure benchmark contracts, fixtures, validation, and runner code under `src/benchmarks/`.
- When benchmark behavior changes, run the benchmark validation command in addition to normal package checks.

## Verification

- `yarn workspace @datalog/datalog-to-sql lint`
- `yarn workspace @datalog/datalog-to-sql typecheck`
- `yarn workspace @datalog/datalog-to-sql build`
- `yarn workspace @datalog/datalog-to-sql test`
- `yarn workspace @datalog/datalog-to-sql benchmark:recursive-closure:validate` when benchmark code changes
