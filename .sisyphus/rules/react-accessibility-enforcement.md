---
globs: ["**/*.tsx", "**/*.jsx"]
alwaysApply: false
description: "Enforces accessibility-first React UI development: semantic elements, stable accessibility tree, keyboard/focus behavior, router-aware semantics, and accessibility-driven automation"
---

<MANDATORY_REACT_ACCESSIBILITY_RULE severity="BLOCKING" priority="HIGHEST">

# React Accessibility Enforcement Rules

Accessibility is not a secondary concern in React work. It is the operational interface for assistive technology, keyboard users, automated testing, and coding agents.
If the accessibility tree is vague, the UI contract is vague.

## Rule 1: The Accessibility Tree is a First-Class Contract

Every new or changed React UI surface MUST expose a coherent accessibility tree.
A reviewer or agent should be able to inspect the rendered page and determine:

- the current screen or page,
- the main landmarks,
- the available actions,
- the current state of interactive controls,
- the primary next step in the flow.

**Blocking violations:**
- Interactive controls with no accessible name.
- Clickable UI with no semantic role.
- Important state changes visible on screen but absent from the accessibility tree.
- Multiple ambiguous controls named only `Edit`, `Open`, or `More` inside the same region without distinguishing context.

## Rule 2: Native Elements Before ARIA

Use the most semantic native element that matches the intent.

- Actions → `button`
- Navigation → `a`
- Text entry → `input` / `textarea`
- Selection → `select`, `input[type=checkbox]`, `input[type=radio]`
- Grouping → `fieldset` / `legend`
- Layout landmarks → `main`, `nav`, `header`, `footer`, `aside`, `section`

Do NOT implement button/link behavior on generic `div` or `span` elements unless there is a documented technical constraint and the full semantic/keyboard behavior is restored.
When composing with React Router, preserve real link semantics instead of simulating navigation with click handlers.

**Blocking violations:**
- `div`/`span` with `onClick` used as a primary control.
- ARIA role used to imitate native semantics when a native element would work.
- Design-system wrappers that strip native semantics.
- Navigation triggered from a button for a normal link/navigation case.

## Rule 3: Every Interactive Element Must Be Discoverable by Role and Name

Agents and tests should be able to locate controls through accessible selectors.

Every interactive element MUST expose:
- a valid role (native or ARIA),
- a stable accessible name,
- state where applicable (`expanded`, `selected`, `pressed`, `checked`, `busy`, `invalid`, `current`).

Preferred selector contract:
1. role + accessible name,
2. label text,
3. visible text,
4. placeholder or display value,
5. test id only as a last resort.

**Blocking violations:**
- Icon-only button without label.
- Input without associated label.
- Composite widget whose options cannot be located by role and name.
- UI automation that depends primarily on class names, DOM depth, or `nth-child` for stable user-facing interactions.

## Rule 4: Keyboard and Focus Behavior Must Be Explicit

Every React interaction MUST define its keyboard and focus behavior.

Required behaviors:
- All controls reachable by `Tab` in logical order.
- Visible focus indicator on all focusable controls.
- No keyboard traps.
- Dialogs/popovers/menus restore focus on close.
- Escape closes dismissible overlays.
- Composite widgets support expected arrow-key behavior where the pattern requires it.
- Route transitions in SPA flows move focus intentionally to a meaningful anchor (`h1`, `main`, or documented equivalent).

**Blocking violations:**
- Overlay opens without focus management.
- Focus disappears after dialog close.
- Control can be clicked but not keyboard-activated.
- Focus styling removed without accessible replacement.

## Rule 5: Forms Must Expose Label, Help, Error, and Pending State

Form components MUST communicate the full interaction state programmatically.

Required contract:
- label association for every field,
- helper text linked via `aria-describedby` when present,
- invalid state exposed programmatically,
- error message associated to the field,
- pending/submit state announced or otherwise represented in the accessibility tree.

Recommended patterns:
- inline field errors,
- optional error summary for multi-field failures,
- `aria-busy` or status region for async submit/save,
- fieldset/legend for related groups.

**Blocking violations:**
- Placeholder used as the only label.
- Error text visible but not associated to the control.
- Loading spinner with no accessible status.
- Required state conveyed only by color or an asterisk with no text equivalent.

## Rule 6: Shared Components Must Preserve Accessibility Through Abstraction

Reusable React components MUST carry a documented accessibility contract.

For every design-system primitive or shared component, define:
- rendered semantic element,
- accessible naming mechanism,
- supported states,
- keyboard behavior,
- focus behavior,
- composition constraints.

Consumers should not need to guess how to make the component accessible.
If a component can render in multiple modes (`button`, `link`, `menuitem`, `tab`), the semantics must change correctly with the mode.

**Blocking violations:**
- `Button` abstraction that renders a non-button without restoring keyboard/role behavior.
- `IconButton` component with no required accessible label path.
- `Modal` abstraction with no focus trap or dialog labeling support.
- Router wrappers that hide link semantics or current-page state.

## Rule 7: Accessibility APIs Are Part of the Development Workflow

When implementing or changing meaningful UI, agents MUST use accessibility-aware inspection and control.

Minimum expectations:
- Inspect the rendered UI through role/name-based queries.
- Prefer automation via `getByRole`, `getByLabelText`, or equivalent accessibility selectors.
- When tooling supports it, inspect the accessibility tree or snapshot after major UI work.
- If the app is hard to drive through accessibility APIs, improve the app rather than layering brittle selectors on top.

This rule exists so agents can **see** the app they are building through the same semantics users depend on.

## Rule 8: Build UX Patterns That Remain Legible to Humans and Agents

Prefer interaction patterns that expose clear semantics and state transitions.

Strongly encouraged:
- app-shell skip link,
- stable `main` landmark,
- one clear page heading,
- live-region status for background work,
- accessible command palette,
- explicit empty/loading/error/success states,
- reduced-motion support,
- predictable focus restoration,
- action labels that describe outcome, not implementation.

These are not just accessibility wins. They make the UI easier to learn, automate, test, and evolve.

## Review Standard

Before completing React UI work, verify:

1. Can the flow be completed with keyboard alone?
2. Can the main controls be found by role and accessible name?
3. Does the accessibility tree expose the right landmarks, names, and states?
4. Are focus transitions intentional and reversible?
5. Are async/loading/error states announced or represented programmatically?
6. Would another agent be able to understand and drive this screen without reading the CSS or DOM structure?

If the answer to any of these is no, the task is not done.

</MANDATORY_REACT_ACCESSIBILITY_RULE>
