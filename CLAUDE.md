# Claude Code Notes for SPRedux

## Before Diving In

**Don't optimistically start coding without context.** If the human hasn't provided enough information, ASK. Jumping into a repo blind leads to "fixes" that violate invisible constraints.

Context checklist - if any of these are unclear, ask:

1. **Architectural constraints** - What can we use? (e.g., "no new dependencies", "must use existing store pattern", "Tauri APIs only")

2. **Implementation concerns** - How can data move? Are there compliance/security requirements? (e.g., HIPAA means no optimistic uploads, cold server starts must be handled gracefully)

3. **Design system/goals** - Is there an existing component library? Visual language? Don't invent new patterns if there's an established one.

4. **Session goals** - What are we actually trying to accomplish? Verify alignment before writing code. A bug fix session is different from a feature session.

This is a two-way contract: John needs to provide context, Claude needs to ask when it's missing.

---

## Dev Environment Confidence

**Don't panic on missing tools.** John runs Nix. If a package exists on [search.nixos.org](https://search.nixos.org), he'll add it to `flake.nix` and it'll be in `$PATH` next run. Disk space and patience are abundant (2TB, 11th-gen i5).

**Build fails from missing deps are one-line fixes.** Don't waste cognitive load working around tooling gaps. Just say "this needs X, add it to the flake" and move on. The goal is to get the environment right once so you can focus entirely on output.

**Confidence matters.** If you know the environment will be fixed for next run, you can plan multi-step work without hedging. Don't let tooling anxiety fragment your focus.

---

## Working with John

**Communication style:** Direct and blunt. If something's wrong, he'll tell you. Don't take it personally, just fix it.

**Be circumspect before jumping to fixes.** Agents tend to find the first plausible problem and try to fix it immediately. Resist this. Review related files, understand the full data flow, and have a backup hypothesis ready before making changes. If fix A doesn't work, you shouldn't be starting the investigation from scratch. Consider dropping investigation notes to `.claude/` so context survives between runs.

**Wire things up completely.** Don't half-implement features. If you're adding a component, make sure it's actually used and functional end-to-end. ("why would you half-ass it?")

**He knows his codebase.** Trust his intuition about where problems are. If he says "it's not X", he's probably right.

**Trust specific directions.** When John gives precise instructions (like "add the conditional" or specific CSS patterns), follow them. He's learned patterns from watching Claude work and knows what fixes issues in this codebase. Direct responses aren't meant to dismiss your reasoning—they're meant to be efficient. Don't second-guess or re-derive when he's already told you the answer.

**Mobile-first.** The Tauri app starts at mobile size. Test mentally against small screens. Scrolling, touch targets, and viewport constraints matter.

**Personal project pragmatism.** This is for his use, not a team. Don't over-engineer. Don't build for hypothetical future requirements.

**Clean build before testing.** In Svelte-Tauri projects, always clear caches and rebuild before asking John to test:
```bash
rm -rf .svelte-kit build
bun run build
```
Then restart: `bun run tauri:dev`. Hot-reload doesn't always pick up new files, store changes, or structural changes. We've wasted time debugging "bugs" that were actually stale code. The app working matters more than avoiding a rebuild.

---

## Technical Context

### Environment
- **Nix/NixOS** with flakes
- **Bun** as package manager (not npm/pnpm)
- **Tauri 2** for desktop/mobile app
- **Svelte 5** with runes (`$state`, `$derived`, `$effect`)

### Two Store Systems (Legacy Split)
There are two competing stores:
- `app.svelte.ts` - In-memory only, used by `/today`, `/tags/*`, `/projects/*`
- `markdown-store.svelte.ts` - Persists to disk, used by `/today-bases`, `/calendar`

**The `-bases` routes are the current system.** When fixing bugs or adding features, use the markdown store functions. Don't import from `app.svelte.ts` for new work.

### Task Storage
Tasks are markdown files with YAML frontmatter:
- Location: `~/Sync/JMC/TaskNotes/Tasks/`
- Synced via Syncthing
- Format: See `src/lib/storage/frontmatter.ts` for the `TaskFrontmatter` type

### Activity Ledger Model (Feb 2026)

SPRedux treats tasks as **reusable activity buckets**, not one-shot checkboxes.

**Core principle:** The app is 90% self-accountability (seeing where time goes) and 10% not forgetting things. This inverts how most task managers work.

**What this means for the data model:**

1. **Completing a task adds to `complete_instances`**, not `status: 'done'`
   - Task goes to "Wrapped" group for today
   - Tomorrow it's back in the backlog (Upcoming), ready to be scheduled again
   - `status: 'done'` is legacy/unused for new tasks

2. **Adding a task that already exists reschedules it**
   - `addTask("Walmart", { scheduled: "2026-02-14" })` finds existing "Walmart.md"
   - Sets its `scheduled` date instead of creating "Walmart (1).md"
   - Time entries and completion history accumulate in one file

