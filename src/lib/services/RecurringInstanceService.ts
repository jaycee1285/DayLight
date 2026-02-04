/**
 * RecurringInstanceService
 *
 * Manages recurring task instances for Obsidian Bases integration.
 * Responsible for:
 * - Populating active_instances when tasks become due
 * - Running on load and at midnight
 * - Tracking completion/skip history
 */

import { generateOccurrences, type Recurrence } from '$lib/domain/recurrence';
import { formatLocalDate, getTodayDate } from '$lib/domain/task';
import type { TaskFrontmatter, TimeEntry } from '$lib/storage/frontmatter';
import { rruleToRecurrence } from '$lib/storage/frontmatter';

/**
 * Configuration for the recurring instance service
 */
export interface RecurringInstanceConfig {
	/** Number of days to look ahead when generating instances */
	lookAheadDays: number;
	/** Number of days to look behind for past instances */
	lookBehindDays: number;
}

const DEFAULT_CONFIG: RecurringInstanceConfig = {
	lookAheadDays: 30,
	lookBehindDays: 7
};

/**
 * Result of processing recurring instances
 */
export interface ProcessResult {
	/** Number of tasks that were updated */
	updated: number;
	/** Task filenames that were updated */
	updatedFiles: string[];
	/** Any errors encountered */
	errors: Array<{ filename: string; message: string }>;
}

/**
 * Process all recurring tasks and update their active_instances
 *
 * This should be called:
 * - On app/plugin load
 * - At midnight (via scheduler)
 *
 * @param tasks Map of filename to TaskFrontmatter
 * @param config Optional configuration
 * @param today Optional override for today's date (for testing)
 * @returns Processing result with list of updated tasks
 */
export function processRecurringInstances(
	tasks: Map<string, TaskFrontmatter>,
	config: RecurringInstanceConfig = DEFAULT_CONFIG,
	today: string = getTodayDate()
): ProcessResult {
	const windowStart = getDateOffset(today, -config.lookBehindDays);
	const windowEnd = getDateOffset(today, config.lookAheadDays);

	const updated: string[] = [];
	const errors: Array<{ filename: string; message: string }> = [];

	for (const [filename, frontmatter] of tasks) {
		// Skip non-recurring tasks and non-template instances
		if (!frontmatter.recurrence || !frontmatter.isSeriesTemplate) {
			continue;
		}

		try {
			const recurrence = parseRRuleToRecurrence(frontmatter.recurrence);
			if (!recurrence) {
				continue;
			}

			// Generate occurrences within the window
			const occurrences = generateOccurrences(recurrence, windowStart, windowEnd);

			// Check if today is in the occurrences and needs to be added to active_instances
			let wasUpdated = false;

			for (const date of occurrences) {
				if (!frontmatter.active_instances.includes(date)) {
					frontmatter.active_instances.push(date);
					wasUpdated = true;
				}
			}

			// Sort instances chronologically
			if (wasUpdated) {
				frontmatter.active_instances.sort();
				updated.push(filename);
			}
		} catch (error) {
			errors.push({
				filename,
				message: error instanceof Error ? error.message : 'Failed to process recurrence'
			});
		}
	}

	return {
		updated: updated.length,
		updatedFiles: updated,
		errors
	};
}

/**
 * Check if a recurring task should appear in "Now" group
 *
 * @param frontmatter The task frontmatter
 * @param today Optional override for today's date (for testing)
 * @returns true if task is active today
 */
export function isActiveToday(frontmatter: TaskFrontmatter, today: string = getTodayDate()): boolean {
	const rescheduledMap = frontmatter.rescheduled_instances;

	for (const date of frontmatter.active_instances) {
		if (frontmatter.complete_instances.includes(date)) continue;
		if (frontmatter.skipped_instances.includes(date)) continue;

		const effectiveDate = rescheduledMap[date] || date;
		if (effectiveDate === today) return true;
	}

	return false;
}

/**
 * Check if a recurring task has past uncompleted instances
 *
 * @param frontmatter The task frontmatter
 * @param today Optional override for today's date (for testing)
 * @returns true if there are past active instances not in complete/skipped
 */
