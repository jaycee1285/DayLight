#!/usr/bin/env bun
/**
 * Generate skeleton CSS theme files from kitty terminal configs.
 *
 * Mapping:
 *   background/foreground → surface scale
 *   color4/color12 (blue) → primary
 *   color5/color13 (magenta) → secondary
 *   color2/color10 (green) → tertiary + success
 *   color6/color14 (cyan) → accent
 *   color3/color11 (yellow) → warning
 *   color1/color9 (red) → error
 *   selection_background/selection_foreground → selection
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, basename } from 'path';

type RGB = [number, number, number];

// ── helpers ──────────────────────────────────────────────────────────

function hexToRgb(hex: string): RGB {
	const h = hex.replace('#', '');
	return [
		parseInt(h.slice(0, 2), 16),
		parseInt(h.slice(2, 4), 16),
		parseInt(h.slice(4, 6), 16)
	];
}

function lerp(a: RGB, b: RGB, t: number): RGB {
	return [
		Math.round(a[0] + (b[0] - a[0]) * t),
		Math.round(a[1] + (b[1] - a[1]) * t),
		Math.round(a[2] + (b[2] - a[2]) * t)
	];
}

function luminance(rgb: RGB): number {
	const [r, g, b] = rgb.map((c) => {
		const s = c / 255;
		return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: RGB, b: RGB): number {
	const la = luminance(a);
	const lb = luminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function triplet(rgb: RGB): string {
	return `${rgb[0]} ${rgb[1]} ${rgb[2]}`;
}

function padTriplet(rgb: RGB): string {
	return `${String(rgb[0]).padStart(3)} ${String(rgb[1]).padStart(3)} ${String(rgb[2]).padStart(3)}`;
}

/** Pad step number for alignment in CSS values, but NOT in property names */
function stepLabel(s: number): string {
	return String(s);
}

function pickOnColor(bg: RGB): RGB {
	const white: RGB = [255, 255, 255];
	const black: RGB = [0, 0, 0];
	return contrastRatio(white, bg) >= contrastRatio(black, bg) ? white : black;
}

function colorDistance(a: RGB, b: RGB): number {
	return Math.sqrt(
		Math.pow(a[0] - b[0], 2) +
		Math.pow(a[1] - b[1], 2) +
		Math.pow(a[2] - b[2], 2)
	);
}

function saturation(rgb: RGB): number {
	const max = Math.max(...rgb);
	const min = Math.min(...rgb);
	if (max === 0) return 0;
	return (max - min) / max;
}

function isDistinctiveAccent(color: RGB, bg: RGB, fg: RGB, minDistance = 60, minSaturation = 0.35): boolean {
	const distFromBg = colorDistance(color, bg);
	const distFromFg = colorDistance(color, fg);
	const sat = saturation(color);
	return distFromBg > minDistance && distFromFg > minDistance && sat > minSaturation;
}

/**
 * Find a distinctive accent color from theme metadata.
 * Checks cursor, selection_background, active_border_color, url_color in priority order.
 * Returns null if no distinctive accent found (caller should fall back to color4/blue).
 */
function findAccentColor(colors: KittyColors, bg: RGB, fg: RGB): { color: RGB; source: string } | null {
	const candidates = [
		'cursor',
		'selection_background',
		'active_border_color',
		'url_color',
		'color16',
		'color17',
	];

	for (const key of candidates) {
		const rgb = getColor(colors, key);
		if (rgb && isDistinctiveAccent(rgb, bg, fg)) {
			return { color: rgb, source: key };
		}
	}

	return null;
}

// ── scale generation ─────────────────────────────────────────────────

function generateColorScale(base: RGB): Record<number, RGB> {
	const white: RGB = [255, 255, 255];
	const black: RGB = [0, 0, 0];
	const tints = [0.92, 0.80, 0.65, 0.45, 0.22]; // 50,100,200,300,400
	const shades = [0.18, 0.33, 0.45, 0.60, 0.72]; // 600,700,800,900,950
	const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
	const result: Record<number, RGB> = {};
	for (let i = 0; i < 5; i++) result[steps[i]] = lerp(base, white, tints[i]);
	result[500] = base;
	for (let i = 0; i < 5; i++) result[steps[i + 6]] = lerp(base, black, shades[i]);
	return result;
}

