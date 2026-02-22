# Accent Color Discovery: Non-Blue Primaries Hidden in Base16/Gogh Themes
Accent Color Discovery: Non-Blue Primaries Hidden in Base16/Gogh Themes
Most Base16 themes default to blue (`base0D`) as the primary accent. But many theme authors chose more interesting colors — buried in cursor values, ANSI slots, or non-standard base16 mappings. This document captures what was found and how to use it.

---

## The Good Ones

### Pinks & Magentas
| Theme | Accent | Hex | Where It Hides | base0D (blue) |
| **Rosé Pine Moon** | rose pink | `#eb6f92` | color_02 | `#3e8fb0` |
| **Catppuccin Latte** | rosewater | `#dc8a78` | base06 (repurposed) | `#1e66f5` |

### Oranges & Ambers

| **Rosé Pine Dawn** | marigold | `#ea9d34` | color_04 (yellow) | `#286983` |
| **Solarized Dark HC** | amber | `#a57706` | color_04 | `#2176c7` |
| **Monokai Pro Light** | warm orange | `#cc7a0a` | color_04 | `#e16032` |
| **Gruvbox Material Light** | ochre | `#b47109` | color_04 | `#45707a` |
| **Gruvbox Material Dark** | warm gold | `#d8a657` | color_04 | `#7daea3` |

### Reds & Corals

| **Everforest Dark Hard** | soft red | `#e67e80` | color_02 | `#7fbbb3` |

### Greens & Teals

| **Selenized Light** | leaf green | `#489100` | color_03 | `#0072d4` |
| **Tomorrow Night Blue** | bright aqua | `#99ffff` | color_07 (cyan) | `#bbdaff` |

### Yellows
| **Paper** | solarized yellow | `#b58900` | color_04 | `#1e6fcc` |


### To Delete

## How the Detection Works

Scan script at `/tmp/scan-accents.ts` (run with `bun run /tmp/scan-accents.ts`).

**For Gogh themes** (`.yml` with `color_01`-`color_16` + `cursor`/`background`/`foreground`):
1. Check `cursor` against distinctiveness filter (distance from bg > 60, distance from fg > 60, saturation > 35%)
2. If cursor fails, check all ANSI color slots, pick most saturated that passes
3. If nothing passes, fall back to color_05 (blue)

**For Base16 themes** (`.yaml` with `palette.base00`-`base0F`):
1. Check base06/base07 (sometimes repurposed — Catppuccin puts rosewater and lavender here)
2. Check base08-base0F for most saturated non-blue
3. Report base0D and best alternative

---

## Implementation: Adding `accent` to base16changer

### 1. Add optional `accent` field to YAML parsing

**File**: `internal/scheme/parse.go`

In the `Scheme` or palette struct, add:

```go
Accent string `yaml:"accent"` // optional override, hex without #
```

In `ParseFile()`, after loading the palette, check for accent:

```go
if scheme.Accent != "" {
    data["accent-hex"] = scheme.Accent
    // also generate accent-rgb-r, accent-rgb-g, accent-rgb-b
} else {
    // fall back to base0D
    data["accent-hex"] = data["base0D-hex"]
}
```

### 2. Update templates to use `accent-hex`

**File**: `internal/targets/templates.go`

Replace `base0D-hex` with `accent-hex` in these specific accent/primary roles only:

**GTK-4** (lines ~80-82):
```css
@define-color accent_color #{{accent-hex}};
@define-color accent_bg_color #{{accent-hex}};
@define-color accent_fg_color #{{base00-hex}};
```

**LabWC/Openbox** (active window border):
```
window.active.border.color: #{{accent-hex}}
```

**Fuzzel** (match highlight and border):
```
match={{accent-hex}}ff
selection-match={{accent-hex}}ff
border={{accent-hex}}ff
```

**Leave these unchanged** (they should stay as literal ANSI blue):
- Kitty `color4` / `color12` → keep `base0D-hex`
- GTK-3/GTK-2 `link_color` → keep `base0D-hex` (or change to accent, your call)
- GTK-4 `blue_1` through `blue_5` → keep `base0D-hex`

### 3. Add `accent` field to the 4-5 theme YAMLs you want to test

Example for Catppuccin Latte (`catppuccin-latte.yaml`):

```yaml
system: "base16"
name: "Catppuccin Latte"
author: "https://github.com/catppuccin/catppuccin"
variant: "light"
accent: "dc8a78"  # rosewater — from base06, cursor in kitty conf
palette:
  base00: "eff1f5"
  # ... rest unchanged
```

The field is optional. Themes without it use base0D as before. Zero breakage.

### 4. For Gogh `.yml` files

Same approach — add `accent:` field. The Gogh parser in `parse.go` already handles extra YAML fields; it just needs to forward the accent value into the template data map the same way.

### 5. For kitty `.conf` files (DayLight/Skeleton pipeline)

No changes needed — the Skeleton generator already has `findAccentColor()` which does this detection. The accent colors in the tables above are what it finds (or would find with the expanded ANSI check).

---

## Starter Set: 5 Themes to Test First

Pick from different hue families to validate the full range:

1. **Catppuccin Latte** — rosewater `#dc8a78` (pink/coral)
2. **Rosé Pine Dawn** — marigold `#ea9d34` (warm orange) — use from Gogh cursor or color_04
3. **Hemisu Light** — hot pink `#ff0054` (magenta)
4. **Gruvbox Material Light, Hard** — already teal `#45707a` in base0D (no change needed, control group)
5. **Monokai Pro Light** — warm orange `#cc7a0a`

---

*Generated 2026-02-19 from scan of 85 themes across `/home/john/repos/Gogh/themes/` and `/home/john/.local/share/themes/`.*