---
id: mutation-index
kind: index
authority: []
mutates: []
observes:
  - editor-page
  - markdown-store
  - layout-shell
  - settings-layout-controls
  - today-bases-page
  - calendar-page
  - habits-page
persists_to: []
depends_on:
  - editor-page
  - markdown-store
  - layout-shell
  - settings-layout-controls
  - today-bases-page
  - calendar-page
  - habits-page
staleness_risks: []
entrypoints:
  - traverse/editor-page.md
  - traverse/markdown-store.md
  - traverse/settings-layout-controls.md
  - traverse/today-bases-page.md
  - traverse/calendar-page.md
  - traverse/habits-page.md
---

# Mutation Index

## Purpose
Shows which nodes drive state changes and where writes land.

## Mutation Chains

### Editor save → filesystem
[Editor Page](editor-page.md) → `writeTextFile()` (generic files)
[Editor Page](editor-page.md) → [Markdown Store](markdown-store.md) → `writeTextFile()` (task files)
Two paths to disk depending on whether the file is a managed task.

### Layout → theme attributes
[Layout Shell](layout-shell.md) → `document.documentElement` attributes + `localStorage`
Theme and dark-mode state written on change.

### Settings → layout override → sidebar behavior
[Settings Layout Controls](settings-layout-controls.md) → `localStorage(daylight-layout-override)` + `daylight:layout-override-change`
[Layout Shell](layout-shell.md) → `data-layout-override` + `--sidebar-width`
`Sidebar.svelte` → `ResizeObserver` width report
Writes are split across settings (preference), layout (attribute application), and sidebar (runtime measurement signal).

### Today route row actions → task mutations
[Today Bases Page](today-bases-page.md) → `ViewTaskRow.svelte` → [Markdown Store](markdown-store.md)
Completion toggles, reschedule actions, and time logs all write through store mutators.

### Calendar scheduling interactions → time block mutations
[Calendar Page](calendar-page.md) → `WeeklyTimeGrid.svelte` → [Markdown Store](markdown-store.md)
Drag/drop and resize in week grid call `updateTaskTimeBlock`.

### Habits interactions → habit/task mutations
[Habits Page](habits-page.md) → `HabitRow.svelte` → [Markdown Store](markdown-store.md)
Habit check toggles and value entry writes call task/habit mutators.

### Primarily observational
[Editor Toolbar](editor-toolbar.md) — triggers commands but holds no persistent state
[Milkdown Adapter](milkdown-adapter.md) — manages editor instance but doesn't persist

## Links
- [Authority Index](authority-index.md)
- [Feature Index](feature-index.md)
