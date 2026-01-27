/**
 * Meta domain model
 *
 * Stores application metadata, schema version, and settings.
 */

export interface Meta {
	/** Schema version for migrations */
	schemaVersion: number;

	/** Data folder path */
	dataPath: string | null;

	/** Last time tasks were modified (ISO string) */
	lastTasksUpdate: string | null;

	/** Last time time logs were modified (ISO string) */
	lastTimeLogsUpdate: string | null;

	/** Google Calendar settings */
	googleCalendar: GoogleCalendarSettings | null;

	/** ICS calendar sources */
	icsSources: IcsSources | null;

	/** Last known sync state for conflict detection */
	syncState: SyncState | null;
}

export interface GoogleCalendarSettings {
	/** Whether Google Calendar integration is enabled */
	enabled: boolean;

	/** OAuth client ID */
	clientId: string | null;

	/** OAuth client secret (optional for public clients) */
	clientSecret: string | null;

	/** Calendar ID to fetch events from */
	calendarId: string | null;

	/** Last refresh timestamp (ISO string) */
	lastRefresh: string | null;

	/** Refresh interval in hours (6 or 12) */
	refreshIntervalHours: number;

	/** OAuth access token */
	accessToken: string | null;

	/** OAuth refresh token */
	refreshToken: string | null;

	/** Access token expiry (ISO string) */
	tokenExpiresAt: string | null;
}

export interface IcsSources {
	/** Public ICS feed URL */
	publicUrl: string | null;

	/** Secret ICS feed URL */
	secretUrl: string | null;

	/** Last refresh timestamp (ISO string) */
	lastRefresh: string | null;
}

export interface SyncState {
	/** Hash of tasks.json at last load */
	tasksHash: string | null;

	/** Hash of time_logs.json at last load */
	timeLogsHash: string | null;

	/** Modification time of tasks.json at last load */
	tasksMtime: string | null;

	/** Modification time of time_logs.json at last load */
	timeLogsMtime: string | null;
}

/** Current schema version */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Create default meta with current schema version
 */
export function createMeta(overrides: Partial<Meta> = {}): Meta {
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		dataPath: null,
		lastTasksUpdate: null,
		lastTimeLogsUpdate: null,
		googleCalendar: createGoogleCalendarSettings(),
		icsSources: createIcsSources(),
		syncState: null,
		...overrides
	};
}

/**
 * Create default Google Calendar settings
 */
export function createGoogleCalendarSettings(
	overrides: Partial<GoogleCalendarSettings> = {}
): GoogleCalendarSettings {
	return {
		enabled: false,
		clientId: null,
		clientSecret: null,
		calendarId: null,
		lastRefresh: null,
		refreshIntervalHours: 12,
		accessToken: null,
		refreshToken: null,
		tokenExpiresAt: null,
		...overrides
	};
}

export function createIcsSources(overrides: Partial<IcsSources> = {}): IcsSources {
	return {
		publicUrl: null,
		secretUrl: null,
		lastRefresh: null,
		...overrides
	};
}

/**
 * Create initial sync state
 */
export function createSyncState(overrides: Partial<SyncState> = {}): SyncState {
	return {
		tasksHash: null,
		timeLogsHash: null,
		tasksMtime: null,
		timeLogsMtime: null,
		...overrides
	};
}

/**
 * Check if schema needs migration
 */
export function needsMigration(meta: Meta): boolean {
	return meta.schemaVersion < CURRENT_SCHEMA_VERSION;
}

/**
 * Migrate meta to current schema version
 * Currently a stub for v1 (no migrations needed yet)
 */
export function migrateMeta(meta: Meta): Meta {
	// v1: No migrations needed, just update version
	if (meta.schemaVersion < CURRENT_SCHEMA_VERSION) {
		return {
			...meta,
			schemaVersion: CURRENT_SCHEMA_VERSION
		};
	}
	return meta;
}
