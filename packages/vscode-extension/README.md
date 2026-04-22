# Datalog Graph Language Support

VS Code language support for graph-oriented Datalog files (`.dl`).

## Requirements

- VS Code 1.85.0 or newer

## Installation

1. Package the extension into a `.vsix` artifact from this workspace's publish flow.
2. In VS Code, open the Extensions view.
3. Select **Extensions: Install from VSIX...** and choose the packaged file.

## Features

- Syntax highlighting for Datalog source files
- Language configuration for line comments (`%`), bracket matching, auto-closing pairs, and indentation around parentheses

## Included Assets

- `syntaxes/datalog.tmLanguage.json` for TextMate grammar-based highlighting
- `language-configuration.json` for editor language behavior

## Development

This package stays `private: true` in the monorepo because it is packaged as a VS Code extension artifact rather than published to npm.
