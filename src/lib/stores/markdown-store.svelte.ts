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
	generateTaskFilename,
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
import { writeTextFile, exists, remove } from '@tauri-apps/plugin-fs';
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
 * Add a new task, or reschedule existing task with same title
 *
 * If a task with the same title already exists (non-recurring),
 * we reschedule it instead of creating a duplicate.
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
	// Check if task with this exact title already exists
	const existingFilename = generateTaskFilename(title);
	const existing = taskFiles.get(existingFilename);

	if (existing && !existing.frontmatter.recurrence) {
		// Task exists and is non-recurring - reschedule it
		const updates: Partial<TaskFrontmatter> = {
			scheduled: options.scheduled || null
		};

		// Optionally merge in new tags/projects if provided
		if (options.tags && options.tags.length > 0) {
			const existingTags = existing.frontmatter.tags;
			const newTags = options.tags.filter(t => !existingTags.includes(t));
			if (newTags.length > 0) {
				updates.tags = [...existingTags, ...newTags];
			}
		}
		if (options.projects && options.projects.length > 0) {
			const existingProjects = existing.frontmatter.projects;
			const newProjects = options.projects.filter(p => !existingProjects.includes(p));
			if (newProjects.length > 0) {
				updates.projects = [...existingProjects, ...newProjects];
			}
		}

		await updateTask(existingFilename, updates);
		return existingFilename;
	}

	// No existing task (or it's recurring) - create new
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
		rescheduled_instances: {},
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
		rescheduled_instances: {},
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
 * Rename a task (change its title/filename)
 *
 * @returns Object with success status and optional error message
 */
export async function renameTask(
	oldFilename: string,
	newTitle: string
): Promise<{ success: boolean; error?: string; newFilename?: string }> {
	const file = taskFiles.get(oldFilename);
	if (!file) {
		return { success: false, error: 'Task not found' };
	}

	const newFilename = generateTaskFilename(newTitle);

	// If filename hasn't changed, nothing to do
	if (newFilename === oldFilename) {
		return { success: true, newFilename: oldFilename };
	}

	// Check if a task with the new filename already exists
	const tasksDir = await getTasksDir();
	const newFilePath = await join(tasksDir, newFilename);

	if (await exists(newFilePath)) {
		return { success: false, error: 'A task with that name already exists' };
	}

	// Write to new file
	const content = serializeMarkdown(file.frontmatter, file.body);
	await writeTextFile(newFilePath, content);

	// Delete old file
	const oldFilePath = await join(tasksDir, oldFilename);
	await remove(oldFilePath);

	// Update in-memory map
	const newMap = new Map(taskFiles);
	newMap.delete(oldFilename);
	newMap.set(newFilename, file);
	taskFiles = newMap;

	return { success: true, newFilename };
}

/**
 * Mark a task as complete
 *
 * All tasks (recurring or not) add to complete_instances.
 * Tasks are never marked 'done' - they're activity buckets that accumulate instances.
 */
export async function markTaskComplete(
	filename: string,
	date: string = getTodayDate()
): Promise<void> {
	const file = taskFiles.get(filename);
	if (!file) return;

	const fm = file.frontmatter;

	if (fm.recurrence) {
		// For recurring tasks, use the instance service (handles active_instances too)
		completeInstance(fm, date);
	} else {
		// For non-recurring tasks, add to complete_instances and clear scheduled
		if (!fm.complete_instances.includes(date)) {
			fm.complete_instances = [...fm.complete_instances, date];
		}
		fm.scheduled = null;
		fm.dateModified = new Date().toISOString();
	}

	await saveTaskFile(filename, fm, file.body);
	taskFiles = new Map(taskFiles).set(filename, { frontmatter: fm, body: file.body });
}

/**
 * Mark a task as incomplete
 *
 * Removes the date from complete_instances.
 */
export async function markTaskIncomplete(
	filename: string,
	date: string = getTodayDate()
): Promise<void> {
	const file = taskFiles.get(filename);
	if (!file) return;

	const fm = file.frontmatter;

	if (fm.recurrence) {
		// For recurring tasks, use the instance service
		uncompleteInstance(fm, date);
	} else {
		// For non-recurring tasks, remove from complete_instances
		fm.complete_instances = fm.complete_instances.filter(d => d !== date);
		fm.dateModified = new Date().toISOString();
	}

	await saveTaskFile(filename, fm, file.body);
	taskFiles = new Map(taskFiles).set(filename, { frontmatter: fm, body: file.body });
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
 * Reschedule a task (series-level, sets scheduled date)
 */
export async function rescheduleTask(
	filename: string,
	newDate: string
): Promise<void> {
	await updateTask(filename, { scheduled: newDate });
}

/**
 * Reschedule a single recurring instance to a new date
 */
export async function rescheduleInstance(
	filename: string,
	instanceDate: string,
	newDate: string
): Promise<void> {
	const file = taskFiles.get(filename);
	if (!file) return;

	const fm = file.frontmatter;
	if (!fm.recurrence) {
		// Not recurring — fall back to regular reschedule
		await rescheduleTask(filename, newDate);
		return;
	}

	const updatedMap = { ...fm.rescheduled_instances, [instanceDate]: newDate };
	await updateTask(filename, { rescheduled_instances: updatedMap });
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
