# @datalog/eslint-plugin-datalog AGENTS.md

## Ownership
- Custom ESLint rule authority for Datalog-specific processor and rule behavior.

## Key surfaces
- `src/index.ts` - package surface for the Datalog ESLint plugin.
- `src/plugin.ts` - Datalog plugin factory.
- `src/datalog-*.ts` - Datalog processor and Datalog rule implementations.

## What belongs here
- `.dl` processor wiring.
- Datalog-only lint rules and source helpers.
- Tests that prove Datalog processor and rule behavior.

## What does not belong here
- Generic TypeScript/workspace/runtime/export/ui rules.
- Root flat-config assembly in `eslint.config.mjs`.
- Repo-specific rule enablement decisions.

## Verification
- `yarn workspace @datalog/eslint-plugin-datalog lint`
- `yarn workspace @datalog/eslint-plugin-datalog typecheck`
- `yarn workspace @datalog/eslint-plugin-datalog test`
- `yarn workspace @datalog/eslint-plugin-datalog build`

## Guardrails
- Keep Datalog ownership local to this workspace; do not re-export generic workspace rules from here.
- Keep package entry files export-only and keep rule logic in focused source modules.
- Root `eslint.config.mjs` is the lint authority for the repo; do not add a package-local ESLint config back into this workspace.
