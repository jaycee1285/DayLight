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
  - app.html inline DARK/KNOWN lists vs src/lib/theme.ts (locked by src/lib/theme.test.ts)
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
- **Theme attributes**: `src/lib/theme.ts` is the registry (theme name, label, dark/light) and owns `applyThemeAttributes()`. `data-theme` and `data-mode` must ALWAYS be written as a pair — a dark `data-theme` with a missing or stale `data-mode` renders every component's light-mode card colors on the dark body background (unreadable light-on-light text).
  - First write is the inline pre-paint script in `src/app.html`, which duplicates the dark list because it cannot import a module. `src/lib/theme.test.ts` executes that script and locks its lists to the registry.
  - `+layout.svelte` re-affirms the pair synchronously in its pre-mount block (next to the `data-path` override) so a hot remount can't leave it half-applied.
  - `applyTheme()` / `handleThemeChange()` set the attributes **before their first `await`**. The GTK bridge and dynamic imports are best-effort refinement and must never gate the base theme.
  - `gtk-theme.ts` also writes the pair, inferring dark/light from the real window background.
- **Add-task sheet**: layout owns the sheet; routes trigger it via shared state.
- **Layout override application**: layout applies/clears `data-layout-override` and emits `daylight:layout-override-change`.
- **Sidebar offset**: layout is authoritative for applying measured `--sidebar-width` to content/nav offsets.
- **Shortcode help surface**: layout owns modal routing between keyboard shortcuts sheet and dedicated shortcode reference sheet.

## Links
- [Editor Page](editor-page.md)
- [Markdown Store](markdown-store.md)
- [Settings Layout Controls](settings-layout-controls.md)
