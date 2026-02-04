#!/usr/bin/env bun
/**
 * SP → SPRedux Markdown Migration Script
 *
 * Reads the Super Productivity __meta_ database and converts all task data
 * to SPRedux's markdown+YAML frontmatter format.
 *
 * Usage:
 *   bun run migrate-sp.ts              # dry-run (default)
 *   bun run migrate-sp.ts --write      # execute migration
 *   bun run migrate-sp.ts --verbose    # detailed per-file output
 */

import { readdir, stat, cp, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SPTask {
	id: string;
	title: string;
	isDone: boolean;
	created: number; // ms timestamp
	modified?: number;
	doneOn?: number;
	projectId?: string;
	tagIds?: string[];
	subTaskIds?: string[];
	parentId?: string;
	dueDay?: string; // YYYY-MM-DD
	timeSpent?: number; // ms
	timeSpentOnDay?: Record<string, number>; // date → ms
	timeEstimate?: number; // ms
	notes?: string; // may contain HTML
	repeatCfgId?: string;
	attachments?: unknown[];
	issueType?: string;
	issueProviderId?: string;
	issueId?: string;
	issueWasUpdated?: boolean;
	issueLastUpdated?: number;
}

interface SPRepeatCfg {
	id: string;
	title: string;
	projectId?: string;
	tagIds?: string[];
	startDate: string; // YYYY-MM-DD
	repeatCycle: string; // DAILY, WEEKLY, MONTHLY, YEARLY
	repeatEvery: number;
	isPaused: boolean;
	quickSetting?: string;
	defaultEstimate?: number;
	monday?: boolean;
	tuesday?: boolean;
	wednesday?: boolean;
	thursday?: boolean;
	friday?: boolean;
	saturday?: boolean;
	sunday?: boolean;
	lastTaskCreation?: number;
	lastTaskCreationDay?: string;
	order?: number;
}

interface SPEntityStore<T> {
	ids: string[];
	entities: Record<string, T>;
}

interface SPProject {
	id: string;
	title: string;
}

interface SPTag {
	id: string;
	title: string;
}

interface SPMainModelData {
	task: SPEntityStore<SPTask>;
	project: SPEntityStore<SPProject>;
	tag: SPEntityStore<SPTag>;
	taskRepeatCfg: SPEntityStore<SPRepeatCfg>;
}

interface SPData {
	mainModelData: SPMainModelData;
	crossModelVersion: number;
	lastUpdate: number;
}

interface TaskFrontmatter {
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
	timeEntries: TimeEntry[];
	dateCreated: string;
	dateModified: string;
	completedAt: string | null;
}

interface TimeEntry {
	date: string;
	minutes: number;
	note: string | null;
	createdAt: string;
}

interface ImportedFile {
	filename: string;
	spId: string; // extracted from uid field
	body: string;
	rawFrontmatter: Record<string, unknown>;
}

interface QueuedWrite {
	filepath: string;
	content: string;
	action: 'rewrite' | 'create';
	title: string;
}

interface ConversionError {
	filename: string;
	error: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SP_META_PATH = join(process.env.HOME!, 'Sync/SP/__meta_');
const IMPORTED_PATH = join(process.env.HOME!, 'Sync/JMC/TaskNotes/Imported');
const TASKS_PATH = join(process.env.HOME!, 'Sync/JMC/TaskNotes/Tasks');
const BACKUP_PATH = join(process.env.HOME!, 'Sync/JMC/TaskNotes/Imported.bak');

const SP_PREFIX_LENGTH = 8; // "pf_4.4__"

const SYSTEM_TAGS = new Set(['TODAY', 'KANBAN_IN_PROGRESS']);
const PRIORITY_TAGS = new Set(['EM_IMPORTANT', 'EM_URGENT']);

// ─── SP Data Parsing ─────────────────────────────────────────────────────────

async function parseSPData(): Promise<SPData> {
	const raw = await Bun.file(SP_META_PATH).text();
	const json = raw.slice(SP_PREFIX_LENGTH);
	return JSON.parse(json) as SPData;
}

interface LookupMaps {
	tagMap: Map<string, string>; // id → name
	projectMap: Map<string, string>; // id → name
	repeatCfgMap: Map<string, SPRepeatCfg>; // id → config
}

function buildLookupMaps(sp: SPData): LookupMaps {
	const tagMap = new Map<string, string>();
	for (const [id, tag] of Object.entries(sp.mainModelData.tag.entities)) {
		tagMap.set(id, tag.title);
	}

	const projectMap = new Map<string, string>();
	for (const [id, proj] of Object.entries(sp.mainModelData.project.entities)) {
		projectMap.set(id, proj.title);
	}

	const repeatCfgMap = new Map<string, SPRepeatCfg>();
	for (const [id, cfg] of Object.entries(sp.mainModelData.taskRepeatCfg.entities)) {
		repeatCfgMap.set(id, cfg);
	}

	return { tagMap, projectMap, repeatCfgMap };
}

// ─── Imported File Scanning ──────────────────────────────────────────────────

async function scanImportedFiles(): Promise<Map<string, ImportedFile>> {
	const result = new Map<string, ImportedFile>();
	const entries = await readdir(IMPORTED_PATH);

	for (const entry of entries) {
		if (!entry.endsWith('.md')) continue;

		const filepath = join(IMPORTED_PATH, entry);
		const content = await Bun.file(filepath).text();
		const parsed = parseRawFrontmatter(content);
		if (!parsed) continue;

		const uid = parsed.frontmatter.uid as string | undefined;
		if (!uid || typeof uid !== 'string') continue;

		// Strip 'sp-' prefix to get SP task ID
		const spId = uid.startsWith('sp-') ? uid.slice(3) : uid;

		result.set(spId, {
			filename: entry,
			spId,
			body: parsed.body,
			rawFrontmatter: parsed.frontmatter
		});
	}

	return result;
}

function parseRawFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } | null {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) return null;

	try {
		const { parse: parseYaml } = require('yaml');
		const frontmatter = parseYaml(match[1]) as Record<string, unknown>;
		return { frontmatter, body: match[2]?.trim() || '' };
	} catch {
		return null;
	}
}

