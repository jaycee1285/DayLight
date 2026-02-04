/**
 * ViewService
 *
 * Provides view integration for the Bases-compatible task system.
 * Loads tasks from markdown files, evaluates formulas, and applies
 * grouping/sorting according to view configurations.
 */

import { parse as parseYaml } from 'yaml';
import type { TaskFrontmatter, TimeEntry } from '$lib/storage/frontmatter';
import { parseMarkdown } from '$lib/storage/frontmatter';
import {
	getTaskDateGroup,
	calculateUrgencyScore,
	isActiveToday,
	hasPastUncompletedInstances,
	processRecurringInstances
} from './RecurringInstanceService';
import { formatLocalDate, getTodayDate } from '$lib/domain/task';

/**
 * Task with computed view properties
 */
export interface ViewTask {
	/** Filename (e.g., "My Task.md") */
	filename: string;

	/** Task title (filename without .md) */
	title: string;

	/** Raw frontmatter data */
	frontmatter: TaskFrontmatter;

	/** Markdown body content */
	body: string;

	/** Computed: Which group (Past/Now/Upcoming/Wrapped) */
	dateGroup: 'Past' | 'Now' | 'Upcoming' | 'Wrapped';

	/** Computed: Urgency score for sorting */
	urgencyScore: number;

	/** Computed: Is this task active today (for recurring) */
	isActiveToday: boolean;

	/** Computed: Does this have past uncompleted instances */
	hasPastUncompleted: boolean;

	/** Computed: Total time tracked in minutes */
	totalTimeTracked: number;

	/** Computed: Time tracked today in minutes */
	timeTrackedToday: number;

	/** For recurring tasks: which specific instance date this ViewTask represents */
	instanceDate: string | null;

	/** The effective display date (rescheduled date if applicable, otherwise instanceDate or scheduled) */
	effectiveDate: string | null;
}

/**
 * Grouped view result
 */
export interface GroupedView {
	past: ViewTask[];
	now: ViewTask[];
	upcoming: ViewTask[];
	wrapped: ViewTask[];
}

/**
 * View configuration (parsed from .base file or hardcoded)
 */
export interface ViewConfig {
	name: string;
	type: 'tasknotesTaskList' | 'tasknotesCalendar' | 'list';
	groupBy?: {
		property: string;
		direction: 'ASC' | 'DESC';
	};
	sortBy?: Array<{
		property: string;
		direction: 'ASC' | 'DESC';
	}>;
	filters?: {
		status?: string;
		tags?: string[];
	};
}

/**
 * .base file structure
 */
export interface BaseFile {
	filters?: {
		and?: string[];
		or?: string[];
	};
	formulas?: Record<string, string>;
	views?: ViewConfig[];
}

/**
 * Convert raw parsed markdown files to ViewTask objects
 * For recurring tasks, expands into multiple ViewTasks (one per uncompleted instance)
 */
