# TASKBOARD — TaskNotes Project Tracker

## Phase 1: Foundation (Complete)

| ID   | Ticket               | Status | Notes                |
|-----:|----------------------|--------|----------------------|
| T0.0 | Root flake.nix       | Done   | `nix develop` works; |
|      | devShell             |        | node/bun/rust/tauri  |
|      |                      |        | deps available       |
| T0.1 | Create project + dev | Done   | Tauri 2 + SvelteKit  |
|      | build                |        | + adapter-static     |
| T0.2 | Install/configure    | Done   | skeleton-svelte +    |
|      | Skeleton UI          |        | Tailwind v4          |
| T0.3 | Import root theme    | Done   | Using flexoki-light; |
|      | CSS                  |        | theme switching is   |
|      |                      |        | v2                   |
| T0.4 | Add routes/pages     | Done   | /today, /calendar,   |
|      |                      |        | /reports, /settings, |
|      |                      |        | /conflicts           |
| T0.5 | Layout shell + nav + | Done   | Bottom nav +         |
|      | FAB                  |        | floating action      |
|      |                      |        | button               |
| T0.6 | UI primitives        | Done   | Sheet, ChipInput,    |
|      | wrappers             |        | DatePill components  |

## Phase 2: Domain Model (Complete)

| ID   | Ticket               | Status | Notes                |
|-----:|----------------------|--------|----------------------|
| T1.1 | Task type + defaults | Done   | src/lib/domain/task.ts |
| T1.2 | Recurrence           | Done   | src/lib/domain/recurrence.ts |
|      | types/helpers        |        |                      |
| T1.3 | TimeLog type         | Done   | src/lib/domain/timeLog.ts |
| T1.4 | Meta type            | Done   | src/lib/domain/meta.ts |
| T1.5 | Selectors            | Done   | src/lib/domain/selectors.ts |

## Phase 3: JSON Storage (Complete — To Be Replaced)

| ID   | Ticket               | Status | Notes                |
|-----:|----------------------|--------|----------------------|
| T2.1 | Filenames + layout   | Done   | src/lib/storage/constants.ts |
|      | constants            |        |                      |
| T2.2 | loadAll()            | Done   | src/lib/storage/storage.ts |
| T2.3 | saveAll() atomic     | Done   | Atomic write with    |
|      |                      |        | temp -> rename       |
| T2.4 | schemaVersion +      | Done   | In domain/meta.ts    |
|      | migrate stub         |        |                      |
| T2.5 | mtime+hash tracking  | Done   | FileState tracking   |
|      |                      |        | in storage.ts        |

## Phase 4: Shortcodes + UI (Complete)

| ID   | Ticket               | Status | Notes                |
|-----:|----------------------|--------|----------------------|
| T3.1 | Shortcode parser     | Done   | src/lib/shortcode/parser.ts |
| T3.2 | ChipInput UI         | Done   | Enhanced with live   |
|      | (Skeleton)           |        | parsing              |
| T3.3 | Autocomplete search  | Done   | Built into ChipInput |
| T3.4 | Normalize on save    | Done   | Lowercase in parser  |

## Phase 5: Today View (Complete)

| ID   | Ticket               | Status | Notes                |
|-----:|----------------------|--------|----------------------|
| T4.1 | Today scaffold       | Done   | Date selector +      |
|      | (Skeleton)           |        | sections             |
| T4.2 | Scheduled list       | Done   | Incomplete tasks for |
|      |                      |        | day                  |
| T4.3 | Overdue list         | Done   | Tasks to Complete    |
|      |                      |        | section              |
| T4.4 | Complete/edit        | Done   | TaskRow component    |
|      | actions              |        |                      |
| T4.5 | Reschedule quick     | Done   | Quick date dropdown  |
|      | actions              |        |                      |
| T4.6 | Today view           | Done   | Today tab click +    |
|      | auto-reset           |        | midnight rollover    |
| T4.7 | Local date handling  | Done   | Date-only strings    |
|      | for UI               |        | parsed/displayed in  |
|      |                      |        | local time           |

## Phase 6: Calendar View (Complete)

| ID   | Ticket               | Status | Notes                |
|-----:|----------------------|--------|----------------------|
| T5.1 | Calendar day         | Done   | Prev/next + DatePill |
|      | selector             |        |                      |
| T5.2 | Appts placeholder    | Done   | Placeholder section  |
| T5.3 | Tasks on day         | Done   | allScheduledForDay   |
|      |                      |        | selector             |
| T5.4 | Edit sheet           | Done   | Sheet with ChipInput |
|      |                      |        | + DatePill           |

## Phase 7: Recurrence (Complete)

