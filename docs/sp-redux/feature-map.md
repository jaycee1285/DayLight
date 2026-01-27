# SP Redux Feature Map

> Mapping of existing codebase structure to required features from the taskboard.

---

## Framework & Stack

- **Framework:** SvelteKit 2.0 + Svelte 5 (runes-based reactivity)
- **Desktop/Mobile:** Tauri 2.0
- **UI Library:** Skeleton Labs Skeleton Svelte v4
- **Styling:** Tailwind CSS 4.x
- **Storage:** JSON files via Tauri file API (Syncthing-friendly)

---

## Where Things Live

### Navigation

| What | Current Location | Notes |
|------|------------------|-------|
| Main layout/shell | `src/routes/+layout.svelte` | 664 lines, contains bottom nav, FAB, modals |
| Bottom nav | `+layout.svelte` lines ~600-650 | 4 tabs: Today, Calendar, Reports, Settings |
| Left sidebar nav | **Does not exist** | Needs to be created |
| FAB (+) button | `+layout.svelte` | Opens "Add Task" sheet |

**Action needed:** Add left sidebar with Projects/Tags sections; remove Planner/Boards (not present currently).

---

### Views/Routes

| View | Route | File |
|------|-------|------|
| Today | `/today` | `src/routes/today/+page.svelte` |
| Calendar | `/calendar` | `src/routes/calendar/+page.svelte` |
| Reports | `/reports` | `src/routes/reports/+page.svelte` |
| Settings | `/settings` | `src/routes/settings/+page.svelte` |
| Conflicts | `/conflicts` | `src/routes/conflicts/+page.svelte` |
| Recurring Review | **Does not exist** | Needs: `src/routes/recurring/+page.svelte` |

---

### State & Data Layer

| What | Location | Notes |
|------|----------|-------|
| Main store | `src/lib/stores/app.svelte.ts` | Svelte 5 runes ($state, $derived) |
| Tasks | `store.tasks` → `tasks.json` | Array of Task objects |
| Time logs | `store.timeLogs` → `time_logs.json` | Manual time entries |
| Meta | `store.meta` → `meta.json` | App settings, sync state |
| Calendar cache | `store.calendarCache` → `calendar_cache.json` | Cached calendar events |
| Storage I/O | `src/lib/storage/storage.ts` | Tauri file API with atomic writes |

**Selectors available:** `src/lib/domain/selectors.ts`
- `scheduledForDay()`, `overdueBeforeDay()`
- `tasksByTag()`, `tasksByProject()`, `tasksByContext()`
- `allTags()`, `allProjects()`, `allContexts()`
- `seriesTemplates()`, `seriesInstances()`

---

### Task Model

**File:** `src/lib/domain/task.ts`

```typescript
interface Task {
  id: string
  title: string
  tags: string[]           // From #shortcodes
  contexts: string[]       // From @shortcodes
  project: string | null   // From +shortcode
  scheduledDate: string | null  // YYYY-MM-DD
  completed: boolean
  completedAt: string | null
  seriesId: string | null      // Link to recurring series
  isSeriesTemplate: boolean
  recurrence: Recurrence | null // Only on templates
  createdAt: string
  updatedAt: string
}
```

**Missing fields for taskboard:**
- `startTime: string | null` - Time component for scheduled tasks

---

### Recurrence Model

**File:** `src/lib/domain/recurrence.ts` (352 lines)

**Currently supports:**
- Daily (with interval)
- Weekly (multiple weekdays)
- Monthly (day-of-month: 1-31)
- Monthly (nth weekday: e.g., 2nd Tuesday)
- Yearly

**Functions available:**
- `generateOccurrences(recurrence, windowStart, windowEnd)`
- `createWeeklyRecurrence(startDate, weekDays[])`
- `createMonthlyRecurrence(startDate, dayOfMonth?)`
- `describeRecurrence(recurrence)` - Human-readable text

**Action needed:** Enhance `describeRecurrence()` to output exact patterns:
- "Every day"
- "Mon-Fri"
- "Weekly on Wed"
- "We, Th, Fr"
- "Monthly on 5th"

---

### UI Primitives

**Directory:** `src/lib/components/`

| Component | File | Purpose |
|-----------|------|---------|
| Sheet | `Sheet.svelte` | Bottom sheet modal |
| TaskRow | `TaskRow.svelte` | Task list item with checkbox, title, chips |
| ChipInput | `ChipInput.svelte` | Text input with shortcode parsing |
| DatePill | `DatePill.svelte` | Date picker with quick options |
| ClockDrag | `ClockDrag.svelte` | Circular clock for duration |

**Needs creation:**
- `ProjectTabs.svelte` - Horizontal tab strip for project filtering
- `ContextMenu.svelte` - Overflow menu (⋮) for tasks/projects/tags

**TaskRow enhancements needed:**
- Right-aligned recurrence summary label
- Better chip styling matching screenshots

---

### Styling & Themes

| What | Location |
|------|----------|
| Global CSS | `src/app.css` |
| Flexoki theme | `flexoki-skeleton.css` |
| Ayu theme | `ayu-skeleton.css` |
| Tailwind config | `tailwind.config.ts` |

**CSS classes defined in app.css:**
- `.primary-btn`, `.cancel-btn`
- `.recurrence-btn`, `.weekday-btn`
- `.quick-date-btn`

---

## Summary: What Needs to Be Built

### Navigation Changes
1. **Add left sidebar** - Currently only bottom nav exists
2. Projects section with expand/collapse, add, overflow menu
3. Tags section with expand/collapse, add, overflow menu
4. Recurring entry point in nav

### New Components
1. `ProjectTabs.svelte` - Horizontal project tab strip
2. Context menus for task/project/tag

### View Changes
1. Create `/recurring` route for global recurring review
2. Add "Scheduled Tasks with Start Time" section to Today view
3. Add project tabs to Today, Schedule (Calendar), and Recurring views

### Model Changes
1. Add `startTime` field to Task
2. Storage migration for new field

### Recurrence Enhancements
1. Update `describeRecurrence()` for exact label patterns
2. Add unit tests for formatting

### Top Bar
1. Add refresh/sync icon
2. Add play/timer icon
3. Add expand/fullscreen icon
