# AGENTS.md

This file tells coding agents how to work in this repository.

Read this file before making changes. For any touched workspace, also read the nearest descendant `AGENTS.md`. Root rules apply unless a deeper file narrows them.

## What this repo is

This repository is a self-contained Datalog workspace.

The root package identity is `datalog`, and the workspace is organized under `packages/*`.
The current package surfaces are:

* `packages/parser` for parser contracts, syntax, semantics, and document analysis primitives
* `packages/datalog-to-sql` for PostgreSQL 13+ graph translation and generic SQL/runtime helpers over `vertices` and `edges`
* `packages/lsp` for language-server contracts, runtime wiring, protocol mapping, and editor-facing features
* `packages/eslint-plugin-datalog` for Datalog-specific ESLint processor and rule behavior
* `packages/eslint-plugin-typescript` for generic TypeScript/workspace ESLint rules
* `packages/medical-ontology-e2e` for the canonical medical ontology project, immutable migrations, mappings, and ontology e2e assertions
* `packages/vscode-extension` for the VS Code extension

Keep guidance aligned to this Datalog workspace's parser, SQL translation, lint-plugin, ontology, LSP, and editor-extension packages. Do not preserve rules for unrelated products, hosted runtimes, or app-server shells.

## How this repo is organized

This is a Yarn 4 monorepo with workspaces under `packages/*`.

Use these boundaries:

* `packages/parser` owns syntax, parsing, shared document analysis primitives, and parser-facing tests.
* `packages/datalog-to-sql` owns Datalog-to-SQL translation behavior plus generic execution/runtime helpers and must stay independent from editor, LSP, and VS Code extension concerns.
* `packages/lsp` owns language-server behavior and depends on parser package surfaces instead of reimplementing parser logic.
* `packages/eslint-plugin-datalog` owns Datalog-specific lint processor/rule behavior only.
* `packages/eslint-plugin-typescript` owns generic TypeScript/workspace lint rule behavior only.
* `packages/medical-ontology-e2e` owns the canonical ontology project, immutable migration structure, ontology mappings, and ontology-specific assertions while remaining free of production SQL runtime ownership.
* `packages/vscode-extension` owns editor integration and delegates protocol and analysis work to the language server.
* Cross-workspace imports use package names, preferably `@datalog/*` when those package names exist. No cross-package relative imports.

Root `eslint.config.mjs` is the sole lint-config authority. Do not add package-local ESLint configs unless the task explicitly requires changing that policy.

Treat workspace entry files as boundary-only surfaces. They may wire dependencies and delegate. They are not the right home for reusable parsing, analysis, or editor behavior.

## Operating principles

* Keep changes as small as possible.
* Fix root causes, not symptoms.
* Do not cargo-cult nearby code if it violates this file.
* Existing violations are debt, not precedent.
* Keep workspace boundaries clear.
* Put reusable logic in the package that owns it.
* Prefer explicit structure over cleverness.
* After correcting an agent mistake, update `AGENTS.md` so the mistake is less likely to recur.

## Default workflow

For any non-trivial task, start in plan mode.

A task is non-trivial if it:

* introduces a new exported function or class
* changes a package contract or public API
* adds more than 30 lines of code
* crosses workspace boundaries
* changes parser behavior, protocol behavior, or extension integration behavior

Execution order:

1. Read root `AGENTS.md`.
2. Read the nearest descendant `AGENTS.md` for every touched workspace.
3. Restate the task as one verifiable goal.
4. Make a smallest-green-slice plan.
5. Name the exact tests and checks before implementation.
6. Implement with seam discipline.
7. Run package checks first.
8. Run root verification when required.
9. Record evidence.
10. If the agent got something wrong, update `AGENTS.md`.

If implementation starts drifting, stop and re-plan before continuing.

## Planning rules

Plans should be concrete and testable. Avoid vague prose.

A good plan names:

* touched packages
* exact files or seams likely to change
* the proving tests
* the final verification command list

## Structural rules

Do not ship non-trivial work as a single-file implementation unless the file is an entrypoint, one-off script, or test.

Additional rules:

* `src/index.ts` in packages is an export surface only unless the package is explicitly defined as a runtime entry package.
* Do not add responsibilities to files already above 300 lines if the change can be split cleanly.
* Do not create files named `utils`, `helpers`, `common`, `misc`, `manager`, or `processor` unless they are domain-qualified and justified.
* Exported APIs must not use boolean flag parameters.
* Exported functions with 4 or more parameters must use an object parameter.
* Prefer guard clauses over `else` after `return`.
* Do not reassign function parameters.
* Do not disable lints without explicit approval.
* Avoid unnecessary ternaries.
* Tests should import implementation modules directly, not barrel exports.

## Verification rules

You do not get to claim success without command evidence.

Always run the smallest relevant checks first.

Minimum verification logic:

* If the change is contained to one package, run that package's checks first.
* If a workspace has `tsconfig.spec.json`, keep it and use it.
* If a change affects parser output or diagnostics, run parser and LSP tests that prove the behavior.
* If a change affects editor integration, run the extension checks that cover the touched behavior.

Run full root verification if the slice changes root-level files, shared package surfaces, executable config, or cross-workspace behavior:

```bash
yarn lint
yarn typecheck
yarn test
yarn build
```

Rules:

* `yarn lint` is blocking. Warnings fail verification when the configured scripts treat them as failures.
* `yarn dev` is not a verification substitute.

## Source of truth

When sources conflict, use this order:

1. checked-in executable scripts and config
2. root `AGENTS.md`
3. nearest descendant `AGENTS.md`
4. checked-in project docs

Executable truth beats prose.

## Stop-ship conditions

Do not ship any of the following:

### Boundary violations

* reusable parser or LSP logic in workspace entry files
* direct `process.env` access outside bootstrap or config modules
* `console.*` in production paths
* cross-package relative imports

### Structural shortcuts

* non-trivial single-file implementations
* generic catch-all file naming without domain qualification
* boolean flag params in exported APIs

### Verification shortcuts

* claiming success without runnable command evidence
* skipping checks for cross-package behavior
* replacing executable proof with prose-only claims

## Evidence

Store verification artifacts in `.sisyphus/evidence/`.

Evidence should include, where relevant:

* touched paths
* exact verification commands
* pass or fail results

Ignore these paths unless the task explicitly requires them:

* `.worktrees/**`
* `**/dist/**`
* `**/coverage/**`
* `**/*.tsbuildinfo`
* `.yarn/**`
* `.sisyphus/plans/**`
* `node_modules/**`

## Monorepo inheritance rule

Keep this root file short and durable. Put workspace-specific rules in descendant `AGENTS.md` files near the code they govern.

A good descendant `AGENTS.md` should only add local facts the root file cannot know, such as:

* package-specific commands
* package-specific test fixtures
* local architecture invariants
* common failure modes in that subtree

Do not repeat the entire root file in descendants.

## Maintenance rule

This file is a living operating manual.

When an agent makes a repeated mistake, do not just fix the code. Tighten the relevant rule here or in the nearest descendant `AGENTS.md` so future agents inherit the correction.
