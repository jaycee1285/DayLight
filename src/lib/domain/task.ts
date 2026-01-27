/**
 * Task domain model
 *
 * Core entity representing a task in the system.
 * Supports shortcode capture (#tags, @contexts, +project)
 * and recurrence via seriesId reference.
 */

import type { Recurrence } from './recurrence';

export interface Task {
	/** Unique identifier (UUID) */
	id: string;

	/** Task title (may contain unparsed shortcodes during editing) */
	title: string;

	/** Tags extracted from #shortcodes */
	tags: string[];

	/** Contexts extracted from @shortcodes */
	contexts: string[];

	/** Project extracted from +shortcode (flat, single project in v1) */
	project: string | null;

	/** Primary scheduling field - date only (YYYY-MM-DD) */
	scheduledDate: string | null;

	/** Optional start time for scheduled tasks (HH:MM format, 24-hour) */
	startTime: string | null;

	/** Whether the task is completed */
	completed: boolean;

	/** Timestamp when completed (ISO string) */
	completedAt: string | null;

	/** For recurring tasks: reference to the series template */
	seriesId: string | null;

	/** For series templates only: marks this as a template, not an instance */
	isSeriesTemplate: boolean;

	/** Recurrence rule (only on series templates) */
	recurrence: Recurrence | null;

	/** Reference to parent task (for sub-tasks) */
	parentId: string | null;

	/** Creation timestamp (ISO string) */
	createdAt: string;

	/** Last update timestamp (ISO string) */
	updatedAt: string;
}

/**
 * Create a new task with defaults
 */
export function createTask(overrides: Partial<Task> = {}): Task {
	const now = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		title: '',
		tags: [],
		contexts: [],
		project: null,
		scheduledDate: null,
		startTime: null,
		completed: false,
		completedAt: null,
		seriesId: null,
		isSeriesTemplate: false,
		recurrence: null,
		parentId: null,
		createdAt: now,
		updatedAt: now,
		...overrides
	};
}

/**
 * Mark a task as completed
 */
export function completeTask(task: Task): Task {
	return {
		...task,
		completed: true,
		completedAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};
}

/**
 * Mark a task as incomplete
 */
export function uncompleteTask(task: Task): Task {
	return {
		...task,
		completed: false,
		completedAt: null,
		updatedAt: new Date().toISOString()
	};
}

/**
 * Reschedule a task to a new date
 */
export function rescheduleTask(task: Task, newDate: string): Task {
	return {
		...task,
		scheduledDate: newDate,
		updatedAt: new Date().toISOString()
	};
}

/**
 * Update task with parsed shortcode data
 */
export function updateTaskFromParsed(
	task: Task,
	parsed: { title: string; tags: string[]; contexts: string[]; project: string | null }
): Task {
	return {
		...task,
		title: parsed.title,
		tags: parsed.tags,
		contexts: parsed.contexts,
		project: parsed.project,
		updatedAt: new Date().toISOString()
	};
}

/**
 * Format a Date as YYYY-MM-DD in local timezone
 */
export function formatLocalDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * Get today's date as YYYY-MM-DD string (local timezone)
 */
export function getTodayDate(): string {
	return formatLocalDate(new Date());
}

/**
 * Get a date offset from today as YYYY-MM-DD string (local timezone)
 */
export function getOffsetDate(days: number): string {
	const date = new Date();
	date.setDate(date.getDate() + days);
	return formatLocalDate(date);
}

/**
 * Get all sub-tasks for a given parent task
 */
export function getSubTasks(tasks: Task[], parentId: string): Task[] {
	return tasks.filter((t) => t.parentId === parentId);
}

/**
 * Check if a task has any sub-tasks
 */
export function hasSubTasks(tasks: Task[], parentId: string): boolean {
	return tasks.some((t) => t.parentId === parentId);
}

/**
 * Count incomplete sub-tasks for a given parent
 */
export function countIncompleteSubTasks(tasks: Task[], parentId: string): number {
	return tasks.filter((t) => t.parentId === parentId && !t.completed).length;
}

/**
 * Count total sub-tasks for a given parent
 */
export function countSubTasks(tasks: Task[], parentId: string): number {
	return tasks.filter((t) => t.parentId === parentId).length;
}