export function createViewTasks(
	files: Map<string, { frontmatter: TaskFrontmatter; body: string }>,
	today: string = getTodayDate()
): ViewTask[] {
	const tasks: ViewTask[] = [];

	for (const [filename, { frontmatter, body }] of files) {
		// Skip files without 'task' tag
		if (!frontmatter.tags.includes('task')) {
			continue;
		}

		const title = filename.replace(/\.md$/, '');

		// For recurring tasks, expand into per-instance ViewTasks
		if (frontmatter.recurrence) {
			// If the task has been rescheduled to the future (series-level), only consider
			// instances that have been per-instance rescheduled
			const seriesRescheduled = frontmatter.scheduled && frontmatter.scheduled > today
				? frontmatter.scheduled
				: null;

			const rescheduledMap = frontmatter.rescheduled_instances;

			// Get all uncompleted instances whose effective date is <= today
			const instancesToShow = frontmatter.active_instances.filter((date) => {
				// Exclude completed and skipped
				if (frontmatter.complete_instances.includes(date)) return false;
				if (frontmatter.skipped_instances.includes(date)) return false;

				const effectiveDate = rescheduledMap[date] || date;

				// Only include instances with effective date <= today
				if (effectiveDate > today) return false;

				// If the series was rescheduled to the future, only show per-instance overrides
				if (seriesRescheduled && !rescheduledMap[date]) return false;

				return true;
			});

			// Create a ViewTask for each uncompleted instance
			for (const instanceDate of instancesToShow) {
				const effectiveDate = rescheduledMap[instanceDate] || instanceDate;
				const dateGroup: 'Past' | 'Now' = effectiveDate < today ? 'Past' : 'Now';

				tasks.push({
					filename,
					title,
					frontmatter,
					body,
					dateGroup,
					urgencyScore: calculateUrgencyScoreForInstance(frontmatter, effectiveDate, today),
					isActiveToday: effectiveDate === today,
					hasPastUncompleted: effectiveDate < today,
					totalTimeTracked: calculateTimeTrackedOnDate(frontmatter.timeEntries, instanceDate),
					timeTrackedToday: calculateTimeTrackedOnDate(frontmatter.timeEntries, today),
					instanceDate,
					effectiveDate
				});
			}

			// If no uncompleted instances, determine group from frontmatter
			// (Wrapped if today's instance was completed, Upcoming otherwise)
			if (instancesToShow.length === 0) {
				tasks.push({
					filename,
					title,
					frontmatter,
					body,
					dateGroup: getTaskDateGroup(frontmatter, today),
					urgencyScore: calculateUrgencyScore(frontmatter, today),
					isActiveToday: false,
					hasPastUncompleted: false,
					totalTimeTracked: calculateTotalTimeTracked(frontmatter.timeEntries),
					timeTrackedToday: calculateTimeTrackedOnDate(frontmatter.timeEntries, today),
					instanceDate: null,
					effectiveDate: null
				});
			}
		} else {
			// Non-recurring task: single ViewTask
			tasks.push({
				filename,
				title,
				frontmatter,
				body,
				dateGroup: getTaskDateGroup(frontmatter, today),
				urgencyScore: calculateUrgencyScore(frontmatter, today),
				isActiveToday: isActiveToday(frontmatter, today),
				hasPastUncompleted: hasPastUncompletedInstances(frontmatter, today),
				totalTimeTracked: calculateTotalTimeTracked(frontmatter.timeEntries),
				timeTrackedToday: calculateTimeTrackedOnDate(frontmatter.timeEntries, today),
				instanceDate: null,
				effectiveDate: frontmatter.scheduled || null
			});
		}
	}

	return tasks;
}

/**
 * Calculate urgency score for a specific recurring instance
 */
function calculateUrgencyScoreForInstance(
	frontmatter: TaskFrontmatter,
	instanceDate: string,
	today: string
): number {
	const priorityWeight = getPriorityWeight(frontmatter.priority);

	// Days difference (negative = past, 0 = today)
	const todayMs = new Date(today).getTime();
	const instanceMs = new Date(instanceDate).getTime();
	const daysDiff = Math.floor((instanceMs - todayMs) / (1000 * 60 * 60 * 24));

	// Past instances get higher urgency (more negative = more urgent)
	if (daysDiff < 0) {
		return priorityWeight + 10 + Math.abs(daysDiff);
	}

	// Today
	return priorityWeight + 10;
}

/**
 * Get priority weight for scoring
 */
function getPriorityWeight(priority: string): number {
	switch (priority) {
		case 'high': return 3;
		case 'normal': return 2;
		case 'low': return 1;
		case 'none': return 0;
		default: return 0;
	}
}

/**
 * Group tasks by dateGroup property
 */
export function groupTasksByDateGroup(tasks: ViewTask[]): GroupedView {
	const grouped: GroupedView = {
		past: [],
		now: [],
		upcoming: [],
		wrapped: []
	};

	for (const task of tasks) {
		switch (task.dateGroup) {
			case 'Past':
				grouped.past.push(task);
				break;
			case 'Now':
				grouped.now.push(task);
				break;
			case 'Upcoming':
				grouped.upcoming.push(task);
				break;
			case 'Wrapped':
				grouped.wrapped.push(task);
				break;
		}
	}

	return grouped;
}

