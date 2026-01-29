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

**Mobile-first.** The Tauri app starts at mobile size. Test mentally against small screens. Scrolling, touch targets, and viewport constraints matter.

**Personal project pragmatism.** This is for his use, not a team. Don't over-engineer. Don't build for hypothetical future requirements.

**ALWAYS suggest restarting the dev server.** John hates reloading `bun run tauri:dev`, but that aversion can mask whether a fix actually worked. If there's *any* doubt that hot-reload might not pick up the change (store changes, new imports, structural changes), explicitly say: "Restart the dev server to test this." Don't let us debug "bugs" that are actually stale code. The app working matters more than avoiding a restart.

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

### Svelte 5 Gotcha: Map Reactivity
When mutating a `$state` Map, derived values may not update. Create a new Map:
```javascript
// Wrong - doesn't trigger reactivity
taskFiles.set(filename, newData);

// Right - triggers reactivity
taskFiles = new Map(taskFiles).set(filename, newData);
```

### CSS Theming
Uses CSS variables with `rgb()` wrapper pattern:
```css
background-color: rgb(var(--color-surface-100));

:global([data-theme='flexoki-dark']) .my-class {
    background-color: rgb(var(--color-surface-800));
}
```

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

### Theme Consistency
- Navbar, sidebar, settings cards now use `--color-surface-100` (light) / `--color-surface-800` (dark)
- Added `ayu-dark` theme variants throughout (previously only `flexoki-dark`)

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

---

## Current State

**Read the Obsidian project file before starting work:**

`~/Sync/JMC/SideProjects/SPRedux/SPRedux.md`

That file has the canonical task list, known issues, blockers, and PORTFOLIO-tagged features. Do not duplicate state here.
