/**
 * Storage module
 *
 * Handles reading/writing data files with:
 * - Atomic writes (write temp -> rename)
 * - File state tracking for conflict detection
 * - Syncthing conflict handling
 */

import {
	exists,
	copyFile,
	mkdir,
	readDir,
	readTextFile,
	writeTextFile,
	rename,
	remove,
	stat,
	BaseDirectory
} from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';

import type { Task } from '$lib/domain/task';
import { createTask } from '$lib/domain/task';
import type { TimeLog } from '$lib/domain/timeLog';
import type { Meta, SyncState } from '$lib/domain/meta';
import {
	createGoogleCalendarSettings,
	createIcsSources,
	createMeta,
	createSyncState,
	CURRENT_SCHEMA_VERSION,
	migrateMeta
} from '$lib/domain/meta';
import type { CalendarCache } from '$lib/domain/calendar';
import { createCalendarCache } from '$lib/domain/calendar';

import {
	FILE_TASKS,
	FILE_TIME_LOGS,
	FILE_META,
	FILE_CALENDAR_CACHE,
	DIR_CONFLICTS,
	DIR_EXPORTS,
	DEFAULT_DATA_FOLDER,
	generateConflictArchiveName
} from './constants';

/**
 * Application data structure
 */
export interface AppData {
	tasks: Task[];
	timeLogs: TimeLog[];
	meta: Meta;
}

export interface LoadError {
	file: string;
	message: string;
}

/**
 * File state for conflict detection
 */
export interface FileState {
	hash: string;
	mtime: string;
}

/**
 * Load state tracking
 */
let loadedState: {
	tasks: FileState | null;
	timeLogs: FileState | null;
} = {
	tasks: null,
	timeLogs: null
};

/**
 * Get the data directory path
 */
let dataPathOverride: string | null = null;

export function setDataPathOverride(path: string | null) {
	dataPathOverride = path;
}

export function getDataPathOverride(): string | null {
	return dataPathOverride;
}

export function resetDataPathOverrideForTests() {
	dataPathOverride = null;
}

export async function getDataPath(): Promise<string> {
	if (dataPathOverride) {
		return dataPathOverride;
	}
	// Use shared storage on Android so Syncthing can access it
	const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
	if (isAndroid) {
		// Default to Syncthing location - requires "All files access" permission
		return '/storage/emulated/0/syncthing/syncthing/JMC/TaskNotes';
	}
	const appData = await appDataDir();
	return await join(appData, DEFAULT_DATA_FOLDER);
}

export async function validateDataFolder(path: string): Promise<{ ok: boolean; message?: string; hasTasksDir?: boolean }> {
	if (!(await exists(path))) {
		return { ok: false, message: 'Folder does not exist.' };
	}
	const info = await stat(path);
	if (!info.isDirectory) {
		return { ok: false, message: 'Path is not a directory.' };
	}

	// Check if there's a Tasks subdirectory (for markdown storage)
	const tasksSubdir = await join(path, 'Tasks');
	const hasTasksDir = await exists(tasksSubdir);

	return { ok: true, hasTasksDir };
}

/**
 * Ensure data directory exists
 */
export async function ensureDataDir(): Promise<void> {
	const dataPath = await getDataPath();

	if (!(await exists(dataPath))) {
		await mkdir(dataPath, { recursive: true });
	}

	const conflictsPath = await join(dataPath, DIR_CONFLICTS);
	if (!(await exists(conflictsPath))) {
		await mkdir(conflictsPath, { recursive: true });
	}
}

/**
 * Migrate task to current schema (adds missing fields with defaults)
 */
function migrateTask(task: Partial<Task>): Task {
	const defaults = createTask();
	return {
		id: task.id ?? defaults.id,
		title: task.title ?? defaults.title,
		tags: task.tags ?? defaults.tags,
		contexts: task.contexts ?? defaults.contexts,
		project: task.project ?? defaults.project,
		scheduledDate: task.scheduledDate ?? defaults.scheduledDate,
		startTime: task.startTime ?? defaults.startTime,
		completed: task.completed ?? defaults.completed,
		completedAt: task.completedAt ?? defaults.completedAt,
		seriesId: task.seriesId ?? defaults.seriesId,
		isSeriesTemplate: task.isSeriesTemplate ?? defaults.isSeriesTemplate,
		recurrence: task.recurrence ?? defaults.recurrence,
		parentId: task.parentId ?? defaults.parentId,
		createdAt: task.createdAt ?? defaults.createdAt,
		updatedAt: task.updatedAt ?? defaults.updatedAt
	};
}

/**
 * Migrate all tasks to current schema
 */
function migrateTasks(tasks: Partial<Task>[]): Task[] {
	return tasks.map(migrateTask);
}

