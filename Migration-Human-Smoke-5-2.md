# Migration Human Smoke - 2026-05-02

Status: PARTIAL PASS (session-confirmed)
Last updated: 2026-05-02
Source: user-confirmed in session + CLI verification

## Bounds

- Platform: Rust desktop migration prototype through `nix develop -c cargo run`
- Scope: A0, V1.1, V1.2, and `today-bases` count parity diagnostics
- Focus: native shell, EGui/shadcn-rs scaffold, GTK theme surface, markdown parsing, daily grouping counts
- Excludes: add/edit persistence, task completion UI, time logging, quick capture daemon, V2 habits/calendar, weekly planner drag/drop, markdown editor component

## Conditions (Passed / Signed Off)

- [x] Root EGui window launches with the native desktop scaffold
- [x] User confirmed the initial native view was visible
- [x] `egui-shadcn` is pinned and used for the first component pass
- [x] GTK theme reader, token mapping, hot reload polling, and debug panel are implemented
- [x] Markdown task parser and task folder loader are implemented
- [x] `--print-counts` diagnostic is implemented
- [x] `--list-past` diagnostic is implemented
- [x] `--list-upcoming` diagnostic is implemented
- [x] Recurring Past inflation was diagnosed through CLI list scripts
- [x] Native counts match the Tauri `today-bases` target on 2026-05-02: Now 5, Past 24, Upcoming 18, Wrapped 415
- [x] `nix develop -c cargo fmt` passed
- [x] `nix develop -c cargo test` passed
- [x] `nix develop -c cargo check` passed

## Implemented But Not Explicitly Signed Off This Session

- [ ] GTK hot reload visually confirmed by editing GTK CSS while the app is open
- [ ] Daily task row interaction smoke beyond grouped count rendering
- [ ] Parser/load error triage for the 8 local markdown files currently reported by diagnostics
- [ ] Add/edit dialog persistence smoke
- [ ] Time tracking smoke

## Notes

- The native migration is still read-mostly for task data.
- Add/edit UI remains scaffold-only until V1.4.
- Count parity command: `nix develop -c cargo run -- --print-counts`.
- Diagnostic list commands: `nix develop -c cargo run -- --print-counts --list-past` and `nix develop -c cargo run -- --print-counts --list-upcoming`.
- The Past overcount came from expanding stale recurring active instances into Past; the native model now follows the observed `today-bases` count target for the 2026-05-02 local TaskNotes snapshot.
