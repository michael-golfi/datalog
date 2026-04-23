# Datalog Language Support

Language support for graph-oriented Datalog source files (`.dl`), including syntax highlighting and language-server-backed editor intelligence.

## Features

```datalog
% Declare entity types
vertex_type(N, Label) :-
    label(N, Label),
    Label = "entity".

% Derive transitive edges
edge(From, To, edge_type(Label)) :-
    edge(From, Mid, edge_type(Label)),
    edge(Mid, To, edge_type(Label)).
```

The extension currently provides:

- TextMate syntax highlighting for predicates, variables, rule operators, strings, and line comments
- Language configuration for `%` comments, bracket matching, auto-closing pairs, and indentation
- Language-server features for hover, go-to-definition, completions, document symbols, folding ranges, and semantic tokens

## What's included

| Feature | Status |
|---------|--------|
| Syntax highlighting (`.dl`) | Available |
| Language configuration | Available |
| Hover information | Available |
| Go-to-definition | Available |
| Completions | Available |
| Document symbols | Available |
| Folding ranges | Available |
| Semantic tokens | Available |
| File icon | Not yet |

## Requirements

- VS Code 1.85.0 or newer

## Installation

1. Open the [Package VS Code Extension workflow artifacts](https://github.com/michael-golfi/datalog/actions/workflows/publish-extension.yml) and download the `datalog-language-support-vsix` artifact.
2. Extract the artifact and locate `artifacts/datalog-language-support.vsix`.
3. In VS Code, open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
4. Select **Extensions: Install from VSIX...** and choose the downloaded file.

## Development

Use the package-local scripts from `packages/vscode-extension`:

- `yarn workspace @datalog/vscode-extension build` compiles the extension to `build/out/`.
- `yarn workspace @datalog/vscode-extension watch` runs `tsc --watch` for the extension package.
- `yarn workspace @datalog/vscode-extension dev` builds `@datalog/parser` and `@datalog/lsp`, then starts the extension watch loop.
- `yarn workspace @datalog/vscode-extension package` builds the parser, language server, and extension, then stages a packaging-ready copy under `packages/vscode-extension/build/package-stage/`.
- `yarn workspace @datalog/vscode-extension vsce:package` rebuilds the same workspaces and emits the final VSIX.
- `yarn workspace @datalog/vscode-extension smoke` rebuilds the same workspaces, creates a staged extension, and runs the smoke suite against an Extension Development Host.

For editor debugging, open `packages/vscode-extension` in VS Code and run the checked-in **Launch Extension Development Host** configuration from `.vscode/launch.json`. That launch config starts the Extension Development Host with `fixtures/smoke/smoke.dl` opened, so the smoke fixture is the default debugging context.