/**
 * Sort tasks by urgency score (descending - highest urgency first)
 */
export function sortByUrgency(tasks: ViewTask[]): ViewTask[] {
	return [...tasks].sort((a, b) => b.urgencyScore - a.urgencyScore);
}

/**
 * Sort tasks by scheduled date (ascending - earliest first)
 */
export function sortByScheduledDate(tasks: ViewTask[]): ViewTask[] {
	return [...tasks].sort((a, b) => {
		const dateA = a.frontmatter.scheduled || '9999-12-31';
		const dateB = b.frontmatter.scheduled || '9999-12-31';
		return dateA.localeCompare(dateB);
	});
}

/**
 * Get grouped and sorted view for the default task list
 */
export function getDefaultTaskListView(
	files: Map<string, { frontmatter: TaskFrontmatter; body: string }>,
	today: string = getTodayDate()
): GroupedView {
	// Process recurring instances first
	const frontmatterMap = new Map<string, TaskFrontmatter>();
	for (const [filename, { frontmatter }] of files) {
		frontmatterMap.set(filename, frontmatter);
	}
	processRecurringInstances(frontmatterMap, undefined, today);

	// Create view tasks
	const tasks = createViewTasks(files, today);

	// Group by date group
	const grouped = groupTasksByDateGroup(tasks);

	// Sort each group by urgency (descending)
	grouped.past = sortByUrgency(grouped.past);
	grouped.now = sortByUrgency(grouped.now);
	grouped.upcoming = sortByUrgency(grouped.upcoming);
	grouped.wrapped = sortByUrgency(grouped.wrapped);

	return grouped;
}

/**
 * Filter tasks for a specific date (for calendar view)
 */
export function getTasksForDate(
	tasks: ViewTask[],
	date: string
): ViewTask[] {
	return tasks.filter((task) => {
		const fm = task.frontmatter;

		// For expanded recurring instances, match on effective date
		if (task.instanceDate) {
			return (task.effectiveDate || task.instanceDate) === date;
		}

		// Non-recurring: check scheduled date
		if (fm.scheduled === date) return true;

		// Non-recurring: check due date
		if (fm.due === date) return true;

		// Recurring without instanceDate (all caught up, showing as Upcoming):
		// check next active instance
		if (fm.recurrence && fm.active_instances.includes(date)) {
			if (!fm.complete_instances.includes(date) && !fm.skipped_instances.includes(date)) {
				return true;
			}
		}

		return false;
	});
}

/**
 * Filter tasks for a date range (for week/month view)
 */
export function getTasksInDateRange(
	tasks: ViewTask[],
	startDate: string,
	endDate: string
): Map<string, ViewTask[]> {
	const tasksByDate = new Map<string, ViewTask[]>();

	// Initialize each date in range
	let currentDate = new Date(startDate);
	const end = new Date(endDate);
	while (currentDate <= end) {
		const dateStr = formatLocalDate(currentDate);
		tasksByDate.set(dateStr, []);
		currentDate.setDate(currentDate.getDate() + 1);
	}

	// Assign tasks to dates
	for (const task of tasks) {
		const fm = task.frontmatter;

		// Check scheduled date
		if (fm.scheduled && tasksByDate.has(fm.scheduled)) {
			tasksByDate.get(fm.scheduled)!.push(task);
		}

		// Check due date (if different from scheduled)
		if (fm.due && fm.due !== fm.scheduled && tasksByDate.has(fm.due)) {
			tasksByDate.get(fm.due)!.push(task);
		}

		// Check recurring instances (using effective dates for rescheduled instances)
		for (const instDate of fm.active_instances) {
			if (fm.complete_instances.includes(instDate)) continue;
			if (fm.skipped_instances.includes(instDate)) continue;
			const effectiveDate = fm.rescheduled_instances[instDate] || instDate;
			if (tasksByDate.has(effectiveDate)) {
				const existing = tasksByDate.get(effectiveDate)!;
				if (!existing.some((t) => t.filename === task.filename && t.instanceDate === instDate)) {
					existing.push(task);
				}
			}
		}
	}

	return tasksByDate;
}