export function hasPastUncompletedInstances(frontmatter: TaskFrontmatter, today: string = getTodayDate()): boolean {
	// If task has been rescheduled to the future, ignore past instances
	if (frontmatter.scheduled && frontmatter.scheduled > today) {
		return false;
	}

	const rescheduledMap = frontmatter.rescheduled_instances;

	for (const date of frontmatter.active_instances) {
		if (frontmatter.complete_instances.includes(date)) continue;
		if (frontmatter.skipped_instances.includes(date)) continue;

		const effectiveDate = rescheduledMap[date] || date;

		// Only count as past if effective date is before today
		if (effectiveDate >= today) continue;

		return true;
	}

	return false;
}

/**
 * Mark a recurring instance as completed for a specific date
 *
 * @param frontmatter The task frontmatter (modified in place)
 * @param date The date to mark as completed (defaults to today)
 * @returns true if the instance was marked completed
 */
export function completeInstance(
	frontmatter: TaskFrontmatter,
	date: string = getTodayDate()
): boolean {
	// Must be an active instance
	if (!frontmatter.active_instances.includes(date)) {
		return false;
	}

	// Already completed
	if (frontmatter.complete_instances.includes(date)) {
		return false;
	}

	// Remove from skipped if it was there
	const skippedIndex = frontmatter.skipped_instances.indexOf(date);
	if (skippedIndex !== -1) {
		frontmatter.skipped_instances.splice(skippedIndex, 1);
	}

	// Add to completed
	frontmatter.complete_instances.push(date);
	frontmatter.complete_instances.sort();
	frontmatter.dateModified = new Date().toISOString();

	return true;
}

/**
 * Mark a recurring instance as skipped for a specific date
 *
 * @param frontmatter The task frontmatter (modified in place)
 * @param date The date to mark as skipped (defaults to today)
 * @returns true if the instance was marked skipped
 */
export function skipInstance(
	frontmatter: TaskFrontmatter,
	date: string = getTodayDate()
): boolean {
	// Must be an active instance
	if (!frontmatter.active_instances.includes(date)) {
		return false;
	}

	// Already skipped
	if (frontmatter.skipped_instances.includes(date)) {
		return false;
	}

	// Remove from completed if it was there
	const completedIndex = frontmatter.complete_instances.indexOf(date);
	if (completedIndex !== -1) {
		frontmatter.complete_instances.splice(completedIndex, 1);
	}

	// Add to skipped
	frontmatter.skipped_instances.push(date);
	frontmatter.skipped_instances.sort();
	frontmatter.dateModified = new Date().toISOString();

	return true;
}

/**
 * Uncomplete a recurring instance (remove from complete_instances)
 *
 * @param frontmatter The task frontmatter (modified in place)
 * @param date The date to uncomplete (defaults to today)
 * @returns true if the instance was uncompleted
 */
export function uncompleteInstance(
	frontmatter: TaskFrontmatter,
	date: string = getTodayDate()
): boolean {
	const index = frontmatter.complete_instances.indexOf(date);
	if (index === -1) {
		return false;
	}

	frontmatter.complete_instances.splice(index, 1);
	frontmatter.dateModified = new Date().toISOString();

	return true;
}

/**
 * Determine the task date group for Bases view
 *
 * @param frontmatter The task frontmatter
 * @param today Optional override for today's date (for testing)
 * @returns Group name: 'Wrapped', 'Past', 'Now', or 'Upcoming'
 */
export function getTaskDateGroup(frontmatter: TaskFrontmatter, today: string = getTodayDate()): 'Wrapped' | 'Past' | 'Now' | 'Upcoming' {

	// 1. Non-recurring: status=done → Wrapped
	if (frontmatter.status === 'done') {
		return 'Wrapped';
	}

	// 2. Recurring task logic
	if (frontmatter.recurrence) {
		// Has past uncompleted instances → Past
		if (hasPastUncompletedInstances(frontmatter, today)) {
			return 'Past';
		}

		// Today is active and not completed/skipped → Now
		if (isActiveToday(frontmatter, today)) {
			return 'Now';
		}

		// Today's instance completed → Wrapped
		if (frontmatter.complete_instances.includes(today)) {
			return 'Wrapped';
		}

		// Has recurrence but no active instances yet → Upcoming
		return 'Upcoming';
	}

	// 3. Non-recurring: Due or scheduled today → Now
	if (frontmatter.scheduled === today || frontmatter.due === today) {
		return 'Now';
	}

	// 4. Non-recurring: Due or scheduled in past → Past
	if (frontmatter.scheduled && frontmatter.scheduled < today) {
		return 'Past';
	}
	if (frontmatter.due && frontmatter.due < today) {
		return 'Past';
	}

	// 5. Everything else → Upcoming
	return 'Upcoming';
}

