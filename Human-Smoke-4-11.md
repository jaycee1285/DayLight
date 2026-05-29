# Human Smoke — 2026-04-11

Status: PASS (session-confirmed)
Last updated: 2026-04-11
Source: user-confirmed in session

## Bounds

- Platform: DayLight desktop flow (session runtime)
- Scope: UX normalization follow-through from Phase 19 + layout ergonomics
- Focus: discoverability, route reachability, modal state clarity, layout adaptability
- Excludes: Android storage permission flow, calendar provider edge-case sync

## Conditions (Passed / Signed Off)

- [x] Shortcode help discoverability works in Add Task (`?` button + dedicated sheet + split keyboard-shortcut sheet)
- [x] TaskEditModal dirty-state behavior is sane (`Save` disabled when unchanged, enabled when changed)
- [x] Command palette route coverage includes Habits, Projects, Tags, Conflicts, Editor
- [x] DatePill dropdown behavior improved (escape, outside-click close, viewport-safe behavior)
- [x] `/today-bases` project pills row removed
- [x] Legacy `/today` and `/recurring` no longer expose legacy surface (redirects to `-bases`)
- [x] Add Task prefill from `/projects/[project]` and `/tags/[tag]` route context
- [x] Dark-mode input surfaces corrected for layout sheets (`select-input`, `command-search`)
- [x] Layout override controls in Settings validated (`Force mobile layout`, `Force desktop layout`)
- [x] Sidebar UX normalized for persistent mode (no header "Menu" label, no close control in persistent mode)
- [x] Sidebar width behavior updated to content-driven sizing with corresponding layout offset

## Implemented But Not Explicitly Signed Off This Session

- [ ] Layout override keyboard shortcuts: `Ctrl/Cmd+D` (desktop), `Ctrl/Cmd+M` (mobile)

## Notes

- This session focused on high-friction UI correctness rather than storage/recurrence internals.
- `nix develop -c bun run check` still reports known baseline type/a11y issues outside this smoke scope.
- Persistence of layout override relies on `localStorage` key `daylight-layout-override`.