| ID   | Ticket               | Status | Notes                |
|-----:|----------------------|--------|----------------------|
| T6.1 | Series template      | Done   | isSeriesTemplate,    |
|      | convention           |        | seriesId             |
| T6.2 | Materialize rolling  | Done   | In                   |
|      | window               |        | domain/recurrence.ts |
| T6.3 | Generate regardless  | Done   | Rule B implemented   |
|      | completion           |        |                      |
| T6.4 | Instance-only        | Done   | rescheduleTask in    |
|      | reschedule           |        | task.ts              |
| T6.5 | Recurrence unit      | Done   | 35 tests covering    |
|      | tests                |        | all patterns         |
| T6.6 | Recurrence capture   | Done   | Weekly multi-day +   |
|      | UI                   |        | monthly selection    |

## Phase 8: Time Tracking (Complete)

| ID   | Ticket               | Status | Notes                |
|-----:|----------------------|--------|----------------------|
| T7.1 | ClockDrag widget     | Done   | src/lib/components/ClockDrag.svelte |
|      | (Skeleton)           |        |                      |
| T7.2 | Multi-rotation       | Done   | Tracks cumulative    |
|      | support              |        | rotations            |
| T7.3 | Log Time sheet       | Done   | In layout with date  |
|      |                      |        | selector             |
| T7.4 | Persist time logs    | Done   | Via store addTimeLog |
| T7.5 | Show daily total per | Done   | Via timeLog          |
|      | task                 |        | selectors            |

## Phase 9: Reports (Complete)

| ID   | Ticket               | Status | Notes                |
|-----:|----------------------|--------|----------------------|
| T8.1 | Range picker         | Done   | Week/month/custom    |
|      |                      |        | selector             |
| T8.2 | Aggregate by project | Done   | Progress bars with   |
|      |                      |        | totals               |
| T8.3 | Aggregate by tag     | Done   | Progress bars with   |
|      |                      |        | totals               |
| T8.4 | Breakdown-by-day     | Done   | Summary card + lists |
|      | view                 |        |                      |

## Phase 10: Conflict Handling (Complete)

| ID   | Ticket               | Status | Notes                |
|-----:|----------------------|--------|----------------------|
| T9.1 | Syncthing conflict   | Done   | scanForConflicts in  |
|      | scan                 |        | conflicts.ts         |
| T9.2 | Save-time conflict   | Done   | hasFileChanged in    |
|      | detection            |        | storage.ts           |
| T9.3 | Conflicts page UI    | Done   | Full conflict        |
|      |                      |        | resolution UI        |
| T9.4 | Resolve actions +    | Done   | Keep                 |
|      | archive              |        | Local/Remote/Archive |
| T9.5 | Settings: scan now   | Done   | View Conflicts       |
|      |                      |        | button in Settings   |

## Phase 11: Calendar Integration (Complete)

| ID    | Ticket               | Status | Notes                |
|------:|----------------------|--------|----------------------|
| T10.1 | Desktop auth         | Done   | OAuth loopback       |
|       |                      |        | listener + token     |
|       |                      |        | storage              |
| T10.2 | Fetch + cache events | Done   | Google Calendar API  |
|       |                      |        | ->                   |
|       |                      |        | calendar_cache.json  |
| T10.3 | Render cached events | Done   | Today + Calendar     |
|       |                      |        | render cached events |
| T10.4 | Refresh schedule +   | Done   | Manual refresh       |
|       | manual               |        | button + interval    |
|       |                      |        | check                |
| T10.5 | Calendar feature     | Done   | VITE_CALENDAR_ENABLED |
|       | flag                 |        |                      |
| T10.6 | ICS feed support     | Done   | Public + secret ICS  |
|       |                      |        | URLs parsed          |

## Phase 12: Polish + Enhancements (Complete)

| ID     | Ticket               | Status | Notes                |
|-------:|----------------------|--------|----------------------|
| T11.1  | Load validation +    | Done   | Invalid JSON         |
|        | error UX             |        | archived; Settings   |
|        |                      |        | shows errors         |
| T11.2  | Export data bundle   | Done   | Exports to           |
|        |                      |        | timestamped bundle   |
| T11.3  | Open data folder     | Done   | Settings button      |
|        |                      |        | opens data directory |
| T11.5  | Custom data folder   | Done   | Validate path +      |
|        | support              |        | optional copy        |
| T12.1  | Task detail sheet    | Done   | Shows task title     |
|        | dynamic title        |        |                      |
| T12.2  | Recurrence editing   | Done   | Modal for            |
|        | in task detail       |        | weekly/monthly       |
|        |                      |        | editing              |
| T12.3  | Remove navbar theme  | Done   | Theme via Settings   |
|        | toggle               |        | only                 |
| T12.4  | Completed tasks pane | Done   | Collapsible green    |
|        | in Today             |        | header section       |
| T12.5  | Reorder task detail  | Done   | Optimized layout     |
|        | sections             |        |                      |
| T12.6  | Remove ClockDrag     | Done   | Pure drag            |
|        | preset buttons       |        | interaction only     |
| T12.7  | Fix Tailwind v4 +    | Done   | @tailwindcss/vite    |
|        | Svelte integration   |        |                      |
| T12.8  | completedForDay      | Done   | Filter tasks         |
|        | selector             |        | completed on day     |
| T12.9  | Split time log       | Done   | "Log Time" + "Log &  |
|        | button               |        | Finish" buttons      |
| T12.10 | Timed Session        | Done   | TimedSessionModal    |
|        | (pomodoro)           |        | with countdown,      |
|        |                      |        | pause/resume,        |
|        |                      |        | overtime             |

