---
id: today-bases-page
kind: ui-surface
authority:
  - today-grouped-rendering
  - today-section-collapse-state
  - route-local-add-task-shortcut
mutates:
  - markdown-store
observes:
  - markdown-store
  - view-service
persists_to: []
depends_on:
  - markdown-store
  - view-service
  - view-task-row
staleness_risks:
  - grouped view semantics rely on RecurringInstanceService and ViewService alignment
  - lazy wrapped section can hide regressions if not expanded during smoke
entrypoints:
  - src/routes/today-bases/+page.svelte
  - src/lib/components/ViewTaskRow.svelte
---

# Today Bases Page

## Purpose
Primary daily task surface (`/today-bases`). Renders grouped attention buckets (Now, Past, Upcoming, Wrapped) and delegates task mutation actions to `ViewTaskRow`.

## Scope of Touch
Safe to edit:
- Section ordering, labels, and collapse defaults
- Date header formatting and total-time display
- Route-level keyboard shortcut wiring (`Ctrl/Cmd+N` dispatch)

Risky to edit:
- Initialization path (`setSelectedDate(getTodayDate())`, `initializeMarkdownStore()`)
- Group wiring to `markdownStore.groupedView` and `filterNonHabits()`
- Row keys (`task.filename + instanceDate`) for recurring instance stability

## Authority Notes
- **Daily grouping render contract**: authoritative here for what appears in each section.
- **Task mutation semantics**: delegated to `ViewTaskRow`, which calls store mutators (`markTaskComplete`, `rescheduleTask`, `logTime`).
- **Date selection for this route**: sets selected date and refresh behavior.

## Links
- [Layout Shell](layout-shell.md)
- [Markdown Store](markdown-store.md)
- [Feature Index](feature-index.md)
