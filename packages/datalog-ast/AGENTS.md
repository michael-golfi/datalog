# @datalog/ast

## Ownership

- This package owns shared Datalog AST node contracts, graph fact primitives, builders, type guards, source spans, and visitor keys.
- It is the lowest-level Datalog model package and should stay free of parser, SQL, migration, LSP, and VS Code runtime concerns.

## Package shape

- Keep `src/index.ts` export-only.
- Keep core language contracts in focused `src/datalog-*.ts` modules.
- Keep graph-specific primitives in `datalog-graph*` modules, not in parser or SQL packages.
- Keep workspace boundary guard tests under `src/workspace/`; they prove package graph invariants rather than product behavior.
- Keep tests colocated as `*.test.ts` beside the implementation or invariant they prove.

## What belongs here

- Datalog language node/type definitions.
- AST and graph fact builders.
- Runtime type guards for AST and graph fact shapes.
- Visitor-key metadata shared by traversal consumers.

## What does not belong here

- Text parsing, syntax scanning, or document analysis.
- SQL translation, PostgreSQL runtime helpers, or migration workflows.
- LSP protocol mapping, editor features, or VS Code extension wiring.

## Verification

- `yarn workspace @datalog/ast lint`
- `yarn workspace @datalog/ast typecheck`
- `yarn workspace @datalog/ast build`
- `yarn workspace @datalog/ast test`
