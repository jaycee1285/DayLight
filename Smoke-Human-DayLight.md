# Manual Smoke Test Draft (Human) - DayLight

Status: PASS
Last updated: 2026-03-01
Source: user-confirmed in session

## Bounds

- Platform: Linux desktop (Wayland primary path)
- Scope: high-signal local-first task workflow smoke
- Focus: markdown/YAML persistence, recurrence behavior, manual time logging, editor search, add-task fuzzy reuse
- Excludes: Android permission/folder flow, deep calendar sync edge cases

## Conditions (Passed)

- [x] App launches and loads configured task folder
- [x] Create task -> appears in expected grouping/view
- [x] Create task -> markdown file written with valid YAML frontmatter/body
- [x] Edit task updates UI and persists to markdown
- [x] Complete task behavior matches DayLight lifecycle model (instance/recurrence semantics)
- [x] Manual time log entry updates UI totals and persists in frontmatter
- [x] Recurring task instance completion preserves future series behavior
- [x] Recurring instance reschedule behaves sanely (single-instance intent preserved)
- [x] Full restart/reopen preserves task, time log, and recurrence state
- [x] External markdown edit roundtrip is reflected without corruption
- [x] Editor search builds a persisted JSON index under the selected root and returns repeat queries quickly
- [x] Editor search debug surface reports state/authority/observation/staleness clearly enough for smoke diagnosis
- [x] Add-task modal shows existing-task fuzzy suggestions without breaking normal task entry

## Notes

- This smoke is designed to protect the local-first contract (`UI <-> markdown`).
- Android and calendar integrations should be tracked as separate smoke variants.
- Search smoke on 2026-03-01 used `/home/john/syncthing` and showed `3578` indexed docs.
- First search query built the persisted index in roughly `15.8s`; repeat query hit cache in roughly `17ms`.
- Current persisted search artifact lives at `<selected-root>/.daylight/search-index.json`.
- Imported TaskNotes migration is still staged-only; see `MIGRATION-REPORT-2026-03-01.md`.
