/**
 * GTK4 Theme Integration Service
 *
 * Reads GTK4 named colors from Rust (parsed from ~/.config/gtk-4.0/ CSS files)
 * and maps them to the app's CSS custom properties. Generates interpolated
 * color scales for surface and primary colors from the GTK anchor points.
 */

type RGB = [number, number, number];

interface GtkThemeColors {
	colors: Record<string, string>;
	prefer_dark: boolean;
	theme_path: string | null;
}

// --- Color conversion utilities ---

/** Parse a CSS color value (hex, rgba, named) to [r, g, b] 0-255 */
function parseCssColor(value: string): RGB | null {
	const trimmed = value.trim().toLowerCase();

	if (trimmed === 'white') return [255, 255, 255];
	if (trimmed === 'black') return [0, 0, 0];

	// #RRGGBB, #RGB, #RRGGBBAA, or #RGBA
	if (trimmed.startsWith('#')) {
		const hex = trimmed.slice(1);
		if (hex.length === 6) {
			return [
				parseInt(hex.slice(0, 2), 16),
				parseInt(hex.slice(2, 4), 16),
				parseInt(hex.slice(4, 6), 16)
			];
		}
		if (hex.length === 3) {
			return [
				parseInt(hex[0] + hex[0], 16),
				parseInt(hex[1] + hex[1], 16),
				parseInt(hex[2] + hex[2], 16)
			];
		}
		if (hex.length === 8) {
			const r = parseInt(hex.slice(0, 2), 16);
			const g = parseInt(hex.slice(2, 4), 16);
			const b = parseInt(hex.slice(4, 6), 16);
			const a = parseInt(hex.slice(6, 8), 16) / 255;
			return [
				Math.round(r * a + 255 * (1 - a)),
				Math.round(g * a + 255 * (1 - a)),
				Math.round(b * a + 255 * (1 - a))
			];
		}
		if (hex.length === 4) {
			const r = parseInt(hex[0] + hex[0], 16);
			const g = parseInt(hex[1] + hex[1], 16);
			const b = parseInt(hex[2] + hex[2], 16);
			const a = parseInt(hex[3] + hex[3], 16) / 255;
			return [
				Math.round(r * a + 255 * (1 - a)),
				Math.round(g * a + 255 * (1 - a)),
				Math.round(b * a + 255 * (1 - a))
			];
		}
	}

	// rgba(r, g, b, a), rgb(r g b / a), rgb(r g b), and percent/float channel forms
	const funcMatch = trimmed.match(/rgba?\((.*)\)/);
	if (funcMatch) {
		const body = funcMatch[1].trim();
		const parts = body.split('/');
		const colorPart = parts[0]?.trim() ?? '';
		const alphaPart = parts[1]?.trim();
		const channels = colorPart.split(/[\s,]+/).filter(Boolean);
		if (channels.length >= 3) {
			const parseChannel = (raw: string): number => {
				if (raw.endsWith('%')) {
					const pct = parseFloat(raw);
					return Math.round((pct / 100) * 255);
				}
				return parseFloat(raw);
			};
			let r = parseChannel(channels[0]);
			let g = parseChannel(channels[1]);
			let b = parseChannel(channels[2]);

			// GTK themes sometimes use 0..1 channel values. Detect and scale.
			if (r <= 1 && g <= 1 && b <= 1) {
				r = Math.round(r * 255);
				g = Math.round(g * 255);
				b = Math.round(b * 255);
			}

			let a = 1;
			const alphaRaw = alphaPart ?? (channels.length >= 4 ? channels[3] : undefined);
			if (alphaRaw !== undefined) {
				a = alphaRaw.endsWith('%') ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw);
				if (a > 1) a = 1;
				if (a < 0) a = 0;
			}
			// Composite against white so rgba(0,0,0,0.12) → light gray, not black.
			// Material Design themes use rgba(0,0,0,alpha) extensively for gray tones.
			return [
				Math.round(r * a + 255 * (1 - a)),
				Math.round(g * a + 255 * (1 - a)),
				Math.round(b * a + 255 * (1 - a))
			];
		}
	}

	return null;
}

function clampChannel(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)));
}

