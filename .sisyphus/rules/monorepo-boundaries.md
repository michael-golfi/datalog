---
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: false
description: "Enforces Datalog workspace dependency direction for packages, package seams, and no cross-workspace relative imports"
---

# Monorepo Boundary Rules

This repo is a Yarn 4 monorepo with workspaces under `packages/*`. Workspace boundaries are architectural seams, not suggestions. Violating them creates hidden coupling that makes changes expensive and makes package reuse harder.

## Dependency Direction

**Dependency direction flows from shared language contracts toward editor integration. Shared package code must not depend back on higher-level editor, LSP, migration, ontology, or SQL surfaces.**

```
packages/datalog-ast ──→ no workspace dependencies
packages/parser ──→ packages/datalog-ast
packages/datalog-to-sql ──→ packages/parser, packages/datalog-ast
packages/datalog-migrate ──→ packages/datalog-to-sql, packages/parser, packages/datalog-ast
packages/lsp ──→ packages/parser, packages/datalog-ast, packages/datalog-migrate
packages/vscode-extension ──→ packages/lsp
packages/medical-ontology-e2e ──→ public package surfaces only
```

- If you find extension-only code imported by the parser or language server, the dependency is inverted. Move shared logic to the lowest package that can own it.
- Peer packages may depend on each other only through package imports, never via relative paths that cross workspace boundaries.

## Package Ownership

The package roles are:

1. `packages/datalog-ast` owns shared Datalog AST contracts, graph fact primitives, builders, guards, and visitor keys.
2. `packages/parser` owns syntax parsing, document analysis, symbol collection, and parser-facing semantics.
3. `packages/datalog-to-sql` owns generic SQL translation, validation, runtime helpers, execution helpers, and benchmarks over graph facts.
4. `packages/datalog-migrate` owns generic migration workflow tooling and CLI command behavior.
5. `packages/lsp` owns language-server orchestration, workspace indexing, protocol mapping, and editor-facing language features.
6. `packages/vscode-extension` owns editor activation, commands, packaging, smoke tests, and VS Code wiring.
7. `packages/medical-ontology-e2e` owns canonical ontology fixtures, migrations, mappings, and ontology e2e assertions.
8. `packages/eslint-plugin-datalog` owns Datalog-specific ESLint processor and rule behavior.
9. `packages/eslint-plugin-typescript` owns generic TypeScript/workspace/runtime/export/UI lint rule behavior.

**`packages/vscode-extension` must not contain:**
- Parser internals that belong in `packages/parser`.
- Language-server business logic that belongs in `packages/lsp`.
- Reusable logic that another package would need.

If you are writing parser analysis directly inside extension activation or command files, stop and extract it to the appropriate package.

## Package Seams

Use package seams instead of reaching across boundaries:

| Concern | Own It Here | Avoid |
|---------|-------------|-------|
| Shared AST contracts and graph facts | `packages/datalog-ast` | Redefining AST or graph fact shapes in parser, SQL, LSP, or tests |
| Parsing and syntax primitives | `packages/parser` | Re-implementing parser logic in LSP or extension code |
| SQL translation and graph runtime helpers | `packages/datalog-to-sql` | Ontology-specific assertions or editor concerns in SQL helpers |
| Migration workflow commands | `packages/datalog-migrate` | Ontology domain modeling or production SQL runtime ownership |
| Language-server protocol behavior | `packages/lsp` | VS Code specific behavior in parser code |
| Editor activation and commands | `packages/vscode-extension` | Embedding VS Code APIs in parser or LSP internals |
| Canonical ontology fixture behavior | `packages/medical-ontology-e2e` | Generic SQL/runtime or migration tooling ownership |

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
6. Add the package to this dependency-direction rule if it creates a new architectural layer.

## How to Detect Violations

When editing any file:

1. **Check imports.** Do any imports cross workspace boundaries via relative paths?
2. **Check the file's location.** Is parser or language-server logic sitting in the extension package?
3. **Check seam usage.** Are you bypassing the package that should own the behavior?
4. **Check dependency direction.** Is a lower-level package importing from a higher-level package?

If any check fails, fix the boundary violation before continuing with the original task.
