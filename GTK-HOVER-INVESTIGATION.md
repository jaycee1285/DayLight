# Hover Theme Investigation

1. **Symptoms**
   - Orchis-themed nav buttons (e.g., `a:nth-child(2)` on the nav bar) remain black-on-black on hover in light themes.
   - GTK option consistently reproduces the issue even though Flexoki/Ayu skins work.

2. **GTK color converter tweaks**
   - Expanded `parseCssColor` to understand hex values with alpha, percent literal channels, and space/slash-separated `rgb()`/`rgba()` syntax.
   - Added `ensureContrastWithText` and `ensureMinLuminance` helpers so hover backgrounds can't collapse into dark grey/black against light text.
   - Forced light-mode hover colors to prefer `--color-surface-200/300`, then readjusted them for contrast against `window_fg_color`.
   - Cleared GTK overrides before applying to avoid stale dark values.

3. **GTK data handling**
   - Added GTK function parsing for `alpha()`, `shade()`, and `mix()`.
   - Improved theme resolution to follow relative and `~/` paths, in case Orchis imports other files.
   - Inferred light/dark mode from `window_bg_color` luminance rather than relying solely on `prefer_dark`.

4. **GTK file sources**
   - Orchis theme files are present under `Orchis-Orange-Light/gtk-3.0` and `GTK-4.0`.
   - The converter reads from GTK 4 definitions (window_bg, window_fg, surface anchors).
   - Added special handling for `a:nth-child(2)` hover via nav button hover styling, but hover colors still ended up too dark.

5. **Remaining issue**
   - Hover backgrounds still rendered black in Orchis light mode despite converter adjustments.
   - Likely root cause: a GTK override forces icons/text to black on hover, so hover background must be light to keep contrast, but we already clamp it to surface colors and enforce contrast.
   - A different selector (beyond hover background) may be overriding the icon fill/stroke; need the actual computed color or DOM structure when the issue happens.

Please review this file later for the exact steps taken and let me know if you want any of the experiments rolled back or refined.
