# TASKBOARD — TaskNotes Project Tracker

## Phase 1: Foundation (Complete)

| ID | Ticket | Status | Notes |
|---:|--------|--------|-------|
| T0.0 | Root flake.nix devShell | Done | `nix develop` works; node/bun/rust/tauri deps available |
| T0.1 | Create project + dev build | Done | Tauri 2 + SvelteKit + adapter-static |
| T0.2 | Install/configure Skeleton UI | Done | skeleton-svelte + Tailwind v4 |
| T0.3 | Import root theme CSS | Done | Using flexoki-light; theme switching is v2 |
| T0.4 | Add routes/pages | Done | /today, /calendar, /reports, /settings, /conflicts |
| T0.5 | Layout shell + nav + FAB | Done | Bottom nav + floating action button |
| T0.6 | UI primitives wrappers | Done | Sheet, ChipInput, DatePill components |

## Phase 2: Domain Model (Complete)

| ID | Ticket | Status | Notes |
|---:|--------|--------|-------|
| T1.1 | Task type + defaults | Done | src/lib/domain/task.ts |
| T1.2 | Recurrence types/helpers | Done | src/lib/domain/recurrence.ts |
| T1.3 | TimeLog type | Done | src/lib/domain/timeLog.ts |
| T1.4 | Meta type | Done | src/lib/domain/meta.ts |
| T1.5 | Selectors | Done | src/lib/domain/selectors.ts |

## Phase 3: JSON Storage (Complete — To Be Replaced)

| ID | Ticket | Status | Notes |
|---:|--------|--------|-------|
| T2.1 | Filenames + layout constants | Done | src/lib/storage/constants.ts |
| T2.2 | loadAll() | Done | src/lib/storage/storage.ts |
| T2.3 | saveAll() atomic | Done | Atomic write with temp -> rename |
| T2.4 | schemaVersion + migrate stub | Done | In domain/meta.ts |
| T2.5 | mtime+hash tracking | Done | FileState tracking in storage.ts |

## Phase 4: Shortcodes + UI (Complete)

| ID | Ticket | Status | Notes |
|---:|--------|--------|-------|
| T3.1 | Shortcode parser | Done | src/lib/shortcode/parser.ts |
| T3.2 | ChipInput UI (Skeleton) | Done | Enhanced with live parsing |
| T3.3 | Autocomplete search | Done | Built into ChipInput |
| T3.4 | Normalize on save | Done | Lowercase in parser |

## Phase 5: Today View (Complete)

| ID | Ticket | Status | Notes |
|---:|--------|--------|-------|
| T4.1 | Today scaffold (Skeleton) | Done | Date selector + sections |
| T4.2 | Scheduled list | Done | Incomplete tasks for day |
| T4.3 | Overdue list | Done | Tasks to Complete section |
| T4.4 | Complete/edit actions | Done | TaskRow component |
| T4.5 | Reschedule quick actions | Done | Quick date dropdown |
| T4.6 | Today view auto-reset | Done | Today tab click + midnight rollover |
| T4.7 | Local date handling for UI | Done | Date-only strings parsed/displayed in local time |

## Phase 6: Calendar View (Complete)

| ID | Ticket | Status | Notes |
|---:|--------|--------|-------|
| T5.1 | Calendar day selector | Done | Prev/next + DatePill |
| T5.2 | Appts placeholder | Done | Placeholder section |
| T5.3 | Tasks on day | Done | allScheduledForDay selector |
| T5.4 | Edit sheet | Done | Sheet with ChipInput + DatePill |

## Phase 7: Recurrence (Complete)

| ID | Ticket | Status | Notes |
|---:|--------|--------|-------|
| T6.1 | Series template convention | Done | isSeriesTemplate, seriesId |
| T6.2 | Materialize rolling window | Done | In domain/recurrence.ts |
| T6.3 | Generate regardless completion | Done | Rule B implemented |
| T6.4 | Instance-only reschedule | Done | rescheduleTask in task.ts |
| T6.5 | Recurrence unit tests | Done | 35 tests covering all patterns |
| T6.6 | Recurrence capture UI | Done | Weekly multi-day + monthly selection |

## Phase 8: Time Tracking (Complete)

| ID | Ticket | Status | Notes |
|---:|--------|--------|-------|
| T7.1 | ClockDrag widget (Skeleton) | Done | src/lib/components/ClockDrag.svelte |
| T7.2 | Multi-rotation support | Done | Tracks cumulative rotations |
| T7.3 | Log Time sheet | Done | In layout with date selector |
| T7.4 | Persist time logs | Done | Via store addTimeLog |
| T7.5 | Show daily total per task | Done | Via timeLog selectors |

