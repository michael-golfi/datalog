# @datalog/eslint-plugin-typescript AGENTS.md

## Ownership
- Custom ESLint rule authority for the TypeScript/workspace ESLint plugin workspace.

## Key surfaces
- `src/plugin.ts` - TypeScript/workspace plugin factory and path-helper wiring.
- `src/shared/*` - shared AST, import, and workspace path helpers.
- `src/workspace/layer-policies.ts` - workspace layer policy types and lookup helpers.

## What belongs here
- Custom generic lint rules.
- Shared rule helper utilities.
- Generic workspace layer policy types and policy helpers.

## What does not belong here
- Flat-config assembly in the root `eslint.config.mjs`.
- Rule enablement decisions or file-glob policy.
- Third-party ESLint plugin config.
- Concrete repo-specific workspace layer policy data.

## Verification
- `yarn workspace @datalog/eslint-plugin-typescript typecheck`
- `yarn workspace @datalog/eslint-plugin-typescript build`

## Guardrails
- Keep rule behavior, messages, and detection logic aligned with the source of truth being extracted.
- Keep `src/index.ts` export-only.
- Keep workspace-aware logic behind `createTypeScriptWorkspacePlugin(rootDir)` and shared path helpers rather than module-level repo state.