async function scanTasksFiles(): Promise<Set<string>> {
	const result = new Set<string>();
	const entries = await readdir(TASKS_PATH);
	for (const entry of entries) {
		if (entry.endsWith('.md')) {
			// Store lowercase filename (without .md) for fuzzy matching
			result.add(entry.toLowerCase().replace(/\.md$/, ''));
		}
	}
	return result;
}

// ─── Field Conversion ────────────────────────────────────────────────────────

function msToISO(ms: number): string {
	return new Date(ms).toISOString();
}

function msToDate(ms: number): string {
	return new Date(ms).toISOString().split('T')[0];
}

function mapSPTags(tagIds: string[] | undefined, tagMap: Map<string, string>): string[] {
	if (!tagIds || tagIds.length === 0) return ['task'];

	const tags = new Set<string>(['task']);
	for (const id of tagIds) {
		if (SYSTEM_TAGS.has(id) || PRIORITY_TAGS.has(id)) continue;
		const name = tagMap.get(id);
		if (name) tags.add(name.toLowerCase());
	}

	return [...tags];
}

function mapSPPriority(tagIds: string[] | undefined): 'none' | 'low' | 'normal' | 'high' {
	if (!tagIds) return 'none';
	for (const id of tagIds) {
		if (PRIORITY_TAGS.has(id)) return 'high';
	}
	return 'none';
}

function mapSPProject(projectId: string | undefined, projectMap: Map<string, string>): string[] {
	if (!projectId) return [];
	const name = projectMap.get(projectId);
	if (!name || name === 'Inbox') return [];
	return [name];
}

