/**
 * Application store
 *
 * Manages global application state using Svelte 5 runes.
 */

import type { Task } from '$lib/domain/task';
import type { TimeLog } from '$lib/domain/timeLog';
import type { Meta } from '$lib/domain/meta';
import type { CalendarCache, CalendarEvent } from '$lib/domain/calendar';
import type { LoadError } from '$lib/storage/storage';
import {
	createTask,
	completeTask,
	uncompleteTask,
	rescheduleTask,
	updateTaskFromParsed,
	getTodayDate,
	getOffsetDate
} from '$lib/domain/task';
import { createCalendarCache, eventsForDate } from '$lib/domain/calendar';
import type { Recurrence } from '$lib/domain/recurrence';
import { generateOccurrences } from '$lib/domain/recurrence';
import { createTimeLog } from '$lib/domain/timeLog';
import { createMeta } from '$lib/domain/meta';
import {
	scheduledForDay,
	overdueBeforeDay,
	allTags,
	allContexts,
	allProjects
} from '$lib/domain/selectors';

// Application state
let tasks = $state<Task[]>([]);
let timeLogs = $state<TimeLog[]>([]);
let meta = $state<Meta>(createMeta());
let calendarCache = $state<CalendarCache>(createCalendarCache());
let selectedDate = $state<string>(getTodayDate());
let isLoading = $state(false);
let hasUnsavedChanges = $state(false);
let loadErrors = $state<LoadError[]>([]);

/**
 * Initialize the store with loaded data
 */
export function initializeStore(data: { tasks: Task[]; timeLogs: TimeLog[]; meta: Meta }) {
	tasks = data.tasks;
	timeLogs = data.timeLogs;
	meta = data.meta;
	hasUnsavedChanges = false;
}

/**
 * Initialize calendar cache
 */
export function setCalendarCache(cache: CalendarCache) {
	calendarCache = cache;
}

/**
 * Get all tasks
 */
export function getTasks(): Task[] {
	return tasks;
}

/**
 * Get all time logs
 */
export function getTimeLogs(): TimeLog[] {
	return timeLogs;
}

/**
 * Get meta
 */
export function getMeta(): Meta {
	return meta;
}

/**
 * Update meta settings
 */
export function updateMeta(updates: Partial<Meta>) {
	meta = { ...meta, ...updates };
	hasUnsavedChanges = true;
}

/**
 * Replace meta without marking unsaved changes
 */
export function setMeta(nextMeta: Meta) {
	meta = nextMeta;
}

/**
 * Get calendar cache
 */
export function getCalendarCache(): CalendarCache {
	return calendarCache;
}

/**
 * Get calendar events for a given date
 */
export function getCalendarEventsForDate(date: string): CalendarEvent[] {
	return eventsForDate(calendarCache.events, date);
}

/**
 * Get selected date
 */
export function getSelectedDate(): string {
	return selectedDate;
}

/**
 * Set selected date
 */
export function setSelectedDate(date: string) {
	selectedDate = date;
}

/**
 * Get loading state
 */
export function getIsLoading(): boolean {
	return isLoading;
}

/**
 * Set loading state
 */
export function setIsLoading(loading: boolean) {
	isLoading = loading;
}

/**
 * Set load errors (recoverable)
 */
export function setLoadErrors(errors: LoadError[]) {
	loadErrors = errors;
}

/**
 * Get unsaved changes state
 */
export function getHasUnsavedChanges(): boolean {
	return hasUnsavedChanges;
}

/**
 * Get tasks scheduled for selected date
 */
export function getScheduledTasks(): Task[] {
	return scheduledForDay(tasks, selectedDate);
}

/**
 * Get overdue tasks (before selected date)
 */
export function getOverdueTasks(): Task[] {
	return overdueBeforeDay(tasks, selectedDate);
}

/**
 * Get all unique tags from tasks
 */
export function getAllTags(): string[] {
	return allTags(tasks);
}

/**
 * Get all unique contexts from tasks
 */
export function getAllContexts(): string[] {
	return allContexts(tasks);
}

/**
 * Get all unique projects from tasks
 */
export function getAllProjects(): string[] {
	return allProjects(tasks);
}

/**
 * Add a new task
 */
export function addTask(
	title: string,
	parsedData: { tags: string[]; contexts: string[]; project: string | null },
	scheduledDate: string | null = null
): Task {
	const task = createTask({
		title,
		tags: parsedData.tags,
		contexts: parsedData.contexts,
		project: parsedData.project,
		scheduledDate
	});
	tasks = [...tasks, task];
	hasUnsavedChanges = true;
	return task;
}

/**
 * Add a sub-task to a parent task
 */
export function addSubTask(
	parentId: string,
	title: string
): Task {
	const task = createTask({
		title,
		parentId
	});
	tasks = [...tasks, task];
	hasUnsavedChanges = true;
	return task;
}

/**
 * Add a recurring task (creates series template and initial instances)
 */
export function addRecurringTask(
	title: string,
	parsedData: { tags: string[]; contexts: string[]; project: string | null },
	recurrence: Recurrence
): Task {
	// Create the series template
	const template = createTask({
		title,
		tags: parsedData.tags,
		contexts: parsedData.contexts,
		project: parsedData.project,
		isSeriesTemplate: true,
		recurrence,
		scheduledDate: null // Templates don't have scheduled dates
	});

	// Generate instances for the next 30 days
	const today = getTodayDate();
	const windowEnd = getOffsetDate(30);
	const occurrences = generateOccurrences(recurrence, today, windowEnd);

	// Create task instances
	const instances = occurrences.map((date) =>
		createTask({
			title,
			tags: parsedData.tags,
			contexts: parsedData.contexts,
			project: parsedData.project,
			seriesId: template.id,
			scheduledDate: date
		})
	);

	tasks = [...tasks, template, ...instances];
	hasUnsavedChanges = true;
	return template;
}

