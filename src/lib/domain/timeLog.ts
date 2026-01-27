/**
 * TimeLog domain model
 *
 * Manual time logging with date + minutes (no timestamps).
 * Supports backfill for any date.
 */

export interface TimeLog {
	/** Unique identifier (UUID) */
	id: string;

	/** Reference to the task this time was logged for */
	taskId: string;

	/** Date the time was logged for (YYYY-MM-DD) */
	date: string;

	/** Duration in minutes (typically 5-min increments) */
	minutes: number;

	/** Optional note about the time entry */
	note: string | null;

	/** Creation timestamp (ISO string) */
	createdAt: string;
}

/**
 * Create a new time log entry
 */
export function createTimeLog(
	taskId: string,
	date: string,
	minutes: number,
	note: string | null = null
): TimeLog {
	return {
		id: crypto.randomUUID(),
		taskId,
		date,
		minutes: snapToIncrement(minutes),
		note,
		createdAt: new Date().toISOString()
	};
}

/**
 * Snap minutes to increment (default 5 minutes)
 */
export function snapToIncrement(minutes: number, increment = 5): number {
	return Math.round(minutes / increment) * increment;
}

/**
 * Convert clock angle (0-360+) to minutes
 * Starting from 12 o'clock, clockwise
 * Multiple rotations allowed
 */
export function angleToMinutes(angle: number, increment = 5): number {
	// Each full rotation = 60 minutes
	const totalMinutes = (angle / 360) * 60;
	return snapToIncrement(totalMinutes, increment);
}

/**
 * Convert minutes to clock angle
 */
export function minutesToAngle(minutes: number): number {
	return (minutes / 60) * 360;
}

/**
 * Format minutes as human-readable duration
 */
export function formatDuration(minutes: number): string {
	if (minutes < 60) {
		return `${minutes}m`;
	}

	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;

	if (mins === 0) {
		return `${hours}h`;
	}

	return `${hours}h ${mins}m`;
}

/**
 * Get total minutes for a task on a specific date
 */
export function getTotalMinutesForTaskOnDate(
	logs: TimeLog[],
	taskId: string,
	date: string
): number {
	return logs
		.filter((log) => log.taskId === taskId && log.date === date)
		.reduce((sum, log) => sum + log.minutes, 0);
}

/**
 * Get total minutes for a task across all dates
 */
export function getTotalMinutesForTask(
	logs: TimeLog[],
	taskId: string
): number {
	return logs
		.filter((log) => log.taskId === taskId)
		.reduce((sum, log) => sum + log.minutes, 0);
}

/**
 * Get total minutes for a date range
 */
export function getTotalMinutesInRange(
	logs: TimeLog[],
	startDate: string,
	endDate: string
): number {
	return logs
		.filter((log) => log.date >= startDate && log.date <= endDate)
		.reduce((sum, log) => sum + log.minutes, 0);
}

/**
 * Group time logs by task ID
 */
export function groupByTask(logs: TimeLog[]): Map<string, TimeLog[]> {
	const grouped = new Map<string, TimeLog[]>();

	for (const log of logs) {
		const existing = grouped.get(log.taskId) || [];
		existing.push(log);
		grouped.set(log.taskId, existing);
	}

	return grouped;
}

/**
 * Group time logs by date
 */
export function groupByDate(logs: TimeLog[]): Map<string, TimeLog[]> {
	const grouped = new Map<string, TimeLog[]>();

	for (const log of logs) {
		const existing = grouped.get(log.date) || [];
		existing.push(log);
		grouped.set(log.date, existing);
	}

	return grouped;
}
