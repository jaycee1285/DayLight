import fuzzysort from 'fuzzysort';
import { exists, mkdir, readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { parseMarkdown } from '$lib/storage/frontmatter';

export interface EditorSearchResult {
	path: string;
	name: string;
	title: string;
	snippet: string;
	source: 'task' | 'note';
	score: number;
}

export interface EditorSearchDebugInfo {
	state: string;
	authority: string;
	observation: string;
	staleness: string;
	indexedDocs: number;
	lastIndexedAt: string | null;
	lastQueryMs: number | null;
	lastError: string | null;
	indexPath: string | null;
}

type SearchDoc = {
	id: string;
	path: string;
	name: string;
	title: string;
	body: string;
	source: 'task' | 'note';
	searchText: string;
};

type PersistedIndex = {
	version: 1;
	root: string;
	builtAt: string;
	docCount: number;
	docs: SearchDoc[];
};

type PreparedDoc = SearchDoc & {
	preparedPath: ReturnType<typeof fuzzysort.prepare>;
	preparedName: ReturnType<typeof fuzzysort.prepare>;
	preparedTitle: ReturnType<typeof fuzzysort.prepare>;
};

const INDEX_DIR = '.daylight';
const INDEX_FILE = 'search-index.json';
const BODY_SNIPPET_LENGTH = 160;
const MAX_INDEXED_BODY_CHARS = 12000;
const DEBUG_UPDATE_INTERVAL = 50;

let cachedBasePath = '';
let cachedDocs: SearchDoc[] = [];
let cachedPreparedDocs: PreparedDoc[] = [];
let lastIndexedAt: string | null = null;
let staleBasePath: string | null = null;
let debugInfo: EditorSearchDebugInfo = {
	state: 'index-missing',
	authority: 'persisted JSON index under selected root',
	observation: 'idle',
	staleness: 'no index built yet',
	indexedDocs: 0,
	lastIndexedAt: null,
	lastQueryMs: null,
	lastError: null,
	indexPath: null
};

function setDebug(partial: Partial<EditorSearchDebugInfo>): void {
	debugInfo = { ...debugInfo, ...partial };
}

function stripMarkdown(text: string): string {
	return text
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/[>*_~#-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function tokenizeQuery(value: string): string[] {
	return value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function getSnippetAnchor(body: string, query: string, terms: string[]): number {
	const lowerBody = body.toLowerCase();
	const wholeQueryIndex = lowerBody.indexOf(query);
	if (wholeQueryIndex !== -1) return wholeQueryIndex;

	let bestIndex = -1;
	for (const term of terms) {
		const index = lowerBody.indexOf(term);
		if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
			bestIndex = index;
		}
	}
	return bestIndex;
}

function makeSnippet(body: string, query: string, terms: string[]): string {
	const normalized = stripMarkdown(body);
	if (!normalized) return '';
	if (!query.trim()) return normalized.slice(0, BODY_SNIPPET_LENGTH);

	const anchor = getSnippetAnchor(normalized, query.toLowerCase().trim(), terms);
	if (anchor === -1) return normalized.slice(0, BODY_SNIPPET_LENGTH);

	const start = Math.max(0, anchor - 48);
	const end = Math.min(normalized.length, anchor + Math.max(query.length, 24) + 96);
	const prefix = start > 0 ? '...' : '';
	const suffix = end < normalized.length ? '...' : '';
	return `${prefix}${normalized.slice(start, end).trim()}${suffix}`;
}

function scoreField(value: string, query: string, terms: string, termList: string[]): number {
	const lowerValue = value.toLowerCase();
	let score = 0;

	if (lowerValue === query) score += 320;
	if (lowerValue.startsWith(query)) score += 180;
	if (lowerValue.includes(query)) score += 90;

	for (const term of termList) {
		if (lowerValue === term) score += 120;
		else if (lowerValue.startsWith(term)) score += 42;
		else if (lowerValue.includes(term)) score += 18;
	}

	return score;
}

function scoreDoc(doc: SearchDoc, query: string, terms: string[]): number {
	const path = doc.path.toLowerCase();
	const name = doc.name.toLowerCase();
	const title = doc.title.toLowerCase();
	const body = doc.body.toLowerCase();
	const basename = path.split('/').at(-1)?.replace(/\.md$/i, '') ?? name;
	let score = 0;

	score += scoreField(title, query, query, terms) * 2.2;
	score += scoreField(name, query, query, terms) * 1.9;
	score += scoreField(basename, query, query, terms) * 1.6;
	score += scoreField(path, query, query, terms) * 1.1;

	if (body.includes(query)) score += 60;
	for (const term of terms) {
		if (body.includes(term)) score += 8;
	}

	if (path.startsWith('Tasks/')) score += 10;
	if (doc.source === 'task') score += 6;
	if (terms.length > 1 && terms.every((term) => title.includes(term) || name.includes(term))) score += 80;
	if (terms.length > 1 && terms.every((term) => path.includes(term))) score += 48;

	return Math.round(score);
}

function prepareDocs(docs: SearchDoc[]): PreparedDoc[] {
	return docs.map((doc) => ({
		...doc,
		preparedPath: fuzzysort.prepare(doc.path),
		preparedName: fuzzysort.prepare(doc.name),
		preparedTitle: fuzzysort.prepare(doc.title)
	}));
}

async function getIndexPath(basePath: string): Promise<string> {
	return join(basePath, INDEX_DIR, INDEX_FILE);
}

async function loadPersistedIndex(basePath: string): Promise<PersistedIndex | null> {
	const indexPath = await getIndexPath(basePath);
	setDebug({ indexPath });
	if (!(await exists(indexPath))) return null;

	try {
		const raw = await readTextFile(indexPath);
		const parsed = JSON.parse(raw) as PersistedIndex;
		if (parsed.version !== 1 || !Array.isArray(parsed.docs)) return null;
		return parsed;
	} catch {
		return null;
	}
}

async function writePersistedIndex(basePath: string, docs: SearchDoc[]): Promise<PersistedIndex> {
	const indexDir = await join(basePath, INDEX_DIR);
	const indexPath = await getIndexPath(basePath);
	await mkdir(indexDir, { recursive: true });

	const payload: PersistedIndex = {
		version: 1,
		root: basePath,
		builtAt: new Date().toISOString(),
		docCount: docs.length,
		docs
	};

	await writeTextFile(indexPath, JSON.stringify(payload));
	return payload;
}

async function walkMarkdownFiles(basePath: string, relativePath = '', progress = { docs: 0 }): Promise<SearchDoc[]> {
	const fullPath = relativePath ? await join(basePath, relativePath) : basePath;
	const entries = await readDir(fullPath);
	const docs: SearchDoc[] = [];

	for (const entry of entries) {
		if (!entry.name || entry.name.startsWith('.')) continue;
		if (entry.isSymlink) continue;
		const entryRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
		const entryFullPath = await join(basePath, entryRelative);

		if (entry.isDirectory) {
			docs.push(...await walkMarkdownFiles(basePath, entryRelative, progress));
			continue;
		}

		if (!entry.isFile || !entry.name.endsWith('.md')) continue;

		try {
			const content = await readTextFile(entryFullPath);
			const parsed = parseMarkdown(content);
			const body = stripMarkdown(parsed?.body ?? content).slice(0, MAX_INDEXED_BODY_CHARS);
			const title = parsed?.frontmatter?.title?.trim() || entry.name.replace(/\.md$/i, '');
			const source = entryRelative.startsWith('Tasks/') ? 'task' : 'note';
			const doc: SearchDoc = {
				id: entryRelative,
				path: entryRelative,
				name: entry.name.replace(/\.md$/i, ''),
				title,
				body,
				source,
				searchText: `${entryRelative}\n${title}\n${body}`.toLowerCase()
			};
			docs.push(doc);
			progress.docs += 1;
			if (progress.docs % DEBUG_UPDATE_INTERVAL === 0) {
				setDebug({
					state: 'index-building',
					observation: `building index: read ${progress.docs} markdown files`,
					indexedDocs: progress.docs
				});
			}
		} catch {
			// Skip unreadable files.
		}
	}

	return docs;
}

async function ensureIndex(basePath: string): Promise<void> {
	const indexPath = await getIndexPath(basePath);
	if (cachedBasePath === basePath && cachedDocs.length > 0 && staleBasePath !== basePath) {
		setDebug({
			state: 'index-ready',
			staleness: `session cache for ${basePath}`,
			indexPath,
			lastError: null
		});
		return;
	}

	const shouldRebuild = staleBasePath === basePath;
	if (!shouldRebuild) {
		const persisted = await loadPersistedIndex(basePath);
		if (persisted) {
			cachedBasePath = basePath;
			cachedDocs = persisted.docs;
			cachedPreparedDocs = prepareDocs(persisted.docs);
			lastIndexedAt = persisted.builtAt;
			setDebug({
				state: 'index-ready',
				observation: 'loaded persisted JSON index',
				staleness: `persisted build from ${persisted.builtAt}`,
				indexedDocs: persisted.docCount,
				lastIndexedAt: persisted.builtAt,
				indexPath,
				lastError: null
			});
			return;
		}
	}

	setDebug({
		state: 'index-building',
		observation: 'building root-local JSON index',
		staleness: shouldRebuild ? 'persisted index marked stale' : 'persisted index missing',
		indexedDocs: 0,
		lastError: null,
		indexPath
	});

	const docs = await walkMarkdownFiles(basePath);
	const persisted = await writePersistedIndex(basePath, docs);
	cachedBasePath = basePath;
	cachedDocs = docs;
	cachedPreparedDocs = prepareDocs(docs);
	lastIndexedAt = persisted.builtAt;
	staleBasePath = null;
	setDebug({
		state: 'index-ready',
		observation: 'index ready',
		staleness: `persisted build from ${persisted.builtAt}`,
		indexedDocs: docs.length,
		lastIndexedAt: persisted.builtAt,
		indexPath,
		lastError: null
	});
}

export async function searchEditor(basePath: string, query: string, limit = 5): Promise<EditorSearchResult[]> {
	const trimmed = query.trim().toLowerCase();
	if (!trimmed) {
		setDebug({ observation: 'idle', lastQueryMs: null, lastError: null });
		return [];
	}

	const startedAt = performance.now();
	setDebug({
		observation: `query-running: ${trimmed}`,
		authority: 'persisted JSON index under selected root; in-memory query over cached docs',
		lastError: null
	});

	try {
		await ensureIndex(basePath);
		const terms = tokenizeQuery(trimmed);
		const directMatches = cachedDocs
			.filter((doc) => terms.every((term) => doc.searchText.includes(term)))
			.map((doc) => ({
				path: doc.path,
				name: doc.name,
				title: doc.title,
				snippet: makeSnippet(doc.body, trimmed, terms),
				source: doc.source,
				score: scoreDoc(doc, trimmed, terms)
			}));

		const fuzzyMatches = fuzzysort.go(trimmed, cachedPreparedDocs, {
			keys: ['preparedTitle', 'preparedName', 'preparedPath'],
			limit: limit * 4,
			threshold: 0.2
		});

		const byPath = new Map<string, EditorSearchResult>();
		for (const result of directMatches) {
			byPath.set(result.path, result);
		}
		for (const match of fuzzyMatches) {
			const doc = match.obj;
			const existing = byPath.get(doc.path);
			const fuzzyScore = Math.max((match.score + 1000) / 10, 1);
			const next: EditorSearchResult = {
				path: doc.path,
				name: doc.name,
				title: doc.title,
				snippet: makeSnippet(doc.body, trimmed, terms),
				source: doc.source,
				score: (existing?.score ?? scoreDoc(doc, trimmed, terms)) + fuzzyScore
			};
			byPath.set(doc.path, next);
		}

		const sorted = Array.from(byPath.values())
			.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
			.slice(0, limit);

		const elapsed = Math.round(performance.now() - startedAt);
		setDebug({
			observation: `query-done: ${sorted.length} results`,
			lastQueryMs: elapsed,
			lastError: null
		});
		return sorted;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const elapsed = Math.round(performance.now() - startedAt);
		setDebug({
			observation: 'query-failed',
			lastQueryMs: elapsed,
			lastError: message
		});
		throw error;
	}
}

export function invalidateEditorSearch(basePath?: string): void {
	if (!basePath || basePath === cachedBasePath) {
		staleBasePath = basePath ?? cachedBasePath;
		cachedBasePath = '';
		cachedDocs = [];
		cachedPreparedDocs = [];
		lastIndexedAt = null;
		setDebug({
			state: 'index-missing',
			observation: 'idle',
			staleness: 'persisted index marked stale; will rebuild on next query',
			indexedDocs: 0,
			lastIndexedAt: null,
			lastQueryMs: null,
			lastError: null
		});
	}
}

export function getEditorSearchDebugInfo(): EditorSearchDebugInfo {
	return debugInfo;
}
