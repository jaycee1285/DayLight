/**
 * Shortcode parser
 *
 * Extracts #tags, +project, @date, and @recurrence from task title text.
 *
 * Syntax:
 *   #tag          → tag
 *   +project      → project (first one wins)
 *   @tom           → scheduled: tomorrow
 *   @d22           → scheduled: 22nd of this month
 *   @d3-15         → scheduled: March 15th this year
 *   @d             → recurrence: daily
 *   @w             → recurrence: weekly
 *   @wMWF          → recurrence: weekly on Mon/Wed/Fri
 *   @m             → recurrence: monthly (today's day-of-month)
 *   @m15           → recurrence: monthly on 15th
 *   @3d            → recurrence: every 3 days
 *   @2w            → recurrence: every 2 weeks
 */

import type { Recurrence, WeekDay } from '../domain/recurrence';
import { getTodayDate, getOffsetDate, formatLocalDate } from '../domain/task';

export interface ParsedShortcodes {
	/** Clean title with shortcodes removed */
	title: string;
	/** Extracted tags (from #shortcodes) */
	tags: string[];
	/** Extracted project (from +shortcode, only first one) */
	project: string | null;
	/** Extracted scheduled date (YYYY-MM-DD) from @date shortcodes */
	scheduled: string | null;
	/** Extracted recurrence from @recurrence shortcodes */
	recurrence: Recurrence | null;
}

/** Day letter map: single char → WeekDay */
const DAY_LETTER_MAP: Record<string, WeekDay> = {
	M: 'mon',
	T: 'tue',
	W: 'wed',
	R: 'thu',
	F: 'fri',
	S: 'sat',
	U: 'sun'
};

/** Regex patterns */
const TAG_PATTERN = /#([a-zA-Z0-9_-]+)/g;
const PROJECT_PATTERN = /\+([a-zA-Z0-9_-]+)/g;

/**
 * All @-shortcode patterns, tested in order.
 * Each returns { type, match } or null.
 */
const AT_PATTERNS: Array<{
	regex: RegExp;
	parse: (match: RegExpExecArray) => { scheduled?: string; recurrence?: Recurrence } | null;
}> = [
	// @tom → tomorrow
	{
		regex: /^@tom$/i,
		parse: () => ({ scheduled: getOffsetDate(1) })
	},
	// @d{M}-{D} → date with month-day (e.g. @d3-15 = March 15)
	{
		regex: /^@d(\d{1,2})-(\d{1,2})$/,
		parse: (m) => {
			const month = parseInt(m[1], 10);
			const day = parseInt(m[2], 10);
			if (month < 1 || month > 12 || day < 1 || day > 31) return null;
			const year = new Date().getFullYear();
			const monthStr = String(month).padStart(2, '0');
			const dayStr = String(day).padStart(2, '0');
			return { scheduled: `${year}-${monthStr}-${dayStr}` };
		}
	},
	// @d{N} where N >= 1 → date: Nth of this month
	{
		regex: /^@d(\d{1,2})$/,
		parse: (m) => {
			const day = parseInt(m[1], 10);
			if (day < 1 || day > 31) return null;
			const now = new Date();
			const year = now.getFullYear();
			const month = String(now.getMonth() + 1).padStart(2, '0');
			const dayStr = String(day).padStart(2, '0');
			return { scheduled: `${year}-${month}-${dayStr}` };
		}
	},
	// @{N}d → recurrence: every N days (N >= 2)
	{
		regex: /^@(\d+)d$/,
		parse: (m) => {
			const interval = parseInt(m[1], 10);
			if (interval < 1) return null;
			return {
				recurrence: {
					frequency: 'daily' as const,
					interval,
					startDate: getTodayDate()
				}
			};
		}
	},
	// @{N}w → recurrence: every N weeks (N >= 2)
	{
		regex: /^@(\d+)w$/,
		parse: (m) => {
			const interval = parseInt(m[1], 10);
			if (interval < 1) return null;
			return {
				recurrence: {
					frequency: 'weekly' as const,
					interval,
					startDate: getTodayDate()
				}
			};
		}
	},
	// @w{DAYS} → weekly on specific days (e.g. @wMWF)
	{
		regex: /^@w([MTWRFSU]+)$/,
		parse: (m) => {
			const dayLetters = m[1];
			const weekDays: WeekDay[] = [];
			for (const ch of dayLetters) {
				const day = DAY_LETTER_MAP[ch];
				if (!day) return null;
				if (!weekDays.includes(day)) weekDays.push(day);
			}
			if (weekDays.length === 0) return null;
			return {
				recurrence: {
					frequency: 'weekly' as const,
					interval: 1,
					weekDays,
					startDate: getTodayDate()
				}
			};
		}
	},
	// @m{N} → monthly on Nth day
	{
		regex: /^@m(\d{1,2})$/,
		parse: (m) => {
			const dayOfMonth = parseInt(m[1], 10);
			if (dayOfMonth < 1 || dayOfMonth > 31) return null;
			return {
				recurrence: {
					frequency: 'monthly' as const,
					interval: 1,
					dayOfMonth,
					startDate: getTodayDate()
				}
			};
		}
	},
	// @d → daily recurrence (bare, no digits)
	{
		regex: /^@d$/,
		parse: () => ({
			recurrence: {
				frequency: 'daily' as const,
				interval: 1,
				startDate: getTodayDate()
			}
		})
	},
	// @w → weekly recurrence (bare, no day letters)
	{
		regex: /^@w$/,
		parse: () => ({
			recurrence: {
				frequency: 'weekly' as const,
				interval: 1,
				startDate: getTodayDate()
			}
		})
	},
	// @m → monthly recurrence (bare, anchored to today's day-of-month)
	{
		regex: /^@m$/,
		parse: () => ({
			recurrence: {
				frequency: 'monthly' as const,
				interval: 1,
				dayOfMonth: new Date().getDate(),
				startDate: getTodayDate()
			}
		})
	}
];