/**
 * Build a surface scale for dark themes.
 *
 * All steps are lerp(fg, bg, factor) — monotonically getting darker as
 * the step number increases. The factors are chosen so that the 600-950
 * "UI zone" has good visible spread (matching flexoki-dark's ~10 RGB
 * units between adjacent steps).
 *
 * 50 = fg (lightest text), 950 = bg (body background, darkest).
 */
function darkSurfaceScale(bg: RGB, fg: RGB): Record<number, RGB> {
	// Factors: 0 = fg (lightest), 1 = bg (darkest)
	// Big jump 100→200 creates the "muted text" zone
	// Gradual 600→950 ensures hover/card/bg steps are distinguishable
	const factors: Record<number, number> = {
		50: 0, 100: 0.05, 200: 0.45, 300: 0.65,
		400: 0.72, 500: 0.78, 600: 0.82,
		700: 0.87, 800: 0.93, 900: 0.97, 950: 1.0
	};
	const result: Record<number, RGB> = {};
	for (const [step, t] of Object.entries(factors)) {
		result[Number(step)] = lerp(fg, bg, t);
	}
	return result;
}

/**
 * Build a surface scale for light themes.
 *
 * All steps are lerp(bg, fg, factor) — monotonically getting darker as
 * the step number increases.
 *
 * 50 = bg (body background, lightest), 950 = fg (text/ink, darkest).
 */
function lightSurfaceScale(bg: RGB, fg: RGB): Record<number, RGB> {
	const factors: Record<number, number> = {
		50: 0, 100: 0.04, 200: 0.08, 300: 0.14,
		400: 0.25, 500: 0.40, 600: 0.55,
		700: 0.65, 800: 0.78, 900: 0.88, 950: 1.0
	};
	const result: Record<number, RGB> = {};
	for (const [step, t] of Object.entries(factors)) {
		result[Number(step)] = lerp(bg, fg, t);
	}
	return result;
}

// ── kitty parser ─────────────────────────────────────────────────────

interface KittyColors {
	background: string;
	foreground: string;
	selection_background?: string;
	selection_foreground?: string;
	[key: string]: string | undefined;
}

function parseKittyConf(path: string): KittyColors {
	const text = readFileSync(path, 'utf-8');
	const result: KittyColors = { background: '#000000', foreground: '#ffffff' };
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const match = trimmed.match(/^(\S+)\s+(\S+)/);
		if (match) {
			const [, key, value] = match;
			if (value.startsWith('#')) {
				result[key] = value;
			}
		}
	}
	return result;
}

/**
 * Parse a YAML terminal theme file (color_01..color_16 format).
 * Maps color_01..color_08 → color0..color7, color_09..color_16 → color8..color15.
 */
function parseYamlTheme(path: string): KittyColors {
	const text = readFileSync(path, 'utf-8');
	const result: KittyColors = { background: '#000000', foreground: '#ffffff' };
	for (const line of text.split('\n')) {
		const match = line.match(/^\s*([\w]+):\s*'(#[0-9a-fA-F]{6})'/);
		if (!match) continue;
		const [, key, value] = match;
		if (key === 'background' || key === 'foreground' || key === 'cursor') {
			result[key] = value;
		} else {
			// color_01 → color0, color_09 → color8, etc.
			const numMatch = key.match(/^color_(\d+)$/);
			if (numMatch) {
				const idx = parseInt(numMatch[1], 10) - 1;
				result[`color${idx}`] = value;
			}
		}
	}
	return result;
}

function getColor(colors: KittyColors, key: string): RGB | null {
	const val = colors[key];
	if (!val || !val.startsWith('#')) return null;
	try {
		return hexToRgb(val);
	} catch {
		return null;
	}
}

// ── CSS generation ───────────────────────────────────────────────────

interface ThemeCssResult {
	css: string;
	primarySource: string;
	primaryHex: string;
}

