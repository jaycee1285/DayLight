---
id: layout-shell
kind: ui-surface
authority:
  - global-nav-visibility
  - global-fab-visibility
  - theme-attributes
  - add-task-sheet
  - layout-override-application
  - sidebar-offset-application
  - keyboard-shortcuts-router
mutates:
  - markdown-store
  - document.documentElement attributes
observes:
  - page-route
  - settings-layout-controls
  - sidebar-component
persists_to:
  - localStorage (theme, data-path, daylight-layout-override)
depends_on:
  - markdown-store
staleness_risks:
  - darkThemes Set vs actual theme registry
  - route-conditional visibility (editor, future routes)
  - layout override logic split across layout + settings + sidebar
  - sidebar width offset depends on runtime measurement and CSS breakpoint parity
entrypoints:
  - src/routes/+layout.svelte
  - src/lib/components/Sidebar.svelte
  - src/lib/components/ChipInput.svelte
  - src/lib/components/ShortcodeHelp.svelte
  - src/routes/today/+page.ts
  - src/routes/recurring/+page.ts
---

# Layout Shell

## Purpose
Root layout. Owns the bottom nav bar, global FAB (add task/habit), theme application (`data-theme` + `data-mode`), add-task sheet, sidebar mode + width offsets, and the main content wrapper with safe-area padding.

## Scope of Touch
Safe to edit:
- Nav item list, FAB behavior per route
- Theme switching, dark mode detection
- Add-task sheet UI
- Shortcut help and shortcode help routing
- Keyboard shortcut bindings and command palette action wiring

Risky to edit:
- Route-conditional hiding (`/editor` hides nav + FAB) - adding new full-screen routes needs the same treatment
- `data-path` override in localStorage - set synchronously before children mount; moving this breaks store init on Android
- Safe-area / `--android-nav-fallback` CSS - affects every route's bottom spacing
- Layout override toggles (`daylight-layout-override`) must stay in sync with sidebar logic and settings toggles
- Sidebar width variable (`--sidebar-width`) must track measured width from `Sidebar.svelte`
- Legacy route redirects (`/today`, `/recurring`) should remain simple 302 pass-throughs to `-bases`

## Authority Notes
- **Nav/FAB visibility**: layout is authoritative. Routes don't control their own nav visibility; layout checks `$page.url.pathname`.
- **Theme attributes**: layout sets `data-theme` and `data-mode` on `<html>`. Settings page writes to localStorage, but layout applies.
- **Add-task sheet**: layout owns the sheet; routes trigger it via shared state.
- **Layout override application**: layout applies/clears `data-layout-override` and emits `daylight:layout-override-change`.
- **Sidebar offset**: layout is authoritative for applying measured `--sidebar-width` to content/nav offsets.
- **Shortcode help surface**: layout owns modal routing between keyboard shortcuts sheet and dedicated shortcode reference sheet.

## Links
- [Editor Page](editor-page.md)
- [Markdown Store](markdown-store.md)
- [Settings Layout Controls](settings-layout-controls.md)
