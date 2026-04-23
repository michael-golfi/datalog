# Datalog Language Support

Syntax highlighting and editor support for graph-oriented Datalog source files (`.dl`).

## Features

**Syntax highlighting** — Colorizes Datalog predicates, variables, rule operators, strings, and line comments.

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

**Language configuration** — Provides editor conventions for `.dl` files:

- Line comments with `%`
- Bracket matching, auto-closing, and surrounding pairs for `()` and `""`
- Automatic indentation around parentheses
- Word pattern that includes Datalog identifier characters

## What's included

| Feature | Status |
|---------|--------|
| Syntax highlighting (`.dl`) | Available |
| Language configuration | Available |
| File icon | Not yet |
| Hover information | Not yet |
| Go-to-definition | Not yet |

## Requirements

- VS Code 1.85.0 or newer

## Installation

1. Download the latest `.vsix` from the [GitHub Actions artifacts](https://github.com/michael-golfi/datalog/actions/workflows/publish-extension.yml).
2. In VS Code, open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Select **Extensions: Install from VSIX...** and choose the downloaded file.