---

## Phase 13: Bases Migration — Storage Layer

| ID    | Ticket               | Status | Owner | Notes                |
|------:|----------------------|--------|-------|----------------------|
| T13.1 | YAML frontmatter     | Done   |       | src/lib/storage/frontmatter.ts |
|       | parser/serializer    |        |       |                      |
| T13.2 | Markdown file I/O    | Done   |       | src/lib/storage/markdown-storage.ts |
|       | utilities            |        |       |                      |
| T13.3 | loadAllTasks() from  | Done   |       | Scan Tasks/ folder,  |
|       | markdown             |        |       | parse all .md        |
| T13.4 | loadTask(filename)   | Done   |       | Parse single .md     |
|       |                      |        |       | frontmatter          |
| T13.5 | saveTask(task)       | Done   |       | Write .md with YAML  |
|       |                      |        |       | frontmatter          |
| T13.6 | deleteTask(filename) | Done   |       | Remove .md file      |
| T13.7 | Task filename        | Done   |       | generateTaskFilename() |
|       | generation           |        |       | + sanitization       |
| T13.8 | Handle filename      | Done   |       | generateUniqueFilename() |
|       | conflicts            |        |       | with suffix          |

## Phase 14: Bases Migration — Domain Adaptation

| ID    | Ticket               | Status  | Owner | Notes                |
|------:|----------------------|---------|-------|----------------------|
| T14.1 | Update Task type for | Done    |       | TaskFrontmatter type |
|       | frontmatter          |         |       | in frontmatter.ts    |
| T14.2 | Embed timeEntries in | Done    |       | TimeEntry[] in       |
|       | Task                 |         |       | frontmatter +        |
|       |                      |         |       | migration            |
| T14.3 | Add instance         | Done    |       | active/complete/skipped_instances |
|       | tracking arrays      |         |       | in frontmatter       |
| T14.4 | Update selectors for | Backlog |       | Query from parsed    |
|       | markdown             |         |       | .md files            |
| T14.5 | RecurringInstanceService | Done    |       | src/lib/services/RecurringInstanceService.ts |
| T14.6 | Instance completion  | Done    |       | completeInstance()   |
|       | tracking             |         |       | function             |
| T14.7 | Instance skip        | Done    |       | skipInstance()       |
|       | tracking             |         |       | function             |

## Phase 15: Bases Migration — View Integration

| ID    | Ticket               | Status  | Owner | Notes                |
|------:|----------------------|---------|-------|----------------------|
| T15.1 | Create               | Backlog |       | Filters, formulas,   |
|       | tasks-default.base   |         |       | taskDateGroup        |
| T15.2 | Create               | Backlog |       | Calendar view        |
|       | agenda-default.base  |         |       | configuration        |
| T15.3 | Fix taskDateGroup    | Done    |       | Attention-based      |
|       | logic                |         |       | grouping implemented |
| T15.4 | Implement            | Backlog |       | Priority + days      |
|       | urgencyScore formula |         |       | until next           |
| T15.5 | Today view uses      | Backlog |       | Render from          |
|       | Bases grouping       |         |       | taskDateGroup        |
| T15.6 | Calendar view uses   | Backlog |       | Render from          |
|       | agenda.base          |         |       | agenda-default.base  |

### T15.3-SPEC: Correct taskDateGroup Logic (Attention-Based View Filtering)

**File**: `src/lib/services/RecurringInstanceService.ts` → `getTaskDateGroup()`

**Current behavior (WRONG)**:
- Upcoming = everything else (includes unscheduled tasks with no history)

**Correct behavior** — filter by attention state, not just data state:

| Group        | Condition            | Attention State      |
|--------------|----------------------|----------------------|
| **Now**      | `scheduled ===       | Needs action now     |
|              | today` OR has active |                      |
|              | recurring instance   |                      |
|              | for today            |                      |
| **Past**     | Has `scheduled` or   | Overdue, needs       |
|              | `due` in the past    | action               |
|              | AND that date NOT in |                      |
|              | `complete_instances` |                      |
| **Upcoming** | Has KNOWN future     | Will need attention  |
|              | date: `scheduled >   | on that date         |
|              | today` OR has future |                      |
|              | recurring instances  |                      |
| **Wrapped**  | Everything else (no  | Not demanding        |
|              | future date,         | attention            |
|              | regardless of        |                      |
|              | history)             |                      |

