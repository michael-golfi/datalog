---
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: false
description: "Enforces Datalog workspace dependency direction for packages, package seams, and no cross-workspace relative imports"
---

# Monorepo Boundary Rules

This repo is a Yarn 4 monorepo with workspaces under `packages/*`. Workspace boundaries are architectural seams, not suggestions. Violating them creates hidden coupling that makes changes expensive and makes package reuse harder.

## Dependency Direction

**`packages/vscode-extension` may depend on `packages/lsp`. `packages/lsp` may depend on `packages/parser`. Shared package code must not depend back on higher-level editor surfaces.**

```
packages/vscode-extension ──→ packages/lsp
packages/lsp ──→ packages/parser
packages/parser ──→ no higher-level package
```

- If you find extension-only code imported by the parser or language server, the dependency is inverted. Move shared logic to the lowest package that can own it.
- Peer packages may depend on each other only through package imports, never via relative paths that cross workspace boundaries.

## Package Ownership

The package roles are:

1. `packages/parser` owns parsing, tokens, diagnostics primitives, and language data structures.
2. `packages/lsp` owns language-server orchestration and protocol behavior.
3. `packages/vscode-extension` owns editor activation, commands, and VS Code wiring.

**`packages/vscode-extension` must not contain:**
- Parser internals that belong in `packages/parser`.
- Language-server business logic that belongs in `packages/lsp`.
- Reusable logic that another package would need.

If you are writing parser analysis directly inside extension activation or command files, stop and extract it to the appropriate package.

## Package Seams

Use package seams instead of reaching across boundaries:

| Concern | Own It Here | Avoid |
|---------|-------------|-------|
| Parsing and syntax primitives | `packages/parser` | Re-implementing parser logic in LSP or extension code |
| Language-server protocol behavior | `packages/lsp` | VS Code specific behavior in parser code |
| Editor activation and commands | `packages/vscode-extension` | Embedding VS Code APIs in parser or LSP internals |

Bypassing a package seam is a boundary violation even if the code works. The seam exists so package contracts can evolve independently.

## Cross-Workspace Import Rules

- Use package names for cross-workspace imports. Prefer `@datalog/*` when those package names exist. Do not use relative paths that escape the current workspace.

```ts
// Good
import { parseDocument } from '@datalog/parser';

// Bad: cross-workspace relative import
import { parseDocument } from '../../parser/src/index.js';
```

- New shared types, constants, and utilities belong in the lowest package that can own them.
- If multiple packages need the same logic, do not duplicate it in the extension package.

## TypeScript Build Output Boundaries

Compiler output is a generated artifact, not package source. `tsc` must never emit JavaScript, declarations, source maps, build info, coverage, or temporary compiler files into `src/` or another source-owned directory.

Required behavior:
- Use `outDir`, declaration output settings, or `noEmit` so generated files land outside source directories.
- If `tsc` output appears in a source directory, remove it immediately and fix the package configuration before continuing.
- Generated sources are allowed only in directories explicitly designated for generated code. Do not silently treat accidental compiler output as source.
- Dirty source directories caused by compiler output are blocking until cleaned.

## New Workspace Checklist

When creating a new package under `packages/*`:

1. Declare ownership and key surfaces in a local `AGENTS.md`.
2. List verification commands (`lint`, `typecheck`, `build`, `test`).
3. State what belongs and what does not belong in the workspace.
4. Ensure `src/index.ts` is an export-only surface (no runtime logic, no interface definitions).
5. Verify the package does not depend on a higher-level package.

## How to Detect Violations

When editing any file:

1. **Check imports.** Do any imports cross workspace boundaries via relative paths?
2. **Check the file's location.** Is parser or language-server logic sitting in the extension package?
3. **Check seam usage.** Are you bypassing the package that should own the behavior?
4. **Check dependency direction.** Is a lower-level package importing from a higher-level package?

If any check fails, fix the boundary violation before continuing with the original task.
