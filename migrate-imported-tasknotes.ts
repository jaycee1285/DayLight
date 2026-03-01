#!/usr/bin/env bun
import { mkdir, readdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

type RawFrontmatter = Record<string, unknown>;

type TimeEntry = {
  date: string;
  minutes: number;
  note: string | null;
  createdAt: string;
};

type TaskFrontmatter = {
  status: 'open' | 'done' | 'cancelled';
  priority: 'none' | 'low' | 'normal' | 'high';
  scheduled: string | null;
  due: string | null;
  startTime: string | null;
  plannedDuration: number | null;
  tags: string[];
  contexts: string[];
  projects: string[];
  recurrence: string | null;
  recurrence_anchor: 'scheduled' | 'completion';
  active_instances: string[];
  complete_instances: string[];
  skipped_instances: string[];
  rescheduled_instances: Record<string, string>;
  seriesId: string | null;
  isSeriesTemplate: boolean;
  parentId: string | null;
  habit_type?: 'check' | 'target' | 'limit' | null;
  habit_goal?: number | null;
  habit_unit?: string | null;
  habit_target_days?: number | null;
  habit_entries?: Record<string, number>;
  timeEntries: TimeEntry[];
  dateCreated: string;
  dateModified: string;
  completedAt: string | null;
};

type ImportedIndexRecord = {
  id: string;
  title: string;
  project?: string | null;
  tags?: string[];
  created?: string | null;
  doneOn?: string | null;
  dueDay?: string | null;
  timeSpentMinutes?: number;
  timeByDay?: Array<{ date?: string; minutes?: number }>;
  notes?: string | null;
};

type ParsedMarkdown = {
  frontmatter: RawFrontmatter;
  body: string;
};

type ImportedOccurrence = {
  sourceFilename: string;
  sourcePath: string;
  title: string;
  canonicalFilename: string;
  body: string;
  frontmatter: TaskFrontmatter;
  completionDate: string | null;
};

type ExistingTask = {
  filename: string;
  path: string;
  body: string;
  frontmatter: TaskFrontmatter;
};

const ROOT = '/home/john/syncthing/TaskNotes';
const IMPORTED_DIR = join(ROOT, 'Imported');
const TASKS_DIR = join(ROOT, 'Tasks');
const INDEX_PATH = join(IMPORTED_DIR, '_tasks.json');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_DIR = join(ROOT, '.migration-backups', TIMESTAMP);
const BACKUP_IMPORTED_DIR = join(BACKUP_DIR, 'Imported');
const BACKUP_TASKS_DIR = join(BACKUP_DIR, 'Tasks');
const WORK_DIR = join(IMPORTED_DIR, `.migration-work-${TIMESTAMP}`);
const WORK_SAME_DIR = join(WORK_DIR, 'same');
const WORK_UNIQUE_DIR = join(WORK_DIR, 'unique');
const LOG_PATH = join(WORK_DIR, 'migration.log');

const args = new Set(process.argv.slice(2));
const WRITE = args.has('--write');
const VERBOSE = args.has('--verbose');

const logLines: string[] = [];

function log(line = ''): void {
  logLines.push(line);
  console.log(line);
}

function verbose(line: string): void {
  if (VERBOSE) log(line);
}

function ensureArrayStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeStatus(value: unknown): 'open' | 'done' | 'cancelled' {
  if (value === 'done') return 'done';
  if (value === 'cancelled') return 'cancelled';
  if (value === 'todo') return 'open';
  if (value === 'open') return 'open';
  return 'open';
}

function normalizePriority(value: unknown): 'none' | 'low' | 'normal' | 'high' {
  if (value === 'low' || value === 'normal' || value === 'high') return value;
  return 'none';
}

function toDateOnly(value: unknown): string | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function dateOnlyToIso(value: string | null, endOfDay = false): string | null {
  if (!value) return null;
  return `${value}T${endOfDay ? '18:00:00.000Z' : '12:00:00.000Z'}`;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return dateOnlyToIso(value);
  }
  return null;
}

function generateTaskFilename(title: string): string {
  let sanitized = title
    .trim()
    .replace(/\.md$/i, '')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 200);
  if (!sanitized) sanitized = 'Untitled';
  return `${sanitized}.md`;
}

