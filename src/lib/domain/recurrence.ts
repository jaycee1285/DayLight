/**
 * Recurrence domain model
 *
 * Supports patterns: daily, weekly, every N days, monthly (day-of-month),
 * monthly (nth weekday), yearly.
 *
 * Rule B: Generate occurrences regardless of completion.
 * Rescheduling affects only that instance, never the series rule.
 */

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type WeekDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface Recurrence {
	/** Base frequency */
	frequency: RecurrenceFrequency;

	/** Interval (e.g., every 2 weeks = frequency: weekly, interval: 2) */
	interval: number;

	/** For weekly: which days of the week */
	weekDays?: WeekDay[];

	/** For monthly: day of month (1-31) */
	dayOfMonth?: number;

	/** For monthly nth weekday: which occurrence (1-5, -1 for last) */
	nthWeekday?: number;

	/** For monthly nth weekday: which day */
	weekdayForNth?: WeekDay;

	/** Start date for the recurrence (YYYY-MM-DD) */
	startDate: string;

	/** Optional end date (YYYY-MM-DD) */
	endDate?: string;
}

/**
 * Create a daily recurrence
 */
export function createDailyRecurrence(startDate: string, interval = 1): Recurrence {
	return {
		frequency: 'daily',
		interval,
		startDate
	};
}

/**
 * Create a weekly recurrence
 */
export function createWeeklyRecurrence(
	startDate: string,
	weekDays: WeekDay[] = [],
	interval = 1
): Recurrence {
	return {
		frequency: 'weekly',
		interval,
		weekDays: weekDays.length > 0 ? weekDays : [getWeekDayFromDate(startDate)],
		startDate
	};
}

/**
 * Create a monthly recurrence (day of month)
 */
export function createMonthlyRecurrence(startDate: string, dayOfMonth?: number): Recurrence {
	return {
		frequency: 'monthly',
		interval: 1,
		dayOfMonth: dayOfMonth ?? parseLocalDate(startDate).getDate(),
		startDate
	};
}

/**
 * Create a monthly nth weekday recurrence (e.g., 2nd Tuesday)
 */
export function createMonthlyNthWeekdayRecurrence(
	startDate: string,
	nth: number,
	weekday: WeekDay
): Recurrence {
	return {
		frequency: 'monthly',
		interval: 1,
		nthWeekday: nth,
		weekdayForNth: weekday,
		startDate
	};
}

/**
 * Create a yearly recurrence
 */
export function createYearlyRecurrence(startDate: string): Recurrence {
	return {
		frequency: 'yearly',
		interval: 1,
		startDate
	};
}

/**
 * Parse a YYYY-MM-DD string as local midnight
 */
function parseLocalDate(dateStr: string): Date {
	const [year, month, day] = dateStr.split('-').map(Number);
	return new Date(year, month - 1, day);  // Local midnight
}

/**
 * Get weekday from date string (local timezone)
 */