/**
 * Simple hash function for conflict detection
 */
function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return hash.toString(16);
}

/**
 * Get file state (hash + mtime)
 */
async function getFileState(filePath: string): Promise<FileState | null> {
	try {
		if (!(await exists(filePath))) {
			return null;
		}

		const content = await readTextFile(filePath);
		const fileStat = await stat(filePath);

		return {
			hash: simpleHash(content),
			mtime: fileStat.mtime?.toISOString() ?? new Date().toISOString()
		};
	} catch {
		return null;
	}
}

/**
 * Check if file has changed since last load
 */
export async function hasFileChanged(
	filename: typeof FILE_TASKS | typeof FILE_TIME_LOGS
): Promise<boolean> {
	const dataPath = await getDataPath();
	const filePath = await join(dataPath, filename);
	const currentState = await getFileState(filePath);

	const savedState = filename === FILE_TASKS ? loadedState.tasks : loadedState.timeLogs;

	if (!savedState || !currentState) {
		return false; // No previous state, assume no change
	}

	return savedState.hash !== currentState.hash;
}

/**
 * Load all data files
 */
export async function loadAll(): Promise<AppData> {
	const result = await loadAllWithErrors();
	return { tasks: result.tasks, timeLogs: result.timeLogs, meta: result.meta };
}

/**
 * Load all data files with validation + error reporting
 */
export async function loadAllWithErrors(): Promise<AppData & { errors: LoadError[] }> {
	await ensureDataDir();
	const dataPath = await getDataPath();
	const errors: LoadError[] = [];

	// Load tasks
	const tasksPath = await join(dataPath, FILE_TASKS);
	let tasks: Task[] = [];
	if (await exists(tasksPath)) {
		try {
			const content = await readTextFile(tasksPath);
			const parsed = JSON.parse(content);
			if (!Array.isArray(parsed)) {
				throw new Error('tasks.json must be an array');
			}
			// Migrate tasks to ensure they have all required fields
			tasks = migrateTasks(parsed);
			loadedState.tasks = await getFileState(tasksPath);
		} catch (error) {
			errors.push({
				file: FILE_TASKS,
				message: error instanceof Error ? error.message : 'Invalid JSON'
			});
			await archiveToConflicts(FILE_TASKS, 'local');
			await writeTextFile(tasksPath, JSON.stringify([], null, 2));
			loadedState.tasks = await getFileState(tasksPath);
		}
	} else {
		await writeTextFile(tasksPath, JSON.stringify([], null, 2));
		loadedState.tasks = await getFileState(tasksPath);
	}

	// Load time logs
	const timeLogsPath = await join(dataPath, FILE_TIME_LOGS);
	let timeLogs: TimeLog[] = [];
	if (await exists(timeLogsPath)) {
		try {
			const content = await readTextFile(timeLogsPath);
			const parsed = JSON.parse(content);
			if (!Array.isArray(parsed)) {
				throw new Error('time_logs.json must be an array');
			}
			timeLogs = parsed;
			loadedState.timeLogs = await getFileState(timeLogsPath);
		} catch (error) {
			errors.push({
				file: FILE_TIME_LOGS,
				message: error instanceof Error ? error.message : 'Invalid JSON'
			});
			await archiveToConflicts(FILE_TIME_LOGS, 'local');
			await writeTextFile(timeLogsPath, JSON.stringify([], null, 2));
			loadedState.timeLogs = await getFileState(timeLogsPath);
		}
	} else {
		await writeTextFile(timeLogsPath, JSON.stringify([], null, 2));
		loadedState.timeLogs = await getFileState(timeLogsPath);
	}

	// Load meta
	const metaPath = await join(dataPath, FILE_META);
	let meta: Meta;
	if (await exists(metaPath)) {
		try {
			const content = await readTextFile(metaPath);
			meta = JSON.parse(content);
		} catch (error) {
			errors.push({
				file: FILE_META,
				message: error instanceof Error ? error.message : 'Invalid JSON'
			});
			await archiveToConflicts(FILE_META, 'local');
			meta = createMeta();
			await writeTextFile(metaPath, JSON.stringify(meta, null, 2));
		}

		// Check if migration is needed
		if (meta.schemaVersion < CURRENT_SCHEMA_VERSION) {
			meta = migrateMeta(meta);
			// Save migrated meta
			await writeTextFile(metaPath, JSON.stringify(meta, null, 2));
		}
		const nextMeta = {
			...meta,
			googleCalendar: createGoogleCalendarSettings(meta.googleCalendar ?? {}),
			icsSources: createIcsSources(meta.icsSources ?? {})
		};
		if (JSON.stringify(nextMeta) !== JSON.stringify(meta)) {
			meta = nextMeta;
			await writeTextFile(metaPath, JSON.stringify(meta, null, 2));
		} else {
			meta = nextMeta;
		}
	} else {
		meta = createMeta();
		await writeTextFile(metaPath, JSON.stringify(meta, null, 2));
	}

	// Update sync state in meta
	meta.syncState = createSyncState({
		tasksHash: loadedState.tasks?.hash ?? null,
		tasksMtime: loadedState.tasks?.mtime ?? null,
		timeLogsHash: loadedState.timeLogs?.hash ?? null,
		timeLogsMtime: loadedState.timeLogs?.mtime ?? null
	});

	return { tasks, timeLogs, meta, errors };
}