**Key insight**: Wrapped is the "quiet backlog" — both completed tasks AND unscheduled items go here because they're equivalent from an attention standpoint. The UI groups by "does this demand my attention?" not "what's the task's lifecycle state?"

**Key changes needed**:

1. `getTaskDateGroup()` must check if past dates were completed before marking as "Past"
2. Unscheduled tasks without recurrence go to **Wrapped**, not Upcoming
3. Upcoming is ONLY for tasks with known future dates
4. No "Hidden" state needed — Wrapped catches everything not in other groups

**Test cases**:
- Task with `scheduled: null`, no recurrence, `complete_instances: []` → **Wrapped** (backlog, no attention needed)
- Task with `scheduled: null`, no recurrence, `complete_instances: ['2026-02-01']` → **Wrapped** (done before, quiet)
- Task with `scheduled: '2026-02-01'` (past), `complete_instances: ['2026-02-01']` → **Wrapped** (was due and done)
- Task with `scheduled: '2026-02-01'` (past), `complete_instances: []` → **Past** (overdue)
- Task with `scheduled: '2026-02-10'` (future) → **Upcoming**
- Weekly recurring with next instance Feb 10 → **Upcoming**
- Weekly recurring with instance today → **Now**

**Convention for AI-created tasks**: Always set `scheduled: +7 days` so tasks appear in Upcoming and eventually surface. Unscheduled tasks get buried in Wrapped.

---

## Phase 16: Bases Migration — Data Migration

| ID    | Ticket               | Status  | Owner | Notes                |
|------:|----------------------|---------|-------|----------------------|
| T16.1 | Migration script:    | Done    |       | src/lib/storage/migration.ts |
|       | tasks.json -> .md    |         |       |                      |
| T16.2 | Migration script:    | Done    |       | Embeds timeEntries   |
|       | time_logs.json       |         |       | in task frontmatter  |
| T16.3 | Validate migrated    | Backlog |       | Verify all tasks     |
|       | data                 |         |       | readable             |
| T16.4 | Backup original JSON | Done    |       | createMigrationBackup() |
|       | files                |         |       | function             |
| T16.5 | Remove JSON storage  | Backlog |       | Clean up deprecated  |
|       | code                 |         |       | code                 |

## Phase 17: Bases Migration — Conflict Handling

| ID    | Ticket               | Status  | Owner | Notes                |
|------:|----------------------|---------|-------|----------------------|
| T17.1 | Per-file Syncthing   | Backlog |       | Detect               |
|       | conflict scan        |         |       | .sync-conflict in    |
|       |                      |         |       | Tasks/               |
| T17.2 | Per-file conflict    | Backlog |       | Choose version per   |
|       | resolution UI        |         |       | task                 |
| T17.3 | Archive non-selected | Backlog |       | Move to conflicts/   |
|       | versions             |         |       | folder               |
| T17.4 | Save-time conflict   | Backlog |       | Check mtime before   |
|       | detection            |         |       | write                |

## Phase 18: Bases Migration — Testing + Polish

| ID    | Ticket               | Status  | Owner | Notes                |
|------:|----------------------|---------|-------|----------------------|
| T18.1 | Unit tests:          | Done    |       | 38 tests in          |
|       | frontmatter parser   |         |       | frontmatter.test.ts  |
| T18.2 | Unit tests:          | Done    |       | 39 tests in          |
|       | RecurringInstanceService |         |       | RecurringInstanceService.test.ts |
| T18.3 | Integration tests:   | Backlog |       | Create/read/update/delete |
|       | CRUD operations      |         |       | tasks                |
| T18.4 | Integration tests:   | Backlog |       | JSON -> markdown     |
|       | migration            |         |       | conversion           |
| T18.5 | Wayland smoke tests  | Backlog |       | Verify on LabWC      |
| T18.6 | Performance testing  | Backlog |       | Load time with many  |
|       |                      |         |       | .md files            |

---

## Phase 19: UX Normalization Review (2026-04-08)

Full UX review against `design-basics.md` + `design-normalization.md`, with cross-platform (Linux desktop + Android) parity in mind. **Ordered by John's review priority** — this is my recommended ranking, reorder freely. All items are backlog unless noted.

### P0 — Critical / one-line fixes

