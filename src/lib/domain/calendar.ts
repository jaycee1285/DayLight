import { formatLocalDate } from './task';

export interface CalendarEvent {
	id: string;
	title: string;
	start: string;
	end: string;
	allDay: boolean;
	location: string | null;
	description: string | null;
	source: 'google' | 'ics';
}

export interface CalendarCache {
	events: CalendarEvent[];
	lastUpdated: string | null;
}

export function createCalendarCache(overrides: Partial<CalendarCache> = {}): CalendarCache {
	return {
		events: [],
		lastUpdated: null,
		...overrides
	};
}

export function eventOccursOnDate(event: CalendarEvent, date: string): boolean {
	if (event.allDay) {
		const endDate = event.end || event.start;
		const end = new Date(endDate + 'T00:00:00');
		end.setDate(end.getDate() - 1);
		const endLocal = formatLocalDate(end);
		return date >= event.start && date <= endLocal;
	}

	const startDate = formatLocalDate(new Date(event.start));
	const endDate = formatLocalDate(new Date(event.end));

	return date >= startDate && date <= endDate;
}

export function eventsForDate(events: CalendarEvent[], date: string): CalendarEvent[] {
	return events.filter((event) => eventOccursOnDate(event, date));
}