3. **Tasks don't nag you unless scheduled**
   - Unscheduled tasks live in Upcoming (the backlog)
   - They only appear in Now when explicitly scheduled for today
   - "Walmart" exists as "a thing I do sometimes" without daily reminders

4. **Reports aggregate across completions**
   - "Walmart: 6 completions, 14h total, avg 2h 25m" tells you where time goes
   - Tags/projects let you see "Housework: 38h this month"

**Key fields:**
- `scheduled: string | null` — when the next instance is planned (cleared on completion)
- `complete_instances: string[]` — dates when this activity was completed
- `timeEntries: TimeEntry[]` — time logged, accumulates across all completions

### Svelte 5 Gotcha: Map Reactivity
When mutating a `$state` Map, derived values may not update. Create a new Map:
```javascript
// Wrong - doesn't trigger reactivity
taskFiles.set(filename, newData);

// Right - triggers reactivity
taskFiles = new Map(taskFiles).set(filename, newData);
```

### CSS Theming
Uses CSS variables with `rgb()` wrapper pattern. Dark mode uses `data-mode` attribute (not per-theme selectors):
```css
background-color: rgb(var(--color-surface-100));

/* Dark mode — applies to ALL dark themes */
:global([data-mode='dark']) .my-class {
    background-color: rgb(var(--color-surface-800));
}
```

**Theme system architecture:**
- `generate-skeleton-themes.ts` converts kitty `.conf` and YAML `.yml` theme files → skeleton CSS
- Generated CSS lives in `/home/john/repos/skeleton-themes/` (sibling repo)
- Imported in `src/app.css` via `@import '../../skeleton-themes/...'`
- `data-theme` attribute selects the active theme, `data-mode="dark"|"light"` set alongside it
- `darkThemes` Set in both `+layout.svelte` and `settings/+page.svelte` tracks which themes are dark
- `setThemeAttributes()` helper sets both attributes together
- Adding a new theme: add source file to `themes/`, run generator, add import to `app.css`, add to `baseThemeOptions` and `darkThemes` (if dark) in settings and layout

**WebKitGTK gotcha:** Tauri's Linux WebView doesn't re-render native `<select>` options after reactive DOM updates. The settings `<select>` is gated behind `{#if initialized}` to ensure it renders only once with final options.

### Mobile Scroll Fix Pattern
For scrollable containers that get cut off:
```css
.container {
    max-height: 90dvh;
    display: flex;
    flex-direction: column;
}
.scrollable-body {
    flex: 1;
    min-height: 0;  /* Critical */
    overflow-y: auto;
}
```

### Android Support
- **All 4 Android targets** configured in `flake.nix`: aarch64, armv7, i686, x86_64
- **MANAGE_EXTERNAL_STORAGE permission** required for Syncthing folder access on Android 11+
- **Custom Kotlin plugins** in `src-tauri/gen/android/app/src/main/java/com/spredux/app/`:
  - `StoragePermissionPlugin.kt` - Handles runtime permission requests
  - `DirectoryPicker.kt` - SAF directory picker integration
- **Default Android path**: `/storage/emulated/0/syncthing/syncthing/JMC/TaskNotes`

### Data Path Override
The app supports custom data paths (for Syncthing sync):
- Set synchronously in `+layout.svelte` BEFORE child components mount
- Stored in `localStorage` as `spredux-data-path`
- Critical for Android where Tauri's default app data location won't sync

---

## Build Commands

```bash
# Enter dev environment
nix develop

# Install deps
bun install

# Dev mode
bun run tauri:dev

# Build release
bun run tauri:build

# Android (all architectures)
bun run tauri:android
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/stores/markdown-store.svelte.ts` | Main store for task persistence |
| `src/lib/storage/frontmatter.ts` | YAML frontmatter parsing/serialization |
| `src/lib/services/ViewService.ts` | Task grouping, filtering, date group logic |
| `src/lib/services/RecurringInstanceService.ts` | Recurring task instance management |
| `src/lib/components/ViewTaskRow.svelte` | Task row for markdown-based views |
| `src/lib/components/TaskContextMenu.svelte` | Context menu (reschedule, delete, edit) |
| `src/lib/components/TaskEditModal.svelte` | Full task editor (tags, projects, notes, recurrence) |
| `src/lib/components/RecurrenceEditor.svelte` | Recurrence configuration UI |
| `src/routes/today-bases/+page.svelte` | Main daily view (uses markdown store) |
| `src-tauri/capabilities/default.json` | Tauri permissions and fs:scope |
| `generate-skeleton-themes.ts` | Converts kitty/YAML themes → skeleton CSS |
| `src/app.css` | Theme CSS imports + base styles |

---

