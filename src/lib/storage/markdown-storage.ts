/**
 * Markdown Storage Module
 *
 * Handles reading/writing task markdown files with YAML frontmatter.
 * Designed for Obsidian Bases compatibility and Syncthing sync.
 *
 * File structure:
 *   ~/Sync/JMC/TaskNotes/
 *   ├── Tasks/           # Individual task markdown files
 *   │   ├── Task Name.md
 *   │   └── ...
 *   └── Views/           # Bases view files (managed separately)
 */

import {
	exists,
	mkdir,
	readDir,
	readTextFile,
	writeTextFile,
	rename,
	remove,
	stat
} from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

import type { Task } from '$lib/domain/task';
import type { TimeLog } from '$lib/domain/timeLog';
import {
	parseMarkdown,
	serializeMarkdown,
	taskToFrontmatter,
	frontmatterToTask,
	type TaskFrontmatter,
	type TimeEntry,
	type ParsedMarkdown
} from './frontmatter';
import { getDataPath, ensureDataDir } from './storage';
import { generateConflictArchiveName, SYNCTHING_CONFLICT_PATTERN, DIR_CONFLICTS } from './constants';

/**
 * Directory names within the data path
 */
export const DIR_TASKS = 'Tasks';
export const DIR_VIEWS = 'Views';
export const DIR_IMPORTED = 'Imported';

/**
 * File state for conflict detection
 */
export interface MarkdownFileState {
	filename: string;
	hash: string;
	mtime: string;
}

/**
 * Parsed file data for a task
 */
export interface ParsedTaskFile {
	filename: string;
	frontmatter: TaskFrontmatter;
	body: string;
}

/**
 * Result of loading all tasks
 */
export interface LoadTasksResult {
	tasks: Task[];
	errors: LoadTaskError[];
	fileStates: Map<string, MarkdownFileState>;
	/** Raw parsed files - use this to populate the store directly */
	parsedFiles: ParsedTaskFile[];
}

/**
 * Error loading a specific task file
 */
export interface LoadTaskError {
	filename: string;
	message: string;
}

/**
 * In-memory file state tracking for conflict detection
 */
let loadedFileStates: Map<string, MarkdownFileState> = new Map();

/**
 * Get the tasks directory path
 */
export async function getTasksDir(): Promise<string> {
	const dataPath = await getDataPath();
	return join(dataPath, DIR_TASKS);
}

/**
 * Ensure tasks directory exists
 */
export async function ensureTasksDir(): Promise<void> {
	await ensureDataDir();
	const tasksDir = await getTasksDir();

	if (!(await exists(tasksDir))) {
		await mkdir(tasksDir, { recursive: true });
	}
}

/**
 * Simple hash function for conflict detection
 */
function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	return hash.toString(16);
}

/**
 * Get file state for a markdown file
 */
async function getMarkdownFileState(filePath: string): Promise<MarkdownFileState | null> {
	try {
		if (!(await exists(filePath))) {
			return null;
		}

		const content = await readTextFile(filePath);
		const fileStat = await stat(filePath);
		const filename = filePath.split('/').pop() || '';

		return {
			filename,
			hash: simpleHash(content),
			mtime: fileStat.mtime?.toISOString() ?? new Date().toISOString()
		};
	} catch {
		return null;
	}
}

/**
 * Load all tasks from markdown files
 */
