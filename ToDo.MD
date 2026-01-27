# SP Redux — Implementation Taskboard (agent should adapt to current repo structure)

> Assumption: you (agent) can see the existing project tree. Before coding, map *actual* folders/files
> to the placeholders below. Do not invent new architecture unless necessary.

---

## 0) Repo orientation (required first pass)

- [ ] Locate app entry + routing:
  - [ ] Identify framework (SvelteKit/Tauri/etc.) and where routes/views live.
  - [ ] Note existing nav + layout components.
- [ ] Locate state/data layer:
  - [ ] Where tasks/projects/tags are stored (local DB, JSON, SQLite, IndexedDB, file sync, etc.).
  - [ ] Where “recurrence” and “schedule” are currently modeled (if at all).
- [ ] Locate UI primitives:
  - [ ] Card component used for list rows.
  - [ ] Chip/badge component.
  - [ ] Icon/button components (top-bar actions, FAB).

**Deliverable:** `docs/sp-redux/feature-map.md`
- [ ] Write a short mapping: “Where nav lives”, “Where Today view lives”, “Where tasks live”, “Where recurrence should live”.

---

## 1) Navigation + IA parity with screenshots (remove Planner/Boards)

### 1.1 Left menu: remove Planner + Boards
- [ ] Find current left nav items list (likely `src/components/Nav*` or `src/routes/+layout*`).
- [ ] Remove/hide **Planner** and **Boards** items (feature flag acceptable if needed).
- [ ] Ensure left menu contains (in order):
  - [ ] Today
  - [ ] Schedule (or Upcoming)
  - [ ] Projects section
  - [ ] Tags section
  - [ ] Recurring review entry (global)

**Acceptance:** Left menu visually matches density/structure of screenshot 1, without Planner/Boards.

### 1.2 Projects and Tags sections
- [ ] Projects list renders as a section with:
  - [ ] Expand/collapse caret
  - [ ] “add project” control
  - [ ] Per-project overflow menu (⋮)
- [ ] Tags list renders similarly with:
  - [ ] Expand/collapse
  - [ ] “add tag” control
  - [ ] Per-tag overflow menu

**Acceptance:** Projects + Tags appear as separate sections in left menu.

---

## 2) Primary organization: “Project tabs” (fast switch) + still keep left menu

> Requirement: user wants organizing by project and “tab”. This can be a top bar tab strip, segmented
> control, or horizontal scroll pills. Must be fast to switch.

- [ ] Implement a **Project Tab Strip** component:
  - [ ] Shows “All” + each Project
  - [ ] Horizontally scrollable on mobile
  - [ ] Selecting a tab filters the current view to that project
- [ ] Decide where this appears:
  - [ ] Today view top area
  - [ ] Schedule view top area
  - [ ] Recurring view top area (optional but recommended)

**Deliverable:** `src/components/ProjectTabs.*` (adapt extension to repo)
- [ ] Uses current project store/source of truth
- [ ] Emits selectedProjectId (or null for All)

**Acceptance:** User can switch project context without opening left menu.

---

## 3) Task list row/card parity (screenshot 2)

### 3.1 Task row layout
- [ ] Update the “task row/card” component to support:
  - [ ] Title left
  - [ ] Under-title chips line: Project chip + Tag chips (match screenshot style)
  - [ ] Right-aligned **recurrence summary label** (e.g., “We, Th, Fr”, “Monthly on 5th”)
- [ ] Ensure consistent spacing / tap targets for mobile.

**Acceptance:** Rows resemble screenshot 2: title + chips + recurrence label on right.

### 3.2 Chips
- [ ] Ensure chips can render:
  - [ ] Project chip (icon optional)
  - [ ] Multiple tag chips
- [ ] Use existing chip/badge component if present; otherwise create minimal one.

---

## 4) Recurrence model + formatting (granular like screenshot 2)

> Non-negotiable: recurring tasks must be as granular as screenshot 2, and reviewable in one place.

### 4.1 Choose canonical recurrence format
- [ ] Prefer internal RRULE-like structure (not necessarily full RFC) with:
  - [ ] freq: daily|weekly|monthly
  - [ ] byDay: [MO,TU,WE,TH,FR,SA,SU] (for weekly)
  - [ ] byMonthDay: [1..31] (for monthly)
  - [ ] interval (default 1)