/**
 * Filter completed tasks for a specific date
 */
export function getCompletedTasksForDate(
	tasks: ViewTask[],
	date: string
): ViewTask[] {
	return tasks.filter((task) => {
		const fm = task.frontmatter;

		// Non-recurring: check completedAt date
		if (fm.status === 'done' && fm.completedAt) {
			const completedDate = fm.completedAt.split('T')[0];
			return completedDate === date;
		}

		// Recurring: check complete_instances
		if (fm.recurrence && fm.complete_instances.includes(date)) {
			return true;
		}

		return false;
	});
}

/**
 * Filter overdue tasks (scheduled before today, not completed)
 */
export function getOverdueTasks(
	tasks: ViewTask[],
	today: string = getTodayDate()
): ViewTask[] {
	return tasks.filter((task) => {
		const fm = task.frontmatter;

		// Skip completed tasks
		if (fm.status === 'done') return false;

		// Check scheduled date
		if (fm.scheduled && fm.scheduled < today) return true;

		// Check due date
		if (fm.due && fm.due < today) return true;

		// Check past uncompleted recurring instances
		if (task.hasPastUncompleted) return true;

		return false;
	});
}

/**
 * Calculate total time tracked from time entries
 */
function calculateTotalTimeTracked(timeEntries: TimeEntry[]): number {
	if (!timeEntries || timeEntries.length === 0) return 0;

	return timeEntries.reduce((total, entry) => total + (entry.minutes || 0), 0);
}

/**
 * Calculate time tracked on a specific date
 */
function calculateTimeTrackedOnDate(timeEntries: TimeEntry[], date: string): number {
	if (!timeEntries || timeEntries.length === 0) return 0;

	return timeEntries
		.filter((entry) => entry.date === date)
		.reduce((total, entry) => total + (entry.minutes || 0), 0);
}

/**
 * Parse a .base file
 */
export function parseBaseFile(content: string): BaseFile | null {
	try {
		return parseYaml(content) as BaseFile;
	} catch {
		return null;
	}
}

/**
 * Get all unique tags from tasks
 */
export function getAllTags(tasks: ViewTask[]): string[] {
	const tagSet = new Set<string>();
	for (const task of tasks) {
		for (const tag of task.frontmatter.tags) {
			if (tag !== 'task') {
				tagSet.add(tag.toLowerCase());
			}
		}
	}
	return Array.from(tagSet).sort();
}

/**
 * Get all unique contexts from tasks
 */
export function getAllContexts(tasks: ViewTask[]): string[] {
	const contextSet = new Set<string>();
	for (const task of tasks) {
		for (const context of task.frontmatter.contexts) {
			contextSet.add(context.toLowerCase());
		}
	}
	return Array.from(contextSet).sort();
}

/**
 * Get all unique projects from tasks
 */
export function getAllProjects(tasks: ViewTask[]): string[] {
	const projectSet = new Set<string>();
	for (const task of tasks) {
		for (const project of task.frontmatter.projects) {
			projectSet.add(project);
		}
	}
	return Array.from(projectSet).sort();
}

/**
 * Filter tasks by tag
 */
export function filterByTag(tasks: ViewTask[], tag: string): ViewTask[] {
	const lowerTag = tag.toLowerCase();
	return tasks.filter((task) =>
		task.frontmatter.tags.some((t) => t.toLowerCase() === lowerTag)
	);
}

/**
 * Filter tasks by context
 */