function generateThemeCssWithInfo(
	themeName: string,
	dataTheme: string,
	colors: KittyColors
): ThemeCssResult {
	const bg = hexToRgb(colors.background);
	const fg = hexToRgb(colors.foreground);
	const isDark = luminance(bg) < 0.2;

	// Surface scale
	const surface = isDark
		? darkSurfaceScale(bg, fg)
		: lightSurfaceScale(bg, fg);

	// Color scales from terminal ANSI colors
	// First, try to find a distinctive accent color from theme metadata
	const detectedAccent = findAccentColor(colors, bg, fg);

	const blue = getColor(colors, 'color4') ?? (isDark ? [100, 149, 237] as RGB : [65, 105, 225] as RGB);
	const brightBlue = getColor(colors, 'color12');
	const defaultBlue = isDark && brightBlue ? brightBlue : blue;

	// Use distinctive accent if found, otherwise fall back to blue
	const primaryBase = detectedAccent ? detectedAccent.color : defaultBlue;
	const primarySource = detectedAccent ? detectedAccent.source : 'color4 (blue)';
	const primary = generateColorScale(primaryBase);

	const magenta = getColor(colors, 'color5') ?? [186, 85, 211] as RGB;
	const secondary = generateColorScale(magenta);

	const green = getColor(colors, 'color2') ?? [76, 175, 80] as RGB;
	const tertiary = generateColorScale(green);

	const cyan = getColor(colors, 'color6') ?? [0, 188, 212] as RGB;
	const accent = generateColorScale(cyan);

	const red = getColor(colors, 'color1') ?? [244, 67, 54] as RGB;
	const brightRed = getColor(colors, 'color9');
	const yellow = getColor(colors, 'color3') ?? [255, 193, 7] as RGB;
	const brightYellow = getColor(colors, 'color11');

	// Selection colors
	const selBg = getColor(colors, 'selection_background') ?? (isDark ? surface[300] : surface[300]);
	const selFg = getColor(colors, 'selection_foreground') ?? (isDark ? fg : fg);

	// Body defaults
	const bodyBg = isDark ? surface[950] : surface[50];
	const bodyText = isDark ? fg : fg;

	const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

	let css = `[data-theme="${dataTheme}"] {\n`;

	// Surfaces
	css += `  /* --- Surfaces --- */\n`;
	for (const s of steps) {
		const hex = `#${surface[s].map(c => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
		css += `  --color-surface-${s}: ${padTriplet(surface[s])}; /* ${hex} */\n`;
	}
	css += '\n';

	// Primary
	const primaryHex = `#${primaryBase.map(c => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
	css += `  /* --- Primary (${primarySource}: ${primaryHex}) --- */\n`;
	for (const s of steps) {
		css += `  --color-primary-${s}: ${padTriplet(primary[s])};\n`;
	}
	css += '\n';

	// Secondary
	css += `  /* --- Secondary (magenta) --- */\n`;
	for (const s of steps) {
		css += `  --color-secondary-${s}: ${padTriplet(secondary[s])};\n`;
	}
	css += '\n';

	// Tertiary
	css += `  /* --- Tertiary (green) --- */\n`;
	for (const s of steps) {
		css += `  --color-tertiary-${s}: ${padTriplet(tertiary[s])};\n`;
	}
	css += '\n';

	// Accent
	css += `  /* --- Accent (cyan) --- */\n`;
	for (const s of steps) {
		css += `  --color-accent-${s}: ${padTriplet(accent[s])};\n`;
	}
	css += '\n';

	// Semantic
	const errorColor = isDark && brightRed ? brightRed : red;
	const warningColor = isDark && brightYellow ? brightYellow : yellow;
	css += `  /* --- Semantic --- */\n`;
	css += `  --color-success-500: ${padTriplet(green)};\n`;
	css += `  --color-warning-500: ${padTriplet(warningColor)};\n`;
	css += `  --color-error-500:   ${padTriplet(errorColor)};\n`;
	css += '\n';

	// App defaults
	css += `  /* --- App defaults --- */\n`;
	css += `  --body-background-color: rgb(var(--color-surface-${isDark ? '950' : '50'}));\n`;
	css += `  --body-text-color:       ${padTriplet(bodyText)};\n`;
	css += '\n';
	css += `  --theme-selection-bg:    ${padTriplet(selBg)};\n`;
	css += `  --theme-selection-fg:    ${padTriplet(selFg)};\n`;
	css += '\n';

	const onPrimary = pickOnColor(primaryBase);
	css += `  --color-on-primary:      ${padTriplet(onPrimary)};\n`;
	css += `  --color-overlay:         ${isDark ? '0 0 0' : '0 0 0'};\n`;
	css += `  --color-shadow:          0 0 0;\n`;

	if (isDark) {
		css += `  --color-hover-bg:        var(--color-surface-700);\n`;
		css += `  --color-hover-bg-strong: var(--color-surface-600);\n`;
	} else {
		css += `  --color-hover-bg:        var(--color-surface-200);\n`;
		css += `  --color-hover-bg-strong: var(--color-surface-300);\n`;
	}

	css += `}\n`;
	return { css, primarySource, primaryHex };
}

// ── main ─────────────────────────────────────────────────────────────

const THEMES_DIR = join(import.meta.dir, 'themes');
const OUTPUT_DIR = '/home/john/repos/skeleton-themes';

// Skip list
const SKIP = new Set([
	'kitty.conf',
	'current-theme.conf',
	'set-colors'
]);
const SKIP_PATTERNS = [/flexoki/i, /ayu/i, /gruvbox.material/i];

// Dedup: prefer files without underscores (space versions)
const seen = new Map<string, string>(); // normalized name → path

const files = readdirSync(THEMES_DIR).filter((f) => f.endsWith('.conf') || f.endsWith('.yml') || f.endsWith('.yaml'));
for (const f of files) {
	if (SKIP.has(f)) continue;
	if (SKIP_PATTERNS.some((p) => p.test(f))) continue;

	// Normalize: remove extension, replace underscores/hyphens with spaces, lowercase
	const normalized = f.replace(/\.(conf|ya?ml)$/, '').replace(/[_-]/g, ' ').toLowerCase();

	if (!seen.has(normalized)) {
		seen.set(normalized, f);
	} else {
		// Prefer yml over conf (user-added), prefer non-underscore
		const existing = seen.get(normalized)!;
		const fIsYml = f.endsWith('.yml') || f.endsWith('.yaml');
		const existingIsYml = existing.endsWith('.yml') || existing.endsWith('.yaml');
		if (fIsYml && !existingIsYml) { seen.set(normalized, f); continue; }
		if (!fIsYml && existingIsYml) continue;
		if (f.includes('_') && !existing.includes('_')) continue;
		if (!f.includes('_') && existing.includes('_')) seen.set(normalized, f);
	}
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const generated: { file: string; dataTheme: string; name: string; isDark: boolean }[] = [];

for (const [normalized, filename] of seen) {
	const path = join(THEMES_DIR, filename);
	const isYaml = filename.endsWith('.yml') || filename.endsWith('.yaml');
	const colors = isYaml ? parseYamlTheme(path) : parseKittyConf(path);

	const bg = hexToRgb(colors.background);
	const isDark = luminance(bg) < 0.2;

	// data-theme value: lowercase, spaces/underscores to hyphens, ascii-safe
	const dataTheme = normalized
		.replace(/\s+/g, '-')
		.replace(/_/g, '-')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // strip diacritics
		.replace(/[^a-z0-9-]/g, '');

	// CSS filename
	const cssFilename = `${dataTheme}-skeleton.css`;

	const themeName = filename.replace(/\.(conf|ya?ml)$/, '').replace(/_/g, ' ');

	const sourceType = isYaml ? 'YAML theme' : 'kitty config';
	const { css, primarySource, primaryHex } = generateThemeCssWithInfo(themeName, dataTheme, colors);

	const header = `/* Generated from ${sourceType}: ${filename}\n   Theme: ${themeName} (${isDark ? 'dark' : 'light'})\n   Primary: ${primaryHex} (from ${primarySource})\n*/\n\n`;
	writeFileSync(join(OUTPUT_DIR, cssFilename), header + css);

	generated.push({ file: cssFilename, dataTheme, name: themeName, isDark });
	console.log(`  ${isDark ? '🌙' : '☀️'}  ${dataTheme} → ${cssFilename} [primary: ${primaryHex} from ${primarySource}]`);
}

console.log(`\nGenerated ${generated.length} skeleton themes in ${OUTPUT_DIR}`);

// Output import lines for app.css
console.log('\n--- Import lines for app.css ---');
for (const g of generated.sort((a, b) => a.dataTheme.localeCompare(b.dataTheme))) {
	console.log(`@import '../../skeleton-themes/${g.file}';`);
}

// Output theme options for settings
console.log('\n--- Theme option entries ---');
for (const g of generated.sort((a, b) => a.name.localeCompare(b.name))) {
	console.log(`  { value: '${g.dataTheme}', label: '${g.name}', dark: ${g.isDark} },`);
}