function parseMarkdown(content: string): ParsedMarkdown | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  try {
    return {
      frontmatter: (parseYaml(match[1]) as RawFrontmatter) ?? {},
      body: (match[2] ?? '').trim()
    };
  } catch {
    return null;
  }
}

function cleanFrontmatterForSerialization(fm: TaskFrontmatter): Record<string, unknown> {
  const result: Record<string, unknown> = {
    status: fm.status,
    priority: fm.priority,
    dateCreated: fm.dateCreated,
    dateModified: fm.dateModified
  };

  if (fm.scheduled) result.scheduled = fm.scheduled;
  if (fm.due) result.due = fm.due;
  if (fm.startTime) result.startTime = fm.startTime;
  if (fm.plannedDuration) result.plannedDuration = fm.plannedDuration;
  if (fm.completedAt) result.completedAt = fm.completedAt;
  if (fm.tags.length) result.tags = fm.tags;
  if (fm.contexts.length) result.contexts = fm.contexts;
  if (fm.projects.length) result.projects = fm.projects;
  if (fm.recurrence) {
    result.recurrence = fm.recurrence;
    result.recurrence_anchor = fm.recurrence_anchor;
  }
  if (fm.active_instances.length) result.active_instances = fm.active_instances;
  if (fm.complete_instances.length) result.complete_instances = fm.complete_instances;
  if (fm.skipped_instances.length) result.skipped_instances = fm.skipped_instances;
  if (Object.keys(fm.rescheduled_instances).length) result.rescheduled_instances = fm.rescheduled_instances;
  if (fm.seriesId) result.seriesId = fm.seriesId;
  if (fm.isSeriesTemplate) result.isSeriesTemplate = fm.isSeriesTemplate;
  if (fm.parentId) result.parentId = fm.parentId;
  if (fm.habit_type) result.habit_type = fm.habit_type;
  if (fm.habit_goal) result.habit_goal = fm.habit_goal;
  if (fm.habit_unit) result.habit_unit = fm.habit_unit;
  if (fm.habit_target_days) result.habit_target_days = fm.habit_target_days;
  if (fm.habit_entries && Object.keys(fm.habit_entries).length) result.habit_entries = fm.habit_entries;
  if (fm.timeEntries.length) result.timeEntries = fm.timeEntries;

  return result;
}

function serializeMarkdown(frontmatter: TaskFrontmatter, body: string): string {
  const yaml = stringifyYaml(cleanFrontmatterForSerialization(frontmatter), {
    indent: 2,
    lineWidth: 0,
    nullStr: '',
    defaultKeyType: 'PLAIN',
    defaultStringType: 'PLAIN'
  });
  const bodyContent = body.trim();
  return `---\n${yaml}---${bodyContent ? `\n${bodyContent}` : ''}\n`;
}

function normalizeProjects(value: unknown, fallbackProject?: string | null): string[] {
  const arr = ensureArrayStrings(value);
  if (arr.length) return arr.filter((project) => project !== '[[Inbox]]' && project !== 'Inbox');
  if (typeof fallbackProject === 'string' && fallbackProject !== 'Inbox' && fallbackProject.trim()) {
    return [fallbackProject.trim()];
  }
  return [];
}

function normalizeTimeEntries(value: unknown): TimeEntry[] {
  if (!Array.isArray(value)) return [];
  const results: TimeEntry[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Record<string, unknown>;
    if (raw.date || raw.minutes) {
      const date = toDateOnly(raw.date);
      const minutes = typeof raw.minutes === 'number' ? raw.minutes : Number(raw.minutes ?? 0);
      if (date && minutes > 0) {
        results.push({
          date,
          minutes,
          note: typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : null,
          createdAt: normalizeTimestamp(raw.createdAt) ?? dateOnlyToIso(date)!
        });
      }
      continue;
    }

    if (raw.startTime || raw.duration) {
      const createdAt = normalizeTimestamp(raw.startTime);
      const date = createdAt?.slice(0, 10) ?? null;
      const minutes = typeof raw.duration === 'number' ? raw.duration : Number(raw.duration ?? 0);
      if (date && minutes > 0) {
        results.push({
          date,
          minutes,
          note: typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : null,
          createdAt
        });
      }
    }
  }
  return results;
}

