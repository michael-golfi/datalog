---
globs: ["**/*"]
alwaysApply: false
description: "Enforces agent workflow discipline: .wt worktrees, tight feedback loops, local CI debugging, safe TypeScript output, and branch cleanup"
---

<MANDATORY_AGENT_WORKFLOW_RULE severity="BLOCKING" priority="HIGHEST">

# Agent Worktree and Validation Workflow Rules

Operational workflow is part of the code contract. A change is not complete merely because the patch exists; it is complete only when it has been developed in an isolated `.wt/` worktree, locally validated with the tightest useful feedback loop, reviewed against its original intent, merged safely, and cleaned up.

## Rule 1: Draft Plans May Be Read-Only; Execution Plans Must Live in `.wt/` Worktrees

Read-only planning may happen outside a feature worktree when the planner cannot mutate files. Implementation plans become canonical only after they are materialized inside the dedicated non-main `.wt/` worktree that will execute them.

Required behavior:
- Draft planners must end with a handoff block that names the task slug, base branch, branch name, absolute `.wt/` worktree path, canonical plan destination, touched packages, and exact verification commands.
- Before starting planned implementation work, create or select the dedicated non-main `.wt/` worktree named by the handoff.
- Copy or recreate the approved plan artifact inside that worktree so the plan, code, validation output, and review context remain colocated.
- Execute all mutation, validation, review, and evidence capture with the `.wt/` worktree path as the working directory.
- Do not execute a plan directly from the main worktree.
- Do not treat the main worktree as a scratch area for experiments, generated files, partial fixes, or review loops.
- Do not create new feature worktrees under `.worktrees/` or any other directory; `.wt/` is the only supported worktree parent.
- Do not require manual plan-file moves or tool restarts when an execution agent can be launched with the explicit `.wt/` worktree path.

**Blocking violations:**
- Mutating code or executing an implementation plan from the main worktree.
- Starting implementation from a draft plan that lacks an explicit `.wt/` worktree handoff.
- Creating a branch without a corresponding isolated `.wt/` worktree for planned work.
- Creating new feature worktrees outside `.wt/`.
- Leaving the canonical execution plan outside the worktree that contains the implementation.
- Mixing multiple unrelated plans inside one worktree.

## Rule 2: Keep the Tightest Feedback Loop During Debugging

Debugging must proceed from the smallest reliable signal to the broadest validation command.

Required order:
1. Reproduce the failure locally.
2. Run the narrowest relevant command first: a single test, focused typecheck, targeted lint, or package-local benchmark.
3. While the implementation direction is still changing, avoid repeated broad lint/test runs; use review, types, and the smallest targeted commands to steer the design.
4. Fix the issue where it is introduced, not by weakening the test or masking the failure.
5. Re-run the same narrow command only when the relevant slice has stabilized enough for the result to be meaningful.
6. Before declaring lint green, run formatter first, then the relevant lint autofix command, then the non-fixing lint command. Use checked-in scripts when available; if formatter or autofix tooling is missing, record that tooling gap instead of claiming the full lint-green sequence ran.
7. Expand to the package/workspace command.
8. Expand to the full repo validation command only after narrower checks pass.

If CI fails, debug it locally first and relaunch CI only after the local reproduction or nearest equivalent is green.

**Blocking violations:**
- Relaunching CI repeatedly without a local reproduction attempt.
- Running only full-suite commands while ignoring a faster targeted command.
- Repeatedly running broad lint/test suites while the implementation approach is still directionally changing.
- Skipping local validation because the change appears small.
- Treating a CI retry as a debugging strategy.

## Rule 3: TypeScript Output Must Never Pollute Source Directories

TypeScript compiler output must not be emitted into source directories.

Required behavior:
- Configure `tsc` output through `outDir`, declaration output directories, or no-emit modes as appropriate for the package.
- Keep generated JavaScript, declaration files, build info, coverage, and temporary compiler artifacts out of `src/` and other source-owned directories.
- If compiler output appears in a source directory, stop and remove the generated artifacts before continuing.
- Fix the build configuration that allowed source pollution before merging.

**Blocking violations:**
- Emitting `.js`, `.d.ts`, `.map`, `.tsbuildinfo`, or generated build artifacts into `src/`.
- Checking generated compiler output into source-owned directories unless that directory is explicitly designated for generated sources.
- Running `tsc` from a directory where its output path resolves into the source tree.
- Ignoring dirty source directories caused by compiler output.

## Rule 4: Branches Must Be Cleaned Up After Merge Completion

A branch is not done until the merge is complete and local branch/worktree state has been cleaned up.

Required behavior after merge:
- Confirm the branch has been merged or otherwise intentionally closed.
- Remove the dedicated `.wt/` worktree for the completed branch.
- Delete the local branch when it is no longer needed.
- Prune stale worktree metadata and stale remote-tracking branches where appropriate.
- Leave the main worktree clean and on the expected base branch.

**Blocking violations:**
- Leaving completed `.wt/` feature worktrees in place after merge.
- Leaving stale local branches for completed merged work.
- Continuing new work on an old merged branch.
- Leaving untracked generated artifacts behind after branch completion.

## Rule 5: `/ulw-loop` Review and Green-Codebase Loop

`/ulw-loop` means: use Oracle to review the original plan and the intention of the plan that created the current worktree, then continue development until both review and validation are clean.

Required loop:
1. Locate and read the original plan in the current worktree, or materialize it there from the handoff block before continuing.
2. Restate the plan intention in operational terms before making further changes.
3. Use Oracle to review the implementation against the original plan and its stated intention.
4. Resolve every issue raised by that review, unless a finding is explicitly documented as inapplicable with a concrete reason.
5. Re-run Oracle review after material changes.
6. Continue until there are no remaining review issues.
7. Run the full validation suite required by the repo: lint, tests, and benchmarks.
8. Continue fixing and revalidating until the entire codebase is green across lint, test, and benchmarks.

Completion criteria:
- No unresolved Oracle review issues remain.
- Lint is green.
- Tests are green.
- Benchmarks are green.
- The worktree has no unrelated dirty state.
- The branch is ready to merge or has been merged and cleaned up according to Rule 4.

**Blocking violations:**
- Treating `/ulw-loop` as a single review pass.
- Ignoring the original plan when continuing work in the worktree.
- Stopping with known review issues still open.
- Stopping before lint, test, and benchmarks are green.
- Claiming completion without checking the full codebase validation commands required by the repo.

## Review Standard

Before declaring work complete, verify:

1. Any read-only draft plan had a complete `.wt/` worktree handoff, and all mutation/execution happened from a non-main `.wt/` worktree.
2. CI failures, if any, were debugged locally before relaunch.
3. TypeScript output did not pollute source directories.
4. The relevant tight feedback loop was used before broad validation.
5. `/ulw-loop`, when invoked, reached both review-clean and validation-green states.
6. The completed branch and worktree were cleaned up after merge.

</MANDATORY_AGENT_WORKFLOW_RULE>
