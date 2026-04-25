# AGENTS.md

This file tells coding agents how to work in this repository.

Read this file before making changes. For any touched workspace, also read the nearest descendant `AGENTS.md`. Root rules apply unless a deeper file narrows them.

## What this repo is

This repository is a self-contained Datalog workspace.

The root package identity is `datalog`, and the workspace is organized under `packages/*`.
The current package surfaces are:

* `packages/parser` for parser contracts, syntax, semantics, and document analysis primitives
* `packages/datalog-ast` for shared Datalog AST node contracts, builders, graph fact primitives, type guards, and visitor keys
* `packages/datalog-to-sql` for PostgreSQL 13+ graph translation and generic SQL/runtime helpers over `vertices` and `edges`
* `packages/datalog-migrate` for generic Datalog migration workflow tooling and Graphile-Migrate-style command behavior
* `packages/lsp` for language-server contracts, runtime wiring, protocol mapping, and editor-facing features
* `packages/eslint-plugin-datalog` for Datalog-specific ESLint processor and rule behavior
* `packages/eslint-plugin-typescript` for generic TypeScript/workspace/runtime/export/UI ESLint rules
* `packages/medical-ontology-e2e` for the canonical medical ontology project, immutable migrations, mappings, and ontology e2e assertions
* `packages/vscode-extension` for the VS Code extension

Keep guidance aligned to this Datalog workspace's parser, SQL translation, lint-plugin, ontology, LSP, and editor-extension packages. Do not preserve rules for unrelated products, hosted runtimes, or app-server shells.

## How this repo is organized

This is a Yarn 4 monorepo with workspaces under `packages/*`.

Use these boundaries:

* `packages/datalog-ast` owns shared Datalog AST language contracts and low-level builders/guards used by parser, SQL translation, migration tooling, and LSP packages.
* `packages/parser` owns syntax, parsing, shared document analysis primitives, and parser-facing tests.
* `packages/datalog-to-sql` owns Datalog-to-SQL translation behavior plus generic execution/runtime helpers and must stay independent from editor, LSP, and VS Code extension concerns.
* `packages/datalog-migrate` owns generic Datalog migration workflow tooling and must stay independent from ontology-specific schema content and production SQL execution ownership.
* `packages/lsp` owns language-server behavior and depends on parser package surfaces instead of reimplementing parser logic.
* `packages/eslint-plugin-datalog` owns Datalog-specific lint processor/rule behavior only.
* `packages/eslint-plugin-typescript` owns generic TypeScript/workspace/runtime/export/UI lint rule behavior only.
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
* Do not provide time estimates. Work relentlessly until the task is complete, taking as much time as correctness requires.
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
4. If planning in a read-only tool or from the main worktree, create a draft plan and a planning-to-worktree handoff block; do not mutate files there.
5. Create or select the named feature worktree and materialize the canonical plan inside it before implementation.
6. Name the exact tests and checks before implementation.
7. Implement with seam discipline inside the feature worktree.
8. Run package checks first.
9. Run root verification when required.
10. Record evidence.
11. If the agent got something wrong, update `AGENTS.md`.

If implementation starts drifting, stop and re-plan before continuing.

## Feature worktree workflow

Every new feature or planned implementation gets its own non-main git worktree nested under `.wt/`. Read-only planning may happen before the worktree exists, but mutation must not.

Use this workflow:

1. Start from a clean `main` worktree or another explicit base branch.
2. Create or select a dedicated branch and worktree under `.wt/`, using a repo-prefixed task slug such as `.wt/datalog-vscode-my-feature`.
3. Launch or direct the execution agent with that absolute worktree path; do not rely on it inferring or changing directories.
4. Keep the canonical plan, code changes, validation evidence, and review context inside that feature worktree.
5. Do not use the main worktree as scratch space for experiments, generated files, partial fixes, or feature implementation.
6. Complete the feature in its worktree: implement, validate with the tightest relevant checks first, then broaden verification as required by this file.
7. Merge the completed feature branch back to `main` only after validation evidence is recorded and the worktree contains no unrelated dirty state.
8. After merge completion, remove the completed worktree, delete the local branch when it is no longer needed, and prune stale worktree metadata.

If a task is only investigation and produces no planned implementation, it may stay read-only. Once it becomes feature work, create or move to a dedicated worktree before editing.

## Planning-to-worktree handoff

Planning tools that cannot mutate, such as Prometheus, may draft plans without creating a worktree. They must end with a handoff block rather than requiring manual plan moves or restarting context.

Every handoff block must include:

* task slug
* base branch
* branch name
* absolute `.wt/` worktree path
* canonical plan destination inside that worktree, usually `.sisyphus/plans/<task-slug>.md`
* touched packages and likely files
* exact package-local and root verification commands
* whether an existing worktree should be reused

Execution agents must do this on receipt:

1. Create or reuse the named `.wt/` worktree from the handoff block.
2. Copy or recreate the approved plan at the canonical plan destination in that worktree.
3. Run all mutation, validation, review, and evidence capture with the worktree path as the command working directory.
4. Do not ask the user to manually move plan files or reopen tooling unless the execution environment truly cannot target the worktree path.

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

* Before evaluating lint as green, run the repo's formatter first, then the relevant lint autofix command, then the non-fixing lint command. Use checked-in scripts when available; if formatter or autofix tooling is missing, record that tooling gap instead of claiming the full lint-green sequence ran.
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

* `.wt/**`
* `.worktrees/**` (legacy only; do not create new feature worktrees here)
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
