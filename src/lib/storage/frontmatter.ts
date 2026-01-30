/**
 * YAML Frontmatter Parser/Serializer for Markdown Task Files
 *
 * Handles conversion between markdown files with YAML frontmatter
 * and Task objects. Designed for Obsidian Bases compatibility.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { Task } from '../domain/task';
import type { Recurrence, WeekDay } from '../domain/recurrence';

/**
 * Frontmatter schema for markdown task files
 * Compatible with Obsidian Bases view system
 */
export interface TaskFrontmatter {
	// Identity (not stored in frontmatter - derived from filename)
	// id is stored for backwards compatibility during migration

	// Status
	status: 'open' | 'done' | 'cancelled';
	priority: 'none' | 'low' | 'normal' | 'high';

	// Scheduling
	scheduled: string | null; // YYYY-MM-DD
	due: string | null; // YYYY-MM-DD
	startTime: string | null; // HH:MM
	plannedDuration: number | null; // minutes

	// Categorization
	tags: string[];
	contexts: string[];
	projects: string[];

	// Recurrence (RRULE format for Bases compatibility)
	recurrence: string | null;
	recurrence_anchor: 'scheduled' | 'completion';

	// Instance tracking for recurring tasks
	active_instances: string[];
	complete_instances: string[];
	skipped_instances: string[];

	// Series relationship
	seriesId: string | null;
	isSeriesTemplate: boolean;

	// Hierarchy
	parentId: string | null;

	// Time tracking (embedded)
	timeEntries: TimeEntry[];

	// Timestamps
	dateCreated: string; // ISO datetime
	dateModified: string; // ISO datetime
	completedAt: string | null; // ISO datetime
}

/**
 * Time entry stored in task frontmatter
 */
export interface TimeEntry {
	date: string; // YYYY-MM-DD
	minutes: number;
	note: string | null;
	createdAt: string; // ISO datetime
}

/**
 * Parsed markdown file structure
 */
export interface ParsedMarkdown {
	frontmatter: TaskFrontmatter;
	body: string;
}

/**
 * Parse markdown content with YAML frontmatter
 *
 * @param content Raw markdown file content
 * @returns Parsed frontmatter and body, or null if invalid
 */
export function parseMarkdown(content: string): ParsedMarkdown | null {
	// Match YAML frontmatter between --- delimiters
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

	if (!match) {
		return null;
	}

	const [, yamlContent, body] = match;

	try {
		const raw = parseYaml(yamlContent) as Record<string, unknown>;
		const frontmatter = normalizeFrontmatter(raw);
		return { frontmatter, body: body.trim() };
	} catch {
		return null;
	}
}

/**
 * Serialize frontmatter and body to markdown content
 *
 * @param frontmatter Task frontmatter object
 * @param body Markdown body content
 * @returns Complete markdown file content
 */
export function serializeMarkdown(frontmatter: TaskFrontmatter, body: string): string {
	// Clean frontmatter for serialization (remove null/empty values for cleaner output)
	const cleaned = cleanFrontmatterForSerialization(frontmatter);

	const yaml = stringifyYaml(cleaned, {
		indent: 2,
		lineWidth: 0, // No line wrapping
		nullStr: '', // Represent null as empty
		defaultKeyType: 'PLAIN',
		defaultStringType: 'PLAIN'
	});

	const bodyContent = body.trim();
	const separator = bodyContent ? '\n' : '';

	return `---\n${yaml}---${separator}${bodyContent}\n`;
}

/**
 * Normalize raw YAML data to TaskFrontmatter with defaults
 */