/**
 * Update a task
 */
export function updateTask(taskId: string, updates: Partial<Task>) {
	tasks = tasks.map((t) =>
		t.id === taskId
			? { ...t, ...updates, updatedAt: new Date().toISOString() }
			: t
	);
	hasUnsavedChanges = true;
}

/**
 * Delete a task
 */
export function deleteTask(taskId: string) {
	tasks = tasks.filter((t) => t.id !== taskId);
	hasUnsavedChanges = true;
}

/**
 * Mark task as complete
 */
export function markTaskComplete(taskId: string) {
	const task = tasks.find((t) => t.id === taskId);
	if (task) {
		const completed = completeTask(task);
		tasks = tasks.map((t) => (t.id === taskId ? completed : t));
		hasUnsavedChanges = true;
	}
}

/**
 * Mark task as incomplete
 */
export function markTaskIncomplete(taskId: string) {
	const task = tasks.find((t) => t.id === taskId);
	if (task) {
		const uncompleted = uncompleteTask(task);
		tasks = tasks.map((t) => (t.id === taskId ? uncompleted : t));
		hasUnsavedChanges = true;
	}
}

/**
 * Reschedule a task
 */
export function rescheduleTaskTo(taskId: string, newDate: string) {
	const task = tasks.find((t) => t.id === taskId);
	if (task) {
		const rescheduled = rescheduleTask(task, newDate);
		tasks = tasks.map((t) => (t.id === taskId ? rescheduled : t));
		hasUnsavedChanges = true;
	}
}

/**
 * Update a task's recurrence (converts to recurring or updates existing)
 */
export function updateTaskRecurrence(taskId: string, recurrence: Recurrence) {
	const task = tasks.find((t) => t.id === taskId);
	if (!task) return;

	// If this is already a series template, just update its recurrence
	if (task.isSeriesTemplate) {
		tasks = tasks.map((t) =>
			t.id === taskId
				? { ...t, recurrence, updatedAt: new Date().toISOString() }
				: t
		);
		hasUnsavedChanges = true;
		return;
	}

	// Convert regular task to recurring: make it a template and generate instances
	const template: Task = {
		...task,
		isSeriesTemplate: true,
		recurrence,
		scheduledDate: null,
		updatedAt: new Date().toISOString()
	};

	// Generate instances for the next 30 days
	const today = getTodayDate();
	const windowEnd = getOffsetDate(30);
	const occurrences = generateOccurrences(recurrence, today, windowEnd);

	const instances = occurrences.map((date) =>
		createTask({
			title: task.title,
			tags: task.tags,
			contexts: task.contexts,
			project: task.project,
			seriesId: template.id,
			scheduledDate: date
		})
	);

	// Replace the original task with template and add instances
	tasks = tasks.map((t) => (t.id === taskId ? template : t));
	tasks = [...tasks, ...instances];
	hasUnsavedChanges = true;
}

/**
 * Remove recurrence from a task (converts back to regular task)
 */
export function removeTaskRecurrence(taskId: string) {
	const task = tasks.find((t) => t.id === taskId);
	if (!task) return;

	if (task.isSeriesTemplate) {
		// Remove all instances of this series and convert template to regular task
		tasks = tasks.filter((t) => t.seriesId !== taskId);
		tasks = tasks.map((t) =>
			t.id === taskId
				? {
						...t,
						isSeriesTemplate: false,
						recurrence: null,
						scheduledDate: getTodayDate(),
						updatedAt: new Date().toISOString()
				  }
				: t
		);
		hasUnsavedChanges = true;
	} else if (task.recurrence) {
		// Just remove recurrence from regular task
		tasks = tasks.map((t) =>
			t.id === taskId
				? { ...t, recurrence: null, updatedAt: new Date().toISOString() }
				: t
		);
		hasUnsavedChanges = true;
	}
}

/**
 * Add a time log entry
 */
export function addTimeLog(taskId: string, date: string, minutes: number, note: string | null = null) {
	const log = createTimeLog(taskId, date, minutes, note);
	timeLogs = [...timeLogs, log];
	hasUnsavedChanges = true;
	return log;
}

/**
 * Delete a time log entry
 */
export function deleteTimeLog(logId: string) {
	timeLogs = timeLogs.filter((l) => l.id !== logId);
	hasUnsavedChanges = true;
}

/**
 * Mark changes as saved
 */
export function markSaved() {
	hasUnsavedChanges = false;
}

/**
 * Get current state for saving
 */
export function getStateForSave(): { tasks: Task[]; timeLogs: TimeLog[]; meta: Meta } {
	return { tasks, timeLogs, meta };
}

/**
 * Reactive getters using $derived
 */
export const store = {
	get tasks() {
		return tasks;
	},
	get timeLogs() {
		return timeLogs;
	},
	get meta() {
		return meta;
	},
	get calendarCache() {
		return calendarCache;
	},
	get calendarEventsForSelectedDate() {
		return eventsForDate(calendarCache.events, selectedDate);
	},
	get selectedDate() {
		return selectedDate;
	},
	get isLoading() {
		return isLoading;
	},
	get hasUnsavedChanges() {
		return hasUnsavedChanges;
	},
	get loadErrors() {
		return loadErrors;
	},
	get scheduledTasks() {
		return scheduledForDay(tasks, selectedDate);
	},
	get overdueTasks() {
		return overdueBeforeDay(tasks, selectedDate);
	},
	get allTags() {
		return allTags(tasks);
	},
	get allContexts() {
		return allContexts(tasks);
	},
	get allProjects() {
		return allProjects(tasks);
	}
};
