---
id: markdown-store
kind: persistence-boundary
authority:
  - task-file-state
  - task-crud
mutates:
  - filesystem
observes: []
persists_to:
  - filesystem (~/Sync/JMC/TaskNotes/Tasks/*.md)
depends_on:
  - frontmatter-parser
staleness_risks:
  - in-memory Map vs on-disk files (no file watcher)
  - Svelte 5 Map reactivity (must create new Map on mutation)
entrypoints:
  - src/lib/stores/markdown-store.svelte.ts
---

# Markdown Store

## Purpose
Central persistence store for task markdown files. Reads/writes YAML-frontmattered `.md` files. Provides reactive `$state` Map of all task files. Used by today-bases, calendar, habits, and editor (for task-file saves).

## Scope of Touch
Safe to edit:
- Adding new query/filter functions
- Extending frontmatter fields (with backwards compat)

Risky to edit:
- `taskFiles` Map mutation pattern — must create new Map for Svelte 5 reactivity
- `addTask` duplicate detection — matches by filename, reschedules instead of creating duplicates
- `markTaskComplete` — adds to `complete_instances`, clears `scheduled`; core activity-ledger behavior
- File write path — all writes go through Tauri's `writeTextFile`; changing paths affects Syncthing sync

## Authority Notes
- **Task state**: this store is the single authority for in-memory task state. Editor-page delegates task saves here via `updateTaskWithBody()`.
- **File content**: authoritative in-memory, but can drift from disk (no watcher). Reload on app restart.
- **Non-task files**: the store has no awareness of non-task `.md` files. Editor-page handles those directly.

## Links
- [Editor Page](editor-page.md)
- [Layout Shell](layout-shell.md)
