# Design Normalization

This document is the operational companion to `design-basics.md`.

`design-basics.md` explains the design grammar. This file explains how to audit, normalize, and clean up existing repos so they move toward that grammar without flattening the character of each product.

The goal is not cosmetic uniformity. The goal is to remove avoidable drift, arbitrary decisions, and assembly-line defaults while preserving product-specific needs.

## Purpose

Use this document when:

- cleaning up an existing UI across repos
- auditing a new project for design drift
- preparing a repo for a more formal theming or component pass
- guiding an agent to normalize visual and interaction patterns

Do not use this document to force identical layouts across products. Use it to align the underlying system: theme source, tokens, typography roles, state handling, spacing rhythm, and interaction patterns.

## Primary Normalization Rule

Normalize systems first, components second.

That means the order of concern is:

1. source of truth
2. token structure
3. typography roles
4. state visibility
5. layout discipline
6. component polish

If the system layer is wrong, polishing components only hides the problem.

## Base Unit Policy

Normalization does not require a single universal starting measurement.

Agents do not need to care whether a repo's effective base unit is inferred from:

- body text
- menu text
- hero text
- button sizing
- an existing component scale
- another stable local measurement

The requirement is not "derive from the correct sacred origin." The requirement is "normalize the repo into a coherent system."

That means:

1. Find the most stable local unit already doing real work in the interface.
2. Map that unit into the approved spacing and sizing logic.
3. Normalize surrounding elements to that system.
4. Prefer consistency after normalization over purity of derivation.

If two different starting points produce the same coherent system, either is acceptable.

## Normalization Outcomes

After normalization, a repo should show:

- colors derived from the correct theme source for the target
- fewer raw pixel literals and more approved token usage
- clear typography role separation
- visible and consistent interactive states
- lower cognitive load from better disclosure and less stray chrome
- platform-appropriate layout behavior

## Repo Classification Pass

Before changing anything, classify the repo.

| Question | Options |
| --- | --- |
| What is the primary target? | web, mobile, desktop GUI, TUI, syntax surface |
| What is the main stack? | Astro, Svelte, Tauri, GTK, Rust, Go, other |
| What is the current theme source? | Base16/YAML, Skeleton tokens, GTK vars, ad hoc CSS, library defaults |
| What is the current typography system? | approved pairing, partial pairing, ad hoc |
| What is the current spacing system? | tokenized, mostly raw values, mixed |
| What is the design maturity? | early, usable but drifting, mature but inconsistent, actively fragmented |

This classification determines what should be normalized and how aggressively.

## Pass 1: Theme Source

The first question is always: where do the colors come from?

### Desired State by Target

| Target | Required source of truth |
| --- | --- |
| Web | Base16 YAML themes mapped through the DayLight-style Skeleton token approach |
| Mobile | Same Base16-derived token system used for web/Svelte surfaces |
| Desktop GUI | GTK-style variables, even when the toolkit is not GTK |
| Syntax layers | `.tmTheme` or equivalent syntax scopes derived from the same theme family |
| TUI | Kitty-style semantics derived from the same terminal theme family |

### Normalize

- Replace library default colors with theme-derived tokens.
- Remove one-off hex values unless they are documented exceptions.
- Bring syntax colors into the same theme family as the app.
- Ensure hover, selection, dirty, and surface colors come from the system, not ad hoc overrides.

### Drift Indicators

- multiple unrelated accent colors
- raw hex values scattered across files
- library defaults leaking into custom surfaces
- syntax theme unrelated to UI theme
- hover and selection states using mismatched colors

## Pass 2: Token Structure

Agents should reduce direct styling values and move the repo toward reusable tokens.

### Normalize

- Replace raw spacing values with approved spacing tiers from `design-basics.md`.
- Replace raw font sizes with role-based type values where possible.
- Replace direct color values with semantic tokens or variables.
- Unify radius, shadows, border colors, and spacing conventions where they drift.
- Infer the working base unit from the repo's most stable existing scale when needed instead of forcing a single canonical origin.

### Priority Order

1. colors
2. spacing
3. typography
4. radius and border treatment
5. shadows and effects

### Drift Indicators

- too many one-off values such as `10px`, `14px`, `18px`, `22px`, `26px`
- repeated values with no shared token name
- token names that do not map to actual semantic roles
- layout values that appear copied from component library defaults

## Pass 3: Typography Roles

Typography should be normalized by role, not by arbitrary font attachment.

### Desired Role Split

| Role | Default treatment |
| --- | --- |
| Headlines | bold monospace |
| Titlebars and strong labels | bold monospace |
| Buttons | bold monospace unless product context strongly argues otherwise |
| Body text | regular sans |
| Menus and supporting UI text | regular sans |
| Dense reading surfaces | sans unless a product-specific reason says otherwise |

### Normalize

- Bring the repo onto one approved pairing unless a strong existing reason says not to.
- Remove mixed font stacks that blur hierarchy.
- Make heading roles visibly distinct from body roles.
- Ensure font sizing follows platform legibility requirements.

