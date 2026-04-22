---
globs: ["**/*.tsx", "**/*.jsx"]
alwaysApply: false
description: "Enforces the default React UI framework strategy: shadcn/ui first, router-aware composition, consistent tokens, and no hand-rolled common primitives"
---

<MANDATORY_REACT_UI_FRAMEWORK_RULE severity="BLOCKING" priority="HIGHEST">

# React UI Framework Enforcement Rules

This repo does not use raw Tailwind as its UI framework.
Tailwind is the styling substrate.
The default UI framework is **shadcn/ui**, composed with React Router and backed by accessible primitives for interaction-heavy controls.

## Rule 1: Use the Approved UI Framework by Default

For common product UI, start from the approved stack:

- `shadcn/ui`
- Radix-backed primitives where the component depends on complex interaction behavior
- `lucide-react` for icons
- `sonner` for toast notifications

**Blocking violations:**
- New route built primarily from ad hoc `div`/`button`/utility-class markup when equivalent shared components already exist.
- Introducing a second general-purpose component library for routine app UI without a documented architectural reason.
- Rebuilding a solved component family from scratch for convenience.

## Rule 2: Do Not Hand-Roll Common Interactive Primitives

The following must come from the UI system unless there is a documented exception:

- buttons,
- form controls,
- dialogs,
- drawers/sheets,
- popovers,
- tooltips,
- menus,
- tabs,
- accordions,
- toasts,
- command palettes,
- cards,
- tables,
- breadcrumbs,
- sidebars.

**Blocking violations:**
- Custom dialog implementation instead of system dialog.
- Custom dropdown/menu built from positioned `div`s.
- Custom tooltip/popover logic that bypasses the shared system.
- Multiple one-off card/button/input styles appearing in different routes.

## Rule 3: React Router Must Compose With Real Link Semantics

Navigation is not a click side effect. It is a semantic contract.

Required behaviors:
- Navigation components render real links for navigation.
- Route-aware navigation exposes current state (`aria-current='page'` or equivalent).
- CTA navigation uses a composed link pattern rather than imperative navigation for ordinary link behavior.
- Breadcrumbs, sidebar items, menus, and inline navigation preserve accessible link semantics when composed with React Router.

**Blocking violations:**
- Button used where a link should be used.
- Route changes triggered through `onClick` navigation for ordinary hyperlinks.
- Active navigation item not exposed programmatically.
- Shared link wrapper that breaks native anchor behavior.

## Rule 4: Use Shared Page Shells and State Patterns

Every route should follow a consistent structural pattern.

Minimum expectation for meaningful pages:
- stable app shell,
- page header,
- main content landmark,
- visible `h1`,
- explicit loading state,
- explicit empty state when data can be absent,
- explicit error state when loading or mutation can fail.

**Blocking violations:**
- Data-heavy route with no empty state.
- Async route with spinner-only loading and no supporting text.
- Route with no obvious page heading or action area.
- Recreating a layout pattern that already exists elsewhere in the app.

## Rule 5: Design Consistency Must Come From Tokens and Variants

Extend the UI system through variants, composition, and theme tokens.
Do not create a new visual language per route.

Required approach:
- prefer shared variants over repeated Tailwind class bundles,
- keep radius, surface treatment, spacing, and typography aligned,
- promote repeated patterns into components.

**Blocking violations:**
- Arbitrary one-off shadows, radii, color mixtures, or spacing systems on individual screens.
- The same conceptual control implemented with visibly different structures across the app.
- Copy-pasted utility bundles appearing in multiple files instead of a shared component or variant.

## Rule 6: Custom Components Must Extend the System, Not Compete With It

When custom UI is necessary, it must:
- build on native semantics or an approved primitive,
- preserve keyboard and accessibility behavior,
- document its API and interaction contract,
- and be reusable if the pattern is likely to recur.

**Blocking violations:**
- Bespoke primitive introduced with no clear reason the system component could not be used.
- Product-specific component that silently forks the design language.
- Custom abstraction that weakens accessibility relative to the shared system.

## Rule 7: The Framework Choice Must Improve Agent Operability

A route should be easier to inspect and drive because it uses shared UI primitives.
Agents should be able to infer structure from the combination of:
- landmark layout,
- component semantics,
- role/name/state selectors,
- and predictable route templates.

If a custom composition makes the UI harder to read or automate than the shared system would, the implementation is moving in the wrong direction.

## Review Standard

Before completing React UI work, verify:

1. Does the route use the approved UI framework for common patterns?
2. Did we avoid rebuilding a solved primitive?
3. Are navigation semantics correct with React Router?
4. Does the page have consistent shell, heading, and state handling?
5. Are repeated visual patterns promoted into variants/components instead of utility duplication?
6. Would another agent recognize this screen as part of the same application immediately?

If the answer to any of these is no, the task is not done.

</MANDATORY_REACT_UI_FRAMEWORK_RULE>