export async function loadAllTasks(): Promise<LoadTasksResult> {
	await ensureTasksDir();
	const tasksDir = await getTasksDir();

	const tasks: Task[] = [];
	const errors: LoadTaskError[] = [];
	const fileStates = new Map<string, MarkdownFileState>();
	const parsedFiles: ParsedTaskFile[] = [];

	try {
		const entries = await readDir(tasksDir);

		for (const entry of entries) {
			// Skip non-markdown files and Syncthing conflicts
			if (!entry.isFile || !entry.name.endsWith('.md')) continue;
			if (SYNCTHING_CONFLICT_PATTERN.test(entry.name)) continue;

			const filePath = await join(tasksDir, entry.name);

			try {
				const content = await readTextFile(filePath);
				const parsed = parseMarkdown(content);

				if (!parsed) {
					errors.push({
						filename: entry.name,
						message: 'Invalid markdown frontmatter'
					});
					continue;
				}

				const task = frontmatterToTask(parsed.frontmatter, entry.name, parsed.body);
				tasks.push(task);

				// Store parsed file data for direct use by the store
				parsedFiles.push({
					filename: entry.name,
					frontmatter: parsed.frontmatter,
					body: parsed.body
				});

				// Track file state for conflict detection
				const state = await getMarkdownFileState(filePath);
				if (state) {
					fileStates.set(entry.name, state);
				}
			} catch (error) {
				errors.push({
					filename: entry.name,
					message: error instanceof Error ? error.message : 'Failed to read file'
				});
			}
		}
	} catch (error) {
		errors.push({
			filename: DIR_TASKS,
			message: error instanceof Error ? error.message : 'Failed to read tasks directory'
		});
	}

	// Update global state tracking
	loadedFileStates = fileStates;

	return { tasks, errors, fileStates, parsedFiles };
}

/**
 * Load archived task files from Imported/ directory (read-only, no state tracking)
 * Used by reports for historical time data outside the active Tasks/ window.
 */
export async function loadArchiveFiles(): Promise<ParsedTaskFile[]> {
	const dataPath = await getDataPath();
	const archiveDir = await join(dataPath, DIR_IMPORTED);

	if (!(await exists(archiveDir))) return [];

	const parsedFiles: ParsedTaskFile[] = [];

	try {
		const entries = await readDir(archiveDir);

		for (const entry of entries) {
			if (!entry.isFile || !entry.name.endsWith('.md')) continue;
			if (SYNCTHING_CONFLICT_PATTERN.test(entry.name)) continue;

			try {
				const filePath = await join(archiveDir, entry.name);
				const content = await readTextFile(filePath);
				const parsed = parseMarkdown(content);
				if (!parsed) continue;

				// Only include files that have time entries (skip empty ones for perf)
				if (parsed.frontmatter.timeEntries.length === 0) continue;

				parsedFiles.push({
					filename: entry.name,
					frontmatter: parsed.frontmatter,
					body: parsed.body
				});
			} catch {
				// Skip unreadable archive files silently
			}
		}
	} catch {
		// Imported/ missing or unreadable — not an error
	}

	return parsedFiles;
}

/**
 * Load a single task by filename
 */
export async function loadTask(filename: string): Promise<Task | null> {
	const tasksDir = await getTasksDir();
	const filePath = await join(tasksDir, filename);

	if (!(await exists(filePath))) {
		return null;
	}

	try {
		const content = await readTextFile(filePath);
		const parsed = parseMarkdown(content);

		if (!parsed) {
			return null;
		}

		return frontmatterToTask(parsed.frontmatter, filename, parsed.body);
	} catch {
		return null;
	}
}

/**
 * Save a task to a markdown file
 *
 * @param task The task to save
 * @param body Optional markdown body content
 * @param options Save options
 * @returns Result with success status and potential conflict info
 */
