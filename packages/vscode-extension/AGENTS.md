# @datalog/vscode-extension

## Ownership

- This package owns VS Code extension activation, language-client setup, packaging, and smoke-test integration.
- It delegates Datalog analysis and protocol behavior to `@datalog/lsp`.

## Package shape

- There is no `src/index.ts`; `src/extension.ts` is the VS Code activation boundary and should stay thin.
- Keep activation lifecycle code in `src/activation/` and language-client option construction in `src/client/`.
- Keep runtime module resolution in `src/runtime/`.
- Keep package and VSIX staging logic under `scripts/packaging/`; top-level `scripts/create-*.mjs` and `scripts/run-smoke.mjs` are executable entry wrappers.
- This package builds CommonJS output to `build/out/`, not library-style ESM output to `dist/`.

## What belongs here

- VS Code `activate`/`deactivate` wiring.
- Extension manifest contributions, syntax assets, language configuration, and package staging.
- Smoke tests against the Extension Development Host and packaging surface checks.

## What does not belong here

- Parser or LSP feature implementation.
- SQL, migration, ontology fixture, or generic runtime helpers.
- Direct deep imports into sibling workspace source or build output.

## Verification

- `yarn workspace @datalog/vscode-extension lint`
- `yarn workspace @datalog/vscode-extension typecheck`
- `yarn workspace @datalog/vscode-extension build`
- `yarn workspace @datalog/vscode-extension test`
- `yarn workspace @datalog/vscode-extension package`
- `yarn workspace @datalog/vscode-extension vsce:package` when VSIX distribution changes
- `yarn workspace @datalog/vscode-extension smoke`
- `yarn workspace @datalog/vscode-extension smoke:broken` when failure-path smoke behavior changes
