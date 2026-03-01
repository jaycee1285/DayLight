# Imported TaskNotes Migration Report

Status: staged only, non-destructive dry run complete.

What exists now:
- Dry-run importer: `/home/john/repos/DayLight/migrate-imported-tasknotes.ts`
- Latest staged workdir: `/home/john/syncthing/TaskNotes/Imported/.migration-work-2026-03-01T00-07-05-402Z`
- Latest dry-run log: `/home/john/syncthing/TaskNotes/Imported/.migration-work-2026-03-01T00-07-05-402Z/migration.log`

What the script currently does:
- Reads `/home/john/syncthing/TaskNotes/Imported/_tasks.json`
- Normalizes imported markdown plus index records into DayLight-style frontmatter
- Groups imported history by canonical title filename
- Detects matches against current `/home/john/syncthing/TaskNotes/Tasks/*.md`
- Plans merges into current tasks by appending `complete_instances` and `timeEntries`
- Plans archive outputs for unmatched titles back into `Imported/`
- Stages grouped duplicate-title histories for audit because many are recurrence-like

Current dry-run summary:
- Imported index records: `1815`
- Imported title groups: `577`
- Current task files: `228`
- Planned task merges: `32`
- Planned archive outputs: `545`
- Staged grouped titles: `82`

Important interpretation:
- Many repeated imported titles are routine-like and probably belong to recurrence-aware canonical tasks.
- The current script is intentionally conservative: it stages and reports rather than mutating the vault.
- The next safe step is reviewing the staged grouped-title buckets before allowing write mode.

Suggested execution path later:
1. Review the grouped directories under the staged workdir `same/`.
2. Confirm which recurring-like titles should merge into canonical current tasks.
3. Run the importer in `--write` mode only after that review.

Notes:
- This report reflects the current importer behavior, not a completed migration.
- No imported markdown or live task files were changed in the latest dry run.
