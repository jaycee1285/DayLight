/**
 * Markdown Store
 *
 * Svelte 5 runes-based store for markdown task storage.
 * Uses the Bases-compatible view system for grouping and sorting.
 */

import type { TaskFrontmatter, TimeEntry } from '$lib/storage/frontmatter';
import {
	loadAllTasks,
	saveTask,
	deleteTask as deleteTaskFile,
	generateUniqueFilename,
	type LoadTasksResult
} from '$lib/storage/markdown-storage';
import {
	serializeMarkdown,
	rruleToRecurrence,
	recurrenceToRRule
} from '$lib/storage/frontmatter';
import {
	createViewTasks,
	groupTasksByDateGroup,
	sortByUrgency,
	getTasksForDate,
	getCompletedTasksForDate,
	getOverdueTasks,
	getAllTags,
	getAllContexts,
	getAllProjects,
	filterByProject,
	filterIncomplete,
	type ViewTask,
	type GroupedView
} from '$lib/services/ViewService';
import {
	processRecurringInstances,
	completeInstance,
	skipInstance,
	uncompleteInstance
} from '$lib/services/RecurringInstanceService';
import { getTodayDate, formatLocalDate } from '$lib/domain/task';
import { generateOccurrences, type Recurrence } from '$lib/domain/recurrence';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { getTasksDir } from '$lib/storage/markdown-storage';

/**
 * Store state
 */
let taskFiles = $state<Map<string, { frontmatter: TaskFrontmatter; body: string }>>(new Map());
let selectedDate = $state<string>(getTodayDate());
let isLoading = $state<boolean>(false);
let hasUnsavedChanges = $state<boolean>(false);
let loadErrors = $state<Array<{ filename: string; message: string }>>([]);

/**
 * Derived computed values - using $derived for proper reactivity
 */
const derivedViewTasks = $derived(createViewTasks(taskFiles, selectedDate));
const derivedGroupedView = $derived.by(() => {
	const tasks = derivedViewTasks;
	const grouped = groupTasksByDateGroup(tasks);
	grouped.past = sortByUrgency(grouped.past);
	grouped.now = sortByUrgency(grouped.now);
	grouped.upcoming = sortByUrgency(grouped.upcoming);
	grouped.wrapped = sortByUrgency(grouped.wrapped);
	return grouped;
});
const derivedAllTags = $derived(getAllTags(derivedViewTasks));
const derivedAllContexts = $derived(getAllContexts(derivedViewTasks));
const derivedAllProjects = $derived(getAllProjects(derivedViewTasks));

/**
 * Initialize the store by loading all task files
 */
export async function initializeMarkdownStore(): Promise<void> {
	isLoading = true;
	loadErrors = [];

	try {
		const result = await loadAllTasks();

		// Use parsed files directly - no need to re-read!
		const files = new Map<string, { frontmatter: TaskFrontmatter; body: string }>();
		for (const parsed of result.parsedFiles) {
			files.set(parsed.filename, {
				frontmatter: parsed.frontmatter,
				body: parsed.body
			});
		}

		taskFiles = files;
		loadErrors = result.errors;

		// Process recurring instances
		const frontmatterMap = new Map<string, TaskFrontmatter>();
		for (const [filename, { frontmatter }] of taskFiles) {
			frontmatterMap.set(filename, frontmatter);
		}
		const processResult = processRecurringInstances(frontmatterMap);

		// Save any tasks that were updated by recurring instance processing
		if (processResult.updated > 0) {
			for (const filename of processResult.updatedFiles) {
				const file = taskFiles.get(filename);
				if (file) {
					await saveTaskFile(filename, file.frontmatter, file.body);
				}
			}
		}
	} catch (error) {
		loadErrors = [{
			filename: 'store',
			message: error instanceof Error ? error.message : 'Failed to load tasks'
		}];
	} finally {
		isLoading = false;
	}
}

/**
 * Save a task file to disk
 */
async function saveTaskFile(
	filename: string,
	frontmatter: TaskFrontmatter,
	body: string
): Promise<void> {
	const content = serializeMarkdown(frontmatter, body);
	const tasksDir = await getTasksDir();
	const filePath = await join(tasksDir, filename);
	await writeTextFile(filePath, content);
}

/**
 * Create derived view tasks
 */
function getViewTasks(): ViewTask[] {
	return createViewTasks(taskFiles, selectedDate);
}

/**
 * Get grouped view (Past/Now/Upcoming/Wrapped)
 */
