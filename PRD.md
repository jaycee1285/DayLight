# TaskNotes PRD — Obsidian Bases Migration

## Product Summary

A personal tasks + calendar + manual time logging app for **Android + Linux Wayland**.
Built with **Svelte + Tauri**, integrating with **Obsidian Bases** for data storage and views.

### Architecture Evolution

| Aspect | v1 (Current) | v2 (Bases) |
|--------|--------------|------------|
| Data storage | JSON files (`tasks.json`, `time_logs.json`, `meta.json`) | Markdown files with YAML frontmatter |
| Task identity | UUID in JSON array | Individual `.md` file per task |
| Views | In-app Svelte components | Bases `.base` files (formula-driven) |
| Sync | Syncthing (JSON) | Syncthing (markdown folder) |
| Obsidian compat | None | Full (tasks editable in Obsidian) |

### Key Benefits of Bases Migration

1. **Obsidian interoperability** — Tasks editable in Obsidian with full plugin ecosystem
2. **Formula-driven views** — Filtering, grouping, sorting via Bases expression language
3. **Granular sync** — Per-file changes reduce conflict surface area
4. **Rich metadata** — YAML frontmatter supports complex properties (arrays, dates, nested values)
5. **Extensibility** — Custom views without code changes

---

## Target User

Single user (me). Phone is primary; desktop is secondary. Obsidian used on both platforms.

## UI + DX Constraints

- **NixOS-first**: project root includes `flake.nix` for reproducible dev environment
- **Skeleton UI**: Skeleton component system (`skeleton.dev`) for UI primitives
- **Theme**: `flexoki-skeleton.css` (theme switching is v2)
- **Wayland**: must run reliably on Wayland + LabWC

---

## Data Model: Markdown + YAML Frontmatter

### Task File Structure

Each task is a markdown file in `~/Sync/JMC/TaskNotes/Tasks/`:

```yaml
---
status: open              # open, done, cancelled
priority: normal          # none, low, normal, high
scheduled: 2026-01-25     # Date to work on task
due: 2026-01-30           # Deadline (optional)
recurrence: "DTSTART:20260125;FREQ=DAILY;INTERVAL=1"  # RRULE format
recurrence_anchor: scheduled  # scheduled or completion
tags:
  - task                  # Required for Bases view inclusion
  - project-name
contexts:
  - work
  - computer
projects:
  - "Project Name"
timeEstimate: 30          # Minutes (optional)
timeEntries:              # Time tracking
  - startTime: "2026-01-25T10:00:00"
    endTime: "2026-01-25T10:30:00"
active_instances:         # Recurring: dates task became active
  - 2026-01-24
  - 2026-01-25
complete_instances:       # Recurring: dates instance was completed
  - 2026-01-24
skipped_instances: []     # Recurring: dates instance was skipped
dateCreated: 2026-01-24T12:00:00.000-05:00
dateModified: 2026-01-25T10:00:00.000-05:00
---

Task description and notes go here.
```

### Required Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `status` | string | Yes | `open`, `done`, `cancelled` |
| `tags` | string[] | Yes | Must include `task` for view inclusion |
| `dateCreated` | ISO datetime | Yes | Auto-set on creation |
| `dateModified` | ISO datetime | Yes | Auto-updated on save |

### Optional Properties

| Property | Type | Description |
|----------|------|-------------|
| `priority` | string | `none`, `low`, `normal`, `high` |
| `scheduled` | date | Date to work on task |
| `due` | date | Deadline |
| `recurrence` | string | RRULE format |
| `recurrence_anchor` | string | `scheduled` or `completion` |
| `contexts` | string[] | Context tags (e.g., `work`, `computer`) |
| `projects` | string[] | Project associations |
| `timeEstimate` | number | Estimated minutes |
| `timeEntries` | object[] | Time tracking entries |
| `active_instances` | date[] | Recurring task activation dates |
| `complete_instances` | date[] | Recurring task completion dates |
| `skipped_instances` | date[] | Recurring task skip dates |

---

## Bases View System

### File Locations