function normalizeFrontmatter(raw: Record<string, unknown>): TaskFrontmatter {
	return {
		status: normalizeStatus(raw.status),
		priority: normalizePriority(raw.priority),
		scheduled: normalizeDate(raw.scheduled),
		due: normalizeDate(raw.due),
		startTime: normalizeString(raw.startTime),
		plannedDuration: normalizePositiveNumber(raw.plannedDuration),
		tags: normalizeStringArray(raw.tags),
		contexts: normalizeStringArray(raw.contexts),
		projects: normalizeProjects(raw.projects, raw.project),
		recurrence: normalizeString(raw.recurrence),
		recurrence_anchor: normalizeRecurrenceAnchor(raw.recurrence_anchor),
		active_instances: normalizeStringArray(raw.active_instances),
		complete_instances: normalizeStringArray(raw.complete_instances),
		skipped_instances: normalizeStringArray(raw.skipped_instances),
		seriesId: normalizeString(raw.seriesId),
		isSeriesTemplate: Boolean(raw.isSeriesTemplate),
		parentId: normalizeString(raw.parentId),
		timeEntries: normalizeTimeEntries(raw.timeEntries),
		dateCreated: normalizeTimestamp(raw.dateCreated) || new Date().toISOString(),
		dateModified: normalizeTimestamp(raw.dateModified) || new Date().toISOString(),
		completedAt: normalizeTimestamp(raw.completedAt)
	};
}

/**
 * Clean frontmatter for serialization (remove empty arrays, null values)
 */
function cleanFrontmatterForSerialization(fm: TaskFrontmatter): Record<string, unknown> {
	const result: Record<string, unknown> = {
		status: fm.status,
		priority: fm.priority,
		dateCreated: fm.dateCreated,
		dateModified: fm.dateModified
	};

	// Only include non-null dates
	if (fm.scheduled) result.scheduled = fm.scheduled;
	if (fm.due) result.due = fm.due;
	if (fm.startTime) result.startTime = fm.startTime;
	if (fm.plannedDuration) result.plannedDuration = fm.plannedDuration;
	if (fm.completedAt) result.completedAt = fm.completedAt;

	// Only include non-empty arrays
	if (fm.tags.length > 0) result.tags = fm.tags;
	if (fm.contexts.length > 0) result.contexts = fm.contexts;
	if (fm.projects.length > 0) result.projects = fm.projects;

	// Recurrence
	if (fm.recurrence) {
		result.recurrence = fm.recurrence;
		result.recurrence_anchor = fm.recurrence_anchor;
	}

	// Instance tracking (only for recurring tasks)
	if (fm.active_instances.length > 0) result.active_instances = fm.active_instances;
	if (fm.complete_instances.length > 0) result.complete_instances = fm.complete_instances;
	if (fm.skipped_instances.length > 0) result.skipped_instances = fm.skipped_instances;

	// Series relationship
	if (fm.seriesId) result.seriesId = fm.seriesId;
	if (fm.isSeriesTemplate) result.isSeriesTemplate = fm.isSeriesTemplate;

	// Hierarchy
	if (fm.parentId) result.parentId = fm.parentId;

	// Time entries
	if (fm.timeEntries.length > 0) result.timeEntries = fm.timeEntries;

	return result;
}

// Normalization helpers

function normalizeStatus(value: unknown): 'open' | 'done' | 'cancelled' {
	if (value === 'done' || value === 'cancelled') return value;
	return 'open';
}

function normalizePriority(value: unknown): 'none' | 'low' | 'normal' | 'high' {
	if (value === 'low' || value === 'normal' || value === 'high') return value;
	return 'none';
}

function normalizeDate(value: unknown): string | null {
	if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return value;
	}
	// Handle Date objects (YAML parser may return these)
	if (value instanceof Date) {
		return value.toISOString().split('T')[0];
	}
	return null;
}

function normalizeString(value: unknown): string | null {
	if (typeof value === 'string' && value.trim()) {
		return value.trim();
	}
	return null;
}

function normalizeTimestamp(value: unknown): string | null {
	if (typeof value === 'string') {
		// Validate it's a reasonable ISO timestamp
		const parsed = Date.parse(value);
		if (!isNaN(parsed)) {
			return value;
		}
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	return null;
}

function normalizeStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
	}
	return [];
}

function normalizeProjects(projects: unknown, legacyProject: unknown): string[] {
	// Handle new array format
	if (Array.isArray(projects)) {
		return projects.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
	}
	// Handle legacy single project string
	if (typeof legacyProject === 'string' && legacyProject.trim()) {
		return [legacyProject.trim()];
	}
	return [];
}

function normalizePositiveNumber(value: unknown): number | null {
	if (typeof value === 'number' && value > 0) return value;
	if (typeof value === 'string') {
		const n = parseInt(value, 10);
		if (!isNaN(n) && n > 0) return n;
	}
	return null;
}

