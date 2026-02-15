# Tailwind 4 + SvelteKit 2 + Svelte 5 + Skeleton Integration Lessons

**Date**: 2026-01-26
**Context**: CoverPro project, referencing DayLight as working baseline
**Stack**: Tauri v2, SvelteKit 2, Svelte 5, Tailwind 4, Skeleton UI v4

---

## What Works

### 1. PostCSS Approach (NOT Vite Plugin)

DayLight uses PostCSS for Tailwind, and this is the correct approach for SvelteKit 2.

**vite.config.ts** - Only SvelteKit plugin, NO Tailwind:
```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  // ... rest of config
});
```

**postcss.config.js** - Tailwind via PostCSS:
```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {}
  }
};
```

**app.css** - Import Tailwind:
```css
@import 'tailwindcss';
```

### 2. Typography Plugin (Tailwind 4 syntax)

In Tailwind 4, plugins are added via `@plugin` directive in CSS:

```css
@import 'tailwindcss';
@plugin '@tailwindcss/typography';
```

Then use `prose` classes:
```html
<article class="prose prose-sm max-w-none">
  {@html htmlContent}
</article>
```

### 3. unplugin-icons for Lucide Icons

**Install**:
```bash
bun add -d unplugin-icons @iconify-json/lucide
bun add @iconify/svelte
```

**vite.config.js**:
```javascript
import Icons from "unplugin-icons/vite";

export default defineConfig({
  plugins: [
    sveltekit(),
    Icons({
      compiler: "svelte",
      autoInstall: false
    })
  ],
});
```

**Usage in Svelte**:
```svelte
<script>
  import IconCheck from '~icons/lucide/check';
  import IconRefreshCw from '~icons/lucide/refresh-cw';
</script>

<IconCheck class="w-5 h-5 text-green-500" />
<IconRefreshCw class="w-5 h-5 animate-spin" />
```

---

## What Failed

### 1. `@tailwindcss/vite` Plugin

**Attempted**:
```javascript
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [sveltekit(), tailwindcss()],
});
```

**Error**: 500 Internal Error on page load.

**Also tried**: `[tailwindcss(), sveltekit()]` - same error.

**Root cause**: The Vite plugin approach conflicts with how SvelteKit processes CSS. Use PostCSS instead.

### 2. PostCSS Parsing .svelte Files

**Attempted**: Just adding postcss.config.js without proper setup.

**Error**: `Unknown word <script` - PostCSS tried to parse .svelte files as CSS.

**Fix**: Ensure `vitePreprocess()` is in svelte.config.js:
```javascript
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  preprocess: vitePreprocess(),
  // ...
};
```

### 3. Skeleton v4 `Card` Component

**Attempted**:
```svelte
import { Card } from '@skeletonlabs/skeleton-svelte';

<Card class="p-3">...</Card>
```

**Error**: `The requested module does not provide an export named 'Card'`

**Root cause**: Skeleton v4 removed the Card component entirely. It's not in the exports:
```
accordion, app-bar, avatar, carousel, collapsible, combobox,
date-picker, dialog, file-upload, floating-panel, listbox, menu,
navigation, pagination, popover, portal, progress, rating-group,
segmented-control, slider, steps, switch, tabs, tags-input,
toast, toggle-group, tooltip, tree-view
```

**Fix**: Use styled divs with Tailwind classes:
```svelte
<div class="card p-3 rounded-lg border bg-surface-100">
  <!-- content -->
</div>
```

### 4. lucide-svelte Package

**Attempted**: `bun add lucide-svelte`

**Issue**: Works but unplugin-icons is more flexible and already used in DayLight.

**Fix**: Use unplugin-icons with @iconify-json/lucide instead.

---

## Stale Cache Issues

When switching between Tailwind approaches, stale caches cause confusing errors.

**Nuclear option**:
```bash
cd app
rm -rf node_modules .svelte-kit .vite dist build
bun install
bun run dev
```

Always try this before debugging weird 500 errors or missing exports.

---

## Package Versions That Work Together

From CoverPro's working setup:

```json
{
  "devDependencies": {
    "@sveltejs/adapter-static": "^3.0.10",
    "@sveltejs/kit": "^2.50.0",
    "@sveltejs/vite-plugin-svelte": "^5.1.1",
    "@tailwindcss/postcss": "^4.1.18",
    "@tailwindcss/typography": "^0.5.19",
    "tailwindcss": "^4.1.18",
    "svelte": "^5.47.1",
    "vite": "^6.4.1",
    "unplugin-icons": "^23.0.1",
    "@iconify-json/lucide": "^1.2.87"
  },
  "dependencies": {
    "@skeletonlabs/skeleton-svelte": "^4.11.0",
    "@iconify/svelte": "^5.2.1"
  }
}
```

**Do NOT install**: `@tailwindcss/vite` - it will break things.

---

## Tauri/WebKitGTK Gotchas (Linux)

Separate from Tailwind but discovered in same session:

If WebKitGTK reports insane viewport values (e.g., `clientWidth: 1400000003`), you're missing dependencies in flake.nix:

```nix
# Required for proper text/viewport rendering
pango
harfbuzz
atk

# Required for Wayland
wayland
wayland-protocols
libxkbcommon
```

See DayLight's flake.nix for complete dependency list.

---

## Summary

| Approach | Status | Notes |
|----------|--------|-------|
| PostCSS + @tailwindcss/postcss | ✅ Works | Use this |
| Vite plugin + @tailwindcss/vite | ❌ Fails | 500 errors |
| Skeleton Card component | ❌ Gone | Use styled divs |
| unplugin-icons | ✅ Works | Better than lucide-svelte |
| @tailwindcss/typography | ✅ Works | Use @plugin directive |

**TL;DR**: For SvelteKit 2 + Tailwind 4, use PostCSS approach, not Vite plugin. Skeleton v4 has no Card. Clear caches when switching approaches.