function convertTimeSpentOnDay(timeSpentOnDay: Record<string, number> | undefined): TimeEntry[] {
	if (!timeSpentOnDay) return [];

	const entries: TimeEntry[] = [];
	for (const [date, ms] of Object.entries(timeSpentOnDay)) {
		const minutes = Math.round(ms / 60000);
		if (minutes <= 0) continue;

		entries.push({
			date,
			minutes,
			note: null,
			createdAt: `${date}T12:00:00.000Z`
		});
	}

	entries.sort((a, b) => a.date.localeCompare(b.date));
	return entries;
}

function convertRepeatCfgToRRule(cfg: SPRepeatCfg): string {
	const parts: string[] = [];

	// DTSTART
	parts.push(`DTSTART:${cfg.startDate.replace(/-/g, '')}`);

	// FREQ
	parts.push(`FREQ=${cfg.repeatCycle}`);

	// INTERVAL
	if (cfg.repeatEvery > 1) {
		parts.push(`INTERVAL=${cfg.repeatEvery}`);
	}

	// BYDAY for weekly
	if (cfg.repeatCycle === 'WEEKLY') {
		const dayMap: [string, string][] = [
			['monday', 'MO'],
			['tuesday', 'TU'],
			['wednesday', 'WE'],
			['thursday', 'TH'],
			['friday', 'FR'],
			['saturday', 'SA'],
			['sunday', 'SU']
		];
		const days = dayMap
			.filter(([key]) => (cfg as Record<string, unknown>)[key] === true)
			.map(([, abbr]) => abbr);
		if (days.length > 0) {
			parts.push(`BYDAY=${days.join(',')}`);
		}
	}

	// BYMONTHDAY for monthly
	if (cfg.repeatCycle === 'MONTHLY') {
		const day = parseInt(cfg.startDate.split('-')[2], 10);
		parts.push(`BYMONTHDAY=${day}`);
	}

	return parts.join(';');
}

function convertHTMLToMarkdown(html: string): string {
	if (!html || !html.trim()) return '';

	let md = html;

	// Convert links
	md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

	// Convert paragraphs
	md = md.replace(/<\/p>\s*<p>/gi, '\n\n');
	md = md.replace(/<p>/gi, '');
	md = md.replace(/<\/p>/gi, '\n');

	// Convert lists
	md = md.replace(/<\/li>\s*<li>/gi, '\n- ');
	md = md.replace(/<ul[^>]*>\s*<li>/gi, '\n- ');
	md = md.replace(/<\/li>\s*<\/ul>/gi, '\n');
	md = md.replace(/<ul[^>]*>/gi, '');
	md = md.replace(/<\/ul>/gi, '');
	md = md.replace(/<li>/gi, '- ');
	md = md.replace(/<\/li>/gi, '\n');

	// Line breaks
	md = md.replace(/<br\s*\/?>/gi, '\n');

	// Strip remaining tags
	md = md.replace(/<[^>]+>/g, '');

	// Decode HTML entities
	md = md.replace(/&amp;/g, '&');
	md = md.replace(/&lt;/g, '<');
	md = md.replace(/&gt;/g, '>');
	md = md.replace(/&quot;/g, '"');
	md = md.replace(/&nbsp;/g, ' ');

	// Clean up multiple blank lines
	md = md.replace(/\n{3,}/g, '\n\n');

	return md.trim();
}

// ─── Core Conversion ─────────────────────────────────────────────────────────