function convertTimeByDay(value: ImportedIndexRecord['timeByDay']): TimeEntry[] {
  if (!Array.isArray(value)) return [];
  const results: TimeEntry[] = [];
  for (const item of value) {
    const date = toDateOnly(item?.date);
    const minutes = typeof item?.minutes === 'number' ? item.minutes : Number(item?.minutes ?? 0);
    if (!date || minutes <= 0) continue;
    results.push({
      date,
      minutes,
      note: null,
      createdAt: dateOnlyToIso(date)!
    });
  }
  return results;
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())).map((value) => value.trim()))].sort();
}

function dedupeTimeEntries(entries: TimeEntry[]): TimeEntry[] {
  const byKey = new Map<string, TimeEntry>();
  for (const entry of entries) {
    const key = `${entry.date}|${entry.minutes}|${entry.note ?? ''}`;
    const existing = byKey.get(key);
    if (!existing || entry.createdAt < existing.createdAt) {
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

function combineBodies(bodies: string[]): string {
  const cleaned = [...new Set(bodies.map((body) => body.trim()).filter(Boolean))];
  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) return cleaned[0];
  return cleaned.join('\n\n---\n\n');
}

function normalizeExistingFrontmatter(raw: RawFrontmatter): TaskFrontmatter {
  const status = normalizeStatus(raw.status);
  const scheduled = toDateOnly(raw.scheduled);
  const due = toDateOnly(raw.due);
  const completedAt = normalizeTimestamp(raw.completedAt);
  return {
    status,
    priority: normalizePriority(raw.priority),
    scheduled,
    due,
    startTime: typeof raw.startTime === 'string' ? raw.startTime : null,
    plannedDuration: typeof raw.plannedDuration === 'number' ? raw.plannedDuration : null,
    tags: dedupeStrings(['task', ...ensureArrayStrings(raw.tags)]),
    contexts: dedupeStrings(ensureArrayStrings(raw.contexts)),
    projects: normalizeProjects(raw.projects, typeof raw.project === 'string' ? raw.project : null),
    recurrence: typeof raw.recurrence === 'string' && raw.recurrence.trim() ? raw.recurrence : null,
    recurrence_anchor: raw.recurrence_anchor === 'completion' ? 'completion' : 'scheduled',
    active_instances: dedupeStrings(ensureArrayStrings(raw.active_instances)),
    complete_instances: dedupeStrings(ensureArrayStrings(raw.complete_instances)),
    skipped_instances: dedupeStrings(ensureArrayStrings(raw.skipped_instances)),
    rescheduled_instances: raw.rescheduled_instances && typeof raw.rescheduled_instances === 'object' && !Array.isArray(raw.rescheduled_instances)
      ? Object.fromEntries(Object.entries(raw.rescheduled_instances as Record<string, unknown>).filter(([key, value]) => toDateOnly(key) && toDateOnly(value))) as Record<string, string>
      : {},
    seriesId: typeof raw.seriesId === 'string' && raw.seriesId.trim() ? raw.seriesId : null,
    isSeriesTemplate: Boolean(raw.isSeriesTemplate),
    parentId: typeof raw.parentId === 'string' && raw.parentId.trim() ? raw.parentId : null,
    habit_type: raw.habit_type === 'check' || raw.habit_type === 'target' || raw.habit_type === 'limit' ? raw.habit_type : null,
    habit_goal: typeof raw.habit_goal === 'number' ? raw.habit_goal : null,
    habit_unit: typeof raw.habit_unit === 'string' && raw.habit_unit.trim() ? raw.habit_unit : null,
    habit_target_days: typeof raw.habit_target_days === 'number' ? raw.habit_target_days : null,
    habit_entries: raw.habit_entries && typeof raw.habit_entries === 'object' && !Array.isArray(raw.habit_entries) ? raw.habit_entries as Record<string, number> : {},
    timeEntries: dedupeTimeEntries(normalizeTimeEntries(raw.timeEntries)),
    dateCreated: normalizeTimestamp(raw.dateCreated) ?? new Date().toISOString(),
    dateModified: normalizeTimestamp(raw.dateModified) ?? normalizeTimestamp(raw.dateCreated) ?? new Date().toISOString(),
    completedAt
  };
}

function buildImportedOccurrence(record: ImportedIndexRecord, parsed: ParsedMarkdown | null, sourcePath: string): ImportedOccurrence {
  const raw = parsed?.frontmatter ?? {};
  const title = (record.title || (typeof raw.title === 'string' ? raw.title : '') || basename(sourcePath).replace(/-[^-]+\.md$/, '')).trim();
  const canonicalFilename = generateTaskFilename(title);
  const completionDate = toDateOnly(record.doneOn) ?? toDateOnly(raw.dateCompleted) ?? (normalizeStatus(raw.status) === 'done' ? toDateOnly(raw.due) : null);
  const completeInstances = completionDate ? [completionDate] : [];
  const rawLegacyTimeEntries = normalizeTimeEntries(raw.timeEntries);
  const indexTimeEntries = convertTimeByDay(record.timeByDay);
  const notesBody = typeof record.notes === 'string' ? record.notes.trim() : '';
  const fileBody = parsed?.body?.trim() ?? '';
  const body = fileBody || notesBody;
  const createdDate = toDateOnly(record.created) ?? toDateOnly(raw.dateCreated) ?? completionDate;
  const createdAt = normalizeTimestamp(raw.dateCreated) ?? dateOnlyToIso(createdDate) ?? new Date().toISOString();
  const completedAt = dateOnlyToIso(completionDate, true) ?? normalizeTimestamp(raw.dateCompleted);
  const modifiedAt = completedAt ?? createdAt;
  const frontmatter: TaskFrontmatter = {
    status: completionDate ? 'done' : normalizeStatus(raw.status),
    priority: normalizePriority(raw.priority),
    scheduled: toDateOnly(record.dueDay) ?? toDateOnly(raw.scheduled) ?? completionDate,
    due: toDateOnly(record.dueDay) ?? toDateOnly(raw.due),
    startTime: typeof raw.startTime === 'string' ? raw.startTime : null,
    plannedDuration: typeof raw.plannedDuration === 'number' ? raw.plannedDuration : null,
    tags: dedupeStrings(['task', ...ensureArrayStrings(raw.tags), ...(record.tags ?? [])]),
    contexts: dedupeStrings(ensureArrayStrings(raw.contexts)),
    projects: normalizeProjects(raw.projects, record.project ?? null),
    recurrence: typeof raw.recurrence === 'string' && raw.recurrence.trim() ? raw.recurrence : null,
    recurrence_anchor: raw.recurrence_anchor === 'completion' ? 'completion' : 'scheduled',
    active_instances: dedupeStrings(ensureArrayStrings(raw.active_instances)),
    complete_instances: completeInstances,
    skipped_instances: dedupeStrings(ensureArrayStrings(raw.skipped_instances)),
    rescheduled_instances: {},
    seriesId: typeof raw.seriesId === 'string' && raw.seriesId.trim() ? raw.seriesId : null,
    isSeriesTemplate: Boolean(raw.isSeriesTemplate),
    parentId: typeof raw.parentId === 'string' && raw.parentId.trim() ? raw.parentId : null,
    timeEntries: dedupeTimeEntries([...rawLegacyTimeEntries, ...indexTimeEntries]),
    dateCreated: createdAt,
    dateModified: modifiedAt,
    completedAt
  };

  return {
    sourceFilename: basename(sourcePath),
    sourcePath,
    title,
    canonicalFilename,
    body,
    frontmatter,
    completionDate
  };
}

function mergeOccurrencesIntoFrontmatter(base: TaskFrontmatter, occurrences: ImportedOccurrence[]): TaskFrontmatter {
  const merged: TaskFrontmatter = {
    ...base,
    tags: dedupeStrings([...base.tags, ...occurrences.flatMap((occurrence) => occurrence.frontmatter.tags)]),
    projects: dedupeStrings([...base.projects, ...occurrences.flatMap((occurrence) => occurrence.frontmatter.projects)]),
    complete_instances: dedupeStrings([...base.complete_instances, ...occurrences.flatMap((occurrence) => occurrence.frontmatter.complete_instances)]),
    timeEntries: dedupeTimeEntries([...base.timeEntries, ...occurrences.flatMap((occurrence) => occurrence.frontmatter.timeEntries)]),
    dateCreated: [base.dateCreated, ...occurrences.map((occurrence) => occurrence.frontmatter.dateCreated)].sort()[0] ?? base.dateCreated,
    dateModified: [base.dateModified, ...occurrences.map((occurrence) => occurrence.frontmatter.dateModified)].sort().at(-1) ?? base.dateModified,
    completedAt: base.status === 'done'
      ? base.completedAt ?? occurrences.map((occurrence) => occurrence.frontmatter.completedAt).filter(Boolean).sort().at(-1) ?? null
      : base.completedAt
  };

  if (merged.status === 'done' && !merged.completedAt && merged.complete_instances.length) {
    merged.completedAt = dateOnlyToIso(merged.complete_instances.at(-1) ?? null, true);
  }

  return merged;
}

async function loadImportedIndex(): Promise<Map<string, ImportedIndexRecord>> {
  const records = JSON.parse(await readFile(INDEX_PATH, 'utf8')) as ImportedIndexRecord[];
  return new Map(records.map((record) => [record.id, record]));
}

async function loadImportedOccurrences(indexMap: Map<string, ImportedIndexRecord>): Promise<Map<string, ImportedOccurrence[]>> {
  const entries = await readdir(IMPORTED_DIR, { withFileTypes: true });
  const byTitle = new Map<string, ImportedOccurrence[]>();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const sourcePath = join(IMPORTED_DIR, entry.name);
    const content = await readFile(sourcePath, 'utf8');
    const parsed = parseMarkdown(content);
    const uid = typeof parsed?.frontmatter.uid === 'string' ? parsed.frontmatter.uid : null;
    const id = uid?.startsWith('sp-') ? uid.slice(3) : uid;
    if (!id) {
      log(`WARN missing uid in imported file: ${entry.name}`);
      continue;
    }
    const record = indexMap.get(id);
    if (!record) {
      log(`WARN no _tasks.json match for imported file: ${entry.name} (${id})`);
      continue;
    }
    const occurrence = buildImportedOccurrence(record, parsed, sourcePath);
    const key = occurrence.canonicalFilename.toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(occurrence);
  }

  for (const occurrences of byTitle.values()) {
    occurrences.sort((a, b) => (a.completionDate ?? a.frontmatter.dateCreated).localeCompare(b.completionDate ?? b.frontmatter.dateCreated));
  }

  return byTitle;
}

async function loadExistingTasks(): Promise<Map<string, ExistingTask>> {
  const entries = await readdir(TASKS_DIR, { withFileTypes: true });
  const map = new Map<string, ExistingTask>();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const path = join(TASKS_DIR, entry.name);
    const content = await readFile(path, 'utf8');
    const parsed = parseMarkdown(content);
    const frontmatter = parsed ? normalizeExistingFrontmatter(parsed.frontmatter) : normalizeExistingFrontmatter({});
    const body = parsed?.body ?? '';
    map.set(entry.name.toLowerCase(), { filename: entry.name, path, body, frontmatter });
  }
  return map;
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function backupFile(source: string, destinationDir: string): Promise<void> {
  await ensureDir(destinationDir);
  await copyFile(source, join(destinationDir, basename(source)));
}

async function writeLog(): Promise<void> {
  await ensureDir(WORK_DIR);
  await writeFile(LOG_PATH, `${logLines.join('\n')}\n`, 'utf8');
}

async function main(): Promise<void> {
  log(`Imported TaskNotes migration ${WRITE ? '(WRITE)' : '(DRY RUN)'}`);
  log(`Root: ${ROOT}`);
  log(`Work dir: ${WORK_DIR}`);

  const indexMap = await loadImportedIndex();
  log(`Imported index records: ${indexMap.size}`);

  const importedGroups = await loadImportedOccurrences(indexMap);
  log(`Imported title groups: ${importedGroups.size}`);

  const existingTasks = await loadExistingTasks();
  log(`Current task files: ${existingTasks.size}`);

  const stagedSame = new Map<string, ImportedOccurrence[]>();
  const archiveOutputs = new Map<string, { frontmatter: TaskFrontmatter; body: string; occurrences: ImportedOccurrence[] }>();
  const taskMerges = new Map<string, { task: ExistingTask; mergedFrontmatter: TaskFrontmatter; occurrences: ImportedOccurrence[] }>();

  for (const [filenameKey, occurrences] of importedGroups) {
    const existing = existingTasks.get(filenameKey);
    if (existing) {
      const mergedFrontmatter = mergeOccurrencesIntoFrontmatter(existing.frontmatter, occurrences);
      taskMerges.set(filenameKey, { task: existing, mergedFrontmatter, occurrences });
      stagedSame.set(filenameKey, occurrences);
      continue;
    }

    const base = occurrences[0].frontmatter;
    const aggregatedFrontmatter = mergeOccurrencesIntoFrontmatter(base, occurrences.slice(1));
    archiveOutputs.set(filenameKey, {
      frontmatter: aggregatedFrontmatter,
      body: combineBodies(occurrences.map((occurrence) => occurrence.body)),
      occurrences
    });

    if (occurrences.length > 1) stagedSame.set(filenameKey, occurrences);
  }

  log(`Task merges: ${taskMerges.size}`);
  log(`Archive outputs: ${archiveOutputs.size}`);
  log(`Staged grouped titles: ${stagedSame.size}`);

  if (!WRITE) {
    for (const [key, merge] of taskMerges) {
      verbose(`MERGE ${merge.task.filename} <= ${merge.occurrences.length} imported occurrence(s)`);
      verbose(`  complete_instances: +${merge.mergedFrontmatter.complete_instances.length - merge.task.frontmatter.complete_instances.length}`);
      verbose(`  timeEntries: +${merge.mergedFrontmatter.timeEntries.length - merge.task.frontmatter.timeEntries.length}`);
    }
    for (const [key, archive] of archiveOutputs) {
      verbose(`ARCHIVE ${archive.occurrences[0].canonicalFilename} from ${archive.occurrences.length} imported occurrence(s)`);
    }
    await writeLog();
    log(`Dry run complete. Log: ${LOG_PATH}`);
    return;
  }

  await ensureDir(BACKUP_IMPORTED_DIR);
  await ensureDir(BACKUP_TASKS_DIR);
  await ensureDir(WORK_SAME_DIR);
  await ensureDir(WORK_UNIQUE_DIR);

  // Backup imported md files before rewriting.
  const importedEntries = await readdir(IMPORTED_DIR, { withFileTypes: true });
  for (const entry of importedEntries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      await backupFile(join(IMPORTED_DIR, entry.name), BACKUP_IMPORTED_DIR);
    }
  }

  // Backup touched tasks.
  for (const { task } of taskMerges.values()) {
    await backupFile(task.path, BACKUP_TASKS_DIR);
  }

  // Clear top-level imported md files; _tasks.json and dirs stay.
  for (const entry of importedEntries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      await rm(join(IMPORTED_DIR, entry.name));
    }
  }

  // Write grouped staged occurrences for audit.
  for (const occurrences of stagedSame.values()) {
    const titleDir = join(WORK_SAME_DIR, occurrences[0].canonicalFilename.replace(/\.md$/, ''));
    await ensureDir(titleDir);
    for (const occurrence of occurrences) {
      const content = serializeMarkdown(occurrence.frontmatter, occurrence.body);
      await writeFile(join(titleDir, occurrence.sourceFilename), content, 'utf8');
    }
  }

  // Write flattened archive files back to Imported/ and stage uniques for inspection.
  for (const archive of archiveOutputs.values()) {
    const filename = archive.occurrences[0].canonicalFilename;
    const content = serializeMarkdown(archive.frontmatter, archive.body);
    await writeFile(join(IMPORTED_DIR, filename), content, 'utf8');
    await writeFile(join(WORK_UNIQUE_DIR, filename), content, 'utf8');
  }

  // Rewrite merged current tasks.
  for (const merge of taskMerges.values()) {
    const content = serializeMarkdown(merge.mergedFrontmatter, merge.task.body);
    await writeFile(merge.task.path, content, 'utf8');
  }

  await writeLog();
  log(`Write complete. Backup: ${BACKUP_DIR}`);
  log(`Log: ${LOG_PATH}`);
}

main().catch(async (error) => {
  log(`FATAL ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  await writeLog();
  process.exit(1);
});
