/**
 * Migration Module
 *
 * Handles migration from JSON storage (tasks.json, time_logs.json)
 * to markdown files with YAML frontmatter.
 */

import { exists, mkdir, copyFile, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

import type { Task } from '$lib/domain/task';
import type { TimeLog } from '$lib/domain/timeLog';
import {
	taskToFrontmatter,
	serializeMarkdown,
	type TaskFrontmatter,
	type TimeEntry
} from './frontmatter';
import {
	getTasksDir,
	ensureTasksDir,
	generateUniqueFilename,
	DIR_TASKS
} from './markdown-storage';
import { getDataPath } from './storage';
import { FILE_TASKS, FILE_TIME_LOGS, DIR_CONFLICTS } from './constants';

/**
 * Migration result
 */
export interface MigrationResult {
	success: boolean;
	tasksMigrated: number;
	timeLogsMigrated: number;
	errors: MigrationError[];
	backupPath: string | null;
}

/**
 * Migration error
 */
export interface MigrationError {
	taskId?: string;
	taskTitle?: string;
	message: string;
}

/**
 * Migration options
 */
export interface MigrationOptions {
	/** Whether to create a backup before migration */
	createBackup?: boolean;
	/** Whether to delete JSON files after successful migration */
	deleteJsonAfterMigration?: boolean;
	/** Dry run - don't actually write files */
	dryRun?: boolean;
}

/**
 * Check if migration is needed
 * Returns true if JSON files exist but Tasks directory is empty or doesn't exist
 */
export async function isMigrationNeeded(): Promise<boolean> {
	const dataPath = await getDataPath();
	const tasksJsonPath = await join(dataPath, FILE_TASKS);

	// Check if tasks.json exists
	if (!(await exists(tasksJsonPath))) {
		return false;
	}

	// Check if tasks.json has any tasks
	try {
		const content = await readTextFile(tasksJsonPath);
		const tasks = JSON.parse(content);
		if (!Array.isArray(tasks) || tasks.length === 0) {
			return false;
		}
	} catch {
		return false;
	}

	// Check if Tasks directory exists and has files
	const tasksDir = await getTasksDir();
	if (!(await exists(tasksDir))) {
		return true;
	}

	// If Tasks directory exists but is empty, migration is needed
	// We don't have a readDir import here so we'll assume migration needed if JSON has tasks
	return true;
}

/**
 * Migrate from JSON storage to markdown files
 */
export async function migrateToMarkdown(
	options: MigrationOptions = {}
): Promise<MigrationResult> {
	const {
		createBackup = true,
		deleteJsonAfterMigration = false,
		dryRun = false
	} = options;

	const result: MigrationResult = {
		success: false,
		tasksMigrated: 0,
		timeLogsMigrated: 0,
		errors: [],
		backupPath: null
	};

	const dataPath = await getDataPath();

	try {
		// Step 1: Load existing JSON data
		const { tasks, timeLogs, loadErrors } = await loadJsonData(dataPath);

		if (loadErrors.length > 0) {
			result.errors.push(...loadErrors);
			return result;
		}

		if (tasks.length === 0) {
			result.success = true;
			return result;
		}

		// Step 2: Create backup if requested
		if (createBackup && !dryRun) {
			result.backupPath = await createMigrationBackup(dataPath);
		}

		// Step 3: Group time logs by task ID
		const timeLogsByTask = groupTimeLogsByTask(timeLogs);

		// Step 4: Ensure Tasks directory exists
		if (!dryRun) {
			await ensureTasksDir();
		}

		// Step 5: Migrate each task
		const tasksDir = await getTasksDir();

		for (const task of tasks) {
			try {
				const taskTimeLogs = timeLogsByTask.get(task.id) || [];
				const timeEntries = convertTimeLogsToEntries(taskTimeLogs);

				if (!dryRun) {
					await migrateTask(task, timeEntries, tasksDir);
				}

				result.tasksMigrated++;
				result.timeLogsMigrated += timeEntries.length;
			} catch (error) {
				result.errors.push({
					taskId: task.id,
					taskTitle: task.title,
					message: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		// Step 6: Delete JSON files if requested and migration was successful
		if (deleteJsonAfterMigration && !dryRun && result.errors.length === 0) {
			await archiveJsonFiles(dataPath);
		}

		result.success = result.errors.length === 0;
	} catch (error) {
		result.errors.push({
			message: error instanceof Error ? error.message : 'Migration failed'
		});
	}

	return result;
}

/**
 * Load existing JSON data
 */
async function loadJsonData(
	dataPath: string
): Promise<{ tasks: Task[]; timeLogs: TimeLog[]; loadErrors: MigrationError[] }> {
	const loadErrors: MigrationError[] = [];
	let tasks: Task[] = [];
	let timeLogs: TimeLog[] = [];

	// Load tasks.json
	const tasksPath = await join(dataPath, FILE_TASKS);
	if (await exists(tasksPath)) {
		try {
			const content = await readTextFile(tasksPath);
			const parsed = JSON.parse(content);
			if (Array.isArray(parsed)) {
				tasks = parsed;
			} else {
				loadErrors.push({ message: 'tasks.json is not an array' });
			}
		} catch (error) {
			loadErrors.push({
				message: `Failed to parse tasks.json: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
		}
	}

	// Load time_logs.json
	const timeLogsPath = await join(dataPath, FILE_TIME_LOGS);
	if (await exists(timeLogsPath)) {
		try {
			const content = await readTextFile(timeLogsPath);
			const parsed = JSON.parse(content);
			if (Array.isArray(parsed)) {
				timeLogs = parsed;
			} else {
				loadErrors.push({ message: 'time_logs.json is not an array' });
			}
		} catch (error) {
			loadErrors.push({
				message: `Failed to parse time_logs.json: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
		}
	}

	return { tasks, timeLogs, loadErrors };
}

/**
 * Create a backup of JSON files before migration
 */
async function createMigrationBackup(dataPath: string): Promise<string> {
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const backupDir = await join(dataPath, 'migration_backup_' + timestamp);

	await mkdir(backupDir, { recursive: true });

	// Copy tasks.json
	const tasksPath = await join(dataPath, FILE_TASKS);
	if (await exists(tasksPath)) {
		await copyFile(tasksPath, await join(backupDir, FILE_TASKS));
	}

	// Copy time_logs.json
	const timeLogsPath = await join(dataPath, FILE_TIME_LOGS);
	if (await exists(timeLogsPath)) {
		await copyFile(timeLogsPath, await join(backupDir, FILE_TIME_LOGS));
	}

	return backupDir;
}

/**
 * Group time logs by task ID
 */
function groupTimeLogsByTask(timeLogs: TimeLog[]): Map<string, TimeLog[]> {
	const grouped = new Map<string, TimeLog[]>();

	for (const log of timeLogs) {
		const existing = grouped.get(log.taskId) || [];
		existing.push(log);
		grouped.set(log.taskId, existing);
	}

	return grouped;
}

/**
 * Convert TimeLog array to TimeEntry array
 */
function convertTimeLogsToEntries(timeLogs: TimeLog[]): TimeEntry[] {
	return timeLogs.map((log) => ({
		date: log.date,
		minutes: log.minutes,
		note: log.note,
		createdAt: log.createdAt
	}));
}

/**
 * Migrate a single task to markdown file
 */
async function migrateTask(
	task: Task,
	timeEntries: TimeEntry[],
	tasksDir: string
): Promise<string> {
	// Generate unique filename
	const filename = await generateUniqueFilename(task.title);
	const filePath = await join(tasksDir, filename);

	// Convert task to frontmatter
	const frontmatter = taskToFrontmatter(task);

	// Add time entries
	frontmatter.timeEntries = timeEntries;

	// Add 'task' tag if not present (required for Bases views)
	if (!frontmatter.tags.includes('task')) {
		frontmatter.tags.unshift('task');
	}

	// Serialize and write
	const content = serializeMarkdown(frontmatter, '');
	await writeTextFile(filePath, content);

	return filename;
}

/**
 * Archive JSON files after successful migration
 */
async function archiveJsonFiles(dataPath: string): Promise<void> {
	const conflictsDir = await join(dataPath, DIR_CONFLICTS);
	if (!(await exists(conflictsDir))) {
		await mkdir(conflictsDir, { recursive: true });
	}

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

	// Archive tasks.json
	const tasksPath = await join(dataPath, FILE_TASKS);
	if (await exists(tasksPath)) {
		const archivePath = await join(conflictsDir, `tasks_pre-migration_${timestamp}.json`);
		await copyFile(tasksPath, archivePath);
	}

	// Archive time_logs.json
	const timeLogsPath = await join(dataPath, FILE_TIME_LOGS);
	if (await exists(timeLogsPath)) {
		const archivePath = await join(conflictsDir, `time_logs_pre-migration_${timestamp}.json`);
		await copyFile(timeLogsPath, archivePath);
	}
}

/**
 * Get migration status/preview
 */
export async function getMigrationPreview(): Promise<{
	tasksCount: number;
	timeLogsCount: number;
	canMigrate: boolean;
	message: string;
}> {
	const dataPath = await getDataPath();
	const { tasks, timeLogs, loadErrors } = await loadJsonData(dataPath);

	if (loadErrors.length > 0) {
		return {
			tasksCount: 0,
			timeLogsCount: 0,
			canMigrate: false,
			message: `Cannot migrate: ${loadErrors.map((e) => e.message).join(', ')}`
		};
	}

	if (tasks.length === 0) {
		return {
			tasksCount: 0,
			timeLogsCount: 0,
			canMigrate: false,
			message: 'No tasks to migrate'
		};
	}

	return {
		tasksCount: tasks.length,
		timeLogsCount: timeLogs.length,
		canMigrate: true,
		message: `Ready to migrate ${tasks.length} tasks and ${timeLogs.length} time logs`
	};
}
