/**
 * Single source of truth for the theme registry.
 *
 * Why this file exists: `data-mode` (dark|light) used to be derived from a
 * hand-maintained Set duplicated in +layout.svelte and settings/+page.svelte,
 * and was only ever written from inside an async onMount chain. Any launch
 * where that chain was slow, threw, or was pre-empted left <html> with a
 * correct `data-theme` but no `data-mode` — which renders a dark theme's body
 * background underneath every component's light-mode card styling.
 *
 * The dark/light flag here matches the `Theme: X (dark|light)` header that
 * generate-skeleton-themes.ts writes into each src/themes/*-skeleton.css.
 */

export type ThemeMode = 'light' | 'dark';

export interface ThemeEntry {
	value: string;
	label: string;
	mode: ThemeMode;
}

/** Every concrete theme that has a [data-theme="..."] block in src/themes. */
export const THEMES: readonly ThemeEntry[] = [
	{ value: 'flexoki-light', label: 'Flexoki Light', mode: 'light' },
	{ value: 'flexoki-dark', label: 'Flexoki Dark', mode: 'dark' },
	{ value: 'ayu-light', label: 'Ayu Light', mode: 'light' },
	{ value: 'ayu-dark', label: 'Ayu Dark', mode: 'dark' },
	{ value: 'catppuccin-latte', label: 'Catppuccin Latte', mode: 'light' },
	{ value: 'dawnfox', label: 'Dawnfox', mode: 'light' },
	{ value: 'everforest-dark-hard', label: 'Everforest Dark', mode: 'dark' },
	{ value: 'everforest-light-hard', label: 'Everforest Light', mode: 'light' },
	{ value: 'glacier', label: 'Glacier', mode: 'dark' },
	{ value: 'gruvbox-material-dark', label: 'Gruvbox Material Dark', mode: 'dark' },
	{ value: 'gruvbox-material-light-hard', label: 'Gruvbox Material Light Hard', mode: 'light' },
	{ value: 'kanagawa', label: 'Kanagawa', mode: 'dark' },
	{ value: 'kanagawa-lotus', label: 'Kanagawa Lotus', mode: 'light' },
	{ value: 'nordfox', label: 'Nordfox', mode: 'dark' },
	{ value: 'polar', label: 'Polar', mode: 'light' },
	{ value: 'rose-pine-dawn', label: 'Rosé Pine Dawn', mode: 'light' },
	{ value: 'rose-pine-moon', label: 'Rosé Pine Moon', mode: 'dark' },
	{ value: 'solarized-dark-higher-contrast', label: 'Solarized Dark HC', mode: 'dark' },
	{ value: 'solarized-light', label: 'Solarized Light', mode: 'light' },
	{ value: 'tokyo-night-storm', label: 'Tokyo Night Storm', mode: 'dark' }
];

export const DEFAULT_LIGHT_THEME = 'flexoki-light';
export const DEFAULT_DARK_THEME = 'flexoki-dark';

const THEME_BY_VALUE = new Map(THEMES.map((t) => [t.value, t]));

/** Concrete theme names whose surface scale runs light-on-dark. */
export const DARK_THEMES: readonly string[] = THEMES.filter((t) => t.mode === 'dark').map(
	(t) => t.value
);

/** True for a concrete theme name. 'system'/'gtk' are preferences, not themes. */
export function isDarkTheme(theme: string): boolean {
	return THEME_BY_VALUE.get(theme)?.mode === 'dark';
}

/** Unknown theme names fall back to the light default rather than rendering unstyled. */
export function normalizeTheme(theme: string | null | undefined): string {
	return theme && THEME_BY_VALUE.has(theme) ? theme : DEFAULT_LIGHT_THEME;
}

export function resolveSystemTheme(): string {
	const prefersDark =
		typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
	return prefersDark ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
}

/**
 * Turn a stored preference ('system' | 'gtk' | a theme name) into a concrete
 * theme. 'gtk' resolves to a flexoki base; gtk-theme.ts layers its variable
 * overrides on top of that base afterwards.
 */
export function resolveThemePreference(preference: string | null | undefined): string {
	if (!preference || preference === 'system') return resolveSystemTheme();
	if (preference === 'gtk') {
		let gtkDark = false;
		try {
			gtkDark = localStorage.getItem('daylight-gtk-dark') === 'true';
		} catch {
			// localStorage unavailable; assume light.
		}
		return gtkDark ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
	}
	return normalizeTheme(preference);
}

/**
 * The ONLY place data-theme + data-mode are written together. Both attributes
 * must always move as a pair — a data-theme without a matching data-mode is
 * the "dark background, light cards" bug.
 */
export function applyThemeAttributes(theme: string, mode?: ThemeMode): void {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	root.setAttribute('data-theme', theme);
	root.setAttribute('data-mode', mode ?? (isDarkTheme(theme) ? 'dark' : 'light'));
}