### Drift Indicators

- too many font families
- body text using the same treatment as headings
- buttons inheriting generic component-library type styles
- menu text too small for the target platform

## Pass 4: State Visibility

State visibility is mandatory. If a user can interact with it, its state must be legible.

### Required States

| State | Must be visible? |
| --- | --- |
| default | yes |
| hover | yes |
| focus | yes |
| active or pressed | yes |
| selected | yes |
| disabled | yes |
| dirty or unsaved | yes when applicable |
| destructive | yes when applicable |
| loading | yes when applicable |
| empty | yes when applicable |

### Normalize

- Make hover and selected visibly different.
- Restore focus indicators where component defaults have hidden them.
- Add dirty indicators to editors and editable records.
- Make disabled states readable, not merely faint.
- Ensure destructive actions are visually distinct without being melodramatic.

### Drift Indicators

- hover and active look the same
- focus ring removed
- disabled buttons still look clickable
- unsaved work has no signal
- selection color conflicts with hover color

## Pass 5: Layout Discipline

Layouts should be normalized toward clarity, progressive disclosure, and platform fit.

### Desktop and TUI

Normalize toward:

- keyboard-literate structure without modal-editor framing
- one obvious menu or command surface for most daily actions
- collapsible or maximizable primary work areas
- reduced chrome where controls are not constantly needed
- visible separation between major surfaces

Drift indicators:

- too many persistent controls
- duplicate actions in several places
- cramped panes with no way to focus the primary work surface
- mobile-like layout choices forced into desktop contexts

### Mobile

Normalize toward:

- safe-area respect on every route
- a top-third viewing emphasis
- a bottom-third interaction emphasis
- one primary action per route
- upward-expanding secondary actions where needed
- avoidance of lazy side-sheet usage

Drift indicators:

- content or actions overlapping status/nav areas
- top-heavy interaction patterns
- several competing CTAs on one screen
- side sheets used where a route, modal, or bottom action stack would be clearer

## Pass 6: Surface Hierarchy

Every UI should have a clear model of surface depth and purpose.

### Normalize

- Distinguish app background from working panels.
- Distinguish panels from raised cards and dialogs.
- Ensure editor surfaces, sidebars, overlays, and status regions read as different layers when they serve different jobs.
- Remove fake depth that does not communicate meaning.

### Drift Indicators

- everything uses the same background tone
- cards and panels are visually interchangeable
- modal overlays do not clearly separate foreground from background
- sidebars compete with primary content for attention

## Pass 7: Interaction and Chrome Reduction

Normalization should reduce unnecessary visible controls.

### Normalize

- move low-frequency actions behind menus, tabs, search, or help surfaces
- remove redundant icons where labels already carry the meaning
- avoid Microsoft Office-style overexposure of every action
- preserve discoverability through command surfaces and shortcuts instead of permanent clutter

### Drift Indicators

- too many toolbar icons
- multiple controls for the same action
- chrome taking attention away from the content or task
- secondary metadata consuming prime layout space

## Pass 8: Exceptions and Allowed Deviations

Not every repo should be forced into perfect conformity.

A deviation is acceptable when:

- the product has a clear domain-specific interaction need
- a library or platform constraint makes the default impractical
- a specialized surface such as a canvas, editor, or visualization needs a distinct treatment
- the deviation is consistent and improves usability

A deviation is not acceptable when:

- it comes from default library styling
- it exists because nobody normalized the repo yet
- it introduces a second visual system without justification
- it weakens state visibility, hierarchy, or legibility

## Agent Workflow

When using this file operationally, follow this order:

1. classify the repo
2. identify the current theme and token systems
3. detect the highest-signal drift areas
4. normalize system-level issues first
5. normalize repeated component patterns next
6. leave documented exceptions alone
7. report what changed and what still deviates

## Reporting Format

An agent performing normalization should report:

- repo type and target
- current design system status
- the local source of truth it used for normalization:
  - body text
  - menu text
  - hero text
  - button sizing
  - existing component scale
  - another stable local anchor
- highest-signal drift found
- what was normalized
- what was intentionally left alone
- what still requires human judgment

This is not required because the anchor is philosophically important. It is required because it creates a useful record of how far the repo drifted before codification, what stable patterns existed in practice, and what sources agents most often used as their normalization baseline.

## Fast Checklist

Use this as the quick pass.

- Are colors derived from the correct source of truth?
- Are raw values being replaced with system tokens?
- Does typography clearly separate structural text from reading text?
- Are hover, focus, selected, disabled, and dirty states all visible?
- Does the layout fit the platform rather than mimic another platform?
- Can the primary work surface dominate when needed?
- Has unnecessary chrome been reduced?
- Are remaining deviations real product decisions rather than leftovers?

## Future Skill Direction

This document is intentionally shaped so it can become a reusable skill.

A future `design-normalization` skill should:

- inspect repo stack and target
- find current theme/token usage
- detect drift against `design-basics.md`
- propose a scoped normalization plan
- apply safe system-level cleanup
- leave ambiguous visual decisions for human review