/**
 * Try to parse an @-token as a date or recurrence shortcode.
 * Returns the parsed result or null if unrecognized.
 */
function parseAtToken(token: string): { scheduled?: string; recurrence?: Recurrence } | null {
	for (const pattern of AT_PATTERNS) {
		const match = pattern.regex.exec(token);
		if (match) {
			return pattern.parse(match);
		}
	}
	return null;
}

/**
 * Parse text and extract shortcodes
 */
export function parseShortcodes(text: string): ParsedShortcodes {
	const tags: string[] = [];
	let project: string | null = null;
	let scheduled: string | null = null;
	let recurrence: Recurrence | null = null;

	// Extract tags
	let match: RegExpExecArray | null;
	const tagRegex = new RegExp(TAG_PATTERN);
	while ((match = tagRegex.exec(text)) !== null) {
		const tag = match[1].toLowerCase();
		if (!tags.includes(tag)) {
			tags.push(tag);
		}
	}

	// Extract project (only first one)
	const projectRegex = new RegExp(PROJECT_PATTERN);
	match = projectRegex.exec(text);
	if (match) {
		project = match[1].toLowerCase();
	}

	// Extract @-tokens and try to parse as date/recurrence
	const atTokenRegex = /@([a-zA-Z0-9_-]+)/g;
	const atTokensToRemove: string[] = [];

	while ((match = atTokenRegex.exec(text)) !== null) {
		const fullToken = match[0]; // e.g. "@wMWF"
		const parsed = parseAtToken(fullToken);
		if (parsed) {
			if (parsed.scheduled && !scheduled) {
				scheduled = parsed.scheduled;
			}
			if (parsed.recurrence && !recurrence) {
				recurrence = parsed.recurrence;
			}
			atTokensToRemove.push(fullToken);
		}
		// Unrecognized @tokens are left in the title
	}

	// Create clean title by removing recognized shortcodes
	let title = text;
	// Remove tags and projects
	title = title.replace(TAG_PATTERN, '').replace(PROJECT_PATTERN, '');
	// Remove recognized @-tokens
	for (const token of atTokensToRemove) {
		title = title.replace(token, '');
	}
	title = title.replace(/\s+/g, ' ').trim();

	return { title, tags, project, scheduled, recurrence };
}

/**
 * Find partial shortcodes being typed (for autocomplete)
 * Returns the current partial if cursor is inside a shortcode
 */