function normalizeRecurrenceAnchor(value: unknown): 'scheduled' | 'completion' {
	if (value === 'completion') return 'completion';
	return 'scheduled';
}

function normalizeTimeEntries(value: unknown): TimeEntry[] {
	if (!Array.isArray(value)) return [];

	return value
		.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
		.map((entry) => {
			// Handle new format (date, minutes)
			if (entry.date !== undefined || entry.minutes !== undefined) {
				return {
					date: normalizeDate(entry.date) || '',
					minutes: typeof entry.minutes === 'number' ? entry.minutes : 0,
					note: normalizeString(entry.note),
					createdAt: normalizeTimestamp(entry.createdAt) || new Date().toISOString()
				};
			}
			// Handle legacy format (startTime, duration)
			if (entry.startTime !== undefined || entry.duration !== undefined) {
				const startTime = normalizeTimestamp(entry.startTime);
				const date = startTime ? startTime.split('T')[0] : '';
				return {
					date,
					minutes: typeof entry.duration === 'number' ? entry.duration : 0,
					note: normalizeString(entry.description),
					createdAt: startTime || new Date().toISOString()
				};
			}
			return { date: '', minutes: 0, note: null, createdAt: new Date().toISOString() };
		})
		.filter((entry) => entry.date && entry.minutes > 0);
}

/**
 * Convert current Task object to TaskFrontmatter
 * Used during migration from JSON to markdown
 */
export function taskToFrontmatter(task: Task): TaskFrontmatter {
	return {
		status: task.completed ? 'done' : 'open',
		priority: 'none', // Default - existing tasks don't have priority
		scheduled: task.scheduledDate,
		due: null, // Existing tasks don't have due dates
		startTime: task.startTime,
		plannedDuration: null,
		tags: [...task.tags],
		contexts: [...task.contexts],
		projects: task.project ? [task.project] : [],
		recurrence: task.recurrence ? recurrenceToRRule(task.recurrence) : null,
		recurrence_anchor: 'scheduled',
		active_instances: [],
		complete_instances: [],
		skipped_instances: [],
		seriesId: task.seriesId,
		isSeriesTemplate: task.isSeriesTemplate,
		parentId: task.parentId,
		timeEntries: [], // Time entries will be migrated separately
		dateCreated: task.createdAt,
		dateModified: task.updatedAt,
		completedAt: task.completedAt
	};
}

/**
 * Convert TaskFrontmatter back to Task object
 * Used when loading markdown files
 */
export function frontmatterToTask(
	frontmatter: TaskFrontmatter,
	filename: string,
	body: string
): Task {
	// Use filename (without .md) as the title
	const title = filename.replace(/\.md$/, '');

	return {
		id: generateIdFromFilename(filename),
		title,
		tags: frontmatter.tags,
		contexts: frontmatter.contexts,
		project: frontmatter.projects[0] || null,
		scheduledDate: frontmatter.scheduled,
		startTime: frontmatter.startTime,
		completed: frontmatter.status === 'done',
		completedAt: frontmatter.completedAt,
		seriesId: frontmatter.seriesId,
		isSeriesTemplate: frontmatter.isSeriesTemplate,
		recurrence: frontmatter.recurrence ? rruleToRecurrence(frontmatter.recurrence) : null,
		parentId: frontmatter.parentId,
		createdAt: frontmatter.dateCreated,
		updatedAt: frontmatter.dateModified
	};
}

/**
 * Generate a stable ID from filename
 * This allows us to have consistent IDs without storing them in frontmatter
 */
