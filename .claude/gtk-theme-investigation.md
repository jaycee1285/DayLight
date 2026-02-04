# GTK Theme Integration: Investigation Notes (Jan 2026)

## ROOT CAUSE

The dark-mode key-spread enforcement in `generateSurfaceScale()` (gtk-theme.ts lines 382-402) pushes steps toward `[0,0,0]` (pure black). This is backwards. It should spread UPWARD from the darkest anchor.

### How the bug works:

```javascript
// Current code: iterates 600→700→800→900→950, pushing each DARKER
const target: RGB = [0, 0, 0];  // ← THE BUG: pushing toward black
current = lerpRgb(current, target, 0.12);
```

If step 600 is already ~48 RGB, each step gets pushed 14 units darker:
- 600: 48 → stays
- 700: pushed to ~34
- 800: pushed to ~20
- 900: pushed to ~6
- 950: pushed to ~0

Everything collapses into near-black. Container bg (surface-800) and hover (surface-700) become indistinguishable dark blobs.

### The fix:

Reverse the direction. Anchor at 950 (= windowBg, the actual desktop background). Iterate UPWARD from 950, pushing each step LIGHTER (toward windowFg/white):

```javascript
// Fix: iterate 950→900→800→700→600, pushing each LIGHTER
const keyIndices = [10, 9, 8, 7, 6]; // reversed: 950→600
const target: RGB = windowFg; // or [255,255,255]
for (let i = 1; i < keyIndices.length; i++) {
    const prevIndex = keyIndices[i - 1]; // darker step
    const index = keyIndices[i];          // lighter step
    let current = parsed[index];
    const prev = parsed[prevIndex];
    for (let iter = 0; iter < 25; iter++) {
        const lumDelta = luminance(current) - luminance(prev); // lighter - darker
        const dist = colorDistance(current, prev);
        if (lumDelta >= MIN_LUMINANCE_DROP && dist >= MIN_KEY_DISTANCE) break;
        current = lerpRgb(current, target, 0.12); // push LIGHTER
    }
    parsed[index] = current;
    scale[`${STEPS[index]}`] = toTriplet(current);
}
```

This keeps the body background (950) matching the GTK desktop and spreads the lighter steps upward into usable territory.

### Reference: flexoki-dark values (what "correct" looks like):
```
surface-600: 48 47 46
surface-700: 40 39 38  (8 units lighter than 800)
surface-800: 30 29 29  (card/panel bg)
surface-900: 24 23 23
surface-950: 16 15 15  (body bg)
```

## ALSO BROKEN: three CSS variable typos in +layout.svelte

Fixed this session:
- `--body-background-700` → `--color-surface-700`
- `--body-background-600` → `--color-surface-600`
- `--color-primary` → `--color-primary-500`

## Semantic variables added by previous sessions

Previous Claude sessions added `--color-hover-bg`, `--color-hover-bg-strong`, `--color-on-primary` to:
- flexoki-skeleton.css
- ayu-skeleton.css
- gtk-theme.ts
- +layout.svelte CSS

These were attempts to work around the black-on-black issue. They may or may not be useful once the root cause (scale direction) is fixed. The component CSS using hardcoded surface steps (surface-700 for hover, surface-800 for bg) should work correctly if the scale is generated properly.

## User-reported issues:

1. Task row hover (today-bases): goes black
2. Task row bg: too dark by ~2 shades
3. Sheet component: bg too dark
4. Projects/tags count badge: bg too dark
5. Navbar button hover: black on black
6. Code block components: black on black

All of these use the standard surface step pattern (700 for hover, 800 for bg, 600 for badges). All should be fixed by correcting the scale generation direction.

## Debug mode:
`localStorage.setItem('spredux-gtk-debug', '1')` — logs resolved GTK colors to console.

## Key file:
`src/lib/services/gtk-theme.ts` — the ONLY file that needs a code change. Lines 382-402.