/**
 * Load calendar cache
 */
export async function loadCalendarCache(): Promise<CalendarCache> {
	const result = await loadCalendarCacheWithErrors();
	return result.cache;
}

/**
 * Load calendar cache with validation + error reporting
 */
export async function loadCalendarCacheWithErrors(): Promise<{
	cache: CalendarCache;
	errors: LoadError[];
}> {
	await ensureDataDir();
	const dataPath = await getDataPath();
	const cachePath = await join(dataPath, FILE_CALENDAR_CACHE);
	const errors: LoadError[] = [];

	if (await exists(cachePath)) {
		try {
			const content = await readTextFile(cachePath);
			const parsed = JSON.parse(content);
			if (!parsed || !Array.isArray(parsed.events)) {
				throw new Error('calendar_cache.json must include an events array');
			}
			return { cache: parsed as CalendarCache, errors };
		} catch (error) {
			errors.push({
				file: FILE_CALENDAR_CACHE,
				message: error instanceof Error ? error.message : 'Invalid JSON'
			});
			await archiveToConflicts(FILE_CALENDAR_CACHE, 'local');
		}
	}

	const cache = createCalendarCache();
	await writeTextFile(cachePath, JSON.stringify(cache, null, 2));
	return { cache, errors };
}

/**
 * Save calendar cache
 */
export async function saveCalendarCache(cache: CalendarCache): Promise<void> {
	await ensureDataDir();
	const dataPath = await getDataPath();
	const cachePath = await join(dataPath, FILE_CALENDAR_CACHE);
	await writeTextFile(cachePath, JSON.stringify(cache, null, 2));
}

/**
 * Save all data files with atomic writes
 */
export async function saveAll(
	data: AppData,
	options: { checkConflicts?: boolean } = {}
): Promise<{ success: boolean; conflicts?: string[] }> {
	const { checkConflicts = true } = options;
	const dataPath = await getDataPath();
	const conflicts: string[] = [];

	// Check for conflicts before saving
	if (checkConflicts) {
		if (await hasFileChanged(FILE_TASKS)) {
			conflicts.push(FILE_TASKS);
		}
		if (await hasFileChanged(FILE_TIME_LOGS)) {
			conflicts.push(FILE_TIME_LOGS);
		}

		if (conflicts.length > 0) {
			return { success: false, conflicts };
		}
	}

	// Save tasks atomically
	await atomicWrite(
		await join(dataPath, FILE_TASKS),
		JSON.stringify(data.tasks, null, 2)
	);
	loadedState.tasks = await getFileState(await join(dataPath, FILE_TASKS));

	// Save time logs atomically
	await atomicWrite(
		await join(dataPath, FILE_TIME_LOGS),
		JSON.stringify(data.timeLogs, null, 2)
	);
	loadedState.timeLogs = await getFileState(await join(dataPath, FILE_TIME_LOGS));

	// Update meta with new timestamps and sync state
	const now = new Date().toISOString();
	const updatedMeta: Meta = {
		...data.meta,
		lastTasksUpdate: now,
		lastTimeLogsUpdate: now,
		syncState: createSyncState({
			tasksHash: loadedState.tasks?.hash ?? null,
			tasksMtime: loadedState.tasks?.mtime ?? null,
			timeLogsHash: loadedState.timeLogs?.hash ?? null,
			timeLogsMtime: loadedState.timeLogs?.mtime ?? null
		})
	};

	// Save meta (not atomic, less critical)
	await writeTextFile(
		await join(dataPath, FILE_META),
		JSON.stringify(updatedMeta, null, 2)
	);

	return { success: true };
}

/**
 * Atomic write: write to temp file, then rename
 */
async function atomicWrite(filePath: string, content: string): Promise<void> {
	const tempPath = filePath + '.tmp';

	// Write to temp file
	await writeTextFile(tempPath, content);

	// Rename temp to final (atomic on most file systems)
	await rename(tempPath, filePath);
}

/**
 * Archive a file to the conflicts directory
 */
