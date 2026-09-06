import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { ensureDataDir, getDataPath } from './storage';

const CONTEXT_FILE = 'context.md';
const CONTEXT_HEADING = /^##\s+(\d{2}-\d{2})\s*$/;

export interface ContextEntry {
	dateKey: string;
	entry: string;
}

export function dateToContextKey(date: string | Date): string {
	if (typeof date === 'string') {
		const match = date.match(/^\d{4}-(\d{2}-\d{2})$/);
		if (match) return match[1];
		const mmdd = date.match(/^(\d{2}-\d{2})$/);
		if (mmdd) return mmdd[1];
	}

	const value = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	return `${month}-${day}`;
}

async function getContextPath(): Promise<string> {
	const dataPath = await getDataPath();
	return join(dataPath, CONTEXT_FILE);
}

function parseContext(content: string): Map<string, string> {
	const entries = new Map<string, string>();
	let currentKey: string | null = null;
	let buffer: string[] = [];

	function flush() {
		if (!currentKey) return;
		entries.set(currentKey, buffer.join('\n').trim());
	}

	for (const line of content.split(/\r?\n/)) {
		const match = line.match(CONTEXT_HEADING);
		if (match) {
			flush();
			currentKey = match[1];
			buffer = [];
			continue;
		}
		if (currentKey) buffer.push(line);
	}
	flush();

	return entries;
}

function serializeContext(entries: Map<string, string>): string {
	return Array.from(entries.entries())
		.filter(([, entry]) => entry.trim().length > 0)
		.sort(([left], [right]) => right.localeCompare(left))
		.map(([dateKey, entry]) => `## ${dateKey}\n${entry.trim()}`)
		.join('\n\n') + '\n';
}

export async function loadContextEntries(): Promise<Map<string, string>> {
	await ensureDataDir();
	const contextPath = await getContextPath();
	if (!(await exists(contextPath))) return new Map();
	return parseContext(await readTextFile(contextPath));
}

export async function loadContextEntry(date: string | Date): Promise<string> {
	const entries = await loadContextEntries();
	return entries.get(dateToContextKey(date)) ?? '';
}

export async function hasContextEntry(date: string | Date): Promise<boolean> {
	const entry = await loadContextEntry(date);
	return entry.trim().length > 0;
}

export async function saveContextEntry(date: string | Date, entry: string): Promise<void> {
	await ensureDataDir();
	const contextPath = await getContextPath();
	const entries = await loadContextEntries();
	const dateKey = dateToContextKey(date);
	const trimmed = entry.trim();

	if (trimmed) {
		entries.set(dateKey, trimmed);
	} else {
		entries.delete(dateKey);
	}

	await writeTextFile(contextPath, serializeContext(entries));
}
