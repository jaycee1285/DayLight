import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@tauri-apps/api/path', () => ({
	appDataDir: vi.fn(async () => '/base'),
	join: vi.fn(async (base: string, name: string) => `${base}/${name}`)
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
	exists: vi.fn(),
	mkdir: vi.fn(),
	readTextFile: vi.fn(),
	writeTextFile: vi.fn(),
	rename: vi.fn(),
	remove: vi.fn(),
	stat: vi.fn(),
	copyFile: vi.fn(),
	readDir: vi.fn(),
	BaseDirectory: {}
}));

import { DEFAULT_DATA_FOLDER } from './constants';
import {
	getDataPath,
	setDataPathOverride,
	resetDataPathOverrideForTests
} from './storage';

describe('getDataPath', () => {
	beforeEach(() => {
		resetDataPathOverrideForTests();
	});

	it('returns default app data path when no override set', async () => {
		const result = await getDataPath();
		expect(result).toBe(`/base/${DEFAULT_DATA_FOLDER}`);
	});

	it('returns override path when configured', async () => {
		setDataPathOverride('/custom/path');
		const result = await getDataPath();
		expect(result).toBe('/custom/path');
	});
});
