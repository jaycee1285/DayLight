---
id: milkdown-adapter
kind: adapter-layer
authority:
  - editor-instance-lifecycle
  - markdown-normalization
mutates: []
observes: []
persists_to: []
depends_on:
  - "@milkdown/kit"
  - "@milkdown/plugin-indent"
staleness_risks:
  - milkdown major version changes (commonmark/gfm plugin API)
entrypoints:
  - src/lib/editor/milkdown-adapter.ts
---

# Milkdown Adapter

## Purpose
Framework-agnostic wrapper around milkdown editor. Initializes ProseMirror with commonmark + GFM + history + clipboard + indent plugins. Exposes a minimal `EditorHandle` interface: `setMarkdown`, `getMarkdown`, `focus`, `destroy`, `action`.

## Scope of Touch
Safe to edit:
- Adding milkdown plugins (e.g. new preset features)
- Changing `normalizeMarkdown` behavior

Risky to edit:
- `onMarkdownChange` callback — editor-page derives dirty state from this; if it fires spuriously or stops firing, dirty tracking breaks
- `replaceAll` usage in `setMarkdown` — milkdown's `replaceAll` util is version-sensitive
- Plugin ordering — history must come after commonmark/gfm

## Authority Notes
- **Editor lifecycle**: this adapter owns creation and destruction. Editor-page must call `destroy()` before re-mounting.
- **Markdown content**: the adapter holds `currentMarkdown` internally for dedup, but editor-page's copy (via callback) is the display/save authority.
- **Zero-width space normalization**: strips `\u200B` that milkdown sometimes injects. If removed, dirty detection may false-positive.

## Links
- [Editor Page](editor-page.md)
- [Editor Toolbar](editor-toolbar.md)
