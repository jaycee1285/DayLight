/**
 * Domain selectors
 *
 * Pure functions for querying and filtering domain objects.
 */

import type { Task } from './task';
import type { TimeLog } from './timeLog';

/**
 * Create a map of tasks by ID for fast lookup
 */
export function tasksById(tasks: Task[]): Map<string, Task> {
	return new Map(tasks.map((task) => [task.id, task]));
}

/**
 * Create a map of time logs by ID for fast lookup
 */
export function timeLogsById(logs: TimeLog[]): Map<string, TimeLog> {
	return new Map(logs.map((log) => [log.id, log]));
}

/**
 * Get tasks scheduled for a specific day (incomplete only, excludes sub-tasks)
 */
export function scheduledForDay(tasks: Task[], date: string): Task[] {
	return tasks.filter(
		(task) =>
			task.scheduledDate === date &&
			!task.completed &&
			!task.isSeriesTemplate &&
			!task.parentId
	);
}

/**
 * Get tasks scheduled for a specific day (including completed, excludes sub-tasks)
 */
export function allScheduledForDay(tasks: Task[], date: string): Task[] {
	return tasks.filter(
		(task) =>
			task.scheduledDate === date &&
			!task.isSeriesTemplate &&
			!task.parentId
	);
}

/**
 * Get overdue tasks (scheduled before the given day, incomplete, excludes sub-tasks)
 */
export function overdueBeforeDay(tasks: Task[], date: string): Task[] {
	return tasks.filter(
		(task) =>
			task.scheduledDate !== null &&
			task.scheduledDate < date &&
			!task.completed &&
			!task.isSeriesTemplate &&
			!task.parentId
	);
}

/**
 * Get all incomplete tasks
 */
export function incompleteTasks(tasks: Task[]): Task[] {
	return tasks.filter((task) => !task.completed && !task.isSeriesTemplate);
}

/**
 * Get completed tasks
 */
export function completedTasks(tasks: Task[]): Task[] {
	return tasks.filter((task) => task.completed && !task.isSeriesTemplate);
}

/**
 * Get tasks by tag
 */
export function tasksByTag(tasks: Task[], tag: string): Task[] {
	const normalizedTag = tag.toLowerCase();
	return tasks.filter(
		(task) =>
			task.tags.some((t) => t.toLowerCase() === normalizedTag) &&
			!task.isSeriesTemplate
	);
}

/**
 * Get tasks by context
 */
export function tasksByContext(tasks: Task[], context: string): Task[] {
	const normalizedContext = context.toLowerCase();
	return tasks.filter(
		(task) =>
			task.contexts.some((c) => c.toLowerCase() === normalizedContext) &&
			!task.isSeriesTemplate
	);
}

/**
 * Get tasks by project
 */
export function tasksByProject(tasks: Task[], project: string): Task[] {
	const normalizedProject = project.toLowerCase();
	return tasks.filter(
		(task) =>
			task.project?.toLowerCase() === normalizedProject &&
			!task.isSeriesTemplate
	);
}

/**
 * Get all unique tags from tasks
 */
export function allTags(tasks: Task[]): string[] {
	const tags = new Set<string>();
	for (const task of tasks) {
		for (const tag of task.tags) {
			tags.add(tag.toLowerCase());
		}
	}
	return Array.from(tags).sort();
}

/**
 * Get all unique contexts from tasks
 */
export function allContexts(tasks: Task[]): string[] {
	const contexts = new Set<string>();
	for (const task of tasks) {
		for (const context of task.contexts) {
			contexts.add(context.toLowerCase());
		}
	}
	return Array.from(contexts).sort();
}

/**
 * Get all unique projects from tasks
 */
export function allProjects(tasks: Task[]): string[] {
	const projects = new Set<string>();
	for (const task of tasks) {
		if (task.project) {
			projects.add(task.project.toLowerCase());
		}
	}
	return Array.from(projects).sort();
}

/**
 * Get series templates only
 */
export function seriesTemplates(tasks: Task[]): Task[] {
	return tasks.filter((task) => task.isSeriesTemplate);
}

/**
 * Get instances of a specific series
 */
