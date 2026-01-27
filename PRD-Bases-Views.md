# PRD: TaskNotes Bases Views

## Overview

TaskNotes integrates with the Obsidian Bases plugin to provide powerful, formula-driven task views. These views allow users to filter, group, and sort tasks using computed properties and custom expressions.

Two primary views are provided:
- **tasks-default.base** - A list-based task view with temporal grouping (Past/Now/Upcoming)
- **agenda-default.base** - A calendar/agenda view for date-based task visualization

---

## Base File Structure

Each `.base` file is a YAML document with three main sections:

```yaml
filters:      # Which files to include
formulas:     # Computed properties for filtering/grouping/display
views:        # View configurations (type, grouping, sorting, display options)
```

### 1. Filters

Filters determine which markdown files are included in the view.

```yaml
filters:
  and:
    - file.hasTag("task")    # Only include files with #task tag
```

Supports boolean logic (`and`, `or`) and various conditions:
- `file.hasTag("tagname")` - Check for frontmatter/inline tags
- `property == "value"` - Property equality
- `property != "value"` - Property inequality
- `property < value` - Comparisons

### 2. Formulas

Formulas are computed properties that can reference:
- **Frontmatter properties**: `status`, `due`, `scheduled`, `priority`, `recurrence`, etc.
- **File metadata**: `file.ctime`, `file.mtime`, `file.name`, `file.path`
- **Other formulas**: `formula.propertyName`
- **Built-in functions**: `today()`, `now()`, `date()`, `number()`, `list()`, `if()`, etc.

#### Formula Categories

**Date Calculations:**
```yaml
daysUntilDue: if(due, ((number(date(due)) - number(today())) / 86400000).floor(), null)
daysUntilScheduled: if(scheduled, ((number(date(scheduled)) - number(today())) / 86400000).floor(), null)
daysSinceCreated: ((number(now()) - number(file.ctime)) / 86400000).floor()
```

**Boolean Flags:**
```yaml
isOverdue: due && date(due) < today() && status != "done"
isDueToday: due && date(due).date() == today()
isRecurring: recurrence && !recurrence.isEmpty()
isActiveToday: active_instances && list(active_instances).contains(today().format("YYYY-MM-DD"))
```

**Categorization:**
```yaml
dueDateCategory: if(!due, "No due date", if(date(due) < today(), "Overdue", ...))
priorityCategory: if(priority=="none","None",if(priority=="low","Low",...))
timeEstimateCategory: if(!timeEstimate, "No estimate", if(timeEstimate < 30, "Quick (<30m)", ...))
```

**Scoring:**
```yaml
priorityWeight: if(priority=="none",0,if(priority=="low",1,if(priority=="normal",2,if(priority=="high",3,999))))
urgencyScore: if(!due && !scheduled, formula.priorityWeight, formula.priorityWeight + max(0, 10 - formula.daysUntilNext))
```

### 3. Views

Views define how tasks are rendered. Each base file can contain multiple views.

```yaml
views:
  - type: tasknotesTaskList    # or tasknotesCalendar
    name: "View Name"
    filters:                    # Additional view-specific filters
      and:
        - status != "done"
    groupBy:
      property: formula.taskDateGroup
      direction: ASC
    sort:
      - property: formula.urgencyScore
        direction: DESC
    order:                      # Which properties to display on task cards
      - scheduled
      - contexts
      - tags
```

---

## Task List View (tasks-default.base)

### Purpose