function parseGtkColor(
	value: string,
	colors: Record<string, string>,
	visited: Set<string> = new Set()
): RGB | null {
	const trimmed = value.trim();
	if (trimmed.startsWith('@')) {
		const ref = trimmed.slice(1);
		if (visited.has(ref)) return null;
		const next = colors[ref];
		if (!next) return null;
		visited.add(ref);
		return parseGtkColor(next, colors, visited);
	}

	const lower = trimmed.toLowerCase();
	const alphaMatch = lower.match(/^alpha\((.+),\s*([0-9.]+%?)\s*\)$/);
	if (alphaMatch) {
		const base = parseGtkColor(alphaMatch[1], colors, new Set(visited));
		if (!base) return null;
		let a = alphaMatch[2].endsWith('%')
			? parseFloat(alphaMatch[2]) / 100
			: parseFloat(alphaMatch[2]);
		if (a > 1) a = 1;
		if (a < 0) a = 0;
		return [
			Math.round(base[0] * a + 255 * (1 - a)),
			Math.round(base[1] * a + 255 * (1 - a)),
			Math.round(base[2] * a + 255 * (1 - a))
		];
	}

	const shadeMatch = lower.match(/^shade\((.+),\s*([0-9.]+)\s*\)$/);
	if (shadeMatch) {
		const base = parseGtkColor(shadeMatch[1], colors, new Set(visited));
		if (!base) return null;
		const factor = parseFloat(shadeMatch[2]);
		return [
			clampChannel(base[0] * factor),
			clampChannel(base[1] * factor),
			clampChannel(base[2] * factor)
		];
	}

	const mixMatch = lower.match(/^mix\((.+),\s*(.+),\s*([0-9.]+%?)\s*\)$/);
	if (mixMatch) {
		const a = parseGtkColor(mixMatch[1], colors, new Set(visited));
		const b = parseGtkColor(mixMatch[2], colors, new Set(visited));
		if (!a || !b) return null;
		const raw = mixMatch[3];
		const t = raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw);
		return lerpRgb(a, b, Math.max(0, Math.min(1, t)));
	}

	return parseCssColor(trimmed);
}

/** Convert [r, g, b] to the space-separated triplet format CSS vars expect */
function toTriplet(rgb: RGB): string {
	return `${rgb[0]} ${rgb[1]} ${rgb[2]}`;
}

/** Linearly interpolate between two RGB colors */
function lerpRgb(a: RGB, b: RGB, t: number): RGB {
	return [
		Math.round(a[0] + (b[0] - a[0]) * t),
		Math.round(a[1] + (b[1] - a[1]) * t),
		Math.round(a[2] + (b[2] - a[2]) * t)
	];
}

function colorDistance(a: RGB, b: RGB): number {
	const dr = a[0] - b[0];
	const dg = a[1] - b[1];
	const db = a[2] - b[2];
	return Math.sqrt(dr * dr + dg * dg + db * db);
}

// --- Contrast utilities ---