function getWeekDayFromDate(dateStr: string): WeekDay {
	const days: WeekDay[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
	return days[parseLocalDate(dateStr).getDay()];  // Use local day, not UTC
}

/**
 * Get weekday index (0-6, Sun-Sat)
 */
function getWeekDayIndex(day: WeekDay): number {
	const days: WeekDay[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
	return days.indexOf(day);
}

/**
 * Generate occurrence dates within a window
 *
 * @param recurrence The recurrence rule
 * @param windowStart Start of materialization window (YYYY-MM-DD)
 * @param windowEnd End of materialization window (YYYY-MM-DD)
 * @returns Array of date strings (YYYY-MM-DD)
 */
export function generateOccurrences(
	recurrence: Recurrence,
	windowStart: string,
	windowEnd: string
): string[] {
	const occurrences: string[] = [];
	const start = parseLocalDate(recurrence.startDate);
	const winStart = parseLocalDate(windowStart);
	const winEnd = parseLocalDate(windowEnd);
	const end = recurrence.endDate ? parseLocalDate(recurrence.endDate) : winEnd;

	// Don't generate before start date
	let current = new Date(Math.max(start.getTime(), winStart.getTime()));

	// Limit iterations to prevent infinite loops (10 years of daily = ~3650)
	const maxIterations = 5000;
	let iterations = 0;

	while (current <= winEnd && current <= end && iterations < maxIterations) {
		iterations++;

		const dateStr = formatDate(current);

		if (isOccurrence(recurrence, current, start)) {
			if (current >= winStart && current >= start) {
				occurrences.push(dateStr);
			}
		}

		// Advance to next potential date
		current = advanceDate(recurrence, current);
	}

	return occurrences;
}

/**
 * Check if a date is an occurrence based on the recurrence rule
 */
function isOccurrence(recurrence: Recurrence, date: Date, startDate: Date): boolean {
	switch (recurrence.frequency) {
		case 'daily':
			return isDailyOccurrence(recurrence, date, startDate);
		case 'weekly':
			return isWeeklyOccurrence(recurrence, date, startDate);
		case 'monthly':
			return isMonthlyOccurrence(recurrence, date, startDate);
		case 'yearly':
			return isYearlyOccurrence(recurrence, date, startDate);
		default:
			return false;
	}
}

function isDailyOccurrence(recurrence: Recurrence, date: Date, startDate: Date): boolean {
	const daysDiff = Math.floor(
		(date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
	);
	return daysDiff >= 0 && daysDiff % recurrence.interval === 0;
}

function isWeeklyOccurrence(recurrence: Recurrence, date: Date, startDate: Date): boolean {
	// Check if it's the right day of the week
	const weekDays = recurrence.weekDays || [];
	const currentDay = getWeekDayFromDate(formatDate(date));

	if (!weekDays.includes(currentDay)) {
		return false;
	}

	// Check interval (weeks since start)
	const weeksDiff = Math.floor(
		(date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
	);
	return weeksDiff >= 0 && weeksDiff % recurrence.interval === 0;
}

function isMonthlyOccurrence(recurrence: Recurrence, date: Date, startDate: Date): boolean {
	// Check if we're in the right month interval
	const monthsDiff =
		(date.getFullYear() - startDate.getFullYear()) * 12 +
		(date.getMonth() - startDate.getMonth());

	if (monthsDiff < 0 || monthsDiff % recurrence.interval !== 0) {
		return false;
	}

	// Check nth weekday pattern
	if (recurrence.nthWeekday !== undefined && recurrence.weekdayForNth) {
		return isNthWeekdayOfMonth(date, recurrence.nthWeekday, recurrence.weekdayForNth);
	}

	// Check day of month pattern
	if (recurrence.dayOfMonth !== undefined) {
		return date.getDate() === recurrence.dayOfMonth;
	}

	return false;
}

function isYearlyOccurrence(recurrence: Recurrence, date: Date, startDate: Date): boolean {
	const yearsDiff = date.getFullYear() - startDate.getFullYear();
	if (yearsDiff < 0 || yearsDiff % recurrence.interval !== 0) {
		return false;
	}

	return (
		date.getMonth() === startDate.getMonth() &&
		date.getDate() === startDate.getDate()
	);
}

/**
 * Check if date is the nth weekday of the month (local timezone)
 */
function isNthWeekdayOfMonth(date: Date, nth: number, weekday: WeekDay): boolean {
	const targetDayIndex = getWeekDayIndex(weekday);

	if (date.getDay() !== targetDayIndex) {
		return false;
	}

	if (nth === -1) {
		// Last occurrence of this weekday in the month
		const nextWeek = new Date(date);
		nextWeek.setDate(nextWeek.getDate() + 7);
		return nextWeek.getMonth() !== date.getMonth();
	}

	// Count which occurrence this is
	const dayOfMonth = date.getDate();
	const occurrence = Math.ceil(dayOfMonth / 7);
	return occurrence === nth;
}

/**
 * Advance date to next potential occurrence (local timezone)
 */
function advanceDate(recurrence: Recurrence, date: Date): Date {
	const next = new Date(date);

	switch (recurrence.frequency) {
		case 'daily':
			next.setDate(next.getDate() + 1);
			break;
		case 'weekly':
			next.setDate(next.getDate() + 1);
			break;
		case 'monthly':
			next.setDate(next.getDate() + 1);
			break;
		case 'yearly':
			next.setDate(next.getDate() + 1);
			break;
	}

	return next;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
	// Use local date components to avoid UTC offset issues
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * Human-readable description of a recurrence
 */
export function describeRecurrence(recurrence: Recurrence): string {
	const { frequency, interval, weekDays, dayOfMonth, nthWeekday, weekdayForNth } = recurrence;

	switch (frequency) {
		case 'daily':
			return interval === 1 ? 'Every day' : `Every ${interval} days`;

		case 'weekly':
			if (interval === 1 && weekDays && weekDays.length === 1) {
				return `Weekly on ${fullWeekdayName(weekDays[0])}`;
			}
			if (interval === 1 && weekDays && weekDays.length > 1) {
				// Check for Mon-Fri pattern
				if (isWeekdaysPattern(weekDays)) {
					return 'Mon-Fri';
				}
				// Use abbreviated format: "We, Th, Fr"
				return weekDays.map(shortWeekdayName).join(', ');
			}
			return `Every ${interval} weeks`;

		case 'monthly':
			if (nthWeekday !== undefined && weekdayForNth) {
				const ordinal = nthWeekday === -1 ? 'last' : getOrdinal(nthWeekday);
				return `Monthly on ${ordinal} ${fullWeekdayName(weekdayForNth)}`;
			}
			if (dayOfMonth !== undefined) {
				return `Monthly on ${getOrdinal(dayOfMonth)}`;
			}
			return 'Monthly';

		case 'yearly':
			return interval === 1 ? 'Yearly' : `Every ${interval} years`;

		default:
			return 'Unknown';
	}
}

/**
 * Short format for displaying in task rows (more compact)
 */
export function formatRecurrenceShort(recurrence: Recurrence): string {
	const { frequency, interval, weekDays, dayOfMonth, nthWeekday, weekdayForNth } = recurrence;

	switch (frequency) {
		case 'daily':
			return interval === 1 ? 'Every day' : `Every ${interval} days`;

		case 'weekly':
			if (weekDays && weekDays.length > 0) {
				// Check for Mon-Fri pattern
				if (isWeekdaysPattern(weekDays)) {
					return 'Mon-Fri';
				}
				// Single day: "Weekly on Wed"
				if (weekDays.length === 1) {
					return `Weekly on ${fullWeekdayName(weekDays[0])}`;
				}
				// Multiple days: "We, Th, Fr"
				return weekDays.map(shortWeekdayName).join(', ');
			}
			return interval === 1 ? 'Weekly' : `Every ${interval} weeks`;

		case 'monthly':
			if (nthWeekday !== undefined && weekdayForNth) {
				const ordinal = nthWeekday === -1 ? 'last' : getOrdinal(nthWeekday);
				return `${ordinal} ${shortWeekdayName(weekdayForNth)}`;
			}
			if (dayOfMonth !== undefined) {
				return `Monthly on ${getOrdinal(dayOfMonth)}`;
			}
			return 'Monthly';

		case 'yearly':
			return 'Yearly';

		default:
			return '';
	}
}

/**
 * Check if weekDays represents Mon-Fri (weekdays only)
 */
function isWeekdaysPattern(weekDays: WeekDay[]): boolean {
	const weekdaysSet = new Set(weekDays);
	const expectedWeekdays: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
	if (weekdaysSet.size !== 5) return false;
	return expectedWeekdays.every((d) => weekdaysSet.has(d));
}

/**
 * Short weekday name (2-letter abbreviation with capital)
 */
function shortWeekdayName(day: WeekDay): string {
	const names: Record<WeekDay, string> = {
		sun: 'Su',
		mon: 'Mo',
		tue: 'Tu',
		wed: 'We',
		thu: 'Th',
		fri: 'Fr',
		sat: 'Sa'
	};
	return names[day];
}

/**
 * Full weekday name (capitalized)
 */
function fullWeekdayName(day: WeekDay): string {
	const names: Record<WeekDay, string> = {
		sun: 'Sun',
		mon: 'Mon',
		tue: 'Tue',
		wed: 'Wed',
		thu: 'Thu',
		fri: 'Fri',
		sat: 'Sat'
	};
	return names[day];
}

function getOrdinal(n: number): string {
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