function convertSPTask(
	spTask: SPTask,
	lookups: LookupMaps,
	existingBody?: string
): { frontmatter: TaskFrontmatter; body: string } {
	const status = spTask.isDone ? 'done' : 'open';
	const priority = mapSPPriority(spTask.tagIds);
	const tags = mapSPTags(spTask.tagIds, lookups.tagMap);
	const projects = mapSPProject(spTask.projectId, lookups.projectMap);
	const timeEntries = convertTimeSpentOnDay(spTask.timeSpentOnDay);

	const plannedMinutes = spTask.timeEstimate ? Math.round(spTask.timeEstimate / 60000) : null;

	// Notes → body. Prefer existing body if it has content; otherwise convert SP notes.
	let body = '';
	if (existingBody && existingBody.trim()) {
		body = existingBody;
	} else if (spTask.notes && spTask.notes.trim()) {
		body = convertHTMLToMarkdown(spTask.notes);
	}

	const now = new Date().toISOString();

	const frontmatter: TaskFrontmatter = {
		status,
		priority,
		scheduled: spTask.dueDay || null,
		due: status === 'open' && spTask.dueDay ? spTask.dueDay : null,
		startTime: null,
		plannedDuration: plannedMinutes && plannedMinutes > 0 ? plannedMinutes : null,
		tags,
		contexts: [],
		projects,
		recurrence: null, // Recurring instances are plain tasks; templates exist in Tasks/
		recurrence_anchor: 'scheduled',
		active_instances: [],
		complete_instances: [],
		skipped_instances: [],
		rescheduled_instances: {},
		seriesId: null,
		isSeriesTemplate: false,
		parentId: null, // Resolved in Phase 3
		timeEntries,
		dateCreated: spTask.created ? msToISO(spTask.created) : now,
		dateModified: spTask.modified ? msToISO(spTask.modified) : (spTask.created ? msToISO(spTask.created) : now),
		completedAt: spTask.isDone && spTask.doneOn ? msToISO(spTask.doneOn) : null
	};

	return { frontmatter, body };
}

// ─── Serialization (matches frontmatter.ts exactly) ──────────────────────────

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

	if (fm.tags.length > 0) result.tags = fm.tags;
	if (fm.contexts.length > 0) result.contexts = fm.contexts;
	if (fm.projects.length > 0) result.projects = fm.projects;

	if (fm.recurrence) {
		result.recurrence = fm.recurrence;
		result.recurrence_anchor = fm.recurrence_anchor;
	}

	if (fm.active_instances.length > 0) result.active_instances = fm.active_instances;
	if (fm.complete_instances.length > 0) result.complete_instances = fm.complete_instances;
	if (fm.skipped_instances.length > 0) result.skipped_instances = fm.skipped_instances;
	if (Object.keys(fm.rescheduled_instances).length > 0) result.rescheduled_instances = fm.rescheduled_instances;

	if (fm.seriesId) result.seriesId = fm.seriesId;
	if (fm.isSeriesTemplate) result.isSeriesTemplate = fm.isSeriesTemplate;

	if (fm.parentId) result.parentId = fm.parentId;

	if (fm.timeEntries.length > 0) result.timeEntries = fm.timeEntries;

	return result;
}

function serializeMarkdown(frontmatter: TaskFrontmatter, body: string): string {
	const cleaned = cleanFrontmatterForSerialization(frontmatter);

	const yaml = stringifyYaml(cleaned, {
		indent: 2,
		lineWidth: 0,
		nullStr: '',
		defaultKeyType: 'PLAIN',
		defaultStringType: 'PLAIN'
	});

	const bodyContent = body.trim();
	const separator = bodyContent ? '\n' : '';

	return `---\n${yaml}---${separator}${bodyContent}\n`;
}

// ─── Filename Generation ─────────────────────────────────────────────────────