export function seriesInstances(tasks: Task[], seriesId: string): Task[] {
	return tasks.filter(
		(task) =>
			task.seriesId === seriesId &&
			!task.isSeriesTemplate
	);
}

/**
 * Get time logs for a date range
 */
export function timeLogsInRange(logs: TimeLog[], startDate: string, endDate: string): TimeLog[] {
	return logs.filter((log) => log.date >= startDate && log.date <= endDate);
}

/**
 * Get time logs for a specific task
 */
export function timeLogsForTask(logs: TimeLog[], taskId: string): TimeLog[] {
	return logs.filter((log) => log.taskId === taskId);
}

/**
 * Aggregate time by project for a date range
 */
export function timeByProject(
	logs: TimeLog[],
	tasks: Task[],
	startDate: string,
	endDate: string
): Map<string, number> {
	const taskMap = tasksById(tasks);
	const byProject = new Map<string, number>();

	for (const log of timeLogsInRange(logs, startDate, endDate)) {
		const task = taskMap.get(log.taskId);
		const project = task?.project ?? 'Uncategorized';
		const current = byProject.get(project) ?? 0;
		byProject.set(project, current + log.minutes);
	}

	return byProject;
}

/**
 * Aggregate time by tag for a date range
 */
export function timeByTag(
	logs: TimeLog[],
	tasks: Task[],
	startDate: string,
	endDate: string
): Map<string, number> {
	const taskMap = tasksById(tasks);
	const byTag = new Map<string, number>();

	for (const log of timeLogsInRange(logs, startDate, endDate)) {
		const task = taskMap.get(log.taskId);
		const tags = task?.tags ?? [];

		if (tags.length === 0) {
			const current = byTag.get('Untagged') ?? 0;
			byTag.set('Untagged', current + log.minutes);
		} else {
			for (const tag of tags) {
				const current = byTag.get(tag) ?? 0;
				byTag.set(tag, current + log.minutes);
			}
		}
	}

	return byTag;
}

/**
 * Sort tasks by scheduled date (earliest first, null dates last)
 */
export function sortByScheduledDate(tasks: Task[]): Task[] {
	return [...tasks].sort((a, b) => {
		if (a.scheduledDate === null && b.scheduledDate === null) return 0;
		if (a.scheduledDate === null) return 1;
		if (b.scheduledDate === null) return -1;
		return a.scheduledDate.localeCompare(b.scheduledDate);
	});
}

/**
 * Sort tasks by creation date (newest first)
 */
export function sortByCreatedAt(tasks: Task[]): Task[] {
	return [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Get tasks with start times for a specific day (excludes sub-tasks)
 */
export function tasksWithStartTimeForDay(tasks: Task[], date: string): Task[] {
	return tasks
		.filter(
			(task) =>
				task.scheduledDate === date &&
				task.startTime !== null &&
				!task.completed &&
				!task.isSeriesTemplate &&
				!task.parentId
		)
		.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
}

/**
 * Get tasks without start times for a specific day (incomplete only, excludes sub-tasks)
 */
export function tasksWithoutStartTimeForDay(tasks: Task[], date: string): Task[] {
	return tasks.filter(
		(task) =>
			task.scheduledDate === date &&
			task.startTime === null &&
			!task.completed &&
			!task.isSeriesTemplate &&
			!task.parentId
	);
}

/**
 * Get sub-tasks for a parent task
 */
export function subTasksForParent(tasks: Task[], parentId: string): Task[] {
	return tasks.filter((task) => task.parentId === parentId);
}

/**
 * Get incomplete sub-tasks for a parent task
 */
export function incompleteSubTasksForParent(tasks: Task[], parentId: string): Task[] {
	return tasks.filter((task) => task.parentId === parentId && !task.completed);
}

/**
 * Get tasks completed on a specific day (excludes sub-tasks and series templates)
 */
export function completedForDay(tasks: Task[], date: string): Task[] {
	return tasks.filter(
		(task) =>
			task.completed &&
			task.completedAt?.startsWith(date) &&
			!task.isSeriesTemplate &&
			!task.parentId
	);
}
