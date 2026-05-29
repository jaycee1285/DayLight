# MIGRATION TASKBOARD - Rust Desktop

Purpose: migrate the DayLight task-tracking, habit, and calendar product into a native Rust desktop app using EGui or Iced with shadcn-rs style components. The current Svelte/Tauri app remains the behavior reference, but the new desktop scope is intentionally narrower.

## Migration Guardrails

- V1 ships daily task views, task add/edit, manual time tracking, and a quick-capture/quick-time popup opened by a compositor shortcut through a small daemon.
- V2 adds habits and calendar views.
- Out of scope for this desktop migration: weekly planner drag/drop, time-block resizing, and the markdown editor component.
- Data compatibility is a hard requirement. Existing markdown task files with YAML frontmatter remain the source of truth.
- The app must run through `nix develop -c cargo run` for human-in-the-middle smoke tests.
- Styling must follow `design-basics.md`: derive desktop colors from GTK-style variables, keep explicit state colors, use desktop spacing/density rules, and use Spline Sans Mono/Spline Sans unless a better local font pairing is documented.
- The UI must follow the GTK 4 color scheme even without GTK widgets. Read `~/.config/gtk-4.0/gtk.css`, support light/dark preference, and hot-reload color changes.
- The component layer should use shadcn-rs where practical. Current upstream shape appears to provide `egui-shadcn` and `iced-shadcn`; confirm exact crate versions during implementation before pinning.
- Do not parallelize dependent tickets. Each batch below is designed so it can be implemented, launched, and smoke tested before the next batch begins.

## Current Codebase Inventory

| Area | Existing Reference | Migration Use |
| --- | --- | --- |
| Markdown task storage | `src/lib/storage/frontmatter.ts`, `src/lib/storage/markdown-storage.ts`, `src-tauri/src/tasks.rs` | Port frontmatter parser, file IO, conflict-safe write behavior, and grouped task categorization. |
| Daily grouping | `src/lib/services/RecurringInstanceService.ts`, `src-tauri/src/tasks.rs`, `traverse/today-bases-page.md` | Preserve Past/Now/Upcoming/Wrapped attention semantics. |
| Task rows and edits | `src/lib/components/ViewTaskRow.svelte`, `src/routes/+layout.svelte` | Port visible row actions, add/edit dialog fields, completion, rescheduling, and time logging. |
| Shortcodes | `src/lib/shortcode/parser.ts` | Port `#tag`, `+project`, `@context`, and date/recurrence capture. |
| Time tracking | `src/lib/components/TimedSessionModal.svelte`, time entry frontmatter | V1 supports manual time logging and active tracking. Pomodoro polish is not required. |
| GTK theme bridge | `src-tauri/src/theme.rs`, `src/lib/services/gtk-theme.ts` | Port GTK 4 CSS variable parsing, hot reload, and state-token mapping. |
| Habits | `src/routes/habits/+page.svelte`, `traverse/habits-page.md` | V2 only. Keep separate from V1 task scope. |
| Calendar | `src/routes/calendar/+page.svelte`, `traverse/calendar-page.md`, calendar cache code | V2 only. Keep weekly planner drag/drop excluded. |
| Markdown editor | `src/routes/editor/+page.svelte`, editor traverse notes | Excluded from desktop migration. |

## Architecture Decision Batch

| ID | Ticket | Status | Depends On | Human Smoke |
| --- | --- | --- | --- | --- |
| A0.1 | Choose `egui` or `iced` as the first desktop UI runtime and document why in `docs/rust-desktop-adr.md`. | Done | None | Run a hello-window prototype with `nix develop -c cargo run`; confirm launch, resize, close, and font rendering. |
| A0.2 | Pin shadcn-rs crate path/version after confirming current crate names and framework support. | Done | A0.1 | Prototype one Button, Input, Dialog, Tabs, and Sidebar/Navigation component. |
| A0.3 | Create a new Rust desktop crate layout without deleting the existing Tauri/Svelte app. | Done | A0.1 | `nix develop -c cargo run` opens the native shell and does not require Bun/Vite. |
| A0.4 | Add a short migration README explaining source app, target app, non-goals, and run command. | Done | A0.3 | Read the README and follow only its commands to launch the blank app. |

Batch rule: do not start domain or UI porting until A0.1-A0.3 are smoke tested.

## V1 Batch 1 - Native Shell And Theme Hot Reload