```
~/Sync/JMC/TaskNotes/
├── Views/
│   ├── tasks-default.base      # Main task list view
│   ├── agenda-default.base     # Calendar/agenda view
│   └── ...
└── Tasks/
    ├── Task Name.md            # Individual task files
    └── ...
```

### Base File Structure

Each `.base` file is YAML with three sections:

```yaml
filters:      # Which files to include
formulas:     # Computed properties for filtering/grouping/display
views:        # View configurations (type, grouping, sorting, display)
```

### Primary Views

#### Task List View (`tasks-default.base`)

Groups tasks by temporal relevance:

| Group | Criteria |
|-------|----------|
| **Past** | Tasks with uncompleted instances from previous days |
| **Now** | Tasks active today (scheduled, due, or recurring instance) |
| **Upcoming** | Future tasks |
| **Wrapped** | Completed tasks (today's instance done, or status=done) |

Key formula (`taskDateGroup`):
1. Completed today or status=done → **Wrapped**
2. Has past uncompleted recurring instances → **Past**
3. Today is in `active_instances` → **Now**
4. Due or scheduled today → **Now**
5. Due or scheduled in past → **Past**
6. Everything else → **Upcoming**

#### Agenda View (`agenda-default.base`)

Calendar-based view displaying tasks on scheduled/due dates.

```yaml
views:
  - type: tasknotesCalendar
    name: Agenda
    filters:
      and:
        - status != "done"
    calendarView: dayGridMonth
    listDayCount: 7
```

### Key Formulas

**Date Calculations:**
```yaml
daysUntilDue: if(due, ((number(date(due)) - number(today())) / 86400000).floor(), null)
daysUntilScheduled: if(scheduled, ((number(date(scheduled)) - number(today())) / 86400000).floor(), null)
```

**Boolean Flags:**
```yaml
isOverdue: due && date(due) < today() && status != "done"
isDueToday: due && date(due).date() == today()
isRecurring: recurrence && !recurrence.isEmpty()
isActiveToday: active_instances && list(active_instances).contains(today().format("YYYY-MM-DD"))
```

**Urgency Scoring:**
```yaml
priorityWeight: if(priority=="none",0,if(priority=="low",1,if(priority=="normal",2,if(priority=="high",3,999))))
urgencyScore: if(!due && !scheduled, formula.priorityWeight, formula.priorityWeight + max(0, 10 - formula.daysUntilNext))
```

---

## RecurringInstanceService

The `RecurringInstanceService` manages recurring task instances:

1. **On plugin load** and **at midnight**: Scans all recurring tasks
2. For each task, checks if today matches the RRULE pattern
3. If yes and today isn't in `active_instances`, adds it
4. Persists the update to the task's frontmatter

This enables:
- Recurring tasks appearing in "Now" when active today
- Recurring tasks appearing in "Past" when instances are incomplete
- Completion history tracking across instances

---

## Core Screens

### 1. Today View

- **Appointments**: Read-only Google Calendar events
- **Now section**: Tasks active today (from Bases `taskDateGroup`)
- **Past section**: Overdue/incomplete tasks
- **Wrapped section**: Completed tasks (collapsible)
- Date selector with prev/next navigation
- Returning to Today resets to current date; midnight rollover updates date

### 2. Calendar View

- Day-based task + appointment view
- Tasks positioned by scheduled/due date
- Agenda view from `agenda-default.base`

### 3. Reports

- Time spent by **tag** and **project** for day/week/month ranges
- Aggregate from `timeEntries` in task frontmatter

### 4. Settings

- Data folder configuration
- Calendar refresh controls
- Conflict tools

### 5. Conflicts

- Syncthing conflict detection
- Remote vs local choice with archive

---

## Storage Layer Changes

### Current (JSON)

```typescript
// storage.ts
loadAll(): { tasks: Task[], timeLogs: TimeLog[], meta: Meta }
saveAll(data): void  // Atomic write with temp -> rename
```

### Target (Markdown)

```typescript
// storage.ts
loadAllTasks(): Task[]           // Parse all .md files in Tasks/
loadTask(filename): Task         // Parse single .md frontmatter
saveTask(task): void             // Write .md with frontmatter
deleteTask(filename): void       // Remove .md file

loadMeta(): Meta                 // meta.json (app config only)
saveMeta(meta): void
```

### Migration Path

1. **Read JSON** → Parse `tasks.json`
2. **Create markdown files** → One `.md` per task with frontmatter
3. **Migrate time logs** → Embed `timeEntries` in each task's frontmatter
4. **Update selectors** → Query from markdown files instead of JSON array
5. **Remove JSON dependency** → Delete old storage code

---

## Hard Requirements

### Scheduling + Recurrence

- **scheduled** (date-only) is primary scheduling field
- Recurrence patterns: daily, weekly, every N, monthly (day-of-month), monthly (nth weekday), yearly
- Generate occurrences **regardless of completion** (rule B)
- Rescheduling affects **only that instance**, never the series rule
- Instance tracking via `active_instances`, `complete_instances`, `skipped_instances` arrays

### Task Capture

- Parse shortcodes in title input:
  - `#tag` → `tags[]`
  - `@context` → `contexts[]`
  - `+project` → `projects[]`
- Autocomplete via search

### Time Logging

- Manual only; no timers
- Clock-drag duration picker (15-minute snap)
- Backfill support: yesterday + date picker
- Stored as `timeEntries` array in task frontmatter

### Date Handling

- Treat date-only strings as **local dates**
- Avoid `toISOString()` for date-only display
- Parse `YYYY-MM-DD` as local midnight

### Conflict Handling

- Per-file conflicts easier to resolve than whole-JSON conflicts
- Archive losing version to `conflicts/`
- Syncthing conflict variants detected and surfaced

### Google Calendar / ICS (read-only)

- One calendar + ICS feeds
- Cached locally for rendering
- Desktop OAuth with loopback redirect
- Behind feature flag (`VITE_CALENDAR_ENABLED`)

---

## MVP Acceptance Criteria (Bases Migration)

- [ ] Tasks stored as individual markdown files with YAML frontmatter
- [ ] `tasks-default.base` renders task list with Past/Now/Upcoming/Wrapped groups
- [ ] `agenda-default.base` renders calendar view
- [ ] RecurringInstanceService populates `active_instances` for recurring tasks
- [ ] Time logging stored in `timeEntries` frontmatter property
- [ ] Existing JSON data migrated to markdown files
- [ ] Selectors updated to query markdown files
- [ ] Today/Calendar/Reports views functional with new storage
- [ ] Syncthing per-file conflict detection working

---

## Non-Goals (v2 Backlog)

- Theme switching UI
- Kanban board view
- Nested projects
- Habit tracking
- Focus mode / pomodoro
- Integrations beyond read-only calendars
- System/GTK theming fidelity
- Advanced conflict diffing/merging

---

## Expression Language Reference (Bases)

### Functions

| Function | Description | Example |
|----------|-------------|---------|
| `today()` | Current date (no time) | `date(due) < today()` |
| `now()` | Current datetime | `number(now())` |
| `date(value)` | Parse string to date | `date(scheduled)` |
| `number(value)` | Convert to number | `number(date(due))` |
| `list(value)` | Convert to list | `list(tags).length` |
| `if(cond, then, else)` | Conditional | `if(due, "Has due", "No due")` |
| `min(a, b)` / `max(a, b)` | Min/max value | `max(0, 10 - days)` |

### List Operations

| Operation | Description | Example |
|-----------|-------------|---------|
| `.length` | List length | `list(tags).length` |
| `.contains(val)` | Check membership | `list(tags).contains("urgent")` |
| `.filter(expr)` | Filter items | `list(items).filter(value > 0)` |
| `.isEmpty()` | Check if empty | `recurrence.isEmpty()` |

### Date Operations

| Operation | Description | Example |
|-----------|-------------|---------|
| `.date()` | Extract date part | `date(due).date()` |
| `.format(fmt)` | Format date | `today().format("YYYY-MM-DD")` |
| `+ "Nd"` / `- "Nd"` | Add/subtract days | `today() + "7d"` |