| ID    | Ticket               | Status            | Owner | Notes                |
|------:|----------------------|-------------------|-------|----------------------|
| T19.1 | Sidebar backdrop →   | Done (2026-04-08) |       | `src/lib/components/Sidebar.svelte:259` |
|       | theme token          |                   |       | now uses             |
|       |                      |                   |       | `rgb(var(--color-overlay) |
|       |                      |                   |       | / 0.4)`.             |
| T19.2 | TimedSessionModal    | Done (2026-04-08) |       | `TimedSessionModal.svelte`: |
|       | trap —               |                   |       | Esc always closes    |
|       | Esc/X/backdrop only  |                   |       | (`handleKeydown`     |
|       | work in `select`     |                   |       | unconditional), X    |
|       | state                |                   |       | button visible in    |
|       |                      |                   |       | all states, backdrop |
|       |                      |                   |       | click dismisses via  |
|       |                      |                   |       | `handleBackdropClick`, |
|       |                      |                   |       | `.session-modal` has |
|       |                      |                   |       | `margin-bottom:      |
|       |                      |                   |       | env(safe-area-inset-bottom)`. |
|       |                      |                   |       | `handleClose()`      |
|       |                      |                   |       | already calls        |
|       |                      |                   |       | `stopTimer()` first  |
|       |                      |                   |       | so running/paused    |
|       |                      |                   |       | sessions clean up.   |
| T19.3 | Remove debug-badge   | Done (2026-04-08) |       | `+layout.svelte`:    |
|       | hex literals or gate |                   |       | `.shortcut-debug-badge.not-ready` |
|       | behind dev flag      |                   |       | →                    |
|       |                      |                   |       | `--color-error-500`, |
|       |                      |                   |       | `.ready` →           |
|       |                      |                   |       | `--color-success-500`, |
|       |                      |                   |       | `.shortcut-build-marker` |
|       |                      |                   |       | →                    |
|       |                      |                   |       | `--color-warning-500` |
|       |                      |                   |       | bg +                 |
|       |                      |                   |       | `--color-surface-950` |
|       |                      |                   |       | text. Template still |
|       |                      |                   |       | gated behind `{#if   |
|       |                      |                   |       | false &&             |
|       |                      |                   |       | shortcutDebugEnabled}`. |

### P1 — Daily-friction fixes

| ID     | Ticket               | Status            | Owner | Notes                |
|-------:|----------------------|-------------------|-------|----------------------|
| T19.4  | Shortcode            | Done (2026-04-10) |       | Implemented: inline  |
|        | discoverability —    |                   |       | `?` in `ChipInput`,  |
|        | inline `?` icon on   |                   |       | dedicated            |
|        | ChipInput + split    |                   |       | `ShortcodeHelp`      |
|        | help sheets +        |                   |       | sheet, `Ctrl/Cmd+H`  |
|        | `Ctrl+H`             |                   |       | alias, and           |
|        |                      |                   |       | command-palette      |
|        |                      |                   |       | split between        |
|        |                      |                   |       | Keyboard Shortcuts   |
|        |                      |                   |       | vs Shortcode         |
|        |                      |                   |       | Reference.           |
| T19.5  | Dirty-state          | Done (2026-04-10) |       | `TaskEditModal` now  |
|        | indicator in         |                   |       | detects draft        |
|        | TaskEditModal        |                   |       | changes, shows an    |
|        |                      |                   |       | “Unsaved changes”    |
|        |                      |                   |       | indicator,           |
|        |                      |                   |       | highlights Save when |
|        |                      |                   |       | dirty, and disables  |
|        |                      |                   |       | Save when unchanged. |
| T19.6  | Legacy `/today` and  | Done (2026-04-10) |       | Legacy route         |
|        | `/recurring` routes  |                   |       | surfaces removed;    |
|        | — hide from nav or   |                   |       | `/today` and         |
|        | delete               |                   |       | `/recurring` now     |
|        |                      |                   |       | hard-redirect to     |
|        |                      |                   |       | `/today-bases` and   |
|        |                      |                   |       | `/recurring-bases`.  |
| T19.7  | TaskEditModal →      | Backlog           |       | `src/lib/components/TaskEditModal.svelte` |
|        | bottom-sheet         |                   |       | uses `<Sheet         |
|        | positioning          |                   |       | centered>`. Long     |
|        |                      |                   |       | form with chip       |
|        |                      |                   |       | inputs +             |
|        |                      |                   |       | RecurrenceEditor →   |
|        |                      |                   |       | thumb-reach says     |
|        |                      |                   |       | bottom-sheet.        |
|        |                      |                   |       | HabitEditModal       |
|        |                      |                   |       | already gets this    |
|        |                      |                   |       | right.               |
| T19.8  | Add Task: pre-fill   | Done (2026-04-10) |       | Add Task now         |
|        | project/tag when     |                   |       | auto-prefills        |
|        | launched from        |                   |       | `+project` or `#tag` |
|        | `/projects/[project]` |                   |       | from route context   |
|        | or `/tags/[tag]`     |                   |       | before typing.       |
| T19.9  | Command palette      | Done (2026-04-10) |       | Command palette now  |
|        | missing routes —     |                   |       | includes Habits,     |
|        | Habits, Projects,    |                   |       | Projects, Tags,      |
|        | Tags, Conflicts,     |                   |       | Conflicts, and       |
|        | Editor               |                   |       | Editor routes        |
|        |                      |                   |       | (Projects/Tags open  |
|        |                      |                   |       | first item or        |
|        |                      |                   |       | sidebar fallback).   |
| T19.10 | DatePill dropdown:   | Done (2026-04-10) |       | `DatePill` now       |
|        | Escape handler,      |                   |       | supports Esc close,  |
|        | click-outside,       |                   |       | outside-click close, |
|        | theme-tokened input, |                   |       | input focus token    |
|        | viewport bounds      |                   |       | styling, and         |
|        |                      |                   |       | viewport-aware       |
|        |                      |                   |       | dropdown alignment.  |

