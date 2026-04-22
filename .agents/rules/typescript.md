# TypeScript Coding Style

TypeScript in this repo is written to feel like a strongly typed language (C#, Java).
The compiler is your safety net — use it fully.
Code is read far more often than it is written — optimize for readability over cleverness.

---

## Formatting

- 2-space indentation, single quotes, semicolons, trailing commas in multiline.
- Maximum line length: **100 characters** (soft), **120** (hard).
- Prettier enforces formatting mechanically (see root `.prettierrc`).
- One statement per line. No comma-first style.

## Module System

- Use ESM syntax exclusively (`import`/`export`). No CommonJS (`require`, `module.exports`).
- Use `.js` extensions in relative import/export specifiers (required by `NodeNext` resolution).
- Use `verbatimModuleSyntax`: always `import type` for type-only imports.

## Imports

- Group imports in order: (1) external packages, (2) workspace packages such as `@datalog/*`, (3) relative.
- Separate each group with a blank line.
- Use `import type` for any import used only as a type.
- Use inline `type` marker for mixed imports: `import { type Foo, bar } from "..."`.
- Prefix intentionally unused parameters with `_`.
- Import other workspaces through their package exports, never cross-package relative paths.

## Exports

- Prefer named exports. Avoid `export default` except in framework-required entry points.
- Barrel files (`index.ts`) use `export * from "./module.js"`.
- Only `index.ts` barrel files may re-export. No re-exports in implementation files.
- Tests import directly from implementation files, not through barrel exports.
- Library `src/index.ts` files are export-only public surfaces. Do not define interfaces, functions, classes, schemas, constants, or runtime logic in them.
- Package runtime entry files are entry surfaces only. They may expose startup wiring, but they must not accumulate helper functions, boundary constants, or reusable business logic.

## Types — Strict Mode

- `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`.
- Never use `any`. If `unknown` is absolutely necessary, add a comment: `// NOTE: unknown required because <reason>`.
- Never suppress errors with `as any`, `@ts-ignore`, or `@ts-expect-error`.
- Prefer `interface` for object contracts and service shapes.
- Use `readonly` on config/data objects where mutation is not intended.
- Use discriminated unions for multi-state results.
- Use `satisfies` to validate object literals without widening type.
- Always access array elements with awareness that the result may be `undefined` (enforced by `noUncheckedIndexedAccess`).
- **Make invalid states hard to represent.** Use discriminated unions, branded types, and precise domain types instead of loose strings or generic objects.

```ts
// Good: the type system prevents invalid combinations
type LoadResult = { kind: 'found'; user: User } | { kind: 'not_found' };

// Bad: caller must remember to check for null
type LoadResult = User | null;
```

## Functions

- Prefer `const` over `let`. Use `let` only when reassignment is needed.
- Prefer pure functions and factory functions over classes.
- Every exported function must have a JSDoc comment describing its purpose.
- Every exported function must declare its return type explicitly.
- No nested ternary expressions. Use `if`/`else` or early returns instead.
- **Keep functions under 20 statements.** Over 20 is a warning. Over 30 means it does too much.
- A function should do **one thing** — if you describe it with "and", split it.
- A function should operate at **one level of abstraction** — do not mix business flow with low-level details.

```ts
// Good: each step is a named, single-level operation
async function createUser(input: CreateUserInput): Promise<User> {
  validateCreateUserInput(input);
  const normalizedEmail = normalizeEmail(input.email);
  const existingUser = await userRepo.findByEmail(normalizedEmail);
  ensureUserDoesNotExist(existingUser);
  const user = buildUser(input, normalizedEmail);
  await userRepo.save(user);
  auditUserCreated(user);
  return user;
}
```

- **Separate commands from queries.** A function should either return data or cause a side effect — not both.
- **Avoid flag arguments.** Boolean parameters usually mean one function does two things. Use separate functions or a parameter object with a domain-meaningful mode.
- **Do not reassign parameters.** Mutation at the function boundary hides side effects and weakens readability.

```ts
// Bad: what does `true` mean?
renderUser(user, true);

// Better: explicit mode
renderUser(user, { mode: 'editable' });
```

- **Prefer fewer parameters.** Ideal: 0–2. Three is acceptable if cohesive. Four or more: use a parameter object.
- **Keep variable scope tight.** Declare variables as close as possible to first use. No top-loaded variables assigned much later.

## Classes

- Use classes only for: custom Error types, stateful adapters/stores/services.
- Classes that implement an interface must declare it explicitly: `class Foo implements IFoo`.
- **Keep classes small.** One clear responsibility. If a class has multiple clusters of methods, split it.
- **Keep constructors simple.** Assign invariants only. No I/O, no complex branching, no async bootstrapping.
- **Hide internals.** Expose behavior, not raw mutable state. Protect invariants with methods.
- **Prefer composition over inheritance.** Use inheritance only for real subtype relationships.

```ts
// Good: invariant protection, explicit methods, no uncontrolled mutation
class BankAccount {
  #balance: number;

  constructor(initialBalance: number) {
    ensureNonNegative(initialBalance);
    this.#balance = initialBalance;
  }

  withdraw(amount: number): void {
    ensurePositive(amount);
    ensureSufficientFunds(this.#balance, amount);
    this.#balance -= amount;
  }

  getBalance(): number {
    return this.#balance;
  }
}
```

## Error Handling

- Custom domain errors extend `Error` with a descriptive `name` property.
- Catch variables are `unknown` (enforced by `useUnknownInCatchVariables`).
- Narrow caught errors explicitly: `instanceof Error`, property checks, or type guards.
- Never leave catch blocks empty. At minimum, log or re-throw.
- **Use consistent error-handling semantics.** Throw for exceptional situations. Return structured results for expected domain outcomes. Do not mix throw/null/{ok:false} arbitrarily within the same module.

## Naming

- Files: `kebab-case.ts`.
- Variables and functions: `camelCase`.
- Types and interfaces: `PascalCase`. Interface names may use `I` prefix where the codebase convention demands it, but prefer bare `PascalCase`.
- Constants: `UPPER_SNAKE_CASE` for true constants, `camelCase` for `readonly` config objects.
- Boolean variables and properties: use `is`/`has`/`should`/`can` prefixes (e.g., `isActive`, `hasPermission`).
- **Names should explain purpose, not implementation.** Prefer domain language over generic technical words.
- **Avoid vague names:** `data`, `value`, `handle`, `manager`, `util`, `process`, `misc`, `info`.
- **Use verbs for functions:** `loadConfig`, `parseToken`, `sendReminder`.
- **Use creation language for factories:** `createSession`, `buildRequestContext`, `makeRetryPolicy`.
- **Use propositions for predicates:** `isEligible`, `hasExpired`, `supportsStreaming`.

## Readability

- **Optimize for readability over cleverness.** Code should be understandable on first read. A reader should be able to answer what it does, why it exists, and what assumptions it relies on.
- **Limit branching depth to 2 levels.** Prefer guard clauses, extracted predicates, and early returns.

```ts
// Bad: nested conditionals
if (user) {
  if (user.isActive) {
    if (!user.isLocked) {
      /* ... */
    }
  }
}

// Good: guard clauses
if (!user) return;
if (!user.isActive) return;
if (user.isLocked) return;
/* ... */
```

- **Name complex conditions.** Inline boolean algebra is hard to scan.

```ts
// Bad: dense inline logic
if ((isAdmin || isOwner) && !isSuspended && hasQuota && !isReadonlyMode) {

// Good: named predicate
const canModifyWorkspace = (isAdmin || isOwner) && !isSuspended && hasQuota && !isReadonlyMode;
if (canModifyWorkspace) {
```

- **Prefer declarative style, but not at the cost of clarity.** Use `map`/`filter`/`reduce` when they make intent clearer. Use a loop when it's easier to read. Avoid long pipelines with hidden branching or side effects.
- **Keep async flow simple.** Async functions should read top-to-bottom. Avoid mixing `await`, `.then`, callbacks in one flow. Keep concurrency explicit with `Promise.all`.
- **Prefer immutability by default.** Use `const`. Mutate only when it materially improves clarity or performance.

## Comments

- **Comments should explain why, not what.** If a comment explains confusing code, first try rewriting the code.
- Good comments justify: non-obvious decisions, tradeoffs, constraints, external quirks.
- Bad comments narrate obvious code: `// Increment i` before `i++`.
- Every exported function must have a JSDoc comment (enforced by ESLint).

## Structure

- **Keep files under 200 lines.** Over 300 is a review trigger. Over 500 needs splitting.
- **A file should contain code that belongs together conceptually.** Do not mix types, API calls, UI formatting, domain logic, and persistence in one file.
- **Avoid "utils" and "helpers" dumping grounds.** Files named `utils.ts`, `helpers.ts`, `common.ts`, or `misc.ts` should be rare. Group code by domain or purpose. If a helper has a clear job, give it a real home and a real name.
- **Prefer directness over excessive indirection.** Extract when it captures business meaning, removes complexity, or improves reuse. Do not extract trivial property accessors that scatter logic.
- **Make boundaries obvious.** Separate domain logic, infrastructure, framework glue, and presentation formatting. Business rules should not depend directly on transport, storage, or UI concerns. Mapping between layers should be explicit.
- **Use symmetry in code structure.** Similar operations should look similar. `loadUser` / `saveUser` / `deleteUser` — not `fetchUser` / `persistUserRecord` / `removeUserEntity`.
- For non-trivial work, do not default to a single-file implementation. Split by concern before writing code.
- Match the nearest good existing structure before inventing a new one.
- Before writing non-trivial code, decide which files own boundary, application, domain, infrastructure, and presentation responsibilities.
- Boundary files such as package entrypoints, LSP server startup files, extension activation files, and `src/index.ts` must stay thin: validate input, call orchestration code, map output, and wire dependencies.
- Boundary files must not contain reusable business policy, prompt text, direct SQL, direct HTTP client code, or data-access logic.
- Application files own orchestration and use-case flow.
- Domain files own invariants, policies, and pure business rules.
- Infrastructure files own repositories, clients, persistence, and transport adapters.
- Presentation and transport files own DTOs, response mappers, and rendering-oriented formatting.
- Treat files over 300 lines as active refactor targets. Do not add new responsibilities to them when the change can be split into a purpose-specific module.
- Package boundary files such as entrypoints, server bootstrap files, and extension activation files must stay thin. Validation helpers, transport mappers, and reusable orchestration belong in named support modules.
- Existing structure violations are not precedent. When touching a file that already violates these rules, reduce the violation or at minimum do not make it worse.
- Filenames `utils`, `helpers`, `common`, `misc`, `manager`, and `processor` are forbidden unless domain-qualified.

## Side Effects

- **Avoid hidden side effects.** A function called `getUserPreferences` should not mutate cache, send metrics, or rewrite state unless clearly expected.
- **Side effects should happen in orchestration layers**, not deep utilities.
- **Prefer explicit data flow.** A reader should be able to trace where data comes from and where it goes. No magic mutation through shared objects or implicit globals.
- **Minimize temporal coupling.** Code that must happen in strict order should make that order explicit — wrap it in a safer abstraction.

## Dependencies

- **Prefer explicit dependencies.** A function or class should depend only on what it needs. No giant service containers. No modules with hidden global dependencies.
- **Do not abstract too early.** Prefer concrete code first. Extract when duplication or variation is proven.
- **Duplicate knowledge, not just duplicate text.** Repeated business rules in multiple places are worse than repeated literals. But tolerate small duplication when abstraction would be worse.

## Runtime Safety

- Runtime-safe files (`*.shared.ts`, `*.browser.ts`, `*.native.ts`, `*.edge.ts`) must not import Node-only modules (`fs`, `path`, `node:*`).
- Read config through validated config modules, never `process.env` directly in runtime-safe code.
- Prefer the project's existing fetch or transport abstractions over adding a new HTTP client without a clear need.
- Use the repo's logging surface for production logging. No `console.log` or `console.error` in production code.
- Read `process.env` only in explicit bootstrap, env, or config adapter modules. Ordinary package code must consume validated config objects instead.

## Compiler Configuration (tsconfig.base.json)

```jsonc
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "useUnknownInCatchVariables": true,
  "verbatimModuleSyntax": true,
  "module": "NodeNext",
  "moduleResolution": "NodeNext",
}
```

## ESLint Enforcement (eslint.config.mjs)

The following are mechanically enforced as hard errors and should not need manual review:

- Generic dumping-ground filenames are forbidden.
- Boolean flag parameters on exported functions are forbidden.
- Exported functions must declare explicit return types.
- Re-exports outside `index.ts` barrel files are forbidden.
- Restricted HTTP clients when the workspace already provides a transport abstraction.
- No Node-only imports in runtime-safe files.
- No cross-package relative imports.
- Raw `process.env` is forbidden outside explicit bootstrap, env, and config adapter modules.
- Library `src/index.ts` files must be export-only surfaces.
- App `src/index.ts` files must stay entry-only and may not declare or re-export helper surfaces.
- Empty catch blocks are forbidden.
- Type-only imports are enforced where appropriate.
- `prefer-const`, `no-param-reassign`, `no-else-return`, and `no-unneeded-ternary` are enforced as hard errors.

The following are enforced as warnings to create maintainability pressure without drowning delivery in stylistic churn:

- Nested ternary expressions.
- JSDoc coverage on exported library surfaces.
- File length, function length, statement count, parameter count, nesting depth, and cyclomatic complexity.

Warnings still matter when the configured root or package lint commands treat them as failures.

## Review Checklist

Before submitting code, verify:

- [ ] Is every exported function under 20 statements?
- [ ] Does each function do one thing at one abstraction level?
- [ ] Are names specific, domain-based, and intention-revealing?
- [ ] Are side effects obvious from function names?
- [ ] Is branching shallow (≤2 levels deep)?
- [ ] Are complex conditions named as predicates?
- [ ] Do comments explain why, not what?
- [ ] Is error handling consistent (not mixing throw/null/result arbitrarily)?
- [ ] Do types make invalid states hard to represent?
- [ ] Is the file cohesive and under 300 lines?
- [ ] Would a new reader understand this in one pass?
- [ ] Can a function be safely modified with only local context?
