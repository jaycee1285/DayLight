import type { CalendarEvent } from '$lib/domain/calendar';

interface RawEvent {
	uid: string | null;
	summary: string | null;
	location: string | null;
	description: string | null;
	dtstart: { value: string; isDate: boolean };
	dtend: { value: string; isDate: boolean };
}

export async function fetchIcsEvents(
	urls: string[],
	fetchText: (url: string) => Promise<string> = async (url) => {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error('ICS fetch failed');
		}
		return await response.text();
	}
): Promise<CalendarEvent[]> {
	const results: CalendarEvent[] = [];
	for (const url of urls) {
		if (!url) continue;
		const text = await fetchText(url);
		const events = parseIcs(text, url);
		results.push(...events);
	}
	return results;
}

export function parseIcs(content: string, sourceUrl: string): CalendarEvent[] {
	const lines = unfoldLines(content);
	const events: CalendarEvent[] = [];
	let current: RawEvent | null = null;

	for (const line of lines) {
		if (line === 'BEGIN:VEVENT') {
			current = {
				uid: null,
				summary: null,
				location: null,
				description: null,
				dtstart: { value: '', isDate: false },
				dtend: { value: '', isDate: false }
			};
			continue;
		}
		if (line === 'END:VEVENT' && current) {
			const event = normalizeRawEvent(current, sourceUrl);
			if (event) events.push(event);
			current = null;
			continue;
		}
		if (!current) continue;

		const [name, value] = splitLine(line);
		if (!name) continue;

		switch (name) {
			case 'UID':
				current.uid = value;
				break;
			case 'SUMMARY':
				current.summary = value;
				break;
			case 'LOCATION':
				current.location = value;
				break;
			case 'DESCRIPTION':
				current.description = value;
				break;
			case 'DTSTART':
				current.dtstart = parseDateValue(line, value);
				break;
			case 'DTEND':
				current.dtend = parseDateValue(line, value);
				break;
			default:
				break;
		}
	}

	return events;
}

function unfoldLines(content: string): string[] {
	const raw = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
	const lines: string[] = [];
	for (const line of raw) {
		if (line.startsWith(' ') || line.startsWith('\t')) {
			const prev = lines.pop() ?? '';
			const trimmed = line.trim();
			const spacer = prev.endsWith(' ') || trimmed === '' ? '' : ' ';
			lines.push(prev + spacer + trimmed);
		} else {
			lines.push(line.trim());
		}
	}
	return lines.filter(Boolean);
}

function splitLine(line: string): [string | null, string] {
	const idx = line.indexOf(':');
	if (idx === -1) return [null, ''];
	const name = line.slice(0, idx);
	const value = line.slice(idx + 1);
	return [name.split(';')[0], value];
}

function parseDateValue(line: string, value: string): { value: string; isDate: boolean } {
	if (line.includes('VALUE=DATE')) {
		return { value, isDate: true };
	}
	return { value, isDate: false };
}

function normalizeRawEvent(raw: RawEvent, sourceUrl: string): CalendarEvent | null {
	if (!raw.dtstart.value) return null;

	const start = parseIcsDate(raw.dtstart.value, raw.dtstart.isDate);
	const end = raw.dtend.value
		? parseIcsDate(raw.dtend.value, raw.dtend.isDate)
		: start;

	return {
		id: raw.uid ? `ics:${raw.uid}` : `ics:${hash(`${sourceUrl}:${start}:${end}`)}`,
		title: raw.summary ?? 'Untitled event',
		start,
		end,
		allDay: raw.dtstart.isDate,
		location: raw.location,
		description: raw.description,
		source: 'ics'
	};
}

function parseIcsDate(value: string, isDate: boolean): string {
	// All-day events: "20190115" -> "2019-01-15"
	if (isDate) {
		const dateMatch = value.match(/^(\d{4})(\d{2})(\d{2})$/);
		if (dateMatch) {
			const [, year, month, day] = dateMatch;
			return `${year}-${month}-${day}`;
		}
		return value;
	}

	// Date-time events: "20190115T100000Z" -> ISO string
	const match = value.match(
		/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/
	);
	if (!match) {
		return new Date(value).toISOString();
	}

	const [, year, month, day, hour, minute, second, zulu] = match;
	if (zulu === 'Z') {
		return new Date(
			Date.UTC(
				Number(year),
				Number(month) - 1,
				Number(day),
				Number(hour),
				Number(minute),
				Number(second)
			)
		).toISOString();
	}

	return new Date(
		Number(year),
		Number(month) - 1,
		Number(day),
		Number(hour),
		Number(minute),
		Number(second)
	).toISOString();
}

function hash(input: string): string {
	let hashValue = 0;
	for (let i = 0; i < input.length; i++) {
		hashValue = (hashValue << 5) - hashValue + input.charCodeAt(i);
		hashValue |= 0;
	}
	return Math.abs(hashValue).toString(16);
}
