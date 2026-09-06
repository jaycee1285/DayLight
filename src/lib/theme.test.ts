import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { THEMES, DARK_THEMES, isDarkTheme, normalizeTheme } from './theme';

const SRC = join(process.cwd(), 'src');
const THEMES_DIR = join(SRC, 'themes');

function themeFiles(): string[] {
	return readdirSync(THEMES_DIR).filter((f) => f.endsWith('.css'));
}

/** Every [data-theme="x"] block across the theme CSS files. */
function cssThemeNames(): string[] {
	const names: string[] = [];
	for (const file of themeFiles()) {
		const css = readFileSync(join(THEMES_DIR, file), 'utf8');
		for (const m of css.matchAll(/\[data-theme="([^"]+)"\]/g)) {
			if (!names.includes(m[1])) names.push(m[1]);
		}
	}
	return names;
}

describe('theme registry vs theme CSS', () => {
	it('every registry theme has a CSS block', () => {
		const css = cssThemeNames();
		const missing = THEMES.map((t) => t.value).filter((v) => !css.includes(v));
		expect(missing, `registry themes with no [data-theme] block: ${missing.join(', ')}`).toEqual(
			[]
		);
	});

	it('every CSS theme block is in the registry', () => {
		const registry = THEMES.map((t) => t.value);
		const orphans = cssThemeNames().filter((v) => !registry.includes(v));
		expect(orphans, `CSS themes missing from the registry: ${orphans.join(', ')}`).toEqual([]);
	});

	it('every theme CSS file is imported by app.css', () => {
		const appCss = readFileSync(join(SRC, 'app.css'), 'utf8');
		const notImported = themeFiles().filter((f) => !appCss.includes(f));
		expect(notImported, `theme files not imported in app.css: ${notImported.join(', ')}`).toEqual(
			[]
		);
	});

	it('registry mode matches the generator header in single-theme files', () => {
		const mismatches: string[] = [];
		for (const file of themeFiles()) {
			const css = readFileSync(join(THEMES_DIR, file), 'utf8');
			const blocks = [...css.matchAll(/\[data-theme="([^"]+)"\]/g)].map((m) => m[1]);
			const unique = [...new Set(blocks)];
			// Files like flexoki/ayu ship a light + dark pair under one header comment.
			if (unique.length !== 1) continue;
			const header = css.match(/Theme:\s.*\((dark|light)\)/);
			if (!header) continue;
			const expected = header[1] === 'dark';
			if (isDarkTheme(unique[0]) !== expected) {
				mismatches.push(`${file}: header says ${header[1]}, registry says ${isDarkTheme(unique[0]) ? 'dark' : 'light'}`);
			}
		}
		expect(mismatches).toEqual([]);
	});
});

describe('app.html boot script stays locked to the registry', () => {
	const html = readFileSync(join(SRC, 'app.html'), 'utf8');

	function inlineList(name: string): string[] {
		const m = html.match(new RegExp(`var ${name} = (?:DARK\\.concat\\()?\\[([^\\]]*)\\]`));
		if (!m) throw new Error(`could not find inline ${name} list in app.html`);
		return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
	}

	it('inline DARK list equals the registry dark themes', () => {
		expect(inlineList('DARK').slice().sort()).toEqual(DARK_THEMES.slice().sort());
	});

	it('inline KNOWN list covers exactly the registry themes', () => {
		const known = [...inlineList('DARK'), ...inlineList('KNOWN')];
		expect([...new Set(known)].sort()).toEqual(THEMES.map((t) => t.value).sort());
	});

	it('boot script sets data-mode, not just data-theme', () => {
		expect(html).toMatch(/setAttribute\('data-mode'/);
		expect(html).toMatch(/<html[^>]*data-mode=/);
	});
});

describe('normalizeTheme', () => {
	it('falls back to the light default for removed/unknown themes', () => {
		// These were in the old hand-maintained darkThemes Set but have no CSS.
		expect(normalizeTheme('liquidcarbon')).toBe('flexoki-light');
		expect(normalizeTheme('tomorrow-night-blue')).toBe('flexoki-light');
		expect(normalizeTheme(null)).toBe('flexoki-light');
	});

	it('passes through known themes', () => {
		expect(normalizeTheme('nordfox')).toBe('nordfox');
	});
});

/**
 * Executes the real inline boot script from src/app.html against a stubbed DOM.
 * This is the regression test for the actual bug: a dark theme restored from
 * localStorage used to set data-theme with no data-mode, so every component
 * rendered its light-mode card colors on top of the dark body background.
 */
describe('app.html boot script behavior', () => {
	const html = readFileSync(join(SRC, 'app.html'), 'utf8');
	const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

	function boot(stored: Record<string, string>, prefersDark = false) {
		const attrs: Record<string, string> = {};
		const sandbox = {
			localStorage: {
				getItem: (k: string) => (k in stored ? stored[k] : null)
			},
			window: { matchMedia: () => ({ matches: prefersDark }) },
			document: {
				documentElement: {
					setAttribute: (k: string, v: string) => {
						attrs[k] = v;
					}
				}
			}
		};
		// eslint-disable-next-line no-new-func
		new Function(
			'localStorage',
			'window',
			'document',
			script as string
		)(sandbox.localStorage, sandbox.window, sandbox.document);
		return attrs;
	}

	it('finds an inline boot script', () => {
		expect(script).toBeTruthy();
	});

	it('restores a dark theme with a matching data-mode', () => {
		expect(boot({ 'daylight-theme': 'nordfox' })).toEqual({
			'data-theme': 'nordfox',
			'data-mode': 'dark'
		});
	});

	it('restores a light theme with a matching data-mode', () => {
		expect(boot({ 'daylight-theme': 'polar' })).toEqual({
			'data-theme': 'polar',
			'data-mode': 'light'
		});
	});

	it('sets a matching pair for every theme in the registry', () => {
		for (const theme of THEMES) {
			expect(boot({ 'daylight-theme': theme.value }), theme.value).toEqual({
				'data-theme': theme.value,
				'data-mode': theme.mode
			});
		}
	});

	it('falls back to the light default for a stale/removed theme name', () => {
		// e.g. a user who had selected one of the themes deleted from src/themes
		expect(boot({ 'daylight-theme': 'liquidcarbon' })).toEqual({
			'data-theme': 'flexoki-light',
			'data-mode': 'light'
		});
	});

	it('follows the OS for the system preference', () => {
		expect(boot({ 'daylight-theme': 'system' }, true)).toEqual({
			'data-theme': 'flexoki-dark',
			'data-mode': 'dark'
		});
		expect(boot({ 'daylight-theme': 'system' }, false)).toEqual({
			'data-theme': 'flexoki-light',
			'data-mode': 'light'
		});
	});

	it('uses the stored gtk dark hint for the gtk preference', () => {
		expect(boot({ 'daylight-theme': 'gtk', 'daylight-gtk-dark': 'true' })).toEqual({
			'data-theme': 'flexoki-dark',
			'data-mode': 'dark'
		});
	});
});
