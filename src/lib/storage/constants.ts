/**
 * Storage constants
 *
 * Canonical filenames and folder layout for Syncthing-friendly storage.
 */

/** Main data files */
export const FILE_TASKS = 'tasks.json';
export const FILE_TIME_LOGS = 'time_logs.json';
export const FILE_META = 'meta.json';

/** Cache files */
export const FILE_CALENDAR_CACHE = 'calendar_cache.json';

/** Conflict archive folder */
export const DIR_CONFLICTS = 'conflicts';

/** Export bundle folder */
export const DIR_EXPORTS = 'exports';

/** Default data folder name */
export const DEFAULT_DATA_FOLDER = 'DayLight';

/** All canonical data filenames */
export const CANONICAL_FILES = [FILE_TASKS, FILE_TIME_LOGS, FILE_META] as const;

/** Syncthing conflict file pattern */
export const SYNCTHING_CONFLICT_PATTERN = /\.sync-conflict-\d{8}-\d{6}/;

/**
 * Check if a filename is a Syncthing conflict variant
 */
export function isSyncthingConflict(filename: string): boolean {
	return SYNCTHING_CONFLICT_PATTERN.test(filename);
}

/**
 * Get the base filename from a conflict variant
 */
export function getBaseFilename(conflictFilename: string): string {
	return conflictFilename.replace(SYNCTHING_CONFLICT_PATTERN, '');
}

/**
 * Generate a conflict archive filename with timestamp
 */
export function generateConflictArchiveName(
	originalFilename: string,
	source: 'local' | 'remote'
): string {
	const now = new Date();
	const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const baseName = originalFilename.replace('.json', '');
	return `${baseName}_${source}_${timestamp}.json`;
}