function generateIdFromFilename(filename: string): string {
	// Use a simple hash of the filename for now
	// In production, we might want to store the original UUID during migration
	let hash = 0;
	for (let i = 0; i < filename.length; i++) {
		const char = filename.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	return `md-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Convert Recurrence object to RRULE string
 * Format: DTSTART:YYYYMMDD;FREQ=DAILY;INTERVAL=1;...
 */
export function recurrenceToRRule(rec: Recurrence): string {
	const parts: string[] = [];

	// DTSTART
	parts.push(`DTSTART:${rec.startDate.replace(/-/g, '')}`);

	// FREQ
	parts.push(`FREQ=${rec.frequency.toUpperCase()}`);

	// INTERVAL
	if (rec.interval > 1) {
		parts.push(`INTERVAL=${rec.interval}`);
	}

	// BYDAY for weekly
	if (rec.frequency === 'weekly' && rec.weekDays && rec.weekDays.length > 0) {
		const dayMap: Record<WeekDay, string> = {
			sun: 'SU',
			mon: 'MO',
			tue: 'TU',
			wed: 'WE',
			thu: 'TH',
			fri: 'FR',
			sat: 'SA'
		};
		parts.push(`BYDAY=${rec.weekDays.map((d) => dayMap[d]).join(',')}`);
	}

	// BYMONTHDAY for monthly day-of-month
	if (rec.frequency === 'monthly' && rec.dayOfMonth !== undefined) {
		parts.push(`BYMONTHDAY=${rec.dayOfMonth}`);
	}

	// BYDAY with position for monthly nth weekday
	if (rec.frequency === 'monthly' && rec.nthWeekday !== undefined && rec.weekdayForNth) {
		const dayMap: Record<WeekDay, string> = {
			sun: 'SU',
			mon: 'MO',
			tue: 'TU',
			wed: 'WE',
			thu: 'TH',
			fri: 'FR',
			sat: 'SA'
		};
		parts.push(`BYDAY=${rec.nthWeekday}${dayMap[rec.weekdayForNth]}`);
	}

	// UNTIL
	if (rec.endDate) {
		parts.push(`UNTIL=${rec.endDate.replace(/-/g, '')}`);
	}

	return parts.join(';');
}

/**
 * Parse RRULE string to Recurrence object
 */
export function rruleToRecurrence(rrule: string): Recurrence | null {
	const parts = rrule.split(';');
	const props: Record<string, string> = {};

	for (const part of parts) {
		const [key, value] = part.split(':').length > 1
			? [part.split(':')[0], part.split(':')[1]]
			: part.split('=');
		if (key && value) {
			props[key] = value;
		}
	}

	// Parse DTSTART
	const startDate = props.DTSTART
		? `${props.DTSTART.slice(0, 4)}-${props.DTSTART.slice(4, 6)}-${props.DTSTART.slice(6, 8)}`
		: new Date().toISOString().split('T')[0];

	// Parse FREQ
	const freqMap: Record<string, Recurrence['frequency']> = {
		DAILY: 'daily',
		WEEKLY: 'weekly',
		MONTHLY: 'monthly',
		YEARLY: 'yearly'
	};
	const frequency = freqMap[props.FREQ] || 'daily';

	// Parse INTERVAL
	const interval = props.INTERVAL ? parseInt(props.INTERVAL, 10) : 1;

	const recurrence: Recurrence = {
		frequency,
		interval,
		startDate
	};

	// Parse BYDAY
	if (props.BYDAY) {
		const dayMap: Record<string, WeekDay> = {
			SU: 'sun',
			MO: 'mon',
			TU: 'tue',
			WE: 'wed',
			TH: 'thu',
			FR: 'fri',
			SA: 'sat'
		};

		// Check for nth weekday format (e.g., "2TU" for 2nd Tuesday)
		const nthMatch = props.BYDAY.match(/^(-?\d+)([A-Z]{2})$/);
		if (nthMatch) {
			recurrence.nthWeekday = parseInt(nthMatch[1], 10);
			recurrence.weekdayForNth = dayMap[nthMatch[2]];
		} else {
			// Regular weekday list
			recurrence.weekDays = props.BYDAY.split(',')
				.map((d) => dayMap[d])
				.filter((d): d is WeekDay => d !== undefined);
		}
	}

	// Parse BYMONTHDAY
	if (props.BYMONTHDAY) {
		recurrence.dayOfMonth = parseInt(props.BYMONTHDAY, 10);
	}

	// Parse UNTIL
	if (props.UNTIL) {
		recurrence.endDate = `${props.UNTIL.slice(0, 4)}-${props.UNTIL.slice(4, 6)}-${props.UNTIL.slice(6, 8)}`;
	}

	return recurrence;
}