export async function saveTask(
	task: Task,
	body: string = '',
	options: { checkConflicts?: boolean; originalFilename?: string } = {}
): Promise<{ success: boolean; conflict?: boolean; filename: string }> {
	await ensureTasksDir();
	const tasksDir = await getTasksDir();

	const { checkConflicts = true, originalFilename } = options;

	// Generate filename from task title
	const filename = originalFilename || generateTaskFilename(task.title);
	const filePath = await join(tasksDir, filename);

	// Check for conflicts if file exists and we're tracking it
	if (checkConflicts && loadedFileStates.has(filename)) {
		const currentState = await getMarkdownFileState(filePath);
		const loadedState = loadedFileStates.get(filename);

		if (currentState && loadedState && currentState.hash !== loadedState.hash) {
			return { success: false, conflict: true, filename };
		}
	}

	// Handle filename change (rename)
	if (originalFilename && originalFilename !== filename) {
		const oldPath = await join(tasksDir, originalFilename);
		if (await exists(oldPath)) {
			await remove(oldPath);
			loadedFileStates.delete(originalFilename);
		}
	}

	// Convert task to frontmatter
	const frontmatter = taskToFrontmatter(task);
	frontmatter.dateModified = new Date().toISOString();

	// Serialize and write
	const content = serializeMarkdown(frontmatter, body);
	await atomicWriteMarkdown(filePath, content);

	// Update file state tracking
	const newState = await getMarkdownFileState(filePath);
	if (newState) {
		loadedFileStates.set(filename, newState);
	}

	return { success: true, filename };
}

/**
 * Delete a task markdown file
 */