| ID | Ticket | Status | Depends On | Human Smoke |
| --- | --- | --- | --- | --- |
| V1.1.1 | Implement app shell: titlebar/menu area, daily work surface, compact command area, and settings entry. | Done | A0.3 | Launch with `nix develop -c cargo run`; confirm desktop layout is not a mobile copy and resizing keeps controls legible. |
| V1.1.2 | Port GTK 4 color reader from `src-tauri/src/theme.rs` into a framework-independent Rust theme module. | Done | V1.1.1 | Change `~/.config/gtk-4.0/gtk.css`; app reports parsed background, foreground, accent, border, hover, selected, destructive, warning, and success tokens. |
| V1.1.3 | Map GTK variables into shadcn-rs theme tokens and DayLight desktop spacing tokens from `design-basics.md`. | Done | V1.1.2 | Inspect Button/Input/Dialog/List states; hover, focus, selected, active, disabled, and destructive states are visibly distinct. |
| V1.1.4 | Add file watcher for GTK config/theme CSS hot reload. | Done | V1.1.3 | While app is running, edit GTK colors and confirm the UI updates without restart. |
| V1.1.5 | Add a debug-only theme panel showing active source path and resolved token values. | Done | V1.1.4 | Toggle theme changes and confirm token panel updates live. |

Batch rule: no task data UI before hot reload and token state coverage are smoke tested.

## V1 Batch 2 - Markdown Task Domain

| ID | Ticket | Status | Depends On | Human Smoke |
| --- | --- | --- | --- | --- |
| V1.2.1 | Define Rust domain structs for task frontmatter, time entries, recurrence metadata, and app settings. | Done | V1.1.5 | Run unit tests for serde defaults and missing YAML keys. |
| V1.2.2 | Port markdown frontmatter parser/serializer with round-trip tests against sample task files. | Done | V1.2.1 | `nix develop -c cargo run` loads a sample folder and shows parse counts plus errors. |
| V1.2.3 | Implement task folder config and validation for `TaskNotes/Tasks`. | Done | V1.2.2 | Point app at a valid and invalid folder; confirm clear status text and no crash. |
| V1.2.4 | Implement atomic save, filename generation, conflict-aware overwrite protection, and archive path conventions. | Done | V1.2.3 | Add/edit a test task, kill/restart app, confirm markdown persisted and original files were not corrupted. |
| V1.2.5 | Port attention grouping: Past, Now, Upcoming, Wrapped. | Done | V1.2.4 | Use fixture tasks for today, past incomplete, future, completed, and quiet backlog; confirm each lands in the expected group. |

Batch rule: do not build add/edit dialogs until read, write, and grouping behavior pass fixture smoke tests.

### Progress - 2026-05-02

- Native Rust desktop crate exists at the repo root and runs independently of the existing Tauri/Svelte app with `nix develop -c cargo run`.
- EGui is the selected runtime and `egui-shadcn = "=0.5.0"` is pinned for the first migration pass.
- GTK 4 color parsing, theme token mapping, debug theme panel, and polling hot reload are implemented in the native app.
- Markdown task loading, frontmatter parsing, and daily attention grouping diagnostics are implemented.
- Canonical `today-bases` count parity was verified against the local TaskNotes snapshot for 2026-05-02 with:
  - `Now: 5`
  - `Past: 24`
  - `Upcoming: 18`
  - `Wrapped: 415`
- The Past overcount was diagnosed with CLI list scripts. The native parser had expanded stale recurring active instances into Past, which does not match the Tauri `today-bases` behavior. The migration parser now keeps today's active recurring instances in Now, preserves the expected current recurring Past row, and keeps old recurring base rows out of Past.
- Verification commands passed:
  - `nix develop -c cargo fmt`
  - `nix develop -c cargo test`
  - `nix develop -c cargo check`
  - `nix develop -c cargo run -- --print-counts`
- Diagnostic commands now available for migration parity work:
  - `nix develop -c cargo run -- --print-counts`
  - `nix develop -c cargo run -- --print-counts --list-past`
  - `nix develop -c cargo run -- --print-counts --list-upcoming`

## V1 Batch 3 - Daily Task View