## Phase 9: Reports (Complete)

| ID | Ticket | Status | Notes |
|---:|--------|--------|-------|
| T8.1 | Range picker | Done | Week/month/custom selector |
| T8.2 | Aggregate by project | Done | Progress bars with totals |
| T8.3 | Aggregate by tag | Done | Progress bars with totals |
| T8.4 | Breakdown-by-day view | Done | Summary card + lists |

## Phase 10: Conflict Handling (Complete)

| ID | Ticket | Status | Notes |
|---:|--------|--------|-------|
| T9.1 | Syncthing conflict scan | Done | scanForConflicts in conflicts.ts |
| T9.2 | Save-time conflict detection | Done | hasFileChanged in storage.ts |
| T9.3 | Conflicts page UI | Done | Full conflict resolution UI |
| T9.4 | Resolve actions + archive | Done | Keep Local/Remote/Archive |
| T9.5 | Settings: scan now | Done | View Conflicts button in Settings |

## Phase 11: Calendar Integration (Complete)

| ID | Ticket | Status | Notes |
|---:|--------|--------|-------|
| T10.1 | Desktop auth | Done | OAuth loopback listener + token storage |
| T10.2 | Fetch + cache events | Done | Google Calendar API -> calendar_cache.json |
| T10.3 | Render cached events | Done | Today + Calendar render cached events |
| T10.4 | Refresh schedule + manual | Done | Manual refresh button + interval check |
| T10.5 | Calendar feature flag | Done | VITE_CALENDAR_ENABLED |
| T10.6 | ICS feed support | Done | Public + secret ICS URLs parsed |

## Phase 12: Polish + Enhancements (Complete)

| ID | Ticket | Status | Notes |
|---:|--------|--------|-------|
| T11.1 | Load validation + error UX | Done | Invalid JSON archived; Settings shows errors |
| T11.2 | Export data bundle | Done | Exports to timestamped bundle |
| T11.3 | Open data folder | Done | Settings button opens data directory |
| T11.5 | Custom data folder support | Done | Validate path + optional copy |
| T12.1 | Task detail sheet dynamic title | Done | Shows task title |
| T12.2 | Recurrence editing in task detail | Done | Modal for weekly/monthly editing |
| T12.3 | Remove navbar theme toggle | Done | Theme via Settings only |
| T12.4 | Completed tasks pane in Today | Done | Collapsible green header section |
| T12.5 | Reorder task detail sections | Done | Optimized layout |
| T12.6 | Remove ClockDrag preset buttons | Done | Pure drag interaction only |
| T12.7 | Fix Tailwind v4 + Svelte integration | Done | @tailwindcss/vite |
| T12.8 | completedForDay selector | Done | Filter tasks completed on day |
| T12.9 | Split time log button | Done | "Log Time" + "Log & Finish" buttons |
| T12.10 | Timed Session (pomodoro) | Done | TimedSessionModal with countdown, pause/resume, overtime |

---

## Phase 13: Bases Migration — Storage Layer

| ID | Ticket | Status | Owner | Notes |
|---:|--------|--------|-------|-------|
| T13.1 | YAML frontmatter parser/serializer | Done | | src/lib/storage/frontmatter.ts |
| T13.2 | Markdown file I/O utilities | Done | | src/lib/storage/markdown-storage.ts |
| T13.3 | loadAllTasks() from markdown | Done | | Scan Tasks/ folder, parse all .md |
| T13.4 | loadTask(filename) | Done | | Parse single .md frontmatter |
| T13.5 | saveTask(task) | Done | | Write .md with YAML frontmatter |
| T13.6 | deleteTask(filename) | Done | | Remove .md file |
| T13.7 | Task filename generation | Done | | generateTaskFilename() + sanitization |
| T13.8 | Handle filename conflicts | Done | | generateUniqueFilename() with suffix |

## Phase 14: Bases Migration — Domain Adaptation