/** sRGB relative luminance (WCAG 2.x definition) */
function luminance(rgb: RGB): number {
	const [r, g, b] = rgb.map((c) => {
		const s = c / 255;
		return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors (always >= 1) */
function contrastRatio(a: RGB, b: RGB): number {
	const la = luminance(a);
	const lb = luminance(b);
	const lighter = Math.max(la, lb);
	const darker = Math.min(la, lb);
	return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Nudge color `c` away from `ref` until contrast ratio >= minRatio.
 * Pushes darker if c is darker than ref, lighter if c is lighter.
 */
function ensureContrast(c: RGB, ref: RGB, minRatio: number): RGB {
	const maxIterations = 20;
	let result = c;
	const cLum = luminance(c);
	const refLum = luminance(ref);
	// Push toward black if c is darker, toward white if c is lighter
	const target: RGB = cLum < refLum ? [0, 0, 0] : [255, 255, 255];

	for (let i = 0; i < maxIterations; i++) {
		if (contrastRatio(result, ref) >= minRatio) break;
		result = lerpRgb(result, target, 0.1);
	}
	return result;
}

function ensureMinLuminance(c: RGB, minLum: number): RGB {
	const maxIterations = 20;
	let result = c;
	for (let i = 0; i < maxIterations; i++) {
		if (luminance(result) >= minLum) break;
		result = lerpRgb(result, [255, 255, 255], 0.1);
	}
	return result;
}

function ensureContrastWithText(bg: RGB, text: RGB, minRatio: number): RGB {
	const maxIterations = 20;
	let result = bg;
	const target: RGB = luminance(text) < 0.5 ? [255, 255, 255] : [0, 0, 0];
	for (let i = 0; i < maxIterations; i++) {
		if (contrastRatio(result, text) >= minRatio) break;
		result = lerpRgb(result, target, 0.1);
	}
	return result;
}

function pickOnColor(bg: RGB): RGB {
	const white: RGB = [255, 255, 255];
	const black: RGB = [0, 0, 0];
	return contrastRatio(white, bg) >= contrastRatio(black, bg) ? white : black;
}

// --- Scale generation ---

/** Steps in the color scale */
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/**
 * Interpolate a full scale from a set of anchors.
 * Anchors are [stepIndex, color] where stepIndex is the position in STEPS (0-10).
 */
function interpolateAnchors(anchors: [number, RGB][]): Record<string, string> {
	const result: Record<string, string> = {};
	anchors.sort((a, b) => a[0] - b[0]);

	for (let i = 0; i < STEPS.length; i++) {
		// Find surrounding anchors
		let lower = anchors[0];
		let upper = anchors[anchors.length - 1];
		for (let a = 0; a < anchors.length - 1; a++) {
			if (i >= anchors[a][0] && i <= anchors[a + 1][0]) {
				lower = anchors[a];
				upper = anchors[a + 1];
				break;
			}
		}
		const range = upper[0] - lower[0];
		const t = range === 0 ? 0 : (i - lower[0]) / range;
		result[`${STEPS[i]}`] = toTriplet(lerpRgb(lower[1], upper[1], t));
	}
	return result;
}

/** Helper: try to parse a GTK color by name, with fallbacks */
function pickColor(colors: Record<string, string>, ...names: string[]): RGB | null {
	for (const name of names) {
		const val = colors[name];
		if (val) {
			const rgb = parseGtkColor(val, colors);
			if (rgb) {
				return rgb;
			}
		}
	}
	return null;
}

/**
 * Generate the surface color scale (50-950) from GTK anchor colors.
 *
 * Light: 50 is lightest background, 950 is darkest (text color).
 * Dark: 50 is lightest (text/highlights), 950 is darkest background.
 */
function generateSurfaceScale(
	colors: Record<string, string>,
	isDark: boolean
): Record<string, string> {
	const windowBg = pickColor(colors, 'window_bg_color');
	const windowFg = pickColor(colors, 'window_fg_color');
	if (!windowBg || !windowFg) return {};

	const viewBg = pickColor(colors, 'view_bg_color') ?? windowBg;
	const headerbarBackdrop = pickColor(colors, 'headerbar_backdrop_color', 'shade_color');
	const headerbarBorder = pickColor(colors, 'headerbar_border_color', 'thumbnail_bg_color');
	const headerbarBg = pickColor(colors, 'headerbar_bg_color');
	const cardBg = pickColor(colors, 'card_bg_color');

	let anchors: [number, RGB][];

	if (!isDark) {
		// Light mode: 50=lightest bg, 950=darkest (text)
		const s50 = viewBg;
		const s100 = headerbarBackdrop ?? lerpRgb(viewBg, windowFg, 0.05);
		const s200 = headerbarBorder ?? lerpRgb(viewBg, windowFg, 0.1);
		const s300 = lerpRgb(s200, windowFg, 0.15);

		anchors = [
			[0, s50], // 50
			[1, s100], // 100
			[2, s200], // 200
			[3, s300], // 300
			[10, windowFg] // 950
		];
	} else {
		// Dark mode: 50=lightest (text highlights), 950=darkest bg
		const s50 = windowFg;
		const s100 = lerpRgb(windowFg, windowBg, 0.15);
		const s200 = lerpRgb(windowFg, windowBg, 0.5);
		const s300 = cardBg ?? viewBg;
		const s700 = headerbarBg ?? lerpRgb(viewBg, windowBg, 0.5);
		const s800 = lerpRgb(s700, windowBg, 0.4);
		const s900 = lerpRgb(s700, windowBg, 0.7);
		const s950 = windowBg;

		anchors = [
			[0, s50], // 50
			[1, s100], // 100
			[2, s200], // 200
			[3, s300], // 300
			[7, s700], // 700
			[8, s800], // 800
			[9, s900], // 900
			[10, s950] // 950
		];
	}

	const scale = interpolateAnchors(anchors);

	// Post-process: enforce minimum contrast between adjacent surface steps.
	// This matters most for surface-100 vs surface-200 (settings card bg vs code-inline bg).
	const MIN_ADJACENT_CONTRAST = 1.12;
	const parsed: RGB[] = STEPS.map((s) => {
		const parts = scale[`${s}`].split(' ').map(Number) as RGB;
		return parts;
	});
	for (let i = 1; i < parsed.length; i++) {
		if (contrastRatio(parsed[i], parsed[i - 1]) < MIN_ADJACENT_CONTRAST) {
			parsed[i] = ensureContrast(parsed[i], parsed[i - 1], MIN_ADJACENT_CONTRAST);
			scale[`${STEPS[i]}`] = toTriplet(parsed[i]);
		}
	}

	if (isDark) {
		// Ensure dark-mode key surface steps have a visible spread.
		const keyIndices = [6, 7, 8, 9, 10]; // 600..950
		const MIN_KEY_DISTANCE = 14;
		const MIN_LUMINANCE_DROP = 0.01;
		const target: RGB = [0, 0, 0];
		for (let i = 1; i < keyIndices.length; i++) {
			const prevIndex = keyIndices[i - 1];
			const index = keyIndices[i];
			let current = parsed[index];
			const prev = parsed[prevIndex];
			for (let iter = 0; iter < 25; iter++) {
				const lumDelta = luminance(prev) - luminance(current);
				const dist = colorDistance(current, prev);
				if (lumDelta >= MIN_LUMINANCE_DROP && dist >= MIN_KEY_DISTANCE) break;
				current = lerpRgb(current, target, 0.12);
			}
			parsed[index] = current;
			scale[`${STEPS[index]}`] = toTriplet(current);
		}
	}

	const result: Record<string, string> = {};
	for (const [step, value] of Object.entries(scale)) {
		result[`--color-surface-${step}`] = value;
	}
	return result;
}

/**
 * Generate the primary color scale from the GTK accent color.
 * Mix toward white for lighter steps, toward black for darker steps.
 *
 * The tint for 100 (used as selected/active bg) is intentionally stronger
 * than a purely linear distribution so the highlight is visible against
 * neutral surface colors.
 */
function generatePrimaryScale(accent: RGB, surfaceBg: RGB | null): Record<string, string> {
	const white: RGB = [255, 255, 255];
	const black: RGB = [0, 0, 0];

	// Tint factors (toward white) for steps below 500
	// 100 at 0.72 instead of 0.80 = more accent retained for visible highlights
	const tints = [0.92, 0.72, 0.58, 0.42, 0.22];
	// Shade factors (toward black) for steps above 500
	// 900 at 0.50 instead of 0.45 = deeper shade for dark-mode highlights
	const shades = [0.18, 0.33, 0.50, 0.62, 0.72];

	const result: Record<string, string> = {};
	for (let i = 0; i < 5; i++) {
		result[`--color-primary-${STEPS[i]}`] = toTriplet(lerpRgb(accent, white, tints[i]));
	}
	result['--color-primary-500'] = toTriplet(accent);
	for (let i = 0; i < 5; i++) {
		result[`--color-primary-${STEPS[i + 6]}`] = toTriplet(lerpRgb(accent, black, shades[i]));
	}

	// Enforce: primary-100 must be visibly distinct from the surface background.
	// This is the "selected item" highlight — needs to clearly stand out.
	if (surfaceBg) {
		const MIN_HIGHLIGHT_CONTRAST = 1.18;
		const p100 = result['--color-primary-100'].split(' ').map(Number) as RGB;
		if (contrastRatio(p100, surfaceBg) < MIN_HIGHLIGHT_CONTRAST) {
			const fixed = ensureContrast(p100, surfaceBg, MIN_HIGHLIGHT_CONTRAST);
			result['--color-primary-100'] = toTriplet(fixed);
		}
	}

	return result;
}

// --- All CSS properties we may override ---

const ALL_GTK_OVERRIDES: string[] = [
	...STEPS.map((s) => `--color-surface-${s}`),
	...STEPS.map((s) => `--color-primary-${s}`),
	'--color-success-500',
	'--color-warning-500',
	'--color-error-500',
	'--color-on-primary',
	'--color-overlay',
	'--color-shadow',
	'--color-hover-bg',
	'--color-hover-bg-strong',
	'--body-background-color',
	'--body-text-color',
	'--theme-selection-bg',
	'--theme-selection-fg'
];

// --- Apply / Clear ---

export function applyGtkTheme(data: GtkThemeColors): void {
	const { colors, prefer_dark: preferDark } = data;
	const debugGtk = (() => {
		try {
			return localStorage.getItem('daylight-gtk-debug') === '1';
		} catch {
			return false;
		}
	})();

	if (Object.keys(colors).length === 0) {
		console.warn('[gtk-theme] No GTK colors available, falling back to default theme');
		clearGtkTheme();
		return;
	}

	// Clear any previous GTK overrides to avoid stale values when parsing fails.
	const root = document.documentElement;
	for (const prop of ALL_GTK_OVERRIDES) {
		root.style.removeProperty(prop);
	}

	// Infer dark/light from actual window background if available.
	const inferredDark = (() => {
		const windowBg = pickColor(colors, 'window_bg_color');
		if (!windowBg) return null;
		return luminance(windowBg) < 0.4;
	})();
	const isDark = inferredDark ?? preferDark;

	// 1. Set data-theme for dark/light CSS branch selection in components
	const baseTheme = isDark ? 'flexoki-dark' : 'flexoki-light';
	root.setAttribute('data-theme', baseTheme);
	root.setAttribute('data-gtk', 'true');

	const overrides: Record<string, string> = {};

	// 2. Surface scale
	Object.assign(overrides, generateSurfaceScale(colors, isDark));

	// 3. Primary scale from accent color
	const accent = pickColor(colors, 'accent_bg_color', 'accent_color');
	if (accent) {
		// Pass surface-100 (card/nav bg) so primary-100 highlight can be contrast-checked against it
		const surfaceBg = overrides['--color-surface-100']
			? (overrides['--color-surface-100'].split(' ').map(Number) as RGB)
			: null;
		Object.assign(overrides, generatePrimaryScale(accent, surfaceBg));
		overrides['--color-on-primary'] = toTriplet(pickOnColor(accent));
	}

	// 4. Semantic colors (direct map, as RGB triplets for alpha blending)
	const mapDirect = (gtkName: string, cssVar: string) => {
		const rgb = pickColor(colors, gtkName);
		if (rgb) overrides[cssVar] = toTriplet(rgb);
	};
	mapDirect('success_color', '--color-success-500');
	mapDirect('warning_color', '--color-warning-500');
	mapDirect('error_color', '--color-error-500');
	// Fallback: some themes use destructive_color instead of error_color
	if (!colors['error_color'] && colors['destructive_color']) {
		mapDirect('destructive_color', '--color-error-500');
	}

	// 5. App-level defaults
	const windowFg = pickColor(colors, 'window_fg_color');
	if (windowFg) {
		overrides['--body-text-color'] = toTriplet(windowFg);
	}

	const windowBg = pickColor(colors, 'window_bg_color');
	if (windowBg && windowFg) {
		const hoverBase = windowBg;
		const hoverTarget = windowFg;
		let hoverBg = ensureContrast(lerpRgb(hoverBase, hoverTarget, isDark ? 0.18 : 0.1), hoverBase, 1.12);
		let hoverStrong = ensureContrast(
			lerpRgb(hoverBase, hoverTarget, isDark ? 0.3 : 0.18),
			hoverBase,
			1.16
		);
		hoverBg = ensureContrastWithText(hoverBg, windowFg, 3);
		hoverStrong = ensureContrastWithText(hoverStrong, windowFg, 3);
		if (!isDark) {
			const minLum = Math.max(0, luminance(hoverBase) - 0.05);
			hoverBg = ensureMinLuminance(hoverBg, minLum);
			hoverStrong = ensureMinLuminance(hoverStrong, minLum);
			// Light GTK themes: prefer surface scale hover colors if available.
			const s200 = overrides['--color-surface-200'];
			const s300 = overrides['--color-surface-300'];
			if (s200 && s300) {
				const s200Rgb = s200.split(' ').map(Number) as RGB;
				const s300Rgb = s300.split(' ').map(Number) as RGB;
				hoverBg = ensureContrastWithText(s200Rgb, windowFg, 3);
				hoverStrong = ensureContrastWithText(s300Rgb, windowFg, 3);
			}
		}
		overrides['--color-hover-bg'] = toTriplet(hoverBg);
		overrides['--color-hover-bg-strong'] = toTriplet(hoverStrong);
	}

	if (debugGtk) {
		console.info('[gtk-theme] applied', {
			prefer_dark: preferDark,
			inferred_dark: inferredDark,
			resolved_dark: isDark,
			theme_path: data.theme_path,
			colors_count: Object.keys(colors).length,
			window_bg_color: colors['window_bg_color'],
			window_fg_color: colors['window_fg_color'],
			view_bg_color: colors['view_bg_color'],
			view_fg_color: colors['view_fg_color'],
			resolved_window_bg: windowBg,
			resolved_window_fg: windowFg,
			hover_bg: overrides['--color-hover-bg'],
			hover_bg_strong: overrides['--color-hover-bg-strong']
		});
	}

	const overlayBase = isDark
		? pickColor(colors, 'window_bg_color', 'view_bg_color')
		: pickColor(colors, 'window_fg_color', 'view_fg_color');
	if (overlayBase) {
		overrides['--color-overlay'] = toTriplet(overlayBase);
	}

	const shadowBase = isDark
		? pickColor(colors, 'window_bg_color', 'view_bg_color')
		: pickColor(colors, 'window_fg_color', 'view_fg_color');
	if (shadowBase) {
		overrides['--color-shadow'] = toTriplet(shadowBase);
	}

	// --body-background-color is used as a full rgb() value, not a triplet
	if (isDark && overrides['--color-surface-950']) {
		overrides['--body-background-color'] = `rgb(${overrides['--color-surface-950']})`;
	} else if (!isDark && overrides['--color-surface-50']) {
		overrides['--body-background-color'] = `rgb(${overrides['--color-surface-50']})`;
	}

	// Selection colors
	const selBg = pickColor(colors, 'theme_selected_bg_color');
	if (selBg) overrides['--theme-selection-bg'] = toTriplet(selBg);
	const selFg = pickColor(colors, 'theme_selected_fg_color');
	if (selFg) overrides['--theme-selection-fg'] = toTriplet(selFg);

	// 6. Apply all overrides as inline styles (higher specificity than [data-theme] selectors)
	for (const [prop, value] of Object.entries(overrides)) {
		root.style.setProperty(prop, value);
	}

	// 7. Store dark preference for anti-FOUC on next load
	try {
		localStorage.setItem('daylight-gtk-dark', String(isDark));
	} catch {
		// Ignore
	}
}

export function clearGtkTheme(): void {
	const root = document.documentElement;
	for (const prop of ALL_GTK_OVERRIDES) {
		root.style.removeProperty(prop);
	}
	root.removeAttribute('data-gtk');
}

export function isGtkAvailable(data: GtkThemeColors): boolean {
	return Object.keys(data.colors).length > 0;
}

// --- Event listener for live theme changes ---

let unlistenFn: (() => void) | null = null;

export async function initGtkThemeListener(): Promise<void> {
	if (unlistenFn) {
		unlistenFn();
		unlistenFn = null;
	}

	try {
		const { listen } = await import('@tauri-apps/api/event');
		const { invoke } = await import('@tauri-apps/api/core');

		unlistenFn = await listen('gtk-theme-changed', async () => {
			try {
				const data = await invoke<GtkThemeColors>('get_gtk_colors');
				applyGtkTheme(data);
			} catch (err) {
				console.error('[gtk-theme] Failed to re-apply after change:', err);
			}
		});
	} catch {
		// Tauri not available (browser dev mode)
	}
}

export function destroyGtkThemeListener(): void {
	if (unlistenFn) {
		unlistenFn();
		unlistenFn = null;
	}
}
