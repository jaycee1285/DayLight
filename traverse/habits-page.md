---
id: habits-page
kind: ui-surface
authority:
  - habits-today-rendering
  - habits-stats-range-selection
  - habits-stats-panel-state
mutates:
  - markdown-store
observes:
  - markdown-store
  - view-service
persists_to: []
depends_on:
  - markdown-store
  - view-service
  - habit-row
staleness_risks:
  - all-time range depends on DTSTART parsing from recurrence text
  - habit entry/value semantics differ by habit type (check vs target/limit)
entrypoints:
  - src/routes/habits/+page.svelte
  - src/lib/components/HabitRow.svelte
---

# Habits Page

## Purpose
Habit tracking surface (`/habits`) with a Today list and collapsible Stats section (week, month, all-time).

## Scope of Touch
Safe to edit:
- Stats panel presentation and range controls
- Overall and per-habit completion display
- Today list ordering and empty-state behavior

Risky to edit:
- Range derivation for all-time (`DTSTART` extraction)
- Completion-rate calculations and color mapping assumptions
- Habit mutation delegation in `HabitRow` (`markTaskComplete`, `markTaskIncomplete`, `logHabitEntry`)

## Authority Notes
- **Range selection state**: authoritative local state for analytics window.
- **Habit completion/value mutations**: delegated to `HabitRow` and markdown-store mutators.
- **Daily habit render contract**: page decides which habits and stats are visible.

## Links
- [Layout Shell](layout-shell.md)
- [Markdown Store](markdown-store.md)
- [Feature Index](feature-index.md)