function getGroupedView(): GroupedView {
	const tasks = getViewTasks();
	const grouped = groupTasksByDateGroup(tasks);

	// Sort each group by urgency
	grouped.past = sortByUrgency(grouped.past);
	grouped.now = sortByUrgency(grouped.now);
	grouped.upcoming = sortByUrgency(grouped.upcoming);
	grouped.wrapped = sortByUrgency(grouped.wrapped);

	return grouped;
}

/**
 * Add a new task
 */
export async function addTask(
	title: string,
	options: {
		tags?: string[];
		contexts?: string[];
		projects?: string[];
		scheduled?: string;
		due?: string;
		startTime?: string;
		plannedDuration?: number;
		priority?: 'none' | 'low' | 'normal' | 'high';
	} = {}
): Promise<string> {
	const now = new Date().toISOString();

	const frontmatter: TaskFrontmatter = {
		status: 'open',
		priority: options.priority || 'none',
		scheduled: options.scheduled || null,
		due: options.due || null,
		startTime: options.startTime || null,
		plannedDuration: options.plannedDuration || null,
		tags: ['task', ...(options.tags || [])],
		contexts: options.contexts || [],
		projects: options.projects || [],
		recurrence: null,
		recurrence_anchor: 'scheduled',
		active_instances: [],
		complete_instances: [],
		skipped_instances: [],
		seriesId: null,
		isSeriesTemplate: false,
		parentId: null,
		timeEntries: [],
		dateCreated: now,
		dateModified: now,
		completedAt: null
	};

	const filename = await generateUniqueFilename(title);
	await saveTaskFile(filename, frontmatter, '');

	taskFiles = new Map(taskFiles).set(filename, { frontmatter, body: '' });
	hasUnsavedChanges = false;

	return filename;
}

/**
 * Add a recurring task
 */
export async function addRecurringTask(
	title: string,
	recurrence: Recurrence,
	options: {
		tags?: string[];
		contexts?: string[];
		projects?: string[];
		priority?: 'none' | 'low' | 'normal' | 'high';
	} = {}
): Promise<string> {
	const now = new Date().toISOString();
	const today = getTodayDate();

	// Generate initial active instances
	const windowEnd = formatLocalDate(new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000));
	const instances = generateOccurrences(recurrence, today, windowEnd);

	const frontmatter: TaskFrontmatter = {
		status: 'open',
		priority: options.priority || 'none',
		scheduled: recurrence.startDate,
		due: null,
		startTime: null,
		plannedDuration: null,
		tags: ['task', ...(options.tags || [])],
		contexts: options.contexts || [],
		projects: options.projects || [],
		recurrence: recurrenceToRRule(recurrence),
		recurrence_anchor: 'scheduled',
		active_instances: instances,
		complete_instances: [],
		skipped_instances: [],
		seriesId: null,
		isSeriesTemplate: true,
		parentId: null,
		timeEntries: [],
		dateCreated: now,
		dateModified: now,
		completedAt: null
	};

	const filename = await generateUniqueFilename(title);
	await saveTaskFile(filename, frontmatter, '');

	taskFiles = new Map(taskFiles).set(filename, { frontmatter, body: '' });
	hasUnsavedChanges = false;

	return filename;
}

/**
 * Update a task's frontmatter
 */
export async function updateTask(
	filename: string,
	updates: Partial<TaskFrontmatter>
): Promise<void> {
	const file = taskFiles.get(filename);
	if (!file) return;

	const updatedFrontmatter: TaskFrontmatter = {
		...file.frontmatter,
		...updates,
		dateModified: new Date().toISOString()
	};

	await saveTaskFile(filename, updatedFrontmatter, file.body);

	// Create new Map to trigger Svelte 5 reactivity
	const newMap = new Map(taskFiles);
	newMap.set(filename, { frontmatter: updatedFrontmatter, body: file.body });
	taskFiles = newMap;
}

/**
 * Update a task's frontmatter and body
 */
export async function updateTaskWithBody(
	filename: string,
	updates: Partial<TaskFrontmatter>,
	newBody: string
): Promise<void> {
	const file = taskFiles.get(filename);
	if (!file) return;

	const updatedFrontmatter: TaskFrontmatter = {
		...file.frontmatter,
		...updates,
		dateModified: new Date().toISOString()
	};

	await saveTaskFile(filename, updatedFrontmatter, newBody);

	// Create new Map to trigger Svelte 5 reactivity
	const newMap = new Map(taskFiles);
	newMap.set(filename, { frontmatter: updatedFrontmatter, body: newBody });
	taskFiles = newMap;
}

/**
 * Delete a task
 */