export function filterByContext(tasks: ViewTask[], context: string): ViewTask[] {
	const lowerContext = context.toLowerCase();
	return tasks.filter((task) =>
		task.frontmatter.contexts.some((c) => c.toLowerCase() === lowerContext)
	);
}

/**
 * Filter tasks by project
 */
export function filterByProject(tasks: ViewTask[], project: string): ViewTask[] {
	return tasks.filter((task) =>
		task.frontmatter.projects.some((p) => p === project)
	);
}

/**
 * Filter to only incomplete tasks
 */
export function filterIncomplete(tasks: ViewTask[]): ViewTask[] {
	return tasks.filter((task) => task.frontmatter.status !== 'done');
}

/**
 * Filter to only completed tasks
 */
export function filterCompleted(tasks: ViewTask[]): ViewTask[] {
	return tasks.filter((task) => task.frontmatter.status === 'done');
}

/**
 * Filter to only recurring tasks (templates with recurrence rule)
 */
export function filterRecurring(tasks: ViewTask[]): ViewTask[] {
	return tasks.filter((task) => task.frontmatter.recurrence !== null);
}

/**
 * Deduplicate ViewTasks by filename (keeps first occurrence)
 * Useful for pages that want one entry per file, not per instance
 */
export function deduplicateByFilename(tasks: ViewTask[]): ViewTask[] {
	const seen = new Set<string>();
	return tasks.filter((task) => {
		if (seen.has(task.filename)) return false;
		seen.add(task.filename);
		return true;
	});
}

/**
 * Filter tasks with start time set
 */
export function filterWithStartTime(tasks: ViewTask[]): ViewTask[] {
	return tasks.filter((task) => task.frontmatter.startTime !== null);
}

// =============================================================================
// Time Block Functions (for Weekly Planner)
// =============================================================================

/**
 * A positioned time block on the weekly planner grid
 */
export interface TimeBlock {
	task: ViewTask;
	date: string;
	startMinutes: number; // minutes from midnight (e.g., 540 = 9:00)
	durationMinutes: number;
}

/**
 * Parse HH:MM time string to minutes from midnight
 */
export function parseTimeToMinutes(time: string): number {
	const [h, m] = time.split(':').map(Number);
	return h * 60 + (m || 0);
}

/**
 * Convert minutes from midnight to HH:MM string
 */
