/**
 * Shortcode parser
 *
 * Extracts #tags, @contexts, and +project from task title text.
 * Supports fast capture during typing.
 */

export interface ParsedShortcodes {
	/** Clean title with shortcodes removed */
	title: string;
	/** Extracted tags (from #shortcodes) */
	tags: string[];
	/** Extracted contexts (from @shortcodes) */
	contexts: string[];
	/** Extracted project (from +shortcode, only first one) */
	project: string | null;
}

/** Regex patterns for shortcode extraction */
const TAG_PATTERN = /#([a-zA-Z0-9_-]+)/g;
const CONTEXT_PATTERN = /@([a-zA-Z0-9_-]+)/g;
const PROJECT_PATTERN = /\+([a-zA-Z0-9_-]+)/g;

/**
 * Parse text and extract shortcodes
 */
export function parseShortcodes(text: string): ParsedShortcodes {
	const tags: string[] = [];
	const contexts: string[] = [];
	let project: string | null = null;

	// Extract tags
	let match: RegExpExecArray | null;
	const tagRegex = new RegExp(TAG_PATTERN);
	while ((match = tagRegex.exec(text)) !== null) {
		const tag = match[1].toLowerCase();
		if (!tags.includes(tag)) {
			tags.push(tag);
		}
	}

	// Extract contexts
	const contextRegex = new RegExp(CONTEXT_PATTERN);
	while ((match = contextRegex.exec(text)) !== null) {
		const context = match[1].toLowerCase();
		if (!contexts.includes(context)) {
			contexts.push(context);
		}
	}

	// Extract project (only first one)
	const projectRegex = new RegExp(PROJECT_PATTERN);
	match = projectRegex.exec(text);
	if (match) {
		project = match[1].toLowerCase();
	}

	// Create clean title by removing all shortcodes
	const title = text
		.replace(TAG_PATTERN, '')
		.replace(CONTEXT_PATTERN, '')
		.replace(PROJECT_PATTERN, '')
		.replace(/\s+/g, ' ')
		.trim();

	return { title, tags, contexts, project };
}

/**
 * Find partial shortcodes being typed (for autocomplete)
 * Returns the current partial if cursor is inside a shortcode
 */
export interface PartialShortcode {
	type: 'tag' | 'context' | 'project';
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
		if (char === '#' || char === '@' || char === '+') {
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
	if (prefix !== '#' && prefix !== '@' && prefix !== '+') {
		return null;
	}

	// Find end of shortcode (could be at cursor or beyond)
	let end = cursorPosition;
	while (end < text.length && /[a-zA-Z0-9_-]/.test(text[end])) {
		end++;
	}

	const partial = text.slice(start, cursorPosition).toLowerCase();

	const type: PartialShortcode['type'] =
		prefix === '#' ? 'tag' : prefix === '@' ? 'context' : 'project';

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
	const prefix = partial.type === 'tag' ? '#' : partial.type === 'context' ? '@' : '+';
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

export function normalizeContext(context: string): string {
	return context.toLowerCase().trim();
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
	contexts: string[],
	project: string | null
): string {
	const parts = [title];

	if (project) {
		parts.push(`+${project}`);
	}

	for (const context of contexts) {
		parts.push(`@${context}`);
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
	return TAG_PATTERN.test(text) || CONTEXT_PATTERN.test(text) || PROJECT_PATTERN.test(text);
}

/**
 * Get all shortcode tokens from text (for highlighting)
 */
export interface ShortcodeToken {
	type: 'tag' | 'context' | 'project' | 'text';
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
		if (value.startsWith('#')) type = 'tag';
		else if (value.startsWith('@')) type = 'context';
		else if (value.startsWith('+')) type = 'project';

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