- [ ] Store in task model: `task.recurrence`

**Acceptance:** Data model can express:
- Every day
- Mon–Fri
- Weekly on Wed
- We, Th, Fr
- Monthly on 5th/15th/20th/24th/28th/29th

### 4.2 Human-readable recurrence formatter
- [ ] Implement `formatRecurrence(recurrence)` that outputs EXACT patterns:
  - [ ] `Every day`
  - [ ] `Mon-Fri`
  - [ ] `Weekly on Wed`
  - [ ] `We, Th, Fr`
  - [ ] `Monthly on 5th` (with correct ordinal suffix)

**Deliverable:** `src/lib/recurrence/format.*` (adapt path)
- [ ] Unit tests in repo’s test style (if present)

**Acceptance:** UI label matches screenshot conventions closely.

### 4.3 Recurrence editor UI
- [ ] Provide recurrence picker in task create/edit:
  - [ ] None / Daily / Weekly / Monthly
  - [ ] Weekly: multi-day selector
  - [ ] Weekly shortcut: Mon–Fri
  - [ ] Monthly: day-of-month selector
- [ ] Saving recurrence updates the row label immediately.

---

## 5) Global Recurring Review screen (one place to audit all repeating tasks)

- [ ] Add a **Recurring** view accessible from left menu.
- [ ] Default list: all tasks where `recurrence != null`
- [ ] Filters:
  - [ ] Project (integrate with Project Tabs; All default)
  - [ ] Tag filter (optional but recommended)
- [ ] Sorting:
  - [ ] By project then title (OK)
  - [ ] Or by next occurrence (better if next-occurrence exists)

**Acceptance:** There is a single view that lists all recurring tasks with granular labels.

---

## 6) “Scheduled Tasks with Start Time” section (screenshot 2 footer)

- [ ] Ensure task model supports optional `startTime` (and date if needed).
- [ ] Create/confirm section titled **Scheduled Tasks with Start Time** in Today (or Schedule) view.
- [ ] If none exist, show an empty state message (no need to match text verbatim).
- [ ] Provide “Schedule Task” action in task context menu.

**Acceptance:** Section exists and behaves like screenshot 2 (empty-state when none).

---

## 7) Top bar controls + FAB parity (lightweight)

> Don’t overbuild. Just match core affordances.

- [ ] Ensure there is a FAB “+” that creates a new task.
- [ ] Ensure top bar contains:
  - [ ] Refresh/sync icon (wired to existing refresh action or noop stub with TODO)
  - [ ] Play/start icon (wired to existing timer or noop stub with TODO)
  - [ ] Expand/fullscreen icon (view toggle or noop stub with TODO)

**Acceptance:** Buttons appear; functionality can be partial if project lacks timer/sync.

---

## 8) Context menus (⋮) on project, tag, and task

- [ ] Task context menu supports:
  - [ ] Edit
  - [ ] Move to project
  - [ ] Add/remove tags
  - [ ] Set recurrence
  - [ ] Schedule/start time
- [ ] Project menu supports:
  - [ ] Rename
  - [ ] Delete/Archive
- [ ] Tag menu supports:
  - [ ] Rename
  - [ ] Delete

**Acceptance:** ⋮ menus exist in the same places as screenshots.

---

## 9) Persistence + migration

- [ ] If adding fields (`recurrence`, `startTime`), implement migration:
  - [ ] Default null for existing tasks
  - [ ] Ensure serialization/deserialization is stable
- [ ] If tasks are stored in a file/db, add version bump if required.

**Acceptance:** No runtime crashes loading existing user data.

---

## 10) QA checklist (must pass before marking done)

- [ ] Left menu: no Planner, no Boards.
- [ ] Projects + Tags sections render and are usable.
- [ ] Project tabs work (All + per project filtering).
- [ ] Task rows show: title + chips + right-aligned recurrence label.
- [ ] Recurrence labels match required patterns.
- [ ] Global Recurring view lists all recurring tasks.
- [ ] “Scheduled Tasks with Start Time” section exists + empty state works.

---

## 11) Final deliverables

- [ ] `docs/sp-redux/feature-map.md` (repo mapping)
- [ ] `docs/sp-redux/recurrence-spec.md` (data format + examples)
- [ ] Code changes implementing sections 1–10
- [ ] If tests exist: add/adjust tests for recurrence formatting and view filtering

---