export async function archiveToConflicts(
	filename: string,
	source: 'local' | 'remote'
): Promise<void> {
	const dataPath = await getDataPath();
	const filePath = await join(dataPath, filename);

	if (!(await exists(filePath))) {
		return;
	}

	const content = await readTextFile(filePath);
	const archiveName = generateConflictArchiveName(filename, source);
	const archivePath = await join(dataPath, DIR_CONFLICTS, archiveName);

	await writeTextFile(archivePath, content);
}

/**
 * Force save (used when resolving conflicts)
 */
export async function forceSave(data: AppData): Promise<void> {
	await saveAll(data, { checkConflicts: false });
}

/**
 * Save only tasks
 */
export async function saveTasks(tasks: Task[]): Promise<{ success: boolean; conflict?: boolean }> {
	const dataPath = await getDataPath();

	if (await hasFileChanged(FILE_TASKS)) {
		return { success: false, conflict: true };
	}

	await atomicWrite(
		await join(dataPath, FILE_TASKS),
		JSON.stringify(tasks, null, 2)
	);
	loadedState.tasks = await getFileState(await join(dataPath, FILE_TASKS));

	return { success: true };
}

/**
 * Save only time logs
 */
export async function saveTimeLogs(
	timeLogs: TimeLog[]
): Promise<{ success: boolean; conflict?: boolean }> {
	const dataPath = await getDataPath();

	if (await hasFileChanged(FILE_TIME_LOGS)) {
		return { success: false, conflict: true };
	}

	await atomicWrite(
		await join(dataPath, FILE_TIME_LOGS),
		JSON.stringify(timeLogs, null, 2)
	);
	loadedState.timeLogs = await getFileState(await join(dataPath, FILE_TIME_LOGS));

	return { success: true };
}

/**
 * Save meta only
 */
export async function saveMeta(meta: Meta): Promise<void> {
	const dataPath = await getDataPath();
	await writeTextFile(
		await join(dataPath, FILE_META),
		JSON.stringify(meta, null, 2)
	);
}

/**
 * Export data bundle (canonical files + conflicts)
 */
export async function exportDataBundle(): Promise<{ exportPath: string; files: string[] }> {
	await ensureDataDir();
	const dataPath = await getDataPath();
	const exportsPath = await join(dataPath, DIR_EXPORTS);

	if (!(await exists(exportsPath))) {
		await mkdir(exportsPath, { recursive: true });
	}

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const exportPath = await join(exportsPath, `export_${timestamp}`);
	await mkdir(exportPath, { recursive: true });

	const files: string[] = [];
	const baseFiles = [FILE_TASKS, FILE_TIME_LOGS, FILE_META, FILE_CALENDAR_CACHE];
	for (const filename of baseFiles) {
		const source = await join(dataPath, filename);
		if (await exists(source)) {
			const dest = await join(exportPath, filename);
			await copyFile(source, dest);
			files.push(filename);
		}
	}

	const conflictsPath = await join(dataPath, DIR_CONFLICTS);
	if (await exists(conflictsPath)) {
		const conflictExportPath = await join(exportPath, DIR_CONFLICTS);
		await mkdir(conflictExportPath, { recursive: true });
		const entries = await readDir(conflictsPath);
		for (const entry of entries) {
			if (entry.isFile) {
				const source = await join(conflictsPath, entry.name);
				const dest = await join(conflictExportPath, entry.name);
				await copyFile(source, dest);
				files.push(`${DIR_CONFLICTS}/${entry.name}`);
			}
		}
	}

	return { exportPath, files };
}

export async function copyDataToFolder(targetPath: string): Promise<void> {
	await ensureDataDir();
	const sourcePath = await getDataPath();

	if (sourcePath === targetPath) {
		return;
	}

	if (!(await exists(targetPath))) {
		await mkdir(targetPath, { recursive: true });
	}

	const baseFiles = [FILE_TASKS, FILE_TIME_LOGS, FILE_META, FILE_CALENDAR_CACHE];
	for (const filename of baseFiles) {
		const source = await join(sourcePath, filename);
		if (await exists(source)) {
			const dest = await join(targetPath, filename);
			await copyFile(source, dest);
		}
	}

	const conflictsPath = await join(sourcePath, DIR_CONFLICTS);
	if (await exists(conflictsPath)) {
		const targetConflicts = await join(targetPath, DIR_CONFLICTS);
		if (!(await exists(targetConflicts))) {
			await mkdir(targetConflicts, { recursive: true });
		}
		const entries = await readDir(conflictsPath);
		for (const entry of entries) {
			if (entry.isFile) {
				const source = await join(conflictsPath, entry.name);
				const dest = await join(targetConflicts, entry.name);
				await copyFile(source, dest);
			}
		}
	}
}