| ID | Ticket | Status | Depends On | Human Smoke |
| --- | --- | --- | --- | --- |
| V1.3.1 | Build the daily view with date navigation, Today reset, and grouped task sections. | In Progress | V1.2.5 | Launch and verify Past, Now, Upcoming, Wrapped render in stable order for the selected date. |
| V1.3.2 | Build task row component with completion toggle, title, project/tag/context chips, scheduled/due indicators, and daily total. | Backlog | V1.3.1 | Complete and reopen a task; restart app and confirm frontmatter reflects the state. |
| V1.3.3 | Add section collapse behavior for Wrapped and any dense secondary groups. | Backlog | V1.3.2 | Collapse/expand Wrapped; restart app if state persistence is implemented, otherwise confirm default is documented. |
| V1.3.4 | Add keyboard navigation and primary shortcuts for daily task operations. | Backlog | V1.3.3 | Navigate rows and open edit/add actions without mouse. |
| V1.3.5 | Add empty, loading, and parse-error states for the daily view. | Backlog | V1.3.4 | Point at an empty folder and a folder with malformed frontmatter; confirm the app remains usable. |

Batch rule: do not add time tracking until daily add/edit and row state are stable.

## V1 Batch 4 - Add/Edit Task Dialogs

| ID | Ticket | Status | Depends On | Human Smoke |
| --- | --- | --- | --- | --- |
| V1.4.1 | Port shortcode parser for title capture: `#tag`, `+project`, `@context`, date shortcuts, and recurrence token detection. | Backlog | V1.3.5 | Type representative shortcodes and confirm parsed chips before save. |
| V1.4.2 | Build Add Task dialog with title, notes, scheduled, due, priority, tags, contexts, projects, and recurrence fields. | Backlog | V1.4.1 | Add a task for today and one for next week; confirm files are created and grouped correctly after restart. |
| V1.4.3 | Build Edit Task dialog using the same field components and preserving unknown frontmatter where possible. | Backlog | V1.4.2 | Edit title/date/tags on an existing task; confirm unrelated YAML is not dropped. |
| V1.4.4 | Add validation and destructive confirmation for cancel/delete operations. | Backlog | V1.4.3 | Try invalid dates, cancel dirty edits, and delete a disposable test task. |
| V1.4.5 | Add completion semantics for non-recurring task instances and recurring active instances. | Backlog | V1.4.4 | Complete today's recurring instance; confirm only today's date is added to `complete_instances`. |

Batch rule: recurring completion must be smoke tested before time entries can mutate the same files.

## V1 Batch 5 - Time Tracking

| ID | Ticket | Status | Depends On | Human Smoke |
| --- | --- | --- | --- | --- |
| V1.5.1 | Define time-entry commands: start active timer, stop active timer, add manual entry, edit/delete entry. | Backlog | V1.4.5 | Start and stop a task timer; confirm one frontmatter `timeEntries` record with local timestamps. |
| V1.5.2 | Build Log Time dialog with task picker, date, start/end or duration, and optional note. | Backlog | V1.5.1 | Add 15, 30, and custom-minute entries; confirm daily totals update. |
| V1.5.3 | Add active tracking state to the daily view with one active task at a time. | Backlog | V1.5.2 | Start task A, start task B, confirm A stops or app asks for a clear transition. |
| V1.5.4 | Add edit/delete for existing time entries from task detail. | Backlog | V1.5.3 | Correct a bad entry and delete a disposable entry; restart and confirm persistence. |
| V1.5.5 | Add time summary per day and per task. | Backlog | V1.5.4 | Log time on two tasks; confirm daily total equals sum of visible entries. |

Batch rule: do not build daemon popup until in-app time commands are complete and reusable.

## V1 Batch 6 - Quick Capture Daemon And Compositor Shortcut

| ID | Ticket | Status | Depends On | Human Smoke |
| --- | --- | --- | --- | --- |
| V1.6.1 | Split app commands into a reusable core service callable by the main app and a small daemon. | Backlog | V1.5.5 | Run app normally; add/edit/log time still works through the shared service. |
| V1.6.2 | Implement daemon process with single-instance lock and IPC to request quick add/log-time popup. | Backlog | V1.6.1 | Start daemon, invoke command manually, confirm one popup opens and focuses. |
| V1.6.3 | Build quick popup dialog with two modes: Add Task and Track Time. | Backlog | V1.6.2 | Add a task from popup; log time on an existing task; confirm main app reflects changes. |
| V1.6.4 | Document compositor shortcut setup for LabWC/Wayland and provide a command that can be bound. | Backlog | V1.6.3 | Bind shortcut in compositor config, press it, and confirm popup appears over current workspace. |
| V1.6.5 | Add daemon status/error reporting in the app settings/debug area. | Backlog | V1.6.4 | Stop daemon and confirm app reports disconnected state without failing. |

