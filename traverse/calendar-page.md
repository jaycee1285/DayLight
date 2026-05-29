---
id: calendar-page
kind: ui-surface
authority:
  - calendar-view-mode
  - selected-period-navigation
  - week-month-planner-rendering
mutates:
  - markdown-store
observes:
  - markdown-store
  - view-service
persists_to: []
depends_on:
  - markdown-store
  - view-service
  - weekly-time-grid
  - planner-sidebar
  - view-task-row
staleness_risks:
  - planner mode desktop assumptions can drift from mobile behavior
  - time-block drag/resize mutators are reachable only through weekly grid interactions
entrypoints:
  - src/routes/calendar/+page.svelte
  - src/lib/components/WeeklyTimeGrid.svelte
  - src/lib/components/PlannerSidebar.svelte
  - src/lib/components/ViewTaskRow.svelte
---

# Calendar Page

## Purpose
Calendar surface (`/calendar`) with `week`, `month`, and `planner` modes. Uses `markdownStore.selectedDate` as anchor state and supports task scheduling via list rows and weekly time-grid interactions.

## Scope of Touch
Safe to edit:
- View mode toggle presentation
- Week/month headers and labels
- Desktop planner visibility behavior

Risky to edit:
- Period navigation math (`navigatePeriod`)
- Shared selected-date authority (`setSelectedDate`) across routes
- Weekly time-grid mutations (`updateTaskTimeBlock`) and drag/resize handling

## Authority Notes
- **Mode selection**: authoritative local state (`week`/`month`/`planner`).
- **Date-anchor behavior**: writes through store-selected date so other surfaces stay aligned.
- **Task mutation paths**: delegated to `ViewTaskRow` and `WeeklyTimeGrid`.

## Links
- [Layout Shell](layout-shell.md)
- [Markdown Store](markdown-store.md)
- [Mutation Index](mutation-index.md)