function generateFilename(title: string): string {
	let sanitized = title
		.trim()
		.replace(/[<>:"/\\|?*]/g, '')
		.replace(/\s+/g, ' ')
		.slice(0, 200);

	if (!sanitized) sanitized = 'Untitled';
	return `${sanitized}.md`;
}

function deduplicateFilename(filename: string, existing: Set<string>): string {
	if (!existing.has(filename.toLowerCase())) {
		existing.add(filename.toLowerCase());
		return filename;
	}

	const base = filename.replace(/\.md$/, '');
	let counter = 1;
	let candidate: string;
	do {
		candidate = `${base} (${counter}).md`;
		counter++;
	} while (existing.has(candidate.toLowerCase()));

	existing.add(candidate.toLowerCase());
	return candidate;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
	const args = process.argv.slice(2);
	const writeMode = args.includes('--write');
	const verbose = args.includes('--verbose');

	if (args.includes('--help')) {
		console.log(`
SP → SPRedux Markdown Migration

Usage: bun run migrate-sp.ts [options]

Options:
  --write     Execute migration (default: dry-run)
  --verbose   Print detailed per-file output
  --help      Show this help
`);
		process.exit(0);
	}

	console.log(`\nSP Migration ${writeMode ? '(WRITING)' : '(DRY RUN)'}`);
	console.log('='.repeat(50));

	// ── Step 1: Parse SP data ──

	console.log('\nParsing SP __meta_ ...');
	const sp = await parseSPData();
	const lookups = buildLookupMaps(sp);

	const allTasks = sp.mainModelData.task.entities;
	const taskIds = sp.mainModelData.task.ids;
	const doneCount = taskIds.filter((id) => allTasks[id]?.isDone).length;
	const openCount = taskIds.length - doneCount;

	console.log(`  Tasks: ${taskIds.length} (${doneCount} done, ${openCount} open)`);
	console.log(`  Projects: ${sp.mainModelData.project.ids.length}`);
	console.log(`  Tags: ${sp.mainModelData.tag.ids.length}`);
	console.log(`  Repeat configs: ${sp.mainModelData.taskRepeatCfg.ids.length}`);

	// ── Step 2: Scan existing files ──

	console.log('\nScanning Imported/ ...');
	const importedFiles = await scanImportedFiles();
	console.log(`  Found: ${importedFiles.size} files with uid`);

	console.log('Scanning Tasks/ ...');
	const tasksFiles = await scanTasksFiles();
	console.log(`  Found: ${tasksFiles.size} active task files`);

	// ── Step 3: Phase 1 — Convert Imported/ files ──

	console.log('\n── Phase 1: Convert Imported/ ──');

	const writeQueue: QueuedWrite[] = [];
	const errors: ConversionError[] = [];
	let matchedCount = 0;
	let unmatchedImported = 0;

	// Track all filenames for dedup (Imported + new)
	const allFilenames = new Set<string>();
	const entries = await readdir(IMPORTED_PATH);
	for (const entry of entries) {
		allFilenames.add(entry.toLowerCase());
	}

	// Build spId → filename map for parentId resolution
	const spIdToFilename = new Map<string, string>();

	for (const [spId, imported] of importedFiles) {
		const spTask = allTasks[spId];
		if (!spTask) {
			unmatchedImported++;
			if (verbose) console.log(`  SKIP ${imported.filename} (no SP match for uid sp-${spId})`);
			continue;
		}

		try {
			const { frontmatter, body } = convertSPTask(spTask, lookups, imported.body);
			const content = serializeMarkdown(frontmatter, body);

			writeQueue.push({
				filepath: join(IMPORTED_PATH, imported.filename),
				content,
				action: 'rewrite',
				title: spTask.title
			});

			spIdToFilename.set(spId, imported.filename);
			matchedCount++;

			if (verbose) console.log(`  CONVERT ${imported.filename}`);
		} catch (e) {
			errors.push({ filename: imported.filename, error: String(e) });
			if (verbose) console.log(`  ERROR ${imported.filename}: ${e}`);
		}
	}

	console.log(`  Matched & converted: ${matchedCount}`);
	if (unmatchedImported > 0) console.log(`  Unmatched (no SP data): ${unmatchedImported}`);

	// ── Step 4: Phase 2 — Create new files for unmatched SP tasks ──

	console.log('\n── Phase 2: New files for unmatched SP tasks ──');

	const matchedSpIds = new Set(importedFiles.keys());
	let createdCount = 0;
	let skippedTasks = 0;
	const skippedInTasks: string[] = [];

	for (const spId of taskIds) {
		if (matchedSpIds.has(spId)) continue;

		const spTask = allTasks[spId];
		if (!spTask) continue;

		// Check if this task already exists in Tasks/ (by normalized title)
		const normalizedTitle = spTask.title.toLowerCase().trim();
		if (tasksFiles.has(normalizedTitle)) {
			skippedTasks++;
			skippedInTasks.push(spTask.title);
			if (verbose) console.log(`  SKIP "${spTask.title}" (exists in Tasks/)`);
			continue;
		}

		try {
			const { frontmatter, body } = convertSPTask(spTask, lookups);
			const content = serializeMarkdown(frontmatter, body);

			let filename = generateFilename(spTask.title);
			filename = deduplicateFilename(filename, allFilenames);

			writeQueue.push({
				filepath: join(IMPORTED_PATH, filename),
				content,
				action: 'create',
				title: spTask.title
			});

			spIdToFilename.set(spId, filename);
			createdCount++;

			if (verbose) console.log(`  CREATE ${filename}`);
		} catch (e) {
			errors.push({ filename: `[new] ${spTask.title}`, error: String(e) });
			if (verbose) console.log(`  ERROR "${spTask.title}": ${e}`);
		}
	}

	console.log(`  New files: ${createdCount}`);
	console.log(`  Skipped (in Tasks/): ${skippedTasks}`);

	// ── Step 5: Phase 3 — Resolve parentId references ──

	console.log('\n── Phase 3: Resolve subtask parentId ──');

	let resolvedParents = 0;
	let unresolvedParents = 0;

	for (const queued of writeQueue) {
		// Find the SP task for this queued write
		for (const spId of taskIds) {
			const spTask = allTasks[spId];
			if (!spTask || !spTask.parentId) continue;

			const filename = spIdToFilename.get(spId);
			if (!filename) continue;

			// Check if this queued write is for this task
			const queuedBasename = basename(queued.filepath);
			if (queuedBasename !== filename) continue;

			const parentFilename = spIdToFilename.get(spTask.parentId);
			if (parentFilename) {
				// Parse the content, inject parentId, re-serialize
				const parsed = parseContentFrontmatter(queued.content);
				if (parsed) {
					parsed.frontmatter.parentId = parentFilename.replace(/\.md$/, '');
					queued.content = serializeMarkdown(parsed.frontmatter, parsed.body);
					resolvedParents++;
				}
			} else {
				unresolvedParents++;
				if (verbose) console.log(`  UNRESOLVED parent for "${spTask.title}" (parent SP ID: ${spTask.parentId})`);
			}
			break;
		}
	}

	console.log(`  Resolved: ${resolvedParents}`);
	if (unresolvedParents > 0) console.log(`  Unresolved: ${unresolvedParents}`);

	// ── Step 6: Recurring task report ──

	console.log('\n── Recurring Tasks ──');
	for (const [cfgId, cfg] of lookups.repeatCfgMap) {
		const tasksWithCfg = taskIds.filter((id) => allTasks[id]?.repeatCfgId === cfgId);
		const doneInstances = tasksWithCfg.filter((id) => allTasks[id]?.isDone).length;
		const openInstances = tasksWithCfg.filter((id) => !allTasks[id]?.isDone).length;
		const inTasks = tasksFiles.has(cfg.title.toLowerCase().trim());
		console.log(`  "${cfg.title}" (${cfg.repeatCycle}): ${tasksWithCfg.length} instances (${doneInstances} done, ${openInstances} open)${inTasks ? ' [EXISTS IN Tasks/]' : ''}`);
	}

	// ── Step 7: Report ──

	console.log('\n── Summary ──');
	console.log(`  Files to rewrite: ${writeQueue.filter((q) => q.action === 'rewrite').length}`);
	console.log(`  Files to create: ${writeQueue.filter((q) => q.action === 'create').length}`);
	console.log(`  Total writes: ${writeQueue.length}`);
	console.log(`  Errors: ${errors.length}`);

	if (errors.length > 0) {
		console.log('\n── Errors ──');
		for (const err of errors) {
			console.log(`  ${err.filename}: ${err.error}`);
		}
	}

	if (skippedInTasks.length > 0 && verbose) {
		console.log('\n── Skipped (already in Tasks/) ──');
		for (const title of skippedInTasks) {
			console.log(`  ${title}`);
		}
	}

	// ── Step 8: Write (if --write) ──

	if (!writeMode) {
		console.log('\nDry run complete. Run with --write to execute.');
		return;
	}

	// Check backup doesn't already exist
	try {
		await stat(BACKUP_PATH);
		console.error(`\nERROR: Backup directory already exists: ${BACKUP_PATH}`);
		console.error('Remove it first to prevent double-run data loss.');
		process.exit(1);
	} catch {
		// Good — doesn't exist
	}

	// Create backup
	console.log(`\nBacking up Imported/ to Imported.bak/ ...`);
	await cp(IMPORTED_PATH, BACKUP_PATH, { recursive: true });
	console.log('  Backup complete.');

	// Write all queued files
	console.log(`\nWriting ${writeQueue.length} files ...`);
	let written = 0;
	let writeErrors = 0;

	for (const queued of writeQueue) {
		try {
			await Bun.write(queued.filepath, queued.content);
			written++;
			if (verbose) console.log(`  WROTE ${basename(queued.filepath)}`);
		} catch (e) {
			writeErrors++;
			console.error(`  WRITE ERROR ${basename(queued.filepath)}: ${e}`);
		}
	}

	console.log(`\nDone. Written: ${written}, Errors: ${writeErrors}`);
}

// Helper to re-parse content we've already serialized (for parentId injection)
function parseContentFrontmatter(content: string): { frontmatter: TaskFrontmatter; body: string } | null {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) return null;

	try {
		const { parse: parseYaml } = require('yaml');
		const raw = parseYaml(match[1]) as Record<string, unknown>;

		// Re-normalize to TaskFrontmatter
		const fm: TaskFrontmatter = {
			status: (raw.status as TaskFrontmatter['status']) || 'open',
			priority: (raw.priority as TaskFrontmatter['priority']) || 'none',
			scheduled: (raw.scheduled as string) || null,
			due: (raw.due as string) || null,
			startTime: (raw.startTime as string) || null,
			plannedDuration: (raw.plannedDuration as number) || null,
			tags: (raw.tags as string[]) || [],
			contexts: (raw.contexts as string[]) || [],
			projects: (raw.projects as string[]) || [],
			recurrence: (raw.recurrence as string) || null,
			recurrence_anchor: (raw.recurrence_anchor as TaskFrontmatter['recurrence_anchor']) || 'scheduled',
			active_instances: (raw.active_instances as string[]) || [],
			complete_instances: (raw.complete_instances as string[]) || [],
			skipped_instances: (raw.skipped_instances as string[]) || [],
			rescheduled_instances: (raw.rescheduled_instances as Record<string, string>) || {},
			seriesId: (raw.seriesId as string) || null,
			isSeriesTemplate: Boolean(raw.isSeriesTemplate),
			parentId: (raw.parentId as string) || null,
			timeEntries: (raw.timeEntries as TimeEntry[]) || [],
			dateCreated: (raw.dateCreated as string) || new Date().toISOString(),
			dateModified: (raw.dateModified as string) || new Date().toISOString(),
			completedAt: (raw.completedAt as string) || null
		};

		return { frontmatter: fm, body: (match[2] || '').trim() };
	} catch {
		return null;
	}
}

main().catch((e) => {
	console.error('Fatal error:', e);
	process.exit(1);
});
