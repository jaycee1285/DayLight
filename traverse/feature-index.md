---
id: feature-index
kind: index
authority: []
mutates: []
observes:
  - editor-page
  - editor-toolbar
  - milkdown-adapter
  - layout-shell
  - settings-layout-controls
  - today-bases-page
  - calendar-page
  - habits-page
  - markdown-store
persists_to: []
depends_on:
  - editor-page
  - editor-toolbar
  - milkdown-adapter
  - layout-shell
  - settings-layout-controls
  - today-bases-page
  - calendar-page
  - habits-page
  - markdown-store
staleness_risks: []
entrypoints:
  - traverse/editor-page.md
  - traverse/layout-shell.md
  - traverse/settings-layout-controls.md
  - traverse/today-bases-page.md
  - traverse/calendar-page.md
  - traverse/habits-page.md
  - traverse/markdown-store.md
---

# Feature Index

## Purpose
Groups traverse nodes by the main workflows an agent is likely to perform in DayLight.

## Workflow Neighborhoods

### Editing a file
[Editor Page](editor-page.md) → [Milkdown Adapter](milkdown-adapter.md) → [Editor Toolbar](editor-toolbar.md)
Open file from browser, edit in WYSIWYG, format via toolbar, save via FAB or Ctrl+S.

### Saving a task file through the editor
[Editor Page](editor-page.md) → [Markdown Store](markdown-store.md)
Editor detects the file is a managed task, parses frontmatter, delegates save to store.

### Route-level chrome visibility
[Layout Shell](layout-shell.md) observes `$page.url.pathname`
Editor route hides global FAB and bottom nav; other routes show them.

### Dirty-state guarding
[Editor Page](editor-page.md) owns dirty flag
Back navigation, `beforeunload`, and Ctrl+S all check dirty state before acting.

### Today workflow
[Today Bases Page](today-bases-page.md) -> `ViewTaskRow.svelte` -> [Markdown Store](markdown-store.md)
Grouped daily buckets render from `groupedView`; row actions mutate completion, reschedule, and time logging.

### Calendar workflow
[Calendar Page](calendar-page.md) -> `ViewTaskRow.svelte` / `WeeklyTimeGrid.svelte` -> [Markdown Store](markdown-store.md)
Week/month/planner modes share selected-date anchor; planner and weekly grid drive scheduling mutations.

### Habits workflow
[Habits Page](habits-page.md) -> `HabitRow.svelte` -> [Markdown Store](markdown-store.md)
Today habit completion and value-entry updates write through habit/task store mutators.

## Notes
This index covers editor, layout shell controls, and primary daily surfaces (`today-bases`, `calendar`, `habits`).

### Layout override and sidebar behavior
[Settings Layout Controls](settings-layout-controls.md) -> [Layout Shell](layout-shell.md) -> `Sidebar.svelte`
Settings writes the override mode (`auto`/`mobile`/`desktop`), layout applies document attributes, sidebar measures runtime width and reports offset.

### Shortcode discoverability in Add Task
[Layout Shell](layout-shell.md) -> `ChipInput.svelte` -> `ShortcodeHelp.svelte`
Add Task input exposes inline `?` help, while keyboard shortcuts remain on the separate shortcuts sheet.

### Legacy route compatibility
`src/routes/today/+page.ts` -> redirect to `/today-bases`
`src/routes/recurring/+page.ts` -> redirect to `/recurring-bases`
Route compatibility is intentionally thin and owned at route load level.

## Links
- [Authority Index](authority-index.md)
- [Mutation Index](mutation-index.md)
