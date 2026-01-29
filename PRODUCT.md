# SPRedux — Personal Task Management with Markdown at the Core

A privacy-first, cross-platform task manager that stores your tasks as plain markdown files you own forever.

---

## What is SPRedux?

SPRedux is a personal productivity app for **Android and Linux** that combines task management, recurring schedules, and manual time tracking—all stored as **markdown files with YAML frontmatter**. Unlike cloud-locked productivity apps, your data lives on your filesystem and syncs via tools you control (like Syncthing).

Built with **Svelte 5** and **Tauri 2**, SPRedux delivers native performance with a web-tech foundation.

---

## Key Features

### Task Management with Context

- **Projects & Tags** — Organize tasks by project and apply multiple tags for filtering
- **Contexts** — Add @work, @home, @errands contexts for GTD-style workflows
- **Priority levels** — None, Low, Normal, High with urgency scoring
- **Shortcode capture** — Type `#urgent @work +ClientProject` and watch it parse instantly

### Flexible Scheduling

- **Scheduled dates** — Set a date to work on a task
- **Due dates** — Hard deadlines with overdue tracking
- **Smart grouping** — Tasks automatically sort into Past, Now, Upcoming, and Wrapped sections

### Recurring Tasks Done Right

- **Granular patterns** — Daily, weekly (Mon-Fri, We/Th/Fr), monthly (5th of month), yearly
- **Instance tracking** — Each occurrence is tracked separately
- **Skip or complete independently** — Mark just today's instance done without affecting the series
- **Rescheduling respects the rule** — Move one instance without breaking future occurrences

### Manual Time Tracking

- **Clock-drag interface** — Intuitive time entry with 15-minute snapping
- **Per-task time entries** — Log time against specific tasks
- **Reports by project & tag** — See where your time goes over days, weeks, or months

### Calendar Integration (Optional)

- **Google Calendar read-only sync** — View appointments alongside tasks
- **ICS feed support** — Pull in any public or private calendar feed
- **Local caching** — Works offline after initial sync

### Sync Your Way

- **Syncthing-ready** — Files sync peer-to-peer without cloud dependencies
- **Per-file conflicts** — When conflicts occur, resolve them per-task instead of losing everything
- **Archive-based resolution** — Rejected versions archived, not deleted

---

## Data You Own

Every task is a markdown file:

```markdown
---
status: open
priority: high
scheduled: 2026-01-28
due: 2026-01-30
recurrence: "DTSTART:20260128;FREQ=WEEKLY;BYDAY=MO,WE,FR"
tags:
  - task
  - urgent
projects:
  - "Client Project"
contexts:
  - work
timeEntries:
  - startTime: "2026-01-27T09:00:00"
    endTime: "2026-01-27T09:45:00"
---

Follow up on the proposal draft and confirm delivery timeline.
```

**Open in any editor.** Edit in Obsidian. Grep from the terminal. Migrate to another system whenever you want.

---

## Views & Navigation

| View | Purpose |
|------|---------|
| **Today** | Daily focus: tasks due or scheduled today, overdue items, completed tasks |
| **Calendar** | Week/month visualization of scheduled tasks and calendar events |
| **Projects** | Filter tasks by project |
| **Tags** | Filter tasks by tag |
| **Recurring** | Review and manage all recurring task series |
| **Reports** | Time tracking summaries by project, tag, or date range |
| **Settings** | Data folder, calendar sync, conflict resolution |

---

## Platform Support

| Platform | Status |
|----------|--------|
| **Linux (Wayland)** | Primary target, tested on NixOS + LabWC |
| **Android** | Full support with Syncthing folder access |
| **Linux (X11)** | Works via XWayland |

Desktop is secondary; the app is designed **mobile-first** for phone use.

---

## Potential Issues & Limitations

### Current Constraints

- **Single-user design** — No multi-user collaboration or sharing features
- **No timers** — Time tracking is manual entry only, no start/stop timers
- **Read-only calendars** — Cannot create calendar events, only view them
- **No offline-first cloud** — Relies on file sync (Syncthing), not cloud backends
- **No iOS** — Tauri 2 Android support exists, but iOS is not currently targeted

### Known Rough Edges

- **Large task sets** — Performance with thousands of markdown files is untested at scale
- **Conflict resolution** — Works but requires user decision; no auto-merge
- **Theme switching** — Currently requires settings toggle, no system theme detection
- **Hot reload quirks** — Some store changes may require dev server restart during development

### Android Specifics

- Requires **MANAGE_EXTERNAL_STORAGE** permission to access Syncthing folders
- Default path: `/storage/emulated/0/syncthing/syncthing/JMC/TaskNotes`
- SAF directory picker available for custom paths

---

## Getting Started

### Prerequisites

- **Nix** (recommended) or Node.js 20+ with Bun
- **Rust toolchain** for Tauri builds
- **Syncthing** for cross-device sync (optional but recommended)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/your-org/spredux.git
cd spredux

# Enter the dev environment (if using Nix)
nix develop

# Install dependencies
bun install

# Run in development mode
bun run tauri:dev
```

### Building for Production

```bash
# Linux desktop release
bun run tauri:build

# Android APK (all architectures)
bun run tauri:android
```

### Setting Up Your Data Folder

1. Create a folder for tasks: `~/Sync/JMC/TaskNotes/Tasks/`
2. Open SPRedux Settings and set the data path
3. (Optional) Configure Syncthing to sync this folder across devices

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    SPRedux (Tauri 2)                    │
├───────────────────────┬─────────────────────────────────┤
│   Frontend (Svelte 5) │      Backend (Rust + Tauri)     │
│   - Reactive UI       │      - Filesystem access        │
│   - Skeleton UI       │      - Path resolution          │
│   - View routing      │      - Android permissions      │
└───────────────────────┴─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Local Filesystem (Markdown)                │
│   ~/Sync/JMC/TaskNotes/                                 │
│   ├── Tasks/                                            │
│   │   ├── Buy groceries.md                              │
│   │   ├── Review quarterly report.md                    │
│   │   └── ...                                           │
│   └── meta.json                                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                Syncthing (peer-to-peer)                 │
│   Phone ◄────────────────────────────────────► Desktop  │
└─────────────────────────────────────────────────────────┘
```

---

## Obsidian Compatibility

SPRedux tasks are designed to work with **Obsidian Bases**, a plugin for formula-driven views:

- **`tasks-default.base`** — List view with Past/Now/Upcoming/Wrapped grouping
- **`agenda-default.base`** — Calendar view of scheduled tasks

Edit tasks in SPRedux or Obsidian interchangeably. The frontmatter schema is shared.

---

## Contributing

SPRedux is a personal project, but contributions are welcome:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request with clear description

Please respect the design principles:
- **Mobile-first** — Test on small screens
- **No over-engineering** — Solve today's problems, not hypothetical future ones
- **Own your data** — Never compromise on local-first storage

---

## License

See LICENSE file in repository.

---

*SPRedux: Tasks you own. Sync you control. Focus you keep.*