export async function deleteTask(filename: string): Promise<boolean> {
	const tasksDir = await getTasksDir();
	const filePath = await join(tasksDir, filename);

	if (!(await exists(filePath))) {
		return false;
	}

	try {
		await remove(filePath);
		loadedFileStates.delete(filename);
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if a task file has changed since last load
 */
export async function hasTaskFileChanged(filename: string): Promise<boolean> {
	const tasksDir = await getTasksDir();
	const filePath = await join(tasksDir, filename);
	const currentState = await getMarkdownFileState(filePath);
	const loadedState = loadedFileStates.get(filename);

	if (!loadedState || !currentState) {
		return false;
	}

	return loadedState.hash !== currentState.hash;
}

/**
 * Generate a safe filename from task title
 */
export function generateTaskFilename(title: string): string {
	// Sanitize the title for use as a filename
	let sanitized = title
		.trim()
		// Remove .md extension if user included it
		.replace(/\.md$/i, '')
		// Remove or replace problematic characters
		.replace(/[<>:"/\\|?*]/g, '')
		// Replace multiple spaces with single space
		.replace(/\s+/g, ' ')
		// Limit length (leave room for .md extension and potential suffix)
		.slice(0, 200);

	// Handle empty or whitespace-only titles
	if (!sanitized) {
		sanitized = 'Untitled';
	}

	return `${sanitized}.md`;
}

/**
 * Generate a unique filename if the base name already exists
 */
export async function generateUniqueFilename(baseTitle: string): Promise<string> {
	const tasksDir = await getTasksDir();
	const baseFilename = generateTaskFilename(baseTitle);
	const baseName = baseFilename.replace(/\.md$/, '');

	// Check if base filename is available
	const basePath = await join(tasksDir, baseFilename);
	if (!(await exists(basePath))) {
		return baseFilename;
	}

	// Try with numeric suffixes
	let counter = 1;
	while (counter < 1000) {
		const filename = `${baseName} (${counter}).md`;
		const filePath = await join(tasksDir, filename);
		if (!(await exists(filePath))) {
			return filename;
		}
		counter++;
	}

	// Fallback to timestamp suffix
	const timestamp = Date.now().toString(36);
	return `${baseName}-${timestamp}.md`;
}

/**
 * Atomic write for markdown files
 */
async function atomicWriteMarkdown(filePath: string, content: string): Promise<void> {
	const tempPath = `${filePath}.tmp`;

	// Write to temp file
	await writeTextFile(tempPath, content);

	// Rename temp to final (atomic on most file systems)
	await rename(tempPath, filePath);
}

/**
 * Archive a task file to conflicts directory
 */
export async function archiveTaskToConflicts(
	filename: string,
	source: 'local' | 'remote'
): Promise<void> {
	const dataPath = await getDataPath();
	const tasksDir = await getTasksDir();
	const filePath = await join(tasksDir, filename);

	if (!(await exists(filePath))) {
		return;
	}

	const content = await readTextFile(filePath);
	const archiveName = generateConflictArchiveName(filename, source);
	const conflictsDir = await join(dataPath, DIR_CONFLICTS);

	if (!(await exists(conflictsDir))) {
		await mkdir(conflictsDir, { recursive: true });
	}

	const archivePath = await join(conflictsDir, archiveName);
	await writeTextFile(archivePath, content);
}

/**
 * Scan for Syncthing conflict files in the tasks directory
 */
export async function scanTaskConflicts(): Promise<string[]> {
	const tasksDir = await getTasksDir();
	const conflicts: string[] = [];

	try {
		const entries = await readDir(tasksDir);

		for (const entry of entries) {
			if (entry.isFile && SYNCTHING_CONFLICT_PATTERN.test(entry.name)) {
				conflicts.push(entry.name);
			}
		}
	} catch {
		// Directory might not exist yet
	}

	return conflicts;
}

/**
 * Get the base filename for a Syncthing conflict file
 */
export function getBaseTaskFilename(conflictFilename: string): string {
	return conflictFilename.replace(SYNCTHING_CONFLICT_PATTERN, '');
}

/**
 * Migrate time logs to embedded timeEntries in task frontmatter
 *
 * @param tasks Array of tasks (with filenames derivable from titles)
 * @param timeLogs Array of time logs to migrate
 * @returns Map of task ID to TimeEntry arrays
 */
export function migrateTimeLogsToEntries(
	tasks: Task[],
	timeLogs: TimeLog[]
): Map<string, TimeEntry[]> {
	const entriesByTaskId = new Map<string, TimeEntry[]>();

	// Group time logs by task ID
	for (const log of timeLogs) {
		const entries = entriesByTaskId.get(log.taskId) || [];
		entries.push({
			date: log.date,
			minutes: log.minutes,
			note: log.note,
			createdAt: log.createdAt
		});
		entriesByTaskId.set(log.taskId, entries);
	}

	return entriesByTaskId;
}

/**
 * Create a task file with embedded time entries
 */
export async function saveTaskWithTimeEntries(
	task: Task,
	timeEntries: TimeEntry[],
	body: string = ''
): Promise<{ success: boolean; filename: string }> {
	await ensureTasksDir();
	const tasksDir = await getTasksDir();

	const filename = await generateUniqueFilename(task.title);
	const filePath = await join(tasksDir, filename);

	// Convert task to frontmatter and add time entries
	const frontmatter = taskToFrontmatter(task);
	frontmatter.timeEntries = timeEntries;

	// Serialize and write
	const content = serializeMarkdown(frontmatter, body);
	await atomicWriteMarkdown(filePath, content);

	// Update file state tracking
	const newState = await getMarkdownFileState(filePath);
	if (newState) {
		loadedFileStates.set(filename, newState);
	}

	return { success: true, filename };
}

/**
 * Batch save multiple tasks (used during migration)
 */
export async function saveAllTasks(
	tasks: Array<{ task: Task; timeEntries?: TimeEntry[]; body?: string }>
): Promise<{ saved: number; errors: LoadTaskError[] }> {
	await ensureTasksDir();

	let saved = 0;
	const errors: LoadTaskError[] = [];

	for (const { task, timeEntries = [], body = '' } of tasks) {
		try {
			const result = timeEntries.length > 0
				? await saveTaskWithTimeEntries(task, timeEntries, body)
				: await saveTask(task, body, { checkConflicts: false });

			if (result.success) {
				saved++;
			} else {
				errors.push({
					filename: generateTaskFilename(task.title),
					message: 'Failed to save task'
				});
			}
		} catch (error) {
			errors.push({
				filename: generateTaskFilename(task.title),
				message: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}

	return { saved, errors };
}

/**
 * Clear file state tracking (for testing)
 */
export function resetFileStateTracking(): void {
	loadedFileStates = new Map();
}
