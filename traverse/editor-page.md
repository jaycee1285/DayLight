---
id: editor-page
kind: ui-surface
authority:
  - editor-view-state
  - dirty-tracking
  - file-open-save
mutates:
  - markdown-store
  - ferrite-state-bridge
observes:
  - milkdown-adapter
  - editor-toolbar
  - layout-shell
persists_to:
  - filesystem (via writeTextFile / updateTaskWithBody)
  - filesystem (.ferrite/state.json via ferrite-state-bridge)
  - localStorage (daylight-editor-path)
depends_on:
  - milkdown-adapter
  - editor-toolbar
  - markdown-store
  - frontmatter-parser
staleness_risks:
  - dirty flag vs actual editor content divergence
  - stale build cache after CSS/structural changes
entrypoints:
  - src/routes/editor/+page.svelte
---

# Editor Page

## Purpose
Full-screen markdown editor route (`/editor`). Three-view flow: file browser → WYSIWYG editor → preview. Owns dirty state, unsaved-changes guarding, file open/save, and the floating save FAB.

## Scope of Touch
Safe to edit:
- UI layout, toolbar wiring, dialog styling
- File browser integration, new note creation
- Save logic for non-task files

Risky to edit:
- `saveTaskFileIfManaged()` — routes saves through markdown-store for task files; changing this affects task data integrity
- `mountEditor()` lifecycle — milkdown init is async and order-sensitive
- `beforeunload` / dirty guard — removing breaks the unsaved-changes safety net

## Authority Notes
- **Dirty state**: authoritative. Derived from `currentMarkdown !== originalContent`.
- **File content**: the editor holds the in-flight version. On save, either writes directly to disk (generic files) or delegates to markdown-store (task files).
- **View state** (`browser`/`editor`/`preview`): local to this component, not persisted.

## Links
- [Milkdown Adapter](milkdown-adapter.md)
- [Editor Toolbar](editor-toolbar.md)
- [Layout Shell](layout-shell.md)
- [Markdown Store](markdown-store.md)