export async function deleteTask(filename: string): Promise<void> {
	await deleteTaskFile(filename);
	const newMap = new Map(taskFiles);
	newMap.delete(filename);
	taskFiles = newMap;
}

/**
 * Mark a task as complete
 */
export async function markTaskComplete(
	filename: string,
	date: string = getTodayDate()
): Promise<void> {
	const file = taskFiles.get(filename);
	if (!file) return;

	const fm = file.frontmatter;

	if (fm.recurrence) {
		// For recurring tasks, complete the instance
		completeInstance(fm, date);
		await saveTaskFile(filename, fm, file.body);
		taskFiles = new Map(taskFiles).set(filename, { frontmatter: fm, body: file.body });
	} else {
		// For non-recurring tasks, mark as done
		await updateTask(filename, {
			status: 'done',
			completedAt: new Date().toISOString()
		});
	}
}

/**
 * Mark a task as incomplete
 */
export async function markTaskIncomplete(
	filename: string,
	date: string = getTodayDate()
): Promise<void> {
	const file = taskFiles.get(filename);
	if (!file) return;

	const fm = file.frontmatter;

	if (fm.recurrence) {
		// For recurring tasks, uncomplete the instance
		uncompleteInstance(fm, date);
		await saveTaskFile(filename, fm, file.body);
		taskFiles = new Map(taskFiles).set(filename, { frontmatter: fm, body: file.body });
	} else {
		// For non-recurring tasks, mark as open
		await updateTask(filename, {
			status: 'open',
			completedAt: null
		});
	}
}

/**
 * Skip a recurring task instance
 */
export async function skipTaskInstance(
	filename: string,
	date: string = getTodayDate()
): Promise<void> {
	const file = taskFiles.get(filename);
	if (!file || !file.frontmatter.recurrence) return;

	skipInstance(file.frontmatter, date);
	await saveTaskFile(filename, file.frontmatter, file.body);
	taskFiles = new Map(taskFiles).set(filename, file);
}

/**
 * Reschedule a task
 */
export async function rescheduleTask(
	filename: string,
	newDate: string
): Promise<void> {
	await updateTask(filename, { scheduled: newDate });
}

/**
 * Update a task's time block (for weekly planner drag/resize)
 */
export async function updateTaskTimeBlock(
	filename: string,
	scheduled: string,
	startTime: string | null,
	plannedDuration: number | null
): Promise<void> {
	await updateTask(filename, { scheduled, startTime, plannedDuration });
}

/**
 * Log time for a task
 */
export async function logTime(
	filename: string,
	date: string,
	minutes: number,
	note?: string
): Promise<void> {
	const file = taskFiles.get(filename);
	if (!file) return;

	const entry: TimeEntry = {
		date,
		minutes,
		note: note || null,
		createdAt: new Date().toISOString()
	};

	const updatedEntries = [...file.frontmatter.timeEntries, entry];
	await updateTask(filename, { timeEntries: updatedEntries });
}

/**
 * Set selected date
 */
export function setSelectedDate(date: string): void {
	selectedDate = date;
}

/**
 * Export store for reactive access
 */
export const markdownStore = {
	// Getters for reactive state
	get isLoading() { return isLoading; },
	get hasUnsavedChanges() { return hasUnsavedChanges; },
	get loadErrors() { return loadErrors; },
	get selectedDate() { return selectedDate; },

	// Derived data (use $derived values for proper reactivity)
	get viewTasks() { return derivedViewTasks; },
	get groupedView() { return derivedGroupedView; },
	get allTags() { return derivedAllTags; },
	get allContexts() { return derivedAllContexts; },
	get allProjects() { return derivedAllProjects; },

	// Tasks for selected date
	get tasksForSelectedDate() {
		return getTasksForDate(getViewTasks(), selectedDate);
	},
	get completedForSelectedDate() {
		return getCompletedTasksForDate(getViewTasks(), selectedDate);
	},
	get overdueBeforeSelectedDate() {
		return getOverdueTasks(getViewTasks(), selectedDate)
			.filter((t) => {
				const fm = t.frontmatter;
				// Only include if scheduled/due before selected date
				return (fm.scheduled && fm.scheduled < selectedDate) ||
					(fm.due && fm.due < selectedDate);
			});
	},

	// Filter by project
	tasksForProject(project: string) {
		return filterByProject(getViewTasks(), project);
	},

	// Raw file access (for advanced use cases)
	get taskFiles() { return taskFiles; },
	getTaskFile(filename: string) { return taskFiles.get(filename); }
};
