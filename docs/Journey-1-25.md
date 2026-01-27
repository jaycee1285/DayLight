# SPRedux Development Journey - January 25, 2026

A chronicle of bugs squashed, features added, and lessons learned.

---

## Task Creation Wasn't Persisting

**Problem:** Creating tasks via the Add Task modal worked in the UI, but tasks vanished on refresh.

**Root Cause:** The layout was importing task creation functions from `app.svelte.ts` (in-memory store) instead of `markdown-store.svelte.ts` (persists to disk).

**Fix:** Changed imports in `+layout.svelte`:
```javascript
// Before (wrong)
import { addTask } from '$lib/stores/app.svelte';

// After (correct)
import { addTask as addMarkdownTask } from '$lib/stores/markdown-store.svelte';
```

Also fixed argument mismatches - the markdown store uses `projects` (array) not `project` (string), and `scheduled` goes inside the options object.

---

## Double `.md` Extension Bug

**Problem:** Creating a task called "test" resulted in `test.md.md`.

**Root Cause:** The `generateTaskFilename` function in `markdown-storage.ts` always appended `.md`, even if the title already ended with it.

**Fix:** Strip `.md` from input before processing:
```javascript
let sanitized = title
    .trim()
    .replace(/\.md$/i, '')  // Added this line
    .replace(/[<>:"/\\|?*]/g, '')
```

---

## Recurrence System Overhaul

**Problem:** The Add Task modal only had None/Weekly/Monthly options. No Daily, no custom/advanced options.

**Changes Made:**

1. **Added Daily recurrence option** - Simple button alongside None/Weekly/Monthly

2. **Created RecurrenceEditor component** (`src/lib/components/RecurrenceEditor.svelte`):
   - Supports Daily (with interval), Weekly (day picker + interval), Monthly (day-of-month or nth weekday), Yearly
   - Has both standalone mode (with Save/Cancel buttons) and inline mode (no buttons, auto-updates via `onchange`)
   - Compact styling for mobile via `.compact` class

3. **Added Custom recurrence button** (gear icon) that shows the full RecurrenceEditor inline

4. **CSS fixes** - Initial version had broken colors in dark mode. Fixed to use proper theme variables: `rgb(var(--color-surface-*))` with `:global([data-theme='flexoki-dark'])` overrides.

---

## TaskContextMenu Refactor

**Problem:** Context menu code was duplicated inline in both `ViewTaskRow.svelte` and `TaskRow.svelte`. A `TaskContextMenu.svelte` component existed but wasn't being used.

**Fix:** Rewrote `TaskContextMenu.svelte` to be the single source of truth:
- Uses Lucide icons (not emoji)
- Integrates RecurrenceEditor for setting task recurrence
- Handles all task actions: reschedule, delete, complete/incomplete, track time
- Auto-repositions when RecurrenceEditor opens (via `requestAnimationFrame`)
- Has `max-height` constraint with scroll for mobile

Updated `ViewTaskRow.svelte` to use the component, removing ~120 lines of duplicated code.

---

## Mobile Sheet Scrolling

**Problem:** The Add Task sheet with RecurrenceEditor was too tall for mobile. The Add button was cut off below the viewport.

**Root Cause:** The Sheet component's content area wasn't properly scrollable.

**Fix:** Restructured `Sheet.svelte` with flexbox:
```css
.sheet-content {
    max-height: 90dvh;
    display: flex;
    flex-direction: column;
}

.sheet-body {
    flex: 1;
    min-height: 0;  /* Critical for flex scroll */
    overflow-y: auto;
}
```

The `min-height: 0` is essential - without it, flex children won't shrink below their content size.

---

## Time Logging Not Updating UI

**Problem:** Logging time via ClockDrag worked (data saved to disk), but the UI didn't reflect the change until page refresh.

**Diagnosis:** Added console.log statements throughout the chain:
- `handleLogTime` in ViewTaskRow ✓
- `logTime` in markdown-store ✓
- File found, timeEntries updated ✓
- Save completed ✓

Data was saving correctly. The issue was **Svelte 5 reactivity**.

**Root Cause:** The store used `$state` with a Map:
```javascript
let taskFiles = $state<Map<string, {...}>>(new Map());
```

When updating via `taskFiles.set(filename, newData)`, Svelte 5's fine-grained reactivity didn't always trigger `$derived` recalculations that iterate over the Map.

**Fix:** Create a new Map on every mutation to force reactivity:
```javascript
// Before (doesn't trigger derived updates)
taskFiles.set(filename, { frontmatter: updated, body });

// After (triggers reactivity)
taskFiles = new Map(taskFiles).set(filename, { frontmatter: updated, body });
```

Applied this pattern to all mutations:
- `updateTask`
- `addTask`
- `addRecurringTask`
- `deleteTask`
- `markTaskComplete`
- `markTaskIncomplete`
- `skipTaskInstance`

---

## Nix Build Documentation

Created `docs/NIX-BUILD.md` with:

1. **Standalone repo flake** - Pinned to nixos-24.11 stable for binary cache hits, minimal inputs (just nixpkgs + flake-utils)

2. **Home Manager module example** - For integrating SPRedux into existing NixOS configs

3. **Build steps** for Linux x86_64 and aarch64

4. **Android build notes** - Clarified that only `aarch64-linux-android` target is needed for modern phones

**Also:** Slimmed down the actual `flake.nix` to remove unnecessary Android targets:
```nix
// Before: 4 Android targets
targets = [
  "aarch64-linux-android"
  "armv7-linux-androideabi"  // Removed
  "x86_64-linux-android"     // Removed
  "i686-linux-android"       // Removed
];

// After: Just what's needed
targets = [
  "x86_64-unknown-linux-gnu"   // Dev machine
  "aarch64-linux-android"       // Phone
];
```

---

## Key Lessons

1. **Check which store you're importing from** - Having two store systems (`app.svelte` and `markdown-store.svelte`) is confusing. Functions with similar names do very different things.

2. **Svelte 5 Map reactivity** - Don't mutate Maps in place when you need derived values to update. Create new Maps.

3. **Mobile-first CSS** - `min-height: 0` on flex children, `max-height: Xdvh` on containers, `overflow-y: auto` where scrolling is needed.

4. **Debug with console.log** - When async flows "don't work", add logs at each step to find exactly where the chain breaks.

5. **Don't over-engineer Nix** - Pin to stable, minimize inputs, only target architectures you actually use.

---

## Files Modified

- `src/routes/+layout.svelte` - Fixed store imports, added recurrence options
- `src/lib/components/RecurrenceEditor.svelte` - New/rewritten component
- `src/lib/components/TaskContextMenu.svelte` - Rewritten to be reusable
- `src/lib/components/ViewTaskRow.svelte` - Uses TaskContextMenu now
- `src/lib/components/Sheet.svelte` - Fixed scroll behavior
- `src/lib/stores/markdown-store.svelte.ts` - Fixed Map reactivity
- `src/lib/storage/markdown-storage.ts` - Fixed double .md extension
- `flake.nix` - Removed unnecessary Android targets
- `docs/NIX-BUILD.md` - New documentation
