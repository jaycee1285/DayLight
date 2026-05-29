---
id: settings-layout-controls
kind: ui-surface
authority:
  - layout-override-user-intent
  - layout-override-persistence
mutates:
  - localStorage (daylight-layout-override)
  - document.documentElement attribute requests
observes:
  - layout-shell
persists_to:
  - localStorage (daylight-layout-override)
depends_on:
  - layout-shell
staleness_risks:
  - split ownership between settings persistence and layout application
  - keyboard shortcuts can override the same key without opening settings
entrypoints:
  - src/routes/settings/+page.svelte
---

# Settings Layout Controls

## Purpose
Owns the Settings route controls for forcing layout mode (`auto`, `mobile`, `desktop`). Persists user choice and signals layout consumers.

## Scope of Touch
Safe to edit:
- Toggle labels and placement in Settings UI
- Persistence key usage (`daylight-layout-override`)
- Event dispatch (`daylight:layout-override-change`)

Risky to edit:
- `setLayoutOverride()` behavior; this is the bridge between user intent and runtime layout
- Any mismatch with layout shortcut handlers in `+layout.svelte`
- Any mismatch with breakpoint assumptions used by `Sidebar.svelte`

## Authority Notes
- **User intent**: authoritative here. Settings is where explicit override preference is recorded.
- **Persistence**: authoritative key owner for `daylight-layout-override`.
- **Application**: delegated. Layout shell applies/removes `data-layout-override`; sidebar consumes it to switch overlay/persistent behavior.

## Links
- [Layout Shell](layout-shell.md)
- [Feature Index](feature-index.md)