Provides a grouped task list organized by temporal relevance:
- **Past** - Tasks with uncompleted instances from previous days
- **Now** - Tasks active today (scheduled, due, or recurring instance)
- **Upcoming** - Future tasks
- **Wrapped** - Completed tasks (today's recurring instance completed, or status=done)

### Key Formula: taskDateGroup

This formula determines which group a task belongs to:

```yaml
taskDateGroup: if(
  status == "done" || (recurrence && complete_instances && list(complete_instances).contains(today().format("YYYY-MM-DD"))),
  "Wrapped",
  if(formula.hasPastUncompletedInstances,
    "Past",
    if(formula.isActiveToday,
      "Now",
      if((due && date(due).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")) || (scheduled && date(scheduled).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")),
        "Now",
        if((due && date(due) < today()) || (scheduled && date(scheduled) < today()),
          "Past",
          "Upcoming"
        )
      )
    )
  )
)
```

**Evaluation Order (priority):**
1. Completed today or status=done → **Wrapped**
2. Has past uncompleted recurring instances → **Past**
3. Today is in active_instances (recurring) → **Now**
4. Due or scheduled today → **Now**
5. Due or scheduled in past → **Past**
6. Everything else → **Upcoming**

### Recurring Task Instance Tracking

For recurring tasks, three arrays track instance state:

| Property | Purpose |
|----------|---------|
| `active_instances` | Dates when the task became "active" (added by RecurringInstanceService) |
| `complete_instances` | Dates when the recurring instance was marked complete |
| `skipped_instances` | Dates when the instance was skipped |

**Helper Formulas:**

```yaml
# Is today in the active_instances array?
isActiveToday: active_instances && list(active_instances).contains(today().format("YYYY-MM-DD"))

# Are there past dates in active_instances that aren't in complete_instances?
hasPastUncompletedInstances: active_instances && list(active_instances).filter(
  value < today().format("YYYY-MM-DD") &&
  (!complete_instances || !list(complete_instances).contains(value))
).length > 0
```

### Sorting

Tasks are sorted by `urgencyScore` (descending), which combines:
- Priority weight (0-3, or 999 for undefined)
- Days until next date (closer = higher urgency)

```yaml
urgencyScore: if(!due && !scheduled,
  formula.priorityWeight,
  formula.priorityWeight + max(0, 10 - formula.daysUntilNext)
)
```

---

## Agenda View (agenda-default.base)

### Purpose

Provides a calendar-based view of tasks, displaying them on their scheduled/due dates.

### View Configuration

```yaml
views:
  - type: tasknotesCalendar
    name: Agenda
    filters:
      and:
        - status != "done"      # Hide completed tasks
    options:
      showPropertyBasedEvents: false
    calendarView: dayGridMonth  # Month grid layout
    listDayCount: 7             # Show 7 days in list mode
```

### Key Differences from Task List

- Uses `tasknotesCalendar` view type instead of `tasknotesTaskList`
- Tasks positioned on calendar by date rather than grouped
- No `groupBy` configuration (calendar handles positioning)
- Same formulas available for filtering and computed properties

---

## Task Frontmatter Schema

Tasks are markdown files with YAML frontmatter:

```yaml
---
status: open              # open, done, cancelled
priority: normal          # none, low, normal, high
scheduled: 2026-01-25     # Date to work on task
due: 2026-01-30           # Deadline
recurrence: "DTSTART:20260125;FREQ=DAILY;INTERVAL=1"  # RRULE format
recurrence_anchor: scheduled  # scheduled or completion
tags:
  - task                  # Required for view inclusion
  - project-name
contexts:
  - work
  - computer
projects:
  - "Project Name"
timeEstimate: 30          # Minutes
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

---

## RecurringInstanceService Integration

The `RecurringInstanceService` (in `src/services/RecurringInstanceService.ts`) automatically populates `active_instances`:

1. **On plugin load** and **at midnight**: Scans all recurring tasks
2. For each task, checks if today matches the RRULE pattern
3. If yes and today isn't already in `active_instances`, adds it
4. Persists the update to the task's frontmatter

This enables the view to:
- Show recurring tasks in "Now" when they're due today
- Show recurring tasks in "Past" when previous instances weren't completed
- Track completion history across recurring instances

---

## Expression Language Reference

### Functions

| Function | Description | Example |
|----------|-------------|---------|
| `today()` | Current date (no time) | `date(due) < today()` |
| `now()` | Current datetime | `number(now())` |
| `date(value)` | Parse string to date | `date(scheduled)` |
| `number(value)` | Convert to number | `number(date(due))` |
| `list(value)` | Convert to list | `list(tags).length` |
| `if(cond, then, else)` | Conditional | `if(due, "Has due", "No due")` |
| `min(a, b)` | Minimum value | `min(daysUntilDue, daysUntilScheduled)` |
| `max(a, b)` | Maximum value | `max(0, 10 - days)` |

### List Operations

| Operation | Description | Example |
|-----------|-------------|---------|
| `.length` | List length | `list(tags).length` |
| `.contains(val)` | Check membership | `list(tags).contains("urgent")` |
| `.filter(expr)` | Filter items | `list(items).filter(value > 0)` |
| `.map(expr)` | Transform items | `list(items).map(value * 2)` |
| `.reduce(expr, init)` | Aggregate | `list(items).reduce(acc + value, 0)` |
| `.isEmpty()` | Check if empty | `recurrence.isEmpty()` |

### Date Operations

| Operation | Description | Example |
|-----------|-------------|---------|
| `.date()` | Extract date part | `date(due).date()` |
| `.format(fmt)` | Format date | `today().format("YYYY-MM-DD")` |
| `+ "Nd"` | Add N days | `today() + "7d"` |
| `- "Nd"` | Subtract N days | `today() - "1d"` |

### Comparison Operators

`==`, `!=`, `<`, `>`, `<=`, `>=`, `&&`, `||`, `!`

---

## File Locations

```
~/Sync/JMC/TaskNotes/
├── Views/
│   ├── tasks-default.base      # Main task list view
│   ├── agenda-default.base     # Calendar/agenda view
│   ├── kanban-default.base     # Kanban board view
│   └── ...
└── Tasks/
    ├── Task Name.md            # Individual task files
    └── ...
```
