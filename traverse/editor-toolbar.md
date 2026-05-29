---
id: editor-toolbar
kind: ui-surface
authority:
  - formatting-actions
  - toolbar-expansion-state
mutates: []
observes:
  - milkdown-adapter
  - editor-page
persists_to: []
depends_on:
  - milkdown-adapter
staleness_risks:
  - milkdown command API changes across versions
entrypoints:
  - src/lib/editor/EditorToolbar.svelte
---

# Editor Toolbar

## Purpose
Fixed bottom bar with scrollable formatting buttons. Sends ProseMirror commands through the milkdown adapter. Owns its own expanded-group state (heading submenu) but has no persistent state.

## Scope of Touch
Safe to edit:
- Adding/removing toolbar buttons
- Changing button order or icons
- Styling, spacing, scroll behavior

Risky to edit:
- `cmd()` / `insertText()` / `insertLinePrefix()` — these reach into ProseMirror's transaction API; incorrect positions or schema mismatches silently corrupt editor state
- CSS positioning — the toolbar is `position: fixed; bottom: 0` with Android safe-area padding; breaking this hides it behind system nav

## Authority Notes
- **Formatting commands**: this component is the sole UI surface for triggering formatting. It does not own the commands themselves (milkdown/ProseMirror does).
- **Expanded state** (heading submenu): purely local, resets on any action.
- **Preview toggle**: delegates to editor-page via `onTogglePreview` callback.

## Links
- [Editor Page](editor-page.md)
- [Milkdown Adapter](milkdown-adapter.md)