### P2 — Desktop/mobile parity (structural)

| ID     | Ticket               | Status            | Owner | Notes                |
|-------:|----------------------|-------------------|-------|----------------------|
| T19.11 | Desktop layout not   | Done (2026-04-11) |       | Sidebar is now       |
|        | mimic mobile —       |                   |       | responsive and       |
|        | persistent left      |                   |       | UX-normalized:       |
|        | sidebar for          |                   |       | persistent at larger |
|        | Projects/Tags,       |                   |       | layout mode (default |
|        | visible nav overflow |                   |       | breakpoint + manual  |
|        | button               |                   |       | override), overlay   |
|        |                      |                   |       | on mobile mode, no   |
|        |                      |                   |       | persistent-mode      |
|        |                      |                   |       | close button/header  |
|        |                      |                   |       | title, and width is  |
|        |                      |                   |       | content-driven with  |
|        |                      |                   |       | measured offset      |
|        |                      |                   |       | applied to           |
|        |                      |                   |       | nav/content.         |
|        |                      |                   |       | Settings now         |
|        |                      |                   |       | includes layout      |
|        |                      |                   |       | override toggles for |
|        |                      |                   |       | force                |
|        |                      |                   |       | mobile/desktop.      |
| T19.12 | Typography pairing — | Backlog           |       | `src/app.css:43` is  |
|        | apply approved       |                   |       | bare `system-ui,     |
|        | mono/sans split      |                   |       | -apple-system,...`.  |
|        |                      |                   |       | design-basics.md     |
|        |                      |                   |       | §Typography wants    |
|        |                      |                   |       | bold monospace for   |
|        |                      |                   |       | headlines/titlebars/buttons |
|        |                      |                   |       | and matching sans    |
|        |                      |                   |       | for body. Single     |
|        |                      |                   |       | biggest system-level |
|        |                      |                   |       | gap. Preferred       |
|        |                      |                   |       | pairings: Spline     |
|        |                      |                   |       | Sans Mono/Sans,      |
|        |                      |                   |       | Iosevka Charon,      |
|        |                      |                   |       | B612, Fragment/Work  |
|        |                      |                   |       | Sans. One-file       |
|        |                      |                   |       | change with global   |
|        |                      |                   |       | `--font-mono` /      |
|        |                      |                   |       | `--font-sans` vars.  |
| T19.13 | Dark-mode input      | Done (2026-04-10) |       | Updated              |
|        | surface flattening   |                   |       | `.select-input` and  |
|        |                      |                   |       | `.command-search`    |
|        |                      |                   |       | dark-mode            |
|        |                      |                   |       | backgrounds to       |
|        |                      |                   |       | `--color-surface-600` |
|        |                      |                   |       | for clear            |
|        |                      |                   |       | input/surface        |
|        |                      |                   |       | separation.          |
| T19.14 | Calendar planner     | Backlog           |       | `/calendar` week     |
|        | sidebar has no       |                   |       | grid scales but the  |
|        | mobile equivalent    |                   |       | planner side-panel   |
|        |                      |                   |       | is desktop-only.     |
|        |                      |                   |       | Need a compact       |
|        |                      |                   |       | mobile drawer or     |
|        |                      |                   |       | separate mobile      |
|        |                      |                   |       | view.                |

### P3 — Polish and secondary reachability

