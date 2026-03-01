# Task Hierarchy & Dependencies

## Status: Backlog (not urgent)

## Overview

Add parent/child hierarchy and "blocked by" dependencies to DayLight tasks.

`parentId` already exists in `TaskFrontmatter` but is unused. Dependencies need one new field.

## Schema

- Add `blockedBy: string[]` to `TaskFrontmatter` (filenames of blocking tasks)
- `parentId: string | null` already exists — just needs wiring up

### frontmatter.ts changes
- Add `blockedBy` to `TaskFrontmatter` interface
- Add `normalizeStringArray(raw.blockedBy)` in `normalizeFrontmatter()`
- Add serialization in `cleanFrontmatterForSerialization()`

## Store Layer

- `getChildren(filename)` — filter taskFiles Map for matching `parentId`
- `getBlockers(filename)` — resolve `blockedBy` filenames to task data
- `isBlocked(filename)` — true if any `blockedBy` task lacks today in `complete_instances`
- `setParent(childFilename, parentFilename)` — update `parentId`
- `addBlocker(filename, blockerFilename)` — append to `blockedBy`

## ViewService

- Children sort directly under their parent (tree walk)
- Blocked tasks render dimmed / can't be completed
- `getTaskDateGroup()` should treat blocked tasks specially (maybe a "Blocked" group, or just visual treatment within existing groups)

## UI

- Context menu: "Make child of..." → opens task picker
- Context menu: "Blocked by..." → opens task picker
- ViewTaskRow: indent for children, lock icon for blocked
- TaskEditModal: show parent + blockers, allow removal

## Design Decisions (TBD)

- Does completing a parent auto-complete children?
- Can recurring tasks have children?
- What happens when you delete a parent? (orphan children vs cascade)
- Circular dependency prevention
- Mobile UX for task picker (search? recent tasks?)

## Effort Estimate

| Layer | Size |
|-------|------|
| Schema | Trivial — one new array field |
| Store | Easy — Map lookups |
| ViewService | Medium — tree traversal, blocked filtering |
| UI (task picker) | Medium — needs new component |
| Edge cases | Medium — cycles, delete cascades, recurring interaction |
