import type { CalendarEvent } from '$lib/domain/calendar';
import type { GoogleCalendarSettings } from '$lib/domain/meta';
import { formatLocalDate } from '$lib/domain/task';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars';
export function buildAuthUrl(clientId: string, redirectUri: string): string {
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		access_type: 'offline',
		prompt: 'consent',
		scope: SCOPES.join(' ')
	});
	return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
	clientId: string,
	clientSecret: string | null,
	code: string,
	redirectUri: string
): Promise<{
	accessToken: string;
	refreshToken: string | null;
	expiresAt: string;
}> {
	const body = new URLSearchParams({
		code,
		client_id: clientId,
		grant_type: 'authorization_code',
		redirect_uri: redirectUri
	});
	if (clientSecret) {
		body.set('client_secret', clientSecret);
	}

	const response = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!response.ok) {
		throw new Error('Token exchange failed');
	}

	const data = await response.json();
	const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token ?? null,
		expiresAt
	};
}

export async function refreshAccessToken(
	clientId: string,
	clientSecret: string | null,
	refreshToken: string
): Promise<{ accessToken: string; expiresAt: string }> {
	const body = new URLSearchParams({
		client_id: clientId,
		grant_type: 'refresh_token',
		refresh_token: refreshToken
	});
	if (clientSecret) {
		body.set('client_secret', clientSecret);
	}

	const response = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!response.ok) {
		throw new Error('Token refresh failed');
	}

	const data = await response.json();
	const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
	return { accessToken: data.access_token, expiresAt };
}

export function isAccessTokenExpired(settings: GoogleCalendarSettings): boolean {
	if (!settings.tokenExpiresAt) {
		return true;
	}
	return Date.now() >= new Date(settings.tokenExpiresAt).getTime() - 30_000;
}

export async function fetchCalendarEvents(
	accessToken: string,
	calendarId: string,
	timeMin: string,
	timeMax: string
): Promise<CalendarEvent[]> {
	const params = new URLSearchParams({
		timeMin,
		timeMax,
		singleEvents: 'true',
		orderBy: 'startTime',
		maxResults: '2500'
	});
	const url = `${CALENDAR_EVENTS_URL}/${encodeURIComponent(calendarId)}/events?${params.toString()}`;

	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (!response.ok) {
		throw new Error('Calendar fetch failed');
	}

	const data = await response.json();
	const items: any[] = data.items ?? [];
	return items.map((item) => normalizeEvent(item)).filter(Boolean) as CalendarEvent[];
}

function normalizeEvent(item: any): CalendarEvent | null {
	if (!item || !item.id) return null;

	const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
	const startValue = isAllDay ? item.start.date : item.start.dateTime;
	const endValue = isAllDay ? item.end.date : item.end.dateTime;

	if (!startValue || !endValue) return null;

	return {
		id: item.id,
		title: item.summary ?? 'Untitled event',
		start: isAllDay ? startValue : new Date(startValue).toISOString(),
		end: isAllDay ? endValue : new Date(endValue).toISOString(),
		allDay: isAllDay,
		location: item.location ?? null,
		description: item.description ?? null,
		source: 'google'
	};
}

export function buildFetchWindow(daysBack = 7, daysForward = 30): { timeMin: string; timeMax: string } {
	const now = new Date();
	const start = new Date(now);
	start.setDate(start.getDate() - daysBack);
	start.setHours(0, 0, 0, 0);

	const end = new Date(now);
	end.setDate(end.getDate() + daysForward);
	end.setHours(23, 59, 59, 999);

	return {
		timeMin: start.toISOString(),
		timeMax: end.toISOString()
	};
}

export function getEventDayLabel(event: CalendarEvent): string {
	if (event.allDay) {
		return formatLocalDate(new Date(event.start + 'T00:00:00'));
	}
	return formatLocalDate(new Date(event.start));
}