| ID     | Ticket               | Status  | Owner | Notes                |
|-------:|----------------------|---------|-------|----------------------|
| T19.15 | Destructive delete   | Backlog |       | `src/lib/components/TaskContextMenu.svelte:95`, |
|        | confirmation         |         |       | `HabitContextMenu.svelte:48`. |
|        |                      |         |       | Single-tap delete    |
|        |                      |         |       | with no              |
|        |                      |         |       | confirmation;        |
|        |                      |         |       | mistap-from-long-press |
|        |                      |         |       | is a real path. Add  |
|        |                      |         |       | two-step confirm     |
|        |                      |         |       | (second tap within   |
|        |                      |         |       | 2s) or centered      |
|        |                      |         |       | confirm Sheet.       |
| T19.16 | `skipTaskInstance`   | Backlog |       | Only exposed in      |
|        | not reachable from   |         |       | `/today-bases`       |
|        | calendar view        |         |       | TaskContextMenu.     |
|        |                      |         |       | Calendar shows       |
|        |                      |         |       | recurring instances  |
|        |                      |         |       | but has no skip      |
|        |                      |         |       | option. Add to       |
|        |                      |         |       | calendar row context |
|        |                      |         |       | menu.                |
| T19.17 | `/editor` file       | Backlog |       | Desktop right-click  |
|        | browser: add mobile  |         |       | only. Mobile users   |
|        | long-press for file  |         |       | can't open/delete    |
|        | context menu         |         |       | files.               |
| T19.18 | HabitContextMenu     | Backlog |       | `HabitContextMenu.svelte:48` |
|        | delete closes async; |         |       | awaits `deleteTask`  |
|        | TaskContextMenu      |         |       | before `onclose()`.  |
|        | closes sync          |         |       | TaskContextMenu      |
|        |                      |         |       | closes immediately.  |
|        |                      |         |       | Minor asymmetry —    |
|        |                      |         |       | close the menu       |
|        |                      |         |       | first, then mutate.  |
| T19.19 | Verify               | Backlog |       | Sub-agent audit      |
|        | `HabitEditModal`     |         |       | couldn't confirm. If |
|        | reachability — is    |         |       | not wired, the       |
|        | there an Edit entry  |         |       | component is dead    |
|        | in                   |         |       | code and habit       |
|        | `HabitContextMenu`?  |         |       | fields are           |
|        |                      |         |       | uneditable except by |
|        |                      |         |       | manual YAML.         |
| T19.20 | Focus ring audit     | Backlog |       | Only one explicit    |
|        | across interactive   |         |       | focus style found    |
|        | elements             |         |       | (`+layout.svelte:1880-1885`). |
|        |                      |         |       | WebKitGTK often      |
|        |                      |         |       | suppresses browser   |
|        |                      |         |       | defaults. Audit      |
|        |                      |         |       | inputs, buttons, nav |
|        |                      |         |       | items, sheet close   |
|        |                      |         |       | buttons.             |
| T19.21 | `updateTaskTimeBlock` | Backlog |       | Accept as            |
|        | has no mobile path — |         |       | platform-appropriate, |
|        | drag/resize is       |         |       | or add a long-press  |
|        | desktop-only on      |         |       | "edit time block"    |
|        | calendar week grid   |         |       | action for mobile.   |

### P4 — System codification (low urgency, high leverage)

| ID     | Ticket               | Status  | Owner | Notes                |
|-------:|----------------------|---------|-------|----------------------|
| T19.22 | Codify spacing       | Backlog |       | Add `--space-1..8`   |
|        | ladder per           |         |       | CSS vars to          |
|        | design-basics.md     |         |       | `src/app.css` using  |
|        | §Spacing Tiers       |         |       | mobile 12px /        |
|        |                      |         |       | desktop 8px base.    |
|        |                      |         |       | Currently all        |
|        |                      |         |       | spacing is raw       |
|        |                      |         |       | `0.5rem`, `0.75rem`, |
|        |                      |         |       | `1rem` — happens to  |
|        |                      |         |       | be regular but is    |
|        |                      |         |       | unauditable.         |
| T19.23 | Codify z-index       | Backlog |       | Current: Sheet=60,   |
|        | ladder               |         |       | TimedSessionModal=60, |
|        |                      |         |       | FAB=50, nav=40,      |
|        |                      |         |       | Sidebar=100/101,     |
|        |                      |         |       | ContextMenu=200/201, |
|        |                      |         |       | DatePill=50. Add     |
|        |                      |         |       | `--z-nav`,           |
|        |                      |         |       | `--z-fab`,           |
|        |                      |         |       | `--z-sheet`,         |
|        |                      |         |       | `--z-sidebar`,       |
|        |                      |         |       | `--z-menu` in        |
|        |                      |         |       | `app.css` so drift   |
|        |                      |         |       | is impossible.       |
| T19.24 | Codify radius ladder | Backlog |       | Mixed `0.25rem`,     |
|        |                      |         |       | `0.375rem`,          |
|        |                      |         |       | `0.5rem`, `0.75rem`, |
|        |                      |         |       | `rounded-xl`,        |
|        |                      |         |       | `rounded-full`. Pick |
|        |                      |         |       | 3-4 named tokens.    |
| T19.25 | Consider persistent  | Backlog |       | Sidebar currently    |
|        | left edge swipe or   |         |       | only opens via       |
|        | nav-menu entry for   |         |       | long-press on sun    |
|        | main sidebar on      |         |       | icon. Adding a       |
|        | mobile               |         |       | visible menu button  |
|        |                      |         |       | in nav (see T19.11)  |
|        |                      |         |       | covers this. Edge    |
|        |                      |         |       | swipe conflicts with |
|        |                      |         |       | Android back gesture |
|        |                      |         |       | — deprioritized.     |