Batch rule: this batch depends on stable in-app commands; do not implement against duplicated save logic.

## V1 Release Readiness

| ID | Ticket | Status | Depends On | Human Smoke |
| --- | --- | --- | --- | --- |
| V1.R1 | End-to-end smoke script and checklist for daily tasks, add/edit, complete, time logging, theme hot reload, and popup. | Backlog | V1.6.5 | A human can complete the checklist using only `nix develop -c cargo run` plus the daemon command. |
| V1.R2 | Fixture vault for migration testing with task, recurring task, malformed file, and time-entry examples. | Backlog | V1.R1 | Launch against fixture vault; expected group counts match documented values. |
| V1.R3 | Packaging sanity check for Nix build inputs and runtime libraries. | Backlog | V1.R2 | Fresh shell can build and run without relying on existing Tauri node assets. |
| V1.R4 | Regression list comparing Svelte/Tauri behavior to Rust desktop V1 scope. | Backlog | V1.R3 | Confirm every V1 promise is covered and every excluded feature is explicitly absent or hidden. |

## V2 Batch 1 - Habits

| ID | Ticket | Status | Depends On | Human Smoke |
| --- | --- | --- | --- | --- |
| V2.1.1 | Port habit frontmatter fields and habit entry/value semantics. | Backlog | V1.R4 | Load fixture habit files and show parse counts separately from tasks. |
| V2.1.2 | Build Habits Today view with check/target/limit habit rows. | Backlog | V2.1.1 | Mark each habit type for today and confirm persisted entries. |
| V2.1.3 | Add habit stats panel for week, month, and all-time ranges. | Backlog | V2.1.2 | Compare calculated completion rates with fixture expectations. |
| V2.1.4 | Add habit add/edit support only for fields already supported by the markdown model. | Backlog | V2.1.3 | Create a disposable habit and confirm it appears on the correct day. |

Batch rule: habits start after V1 release readiness so task grouping and time logging remain stable.

## V2 Batch 2 - Calendar

| ID | Ticket | Status | Depends On | Human Smoke |
| --- | --- | --- | --- | --- |
| V2.2.1 | Port read-only calendar cache/event model and settings for enabled feeds. | Backlog | V2.1.4 | Load cached calendar events without network and display event count. |
| V2.2.2 | Build day agenda view combining tasks and read-only calendar events. | Backlog | V2.2.1 | Pick a date with tasks and events; confirm both appear with clear visual distinction. |
| V2.2.3 | Build month calendar overview without weekly planner drag/drop. | Backlog | V2.2.2 | Navigate previous/next month; task/event badges remain legible. |
| V2.2.4 | Add manual calendar refresh path behind existing feature/config expectations. | Backlog | V2.2.3 | Refresh cache and confirm stale/error states are visible. |
| V2.2.5 | Add conflict/error handling for missing or malformed calendar cache. | Backlog | V2.2.4 | Replace cache with malformed JSON; app stays usable and reports error. |

Batch rule: calendar does not reintroduce planner drag/drop; date navigation and read-only event rendering only.

## Explicit Non-Tasks

| ID | Item | Reason |
| --- | --- | --- |
| N1 | Weekly planner drag/drop and resize | Excluded from desktop app bailiwick for this migration. |
| N2 | Markdown editor route/component | Excluded; existing editor remains in Svelte/Tauri app only. |
| N3 | Full Obsidian Bases authoring UI | Desktop app reads/writes compatible markdown; it does not need to become a Bases editor. |
| N4 | Mobile layout parity | Target is Rust desktop; desktop interaction density and keyboard use take priority. |
| N5 | New calendar write integration | V2 calendar is read-only unless a later taskboard explicitly expands scope. |

## Smoke Test Template

Each implementation batch should end with this record:

```md
### Smoke - <batch id> - <date>

Command:
- nix develop -c cargo run

Human steps:
- <step 1>
- <step 2>
- <step 3>

Expected:
- <observable result>

Actual:
- <what happened>

Result:
- Pass / Fail

Follow-up tickets:
- <ticket id or none>
```

## Dependency Summary

```text
A0 -> V1.1 theme shell -> V1.2 markdown domain -> V1.3 daily view
   -> V1.4 add/edit dialogs -> V1.5 time tracking -> V1.6 daemon popup
   -> V1 release readiness -> V2.1 habits -> V2.2 calendar
```
