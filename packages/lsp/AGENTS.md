# @datalog/lsp

## Ownership

- This package owns language-server runtime wiring, workspace indexing, protocol mapping, and editor-facing Datalog features.
- It depends on parser package surfaces for document understanding instead of reimplementing parser logic.
- It may consume shared migration/workspace surfaces needed for workspace indexing and server composition, but must not own migration command behavior.

## Package shape

- Keep `src/index.ts` export-only for runtime factory APIs.
- Keep `src/server.ts` as the thin executable server entry and package subpath export that starts `server/start-language-server.ts`.
- Keep `src/semantic-tokens.ts` as the public subpath export for semantic-token helpers and constants.
- Keep LSP feature implementations under `src/features/`, protocol conversion under `src/protocol/`, server transport under `src/server/`, runtime composition under `src/runtime/`, and multi-file state under `src/workspace/`.
- Keep tests colocated as `*.test.ts` beside the feature/runtime/workspace seam they prove.

## What belongs here

- Hover, completion, definition, diagnostics, folding, document symbol, and semantic-token behavior.
- Workspace document stores and Datalog workspace indexes.
- Language-server capability declarations and protocol adapters.

## What does not belong here

- VS Code extension activation or `vscode-languageclient` wiring.
- Raw parser implementation or AST contract ownership.
- SQL translation, migration tooling, or ontology-specific fixture logic.

## Verification

- `yarn workspace @datalog/lsp lint`
- `yarn workspace @datalog/lsp typecheck`
- `yarn workspace @datalog/lsp build`
- `yarn workspace @datalog/lsp test`
