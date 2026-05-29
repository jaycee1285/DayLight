---
id: authority-index
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
  - traverse/markdown-store.md
  - traverse/layout-shell.md
  - traverse/settings-layout-controls.md
  - traverse/today-bases-page.md
  - traverse/calendar-page.md
  - traverse/habits-page.md
---

# Authority Index

## Purpose
Groups nodes by where truth lives so agents start from authority, not arbitrary file order.

## Authority Groups

### Editor view state and dirty tracking
**Authority**: [Editor Page](editor-page.md)
The editor page owns view mode, dirty flag, current file content, and unsaved-changes guarding.

### Editor instance lifecycle
**Authority**: [Milkdown Adapter](milkdown-adapter.md)
The adapter owns ProseMirror creation/destruction. Editor page must go through the handle.

### Formatting command surface
**Authority**: [Editor Toolbar](editor-toolbar.md)
Sole UI for formatting triggers. Commands themselves belong to ProseMirror/milkdown.

### Task file state
**Authority**: [Markdown Store](markdown-store.md)
Single in-memory authority for task data. Editor delegates task saves here.

### Global chrome visibility
**Authority**: [Layout Shell](layout-shell.md)
Layout decides nav bar and FAB visibility based on route. Routes don't self-manage.

### Layout mode override and sidebar offset
**Split authority**: [Settings Layout Controls](settings-layout-controls.md) + [Layout Shell](layout-shell.md)
Settings is authoritative for user intent and persistence (`daylight-layout-override`), while layout is authoritative for applying document attributes and offset behavior. Sidebar is authoritative for measured width signal only.

### Daily task grouping surface
**Authority**: [Today Bases Page](today-bases-page.md)
Route decides grouped render behavior for Now/Past/Upcoming/Wrapped and defers row-level mutations to `ViewTaskRow`.

### Calendar mode and period surface
**Authority**: [Calendar Page](calendar-page.md)
Route owns mode selection and navigation period; scheduling mutations are delegated to row/grid components.

### Habit tracking surface
**Authority**: [Habits Page](habits-page.md)
Route owns stats range state and daily habit presentation; row component performs completion/value mutations.

## Split Authority
- **File content during editing**: editor-page holds the working copy; markdown-store holds the persisted version for task files. They reconcile on save.

## Links
- [Feature Index](feature-index.md)
- [Mutation Index](mutation-index.md)
