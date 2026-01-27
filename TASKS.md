# TASKS — Wayland-Ready Tasks + Calendar + Manual Time Logging (NixOS + Skeleton)

Legend: each ticket should be ~30–90 minutes.

## Setup (T0)
- [ ] T0.0 Add **project-root flake.nix** with devShell (node, pnpm, rust, tauri deps).
- [ ] T0.1 Create Tauri + SvelteKit app (adapter-static, SSR off) and run dev build.
- [ ] T0.2 Install and configure **Skeleton UI** (components + Tailwind config if needed).
- [ ] T0.3 Wire global theme CSS:
  - Choose **one** as default in v1: `ayu-skeleton.css` OR `flexoki-skeleton.css`.
  - Import it in the app entry so all pages use it.
- [ ] T0.4 Add routes/pages: /today, /calendar, /reports, /settings, /conflicts.
- [ ] T0.5 Build layout shell with Skeleton components (nav + global "+" button).
- [ ] T0.6 Add Skeleton primitives wrappers: Sheet/Modal, Chip input, Date pill.

## Domain models (T1)
- [ ] T1.1 Create `src/lib/domain/task.ts` with Task type + defaults.
- [ ] T1.2 Create `src/lib/domain/recurrence.ts` with Recurrence type + helpers.
- [ ] T1.3 Create `src/lib/domain/timeLog.ts` with TimeLog type.
- [ ] T1.4 Create `src/lib/domain/meta.ts` with Meta type.
- [ ] T1.5 Create selectors: scheduledForDay(day), overdueBeforeDay(day), byId maps.

## Storage (T2)
- [ ] T2.1 Define canonical filenames + folder layout constants.
- [ ] T2.2 Implement `loadAll()` reading tasks.json/time_logs.json/meta.json (create if missing).
- [ ] T2.3 Implement `saveAll()` with atomic write (write temp -> rename).
- [ ] T2.4 Add schemaVersion + stub migrate() that no-ops for v1.
- [ ] T2.5 Track load-state (mtime + sha256) per file for "changed since load".

## Shortcode capture (T3)
- [ ] T3.1 Implement parser: extract `#tags`, `@contexts`, `+project` from text.
- [ ] T3.2 Implement ChipInput.svelte (Skeleton) showing parsed chips while typing.
- [ ] T3.3 Implement autocomplete (search existing tags/contexts/projects from store).
- [ ] T3.4 On save, normalize: lower-case tags/contexts, single project string.

## Today view (T4)
- [ ] T4.1 Build Today page scaffold with Skeleton components: date selector + sections.
- [ ] T4.2 Render Scheduled list for selected day (incomplete only).
- [ ] T4.3 Render "Tasks to complete" list (scheduledDate < selected day).
- [ ] T4.4 Implement task row actions: complete/uncomplete, edit title.
- [ ] T4.5 Implement reschedule quick actions: today/tomorrow/+3d/+1w/pick date.

## Calendar day view (T5)
- [ ] T5.1 Build Calendar page day selector (prev/next + date tap).
- [ ] T5.2 Render appointments placeholder list (static mocked events).
- [ ] T5.3 Render scheduled tasks for that day.
- [ ] T5.4 Implement tap task -> edit sheet with scheduled date + recurrence summary.

## Recurrence engine (T6)
- [ ] T6.1 Implement series template convention: isSeriesTemplate + seriesId.
- [ ] T6.2 Implement `materializeWindow(startDay, endDay)` for all templates.
- [ ] T6.3 Ensure generation independent of completion (always generate occurrences).
- [ ] T6.4 Implement exception behavior: rescheduling changes instance only.
- [ ] T6.5 Add unit tests for: weekly interval, monthly day, monthly nth weekday, yearly.

## Time logging (T7)
- [ ] T7.1 Build ClockDrag.svelte (Skeleton-styled): pointer events -> angle -> minutes (15-min snap).
- [ ] T7.2 Support multiple rotations (track cumulative rotations).
- [ ] T7.3 Create Log Time sheet: date selector (today/yesterday/pick) + ClockDrag.
- [ ] T7.4 Persist time logs: create TimeLog entries with date + minutes.
- [ ] T7.5 Show per-task total for selected day (optional, minimal UI text).

## Reports (T8)
- [ ] T8.1 Create range picker: week/month/custom.
- [ ] T8.2 Aggregate minutes by project in range (Uncategorized bucket).
- [ ] T8.3 Aggregate minutes by tag in range.
- [ ] T8.4 Render list view + tap row -> breakdown-by-day view.

## Conflicts (T9)
- [ ] T9.1 Scan data dir for `*sync-conflict*` and non-canonical variants.
- [ ] T9.2 On save, detect "changed since load" and write would-save to conflicts/.
- [ ] T9.3 Implement Conflicts page listing each conflict candidate pair.
- [ ] T9.4 Implement actions: Use Local / Use Remote / Keep Both (archive loser).
- [ ] T9.5 Add Settings action: "Scan conflicts now".

## Google Calendar (read-only) (T10)
- [ ] T10.1 Implement auth flow (desktop) and store tokens securely.
- [ ] T10.2 Fetch events for day window and cache to calendar_cache.json.
- [ ] T10.3 Render cached events in Today + Calendar.
- [ ] T10.4 Add refresh interval (6h/12h) + manual refresh button.

## Hardening (T11)
- [ ] T11.1 JSON validation on load; show recoverable error UI.
- [ ] T11.2 Add export function (copy/zip canonical files + conflicts/).
- [ ] T11.3 Add "open data folder" convenience in Settings (desktop).
- [ ] T11.4 Wayland smoke test checklist + fixes (LabWC).

## v2 / day-two (explicit)
- [ ] V2.1 Theme switching UI between `ayu-skeleton.css` and `flexoki-skeleton.css`.
- [ ] V2.2 Device priority ("phone source of truth") + sync health UI.
- [ ] V2.3 Nested projects.