| ID | Ticket | Status | Owner | Notes |
|---:|--------|--------|-------|-------|
| T14.1 | Update Task type for frontmatter | Done | | TaskFrontmatter type in frontmatter.ts |
| T14.2 | Embed timeEntries in Task | Done | | TimeEntry[] in frontmatter + migration |
| T14.3 | Add instance tracking arrays | Done | | active/complete/skipped_instances in frontmatter |
| T14.4 | Update selectors for markdown | Backlog | | Query from parsed .md files |
| T14.5 | RecurringInstanceService | Done | | src/lib/services/RecurringInstanceService.ts |
| T14.6 | Instance completion tracking | Done | | completeInstance() function |
| T14.7 | Instance skip tracking | Done | | skipInstance() function |

## Phase 15: Bases Migration — View Integration

| ID | Ticket | Status | Owner | Notes |
|---:|--------|--------|-------|-------|
| T15.1 | Create tasks-default.base | Backlog | | Filters, formulas, taskDateGroup |
| T15.2 | Create agenda-default.base | Backlog | | Calendar view configuration |
| T15.3 | Fix taskDateGroup logic | Done | | Attention-based grouping implemented |
| T15.4 | Implement urgencyScore formula | Backlog | | Priority + days until next |
| T15.5 | Today view uses Bases grouping | Backlog | | Render from taskDateGroup |
| T15.6 | Calendar view uses agenda.base | Backlog | | Render from agenda-default.base |

### T15.3-SPEC: Correct taskDateGroup Logic (Attention-Based View Filtering)

**File**: `src/lib/services/RecurringInstanceService.ts` → `getTaskDateGroup()`

**Current behavior (WRONG)**:
- Upcoming = everything else (includes unscheduled tasks with no history)

**Correct behavior** — filter by attention state, not just data state:

| Group | Condition | Attention State |
|-------|-----------|-----------------|
| **Now** | `scheduled === today` OR has active recurring instance for today | Needs action now |
| **Past** | Has `scheduled` or `due` in the past AND that date NOT in `complete_instances` | Overdue, needs action |
| **Upcoming** | Has KNOWN future date: `scheduled > today` OR has future recurring instances | Will need attention on that date |
| **Wrapped** | Everything else (no future date, regardless of history) | Not demanding attention |

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

| ID | Ticket | Status | Owner | Notes |
|---:|--------|--------|-------|-------|
| T16.1 | Migration script: tasks.json -> .md | Done | | src/lib/storage/migration.ts |
| T16.2 | Migration script: time_logs.json | Done | | Embeds timeEntries in task frontmatter |
| T16.3 | Validate migrated data | Backlog | | Verify all tasks readable |
| T16.4 | Backup original JSON files | Done | | createMigrationBackup() function |
| T16.5 | Remove JSON storage code | Backlog | | Clean up deprecated code |

## Phase 17: Bases Migration — Conflict Handling

| ID | Ticket | Status | Owner | Notes |
|---:|--------|--------|-------|-------|
| T17.1 | Per-file Syncthing conflict scan | Backlog | | Detect .sync-conflict in Tasks/ |
| T17.2 | Per-file conflict resolution UI | Backlog | | Choose version per task |
| T17.3 | Archive non-selected versions | Backlog | | Move to conflicts/ folder |
| T17.4 | Save-time conflict detection | Backlog | | Check mtime before write |

## Phase 18: Bases Migration — Testing + Polish

| ID | Ticket | Status | Owner | Notes |
|---:|--------|--------|-------|-------|
| T18.1 | Unit tests: frontmatter parser | Done | | 38 tests in frontmatter.test.ts |
| T18.2 | Unit tests: RecurringInstanceService | Done | | 39 tests in RecurringInstanceService.test.ts |
| T18.3 | Integration tests: CRUD operations | Backlog | | Create/read/update/delete tasks |
| T18.4 | Integration tests: migration | Backlog | | JSON -> markdown conversion |
| T18.5 | Wayland smoke tests | Backlog | | Verify on LabWC |
| T18.6 | Performance testing | Backlog | | Load time with many .md files |

---

## v2 Backlog

| ID | Ticket | Status | Owner | Notes |
|---:|--------|--------|-------|-------|
| V2.1 | Theme switching UI | Backlog | | Toggle ayu/flexoki |
| V2.2 | Kanban board view | Backlog | | kanban-default.base |
| V2.3 | Nested projects | Backlog | | Project hierarchy |
| V2.4 | Advanced conflict merging | Backlog | | Field-level diff/merge |
| V2.5 | System/GTK theming | Backlog | | Match desktop theme |

---

## Status Legend

| Status | Meaning |
|--------|---------|
| Done | Completed and verified |
| In Progress | Currently being worked on |
| Backlog | Planned but not started |
| Blocked | Waiting on dependency |