/**
 * Calculate urgency score for task sorting
 *
 * @param frontmatter The task frontmatter
 * @param today Optional override for today's date (for testing)
 * @returns Urgency score (higher = more urgent)
 */
export function calculateUrgencyScore(frontmatter: TaskFrontmatter, today: string = getTodayDate()): number {
	const priorityWeight = getPriorityWeight(frontmatter.priority);
	const daysUntilNext = getDaysUntilNext(frontmatter, today);

	if (daysUntilNext === null) {
		return priorityWeight;
	}

	// Add urgency based on proximity (closer = higher score)
	return priorityWeight + Math.max(0, 10 - daysUntilNext);
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
		default: return 999; // Unknown priority sorts last
	}
}

/**
 * Get days until next occurrence (due or scheduled)
 */
function getDaysUntilNext(frontmatter: TaskFrontmatter, today: string = getTodayDate()): number | null {
	const todayMs = new Date(today).getTime();

	let nextDate: string | null = null;

	// Check scheduled date
	if (frontmatter.scheduled && frontmatter.scheduled >= today) {
		nextDate = frontmatter.scheduled;
	}

	// Check due date (prefer earlier)
	if (frontmatter.due && frontmatter.due >= today) {
		if (!nextDate || frontmatter.due < nextDate) {
			nextDate = frontmatter.due;
		}
	}

	if (!nextDate) {
		return null;
	}

	const nextMs = new Date(nextDate).getTime();
	return Math.floor((nextMs - todayMs) / (1000 * 60 * 60 * 24));
}

/**
 * Get date offset by N days
 */
function getDateOffset(dateStr: string, days: number): string {
	const date = new Date(dateStr);
	date.setDate(date.getDate() + days);
	return formatLocalDate(date);
}

/**
 * Parse RRULE string to Recurrence object
 * Wrapper around the frontmatter parser
 */
function parseRRuleToRecurrence(rrule: string): Recurrence | null {
	return rruleToRecurrence(rrule);
}

/**
 * Scheduler for running at midnight
 */
export class RecurringInstanceScheduler {
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private lastRunDate: string | null = null;
	private onUpdate: ((result: ProcessResult) => void) | null = null;
	private getTasks: (() => Map<string, TaskFrontmatter>) | null = null;

	/**
	 * Start the scheduler
	 *
	 * @param getTasks Function to get current tasks
	 * @param onUpdate Callback when tasks are updated
	 */
	start(
		getTasks: () => Map<string, TaskFrontmatter>,
		onUpdate: (result: ProcessResult) => void
	): void {
		this.getTasks = getTasks;
		this.onUpdate = onUpdate;
		this.lastRunDate = getTodayDate();

		// Run immediately
		this.runIfNewDay();

		// Check every minute for day change
		this.intervalId = setInterval(() => {
			this.runIfNewDay();
		}, 60 * 1000);
	}

	/**
	 * Stop the scheduler
	 */
	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	/**
	 * Run if the date has changed since last run
	 */
	private runIfNewDay(): void {
		const today = getTodayDate();

		if (this.lastRunDate !== today) {
			this.lastRunDate = today;
			this.run();
		}
	}

	/**
	 * Run the instance processor
	 */
	run(): ProcessResult {
		if (!this.getTasks) {
			return { updated: 0, updatedFiles: [], errors: [] };
		}

		const tasks = this.getTasks();
		const result = processRecurringInstances(tasks);

		if (this.onUpdate && result.updated > 0) {
			this.onUpdate(result);
		}

		return result;
	}
}

/**
 * Singleton scheduler instance
 */
export const recurringInstanceScheduler = new RecurringInstanceScheduler();