## Recent Changes (Jan 2026)

### Recurring Task Instance Expansion
- Each uncompleted recurring instance now shows as a separate ViewTask
- `ViewTask.instanceDate` tracks which specific instance the row represents
- Past instances show in "Past" group, today's in "Now"
- Rescheduling a recurring task to the future now hides past uncompleted instances

### Task Edit Modal
- New `TaskEditModal.svelte` component for full task editing
- Editable: notes/body, tags (chip UI), projects (chip UI), recurrence
- "Edit Task" option (pencil icon) replaced "Set Recurrence" in context menu

### Theme Consistency (superseded by Feb 2026 theme overhaul)
- Navbar, sidebar, settings cards now use `--color-surface-100` (light) / `--color-surface-800` (dark)

### Android File Access
- Fixed race condition: data path override now set synchronously before store init
- Added `StoragePermissionPlugin.kt` for MANAGE_EXTERNAL_STORAGE permission
- Settings page shows permission request UI on Android
- `fs:scope` in capabilities updated to include `$HOME/**` and `/home/**`

### Build Fixes
- Removed `@tailwindcss/vite` (conflicts with PostCSS setup)
- Updated `@sveltejs/vite-plugin-svelte` to ^5.1.1 (Svelte 5 compatibility)
- Added `export const prerender = false` to dynamic routes (`/projects/[project]`, `/tags/[tag]`)
- Configured all Android Rust targets in `flake.nix`

## Recent Changes (Feb 2026)

### Theme System Overhaul
- Expanded from 4 hardcoded themes to 30+ generated skeleton themes
- `generate-skeleton-themes.ts` parses both kitty `.conf` and YAML `.yml` terminal theme files
- Color mapping: blue→primary, magenta→secondary, green→tertiary/success, cyan→accent, yellow→warning, red→error
- Surface scales generated differently for light vs dark themes (light: bg→fg lerp, dark: fg→bg lerp)
- YAML parser handles `color_01`–`color_16` (1-indexed) format alongside kitty's `color0`–`color15`
- YAML preferred over `.conf` when both exist for the same theme name

### Dark Mode CSS Selector Migration
- Replaced all per-theme dark selectors (`[data-theme='flexoki-dark']`, `[data-theme='ayu-dark']`) with `[data-mode='dark']`
- 188 selectors across 25 `.svelte` files updated
- New `data-mode` attribute set alongside `data-theme` via `setThemeAttributes()` helper
- `darkThemes` Set maintained in both `+layout.svelte` and `settings/+page.svelte`

### WebKitGTK Select Fix
- Tauri's WebKitGTK doesn't re-render native `<select>` widget after reactive option changes
- Fix: `<select>` wrapped in `{#if initialized}` so it only renders once with final option list
- Added key `(option.value)` to `{#each}` for stable DOM identity

### Per-Instance Rescheduling for Recurring Tasks
- New `rescheduled_instances: Record<string, string>` field in frontmatter maps `original_date → new_date`
- Individual recurring instances can be deferred without affecting the series (e.g. "dog meds due Feb 1, defer to Feb 3")
- `rescheduleInstance()` store function updates the map; `rescheduleTask()` still exists for series-level scheduling
- ViewService uses effective dates (rescheduled or original) for grouping, filtering, and calendar placement
- `instanceDate` on ViewTask stays as the original RRULE-generated date (needed for completion tracking)
- `effectiveDate` on ViewTask is the display/grouping date
- RecurringInstanceService's `isActiveToday()` and `hasPastUncompletedInstances()` are rescheduled-aware
- Compatible with TaskNotes Obsidian plugin (unknown fields preserved as customProperties)
- Re-rescheduling overwrites the map entry; completing uses the original instanceDate

### Stale Build Cache
- When CSS imports or structural changes are made, clear caches before dev: `rm -rf .svelte-kit node_modules/.vite build`
- Tauri's `generate_context!()` requires `build/` dir to exist at compile time

### Activity Ledger Model
- Tasks are reusable activity buckets, not one-shot checkboxes
- `markTaskComplete` adds to `complete_instances` for ALL tasks (recurring and non-recurring)
- `scheduled` cleared on completion; task returns to backlog
- `addTask` checks for existing file with same name; reschedules instead of creating duplicates
- Title editing in TaskEditModal with conflict detection ("A task with that name already exists")
- `getTaskDateGroup` checks `complete_instances.includes(today)` for Wrapped status
- `isCompleted` in ViewTaskRow/TaskContextMenu uses `dateGroup === 'Wrapped'` for non-recurring tasks

---

## Current State

**Read the Obsidian project file before starting work:**

`~/Sync/JMC/SideProjects/SPRedux/SPRedux.md`

That file has the canonical task list, known issues, blockers, and PORTFOLIO-tagged features. Do not duplicate state here.