---

### T19.4-SPEC: Shortcode Help Discoverability

**Problem**: DayLight has a rich shortcode grammar (`src/lib/shortcode/parser.ts`: `#tag`, `+project`, `@tom`, `@d22`, `@d3-15`, `@d`, `@w`, `@wMWF`, `@m`, `@m15`, `@Nd`, `@Nw`) that is the fastest way to add tasks. Currently it is effectively undocumented in-app:
- Global "Shortcuts Help" sheet exists at `+layout.svelte:1425-1463` but is only reachable via `Shift+?` / `Alt+Shift+H` / command palette, none of which are discoverable.
- On mobile, the help sheet is unreachable without a physical keyboard.
- On the sheet itself, the task-shortcode content is a secondary section after desktop keyboard shortcuts.

**Key finding**: Shortcodes have exactly **one** consumer — the Add Task sheet ChipInput (`+layout.svelte:1166`). `TaskEditModal` uses dedicated chip UIs (not shortcodes) and `AddHabitSheet` has no shortcodes. So there is **no task-add vs task-edit divergence** — shortcodes are a single-surface concern. No pagination or nested tabs needed.

**Plan**: Split help content by concern, not by route:

| Help surface         | Scope                | Lives                | Opens via            |
|----------------------|----------------------|----------------------|----------------------|
| **Shortcode cheat    | Only `#tag` /        | Inline `?` button    | Tap the `?` in the   |
| sheet**              | `+project` / `@date` | inside the           | Add Task title       |
|                      | / `@recurrence`. One | `ChipInput`          | field.               |
|                      | page, four sections. | component.           |                      |
| **Keyboard shortcuts | `Ctrl+N`, `Ctrl+K`,  | Existing Shortcuts   | `Ctrl+H` (new),      |
| reference**          | nav shortcuts.       | Help sheet           | `Shift+?`            |
|                      | Desktop-oriented.    | (shortcode content   | (existing), command  |
|                      |                      | removed).            | palette "Keyboard    |
|                      |                      |                      | Shortcuts".          |

**Implementation steps**:
1. **`src/lib/components/ChipInput.svelte`** — add a `?` icon button absolutely-positioned right side of input. Fires an `onhelp` callback prop. Presentational only.
2. **New `src/lib/components/ShortcodeHelp.svelte`** — compact `<Sheet>` (bottom on mobile, centered on desktop) with four sections: Tags, Projects, Dates, Recurrence. Content derived from `parser.ts` grammar with examples.
3. **`src/routes/+layout.svelte`**:
   - Wire `onhelp` from Add Task ChipInput to open the new ShortcodeHelp sheet (add a new `ModalMode` value, e.g. `'shortcode-help'`).
   - Remove the Task Input Shortcodes list from the existing Shortcuts Help sheet (now redundant).
   - Add `Ctrl+H` to `SHORTCUT_BINDINGS` as an alias opening the keyboard-shortcuts sheet. Keep `Shift+?` and `Alt+Shift+H`.
   - Update `commandPaletteActions`: rename existing "show-shortcuts" → "Keyboard Shortcuts"; add a second entry "Shortcode Reference" that opens the new ShortcodeHelp sheet.
4. **Mobile safety**: ShortcodeHelp uses `<Sheet>` so it inherits safe-area padding and scroll handling. No new swipe gesture handling (avoids Android back-gesture conflict).

**Explicitly rejected**:
- Left-edge swipe drawer — conflicts with Android back gesture, and the inline `?` button is more discoverable.
- Paginated/tabbed help dialog — unnecessary once shortcodes are split from keyboard shortcuts by concern.

---

## v2 Backlog

| ID   | Ticket               | Status  | Owner | Notes                |
|-----:|----------------------|---------|-------|----------------------|
| V2.1 | Theme switching UI   | Backlog |       | Toggle ayu/flexoki   |
| V2.2 | Kanban board view    | Backlog |       | kanban-default.base  |
| V2.3 | Nested projects      | Backlog |       | Project hierarchy    |
| V2.4 | Advanced conflict    | Backlog |       | Field-level          |
|      | merging              |         |       | diff/merge           |
| V2.5 | System/GTK theming   | Backlog |       | Match desktop theme  |

---

## Status Legend

| Status      | Meaning              |
|-------------|----------------------|
| Done        | Completed and        |
|             | verified             |
| In Progress | Currently being      |
|             | worked on            |
| Backlog     | Planned but not      |
|             | started              |
| Blocked     | Waiting on           |
|             | dependency           |
