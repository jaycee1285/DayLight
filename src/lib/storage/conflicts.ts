/**
 * Conflict detection and resolution
 *
 * Handles Syncthing conflict files and save-time conflict detection.
 */

import {
	exists,
	readDir,
	readTextFile,
	writeTextFile,
	rename,
	remove,
	mkdir,
	copyFile
} from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

import {
	FILE_TASKS,
	FILE_TIME_LOGS,
	FILE_META,
	DIR_CONFLICTS,
	SYNCTHING_CONFLICT_PATTERN,
	isSyncthingConflict,
	getBaseFilename,
	generateConflictArchiveName
} from './constants';
import { getDataPath } from './storage';

/**
 * Detected conflict information
 */
export interface ConflictInfo {
	/** Unique ID for this conflict */
	id: string;
	/** Original canonical filename (e.g., tasks.json) */
	canonicalFile: string;
	/** Path to the conflict file */
	conflictFile: string;
	/** Conflict file name */
	conflictFileName: string;
	/** When the conflict was detected */
	detectedAt: string;
	/** Size of canonical file in bytes */
	canonicalSize?: number;
	/** Size of conflict file in bytes */
	conflictSize?: number;
}

/**
 * Scan for Syncthing conflict files in the data directory
 */
export async function scanForConflicts(): Promise<ConflictInfo[]> {
	const conflicts: ConflictInfo[] = [];
	const dataPath = await getDataPath();

	try {
		if (!(await exists(dataPath))) {
			return conflicts;
		}

		const entries = await readDir(dataPath);

		for (const entry of entries) {
			if (entry.isFile && entry.name && isSyncthingConflict(entry.name)) {
				const baseFile = getBaseFilename(entry.name);

				// Only track conflicts for our canonical files
				if ([FILE_TASKS, FILE_TIME_LOGS, FILE_META].includes(baseFile)) {
					conflicts.push({
						id: crypto.randomUUID(),
						canonicalFile: baseFile,
						conflictFile: await join(dataPath, entry.name),
						conflictFileName: entry.name,
						detectedAt: new Date().toISOString()
					});
				}
			}
		}
	} catch (error) {
		console.error('Error scanning for conflicts:', error);
	}

	return conflicts;
}

/**
 * Resolve a conflict by choosing which version to keep
 */
export async function resolveConflict(
	conflict: ConflictInfo,
	choice: 'local' | 'remote'
): Promise<void> {
	const dataPath = await getDataPath();
	const canonicalPath = await join(dataPath, conflict.canonicalFile);
	const conflictsDir = await join(dataPath, DIR_CONFLICTS);

	// Ensure conflicts directory exists
	if (!(await exists(conflictsDir))) {
		await mkdir(conflictsDir, { recursive: true });
	}

	if (choice === 'local') {
		// Keep local (canonical) file, archive the conflict file
		const archiveName = generateConflictArchiveName(conflict.canonicalFile, 'remote');
		const archivePath = await join(conflictsDir, archiveName);

		// Copy conflict file to archive
		await copyFile(conflict.conflictFile, archivePath);

		// Delete the conflict file
		await remove(conflict.conflictFile);
	} else {
		// Keep remote (conflict) file, archive the local file
		const archiveName = generateConflictArchiveName(conflict.canonicalFile, 'local');
		const archivePath = await join(conflictsDir, archiveName);

		// Copy canonical file to archive
		await copyFile(canonicalPath, archivePath);

		// Replace canonical with conflict file
		await remove(canonicalPath);
		await rename(conflict.conflictFile, canonicalPath);
	}
}

/**
 * Keep both versions (archive the conflict file without replacing)
 */
export async function keepBothVersions(conflict: ConflictInfo): Promise<void> {
	const dataPath = await getDataPath();
	const conflictsDir = await join(dataPath, DIR_CONFLICTS);

	// Ensure conflicts directory exists
	if (!(await exists(conflictsDir))) {
		await mkdir(conflictsDir, { recursive: true });
	}

	// Archive the conflict file
	const archiveName = generateConflictArchiveName(conflict.canonicalFile, 'remote');
	const archivePath = await join(conflictsDir, archiveName);

	await copyFile(conflict.conflictFile, archivePath);
	await remove(conflict.conflictFile);
}

/**
 * Get list of archived conflict files
 */
export async function getArchivedConflicts(): Promise<string[]> {
	const dataPath = await getDataPath();
	const conflictsDir = await join(dataPath, DIR_CONFLICTS);
	const archived: string[] = [];

	try {
		if (!(await exists(conflictsDir))) {
			return archived;
		}

		const entries = await readDir(conflictsDir);

		for (const entry of entries) {
			if (entry.isFile && entry.name) {
				archived.push(entry.name);
			}
		}
	} catch (error) {
		console.error('Error reading archived conflicts:', error);
	}

	return archived.sort().reverse(); // Most recent first
}

/**
 * Delete an archived conflict file
 */
export async function deleteArchivedConflict(filename: string): Promise<void> {
	const dataPath = await getDataPath();
	const filePath = await join(dataPath, DIR_CONFLICTS, filename);

	if (await exists(filePath)) {
		await remove(filePath);
	}
}

/**
 * Read content preview from a file (first N characters)
 */
export async function getFilePreview(filePath: string, maxLength = 500): Promise<string> {
	try {
		const content = await readTextFile(filePath);
		if (content.length <= maxLength) {
			return content;
		}
		return content.slice(0, maxLength) + '...';
	} catch {
		return '[Unable to read file]';
	}
}

/**
 * Compare two JSON files and return diff summary
 */
export async function compareJsonFiles(
	file1Path: string,
	file2Path: string
): Promise<{ file1Count: number; file2Count: number; description: string }> {
	try {
		const content1 = await readTextFile(file1Path);
		const content2 = await readTextFile(file2Path);

		const data1 = JSON.parse(content1);
		const data2 = JSON.parse(content2);

		const count1 = Array.isArray(data1) ? data1.length : Object.keys(data1).length;
		const count2 = Array.isArray(data2) ? data2.length : Object.keys(data2).length;

		let description = '';
		if (Array.isArray(data1) && Array.isArray(data2)) {
			const diff = count2 - count1;
			if (diff > 0) {
				description = `Remote has ${diff} more item(s)`;
			} else if (diff < 0) {
				description = `Local has ${Math.abs(diff)} more item(s)`;
			} else {
				description = 'Same number of items (content may differ)';
			}
		}

		return { file1Count: count1, file2Count: count2, description };
	} catch {
		return { file1Count: 0, file2Count: 0, description: 'Unable to compare files' };
	}
}