export function minutesToTime(minutes: number): string {
	const clamped = Math.max(0, Math.min(1439, minutes));
	const h = Math.floor(clamped / 60);
	const m = clamped % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Snap minutes to a given increment (e.g., 15-minute grid)
 */
export function snapToGrid(minutes: number, increment: number = 15): number {
	return Math.round(minutes / increment) * increment;
}

/**
 * Get time blocks for a specific date (tasks with both startTime and plannedDuration)
 */
export function getTimeBlocksForDate(
	tasks: ViewTask[],
	date: string
): TimeBlock[] {
	return tasks
		.filter((t) => {
			const scheduled = t.effectiveDate || t.instanceDate || t.frontmatter.scheduled;
			return (
				scheduled === date &&
				t.frontmatter.startTime !== null &&
				t.frontmatter.plannedDuration !== null &&
				t.frontmatter.plannedDuration > 0
			);
		})
		.map((t) => ({
			task: t,
			date,
			startMinutes: parseTimeToMinutes(t.frontmatter.startTime!),
			durationMinutes: t.frontmatter.plannedDuration!
		}));
}

/**
 * Detect colliding (overlapping) time blocks.
 * Returns the set of filenames that have at least one collision.
 */
export function detectCollisions(blocks: TimeBlock[]): Set<string> {
	const colliding = new Set<string>();
	for (let i = 0; i < blocks.length; i++) {
		for (let j = i + 1; j < blocks.length; j++) {
			const a = blocks[i];
			const b = blocks[j];
			const aEnd = a.startMinutes + a.durationMinutes;
			const bEnd = b.startMinutes + b.durationMinutes;
			if (a.startMinutes < bEnd && b.startMinutes < aEnd) {
				colliding.add(a.task.filename);
				colliding.add(b.task.filename);
			}
		}
	}
	return colliding;
}

/**
 * Get tasks that are unplanned for given dates (scheduled but no time block)
 */
export function getUnplannedTasksForDates(
	tasks: ViewTask[],
	dates: string[]
): ViewTask[] {
	const dateSet = new Set(dates);
	return tasks.filter((t) => {
		// Exclude completed and overdue tasks
		if (t.dateGroup === 'Wrapped' || t.dateGroup === 'Past') return false;
		const scheduled = t.effectiveDate || t.instanceDate || t.frontmatter.scheduled;
		if (!scheduled || !dateSet.has(scheduled)) return false;
		// Has a scheduled date in range but no time block
		return t.frontmatter.startTime === null || t.frontmatter.plannedDuration === null;
	});
}

/**
 * Get backlog tasks (open, not scheduled)
 */
export function getBacklogTasks(tasks: ViewTask[]): ViewTask[] {
	return tasks.filter((t) => {
		const fm = t.frontmatter;
		return fm.status === 'open' && !fm.scheduled && !fm.recurrence;
	});
}

/**
 * Filter tasks scheduled for a specific date
 */
export function filterScheduledForDate(tasks: ViewTask[], date: string): ViewTask[] {
	return tasks.filter((task) => {
		const fm = task.frontmatter;

		// Direct match on scheduled date
		if (fm.scheduled === date) return true;

		// Check active recurring instances (accounting for rescheduled dates)
		if (fm.recurrence) {
			for (const instDate of fm.active_instances) {
				const effectiveDate = fm.rescheduled_instances[instDate] || instDate;
				if (effectiveDate === date &&
					!fm.complete_instances.includes(instDate) &&
					!fm.skipped_instances.includes(instDate)) {
					return true;
				}
			}
		}

		return false;
	});
}

// =============================================================================
// Time Aggregation Functions (for Reports)
// =============================================================================

/**
 * Get total time tracked across all tasks in a date range
 */
export function getTotalTimeInRange(
	tasks: ViewTask[],
	startDate: string,
	endDate: string
): number {
	let total = 0;

	for (const task of tasks) {
		for (const entry of task.frontmatter.timeEntries) {
			if (entry.date >= startDate && entry.date <= endDate) {
				total += entry.minutes || 0;
			}
		}
	}

	return total;
}

/**
 * Get time tracked grouped by project in a date range
 */
export function getTimeByProject(
	tasks: ViewTask[],
	startDate: string,
	endDate: string
): Map<string, number> {
	const projectTime = new Map<string, number>();

	for (const task of tasks) {
		const projects = task.frontmatter.projects;
		if (projects.length === 0) continue;

		for (const entry of task.frontmatter.timeEntries) {
			if (entry.date >= startDate && entry.date <= endDate) {
				const minutes = entry.minutes || 0;
				// Distribute time evenly across projects if task has multiple
				const perProject = minutes / projects.length;
				for (const project of projects) {
					const current = projectTime.get(project) || 0;
					projectTime.set(project, current + perProject);
				}
			}
		}
	}

	return projectTime;
}

/**
 * Get time tracked grouped by tag in a date range
 */
export function getTimeByTag(
	tasks: ViewTask[],
	startDate: string,
	endDate: string
): Map<string, number> {
	const tagTime = new Map<string, number>();

	for (const task of tasks) {
		// Filter out 'task' tag
		const tags = task.frontmatter.tags.filter((t) => t !== 'task');
		if (tags.length === 0) continue;

		for (const entry of task.frontmatter.timeEntries) {
			if (entry.date >= startDate && entry.date <= endDate) {
				const minutes = entry.minutes || 0;
				// Distribute time evenly across tags if task has multiple
				const perTag = minutes / tags.length;
				for (const tag of tags) {
					const current = tagTime.get(tag) || 0;
					tagTime.set(tag, current + perTag);
				}
			}
		}
	}

	return tagTime;
}