export interface PartialShortcode {
	type: 'tag' | 'project';
	partial: string;
	startIndex: number;
	endIndex: number;
}

/**
 * Find partial shortcode at cursor position
 */
export function findPartialShortcode(
	text: string,
	cursorPosition: number
): PartialShortcode | null {
	// Look backwards from cursor to find start of potential shortcode
	let start = cursorPosition;
	while (start > 0) {
		const char = text[start - 1];
		if (char === '#' || char === '+') {
			break;
		}
		if (!/[a-zA-Z0-9_-]/.test(char)) {
			return null; // Not in a shortcode
		}
		start--;
	}

	if (start === 0) {
		return null; // No shortcode prefix found
	}

	const prefix = text[start - 1];
	if (prefix !== '#' && prefix !== '+') {
		return null;
	}

	// Find end of shortcode (could be at cursor or beyond)
	let end = cursorPosition;
	while (end < text.length && /[a-zA-Z0-9_-]/.test(text[end])) {
		end++;
	}

	const partial = text.slice(start, cursorPosition).toLowerCase();

	const type: PartialShortcode['type'] = prefix === '#' ? 'tag' : 'project';

	return {
		type,
		partial,
		startIndex: start - 1, // Include the prefix
		endIndex: end
	};
}

/**
 * Replace a partial shortcode with a completed one
 */
export function completeShortcode(
	text: string,
	partial: PartialShortcode,
	completion: string
): string {
	const prefix = partial.type === 'tag' ? '#' : '+';
	const before = text.slice(0, partial.startIndex);
	const after = text.slice(partial.endIndex);
	return `${before}${prefix}${completion} ${after}`.replace(/\s+/g, ' ');
}

/**
 * Normalize shortcode values (lowercase, trim)
 */
export function normalizeTag(tag: string): string {
	return tag.toLowerCase().trim();
}

export function normalizeProject(project: string): string {
	return project.toLowerCase().trim();
}

/**
 * Format a task title with shortcodes
 * Useful for displaying or editing
 */
export function formatWithShortcodes(
	title: string,
	tags: string[],
	project: string | null
): string {
	const parts = [title];

	if (project) {
		parts.push(`+${project}`);
	}

	for (const tag of tags) {
		parts.push(`#${tag}`);
	}

	return parts.join(' ');
}

/**
 * Check if text contains any shortcodes
 */
export function hasShortcodes(text: string): boolean {
	return TAG_PATTERN.test(text) || PROJECT_PATTERN.test(text) || /@[a-zA-Z0-9]/.test(text);
}

/**
 * Get all shortcode tokens from text (for highlighting)
 */
export interface ShortcodeToken {
	type: 'tag' | 'project' | 'date' | 'recurrence' | 'text';
	value: string;
	startIndex: number;
	endIndex: number;
}

export function tokenize(text: string): ShortcodeToken[] {
	const tokens: ShortcodeToken[] = [];
	const pattern = /(#[a-zA-Z0-9_-]+)|(@[a-zA-Z0-9_-]+)|(\+[a-zA-Z0-9_-]+)/g;

	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(text)) !== null) {
		// Add text before this match
		if (match.index > lastIndex) {
			tokens.push({
				type: 'text',
				value: text.slice(lastIndex, match.index),
				startIndex: lastIndex,
				endIndex: match.index
			});
		}

		// Determine token type
		const value = match[0];
		let type: ShortcodeToken['type'] = 'text';
		if (value.startsWith('#')) {
			type = 'tag';
		} else if (value.startsWith('+')) {
			type = 'project';
		} else if (value.startsWith('@')) {
			// Check if it's a recognized date/recurrence token
			const parsed = parseAtToken(value);
			if (parsed) {
				type = parsed.recurrence ? 'recurrence' : 'date';
			} else {
				type = 'text'; // Unrecognized @token, treat as plain text
			}
		}

		tokens.push({
			type,
			value,
			startIndex: match.index,
			endIndex: match.index + value.length
		});

		lastIndex = match.index + value.length;
	}

	// Add remaining text
	if (lastIndex < text.length) {
		tokens.push({
			type: 'text',
			value: text.slice(lastIndex),
			startIndex: lastIndex,
			endIndex: text.length
		});
	}

	return tokens;
}
