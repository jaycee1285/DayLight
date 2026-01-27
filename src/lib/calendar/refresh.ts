import type { CalendarCache, CalendarEvent } from '$lib/domain/calendar';
import type { Meta } from '$lib/domain/meta';
import { saveCalendarCache, saveMeta } from '$lib/storage/storage';
import { getOffsetDate } from '$lib/domain/task';
import {
	buildFetchWindow,
	fetchCalendarEvents,
	isAccessTokenExpired,
	refreshAccessToken
} from './google';
import { fetchIcsEvents } from './ics';

export async function refreshCalendarCache(
	meta: Meta,
	cache: CalendarCache,
	options: { persist?: boolean; fetchIcs?: (url: string) => Promise<string> } = {}
): Promise<{ meta: Meta; cache: CalendarCache }> {
	const events: CalendarEvent[] = [];
	const now = new Date().toISOString();
	const { persist = true } = options;
	const fetchIcs = options.fetchIcs ?? createDefaultFetchIcs();

	const google = meta.googleCalendar;
	if (google?.enabled && google.calendarId && google.clientId && google.accessToken) {
		let accessToken = google.accessToken;
		let tokenExpiresAt = google.tokenExpiresAt;

		if (google.refreshToken && isAccessTokenExpired(google)) {
			const refreshed = await refreshAccessToken(
				google.clientId,
				google.clientSecret,
				google.refreshToken
			);
			accessToken = refreshed.accessToken;
			tokenExpiresAt = refreshed.expiresAt;
		}

		const window = buildFetchWindow();
		const googleEvents = await fetchCalendarEvents(
			accessToken,
			google.calendarId,
			window.timeMin,
			window.timeMax
		);
		events.push(...googleEvents);
		meta = {
			...meta,
			googleCalendar: {
				...google,
				accessToken,
				tokenExpiresAt: tokenExpiresAt ?? google.tokenExpiresAt,
				lastRefresh: now
			}
		};
	}

	const ics = meta.icsSources;
	if (ics?.publicUrl || ics?.secretUrl) {
		const urls = [ics.publicUrl, ics.secretUrl].filter(Boolean) as string[];
		const icsEvents = await fetchIcsEvents(urls, fetchIcs);
		// Filter ICS events to a reasonable window (past 7 days to next 60 days)
		const windowStart = getOffsetDate(-7);
		const windowEnd = getOffsetDate(60);
		const filteredIcsEvents = filterEventsByDateRange(icsEvents, windowStart, windowEnd);
		console.log(`[ICS] Filtered ${icsEvents.length} events to ${filteredIcsEvents.length} in range`);
		events.push(...filteredIcsEvents);
		meta = {
			...meta,
			icsSources: {
				...ics,
				lastRefresh: now
			}
		};
	}

	const updatedMeta: Meta = {
		...meta
	};
	const updatedCache: CalendarCache = {
		...cache,
		events,
		lastUpdated: now
	};

	if (persist) {
		await saveMeta(updatedMeta);
		await saveCalendarCache(updatedCache);
	}

	return { meta: updatedMeta, cache: updatedCache };
}

function createDefaultFetchIcs() {
	return async (url: string) => {
		// Try Tauri backend first to bypass CORS
		if (typeof window !== 'undefined' && '__TAURI__' in window) {
			try {
				const { invoke } = await import('@tauri-apps/api/core');
				console.log('[ICS] Using Tauri fetch_url for:', url.substring(0, 50) + '...');
				const result = await invoke<string>('fetch_url', { url });
				console.log('[ICS] Tauri fetch succeeded, length:', result.length);
				return result;
			} catch (err) {
				console.warn('[ICS] Tauri fetch_url failed:', err);
				// Don't fall back - if Tauri is available but fetch_url fails,
				// browser fetch will also fail due to CORS
				throw new Error(`Tauri fetch failed: ${err instanceof Error ? err.message : err}`);
			}
		}

		console.log('[ICS] Tauri not available, using browser fetch');
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`ICS fetch failed: ${response.status}`);
		}
		return await response.text();
	};
}

/**
 * Filter events to those that overlap with the given date range
 */
function filterEventsByDateRange(
	events: CalendarEvent[],
	startDate: string,
	endDate: string
): CalendarEvent[] {
	return events.filter((event) => {
		// Get event's date range
		const eventStart = event.allDay
			? event.start
			: event.start.slice(0, 10); // Extract YYYY-MM-DD from ISO string
		const eventEnd = event.allDay
			? (event.end || event.start)
			: (event.end || event.start).slice(0, 10);

		// Check if event overlaps with the window
		// Event overlaps if: eventStart <= windowEnd AND eventEnd >= windowStart
		return eventStart <= endDate && eventEnd >= startDate;
	});
}

export function isCalendarRefreshDue(meta: Meta): boolean {
	const google = meta.googleCalendar;
	const ics = meta.icsSources;

	const lastRefresh =
		google?.lastRefresh || ics?.lastRefresh || null;
	const intervalHours = google?.refreshIntervalHours ?? 12;

	if (!lastRefresh) {
		return Boolean(google?.enabled || ics?.publicUrl || ics?.secretUrl);
	}

	const last = new Date(lastRefresh).getTime();
	const now = Date.now();
	const intervalMs = intervalHours * 60 * 60 * 1000;
	return now - last >= intervalMs;
}
