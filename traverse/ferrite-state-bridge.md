---
id: ferrite-state-bridge
kind: integration
authority:
  - recent-files-list
mutates:
  - .ferrite/state.json (shared with Ferrite editor)
observes:
  - editor-page (basePath, file opens)
persists_to:
  - filesystem (.ferrite/state.json in vault root)
depends_on:
  - editor-page
  - tauri-fs-scope
staleness_risks:
  - Ferrite and DayLight writing to the same file concurrently (mitigated: user won't run both simultaneously)
  - Tauri fs:scope must explicitly allow dotdirs (.ferrite) — `**` globs do NOT match dotfiles
  - basePath mismatch: .ferrite/state.json lives at the vault root, not in subdirectories
  - Syncthing conflict files (.sync-conflict-*) can appear alongside state.json
entrypoints:
  - src/routes/editor/+page.svelte (readFerriteState, writeFerriteState, trackRecentFile)
---

# Ferrite State Bridge

## Purpose
DayLight's editor reads and writes Ferrite's `.ferrite/state.json` to share recent file history between the two apps. This gives DayLight a "recent files" FAB in the file browser view, populated from whichever app last opened files in the vault.

## Origin
User-initiated design decision (Mar 2026): "yoink the ferrite json" rather than maintain a separate recent-files list. Ferrite already tracks `recent_files` as absolute paths, so DayLight piggybacks on that format.

## Why This Could Bite You

### Tauri fs:scope
Tauri does NOT match dotfiles/dotdirs with `**` globs. The `.ferrite` directory required explicit scope entries in `src-tauri/capabilities/default.json`:
```json
"$HOME/**/.ferrite",
"$HOME/**/.ferrite/**",
"/home/**/.ferrite",
"/home/**/.ferrite/**"
```
Without these, `exists()` and `readTextFile()` throw "forbidden path" errors that get silently caught, making the feature appear broken with zero visible feedback. This is the same pattern used for `.daylight/`.

### Shared Mutable State
Two apps write to the same JSON file. Current safety model: the user won't run both simultaneously. If that assumption breaks (e.g., Ferrite running in background on Android while DayLight is open), last-write-wins with no merge strategy. The file is small and non-critical (just MRU order), so data loss is cosmetic.

### Format Contract
DayLight preserves all fields in the JSON even if it doesn't use them (`expanded_paths`, `file_tree_width`, `show_file_tree`). If Ferrite adds new fields, DayLight's read-modify-write cycle will preserve them as long as they survive `JSON.parse` → `JSON.stringify`. If Ferrite changes the schema fundamentally (renames `recent_files`, switches to a different format), DayLight's bridge breaks silently.

### Path Assumptions
- Ferrite stores absolute paths in `recent_files`
- DayLight filters to only show files under the current `basePath`
- If the user changes their vault location or Syncthing remaps paths, old entries become stale (but harmless — `exists()` check before opening)

## Data Flow
1. **On editor init**: `$effect` watches `basePath` → calls `loadRecentFiles()` → reads `.ferrite/state.json` → populates `recentFiles` state
2. **On file open**: `openFile()` → `trackRecentFile(absolutePath)` → read-modify-write `.ferrite/state.json` (prepend path, dedup, cap at 20)
3. **On folder change**: `useEditorFolder()` → triggers `loadRecentFiles()` for new basePath

## Links
- [Editor Page](editor-page.md)
- [Authority Index](authority-index.md)
