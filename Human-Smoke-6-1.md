# Human Smoke — 2026-06-01

Status: PASS (session-confirmed)
Last updated: 2026-06-01
Source: user-confirmed in session (work driven from a ferrinode session)

## Bounds

- Platform: DayLight editor flow (desktop session runtime + mobile-shape check)
- Scope: Phase 20 — extended-table markdown parity with ferrinode
- Focus: extended-table render in preview, content-routed edit surface, raw editor fill, preview toggle
- Excludes: Android storage flow, calendar edge cases, the rest of the standing smoke surface (unchanged this session)

## Conditions (Passed / Signed Off)

- [x] Extended tables render in editor preview (colspan `|||`, rowspan `^|`, multi-row headers, percent widths) via `marked` + `marked-extended-tables`
- [x] A file containing extended-table grammar opens in a raw `<textarea>`, not milkdown WYSIWYG (content-routed, silent — no toggle/warning)
- [x] Normal markdown files still open in milkdown WYSIWYG as before
- [x] Raw textarea fills the screen and grows with content (page scrolls), instead of clipping
- [x] Preview replaces the raw editor (does not render below it)
- [x] `Ctrl/Cmd+E` toggles preview ↔ edit, working for both milkdown and raw-table modes
- [x] Editor treeview / buttons work (regressed mid-session on an undeclared state var; fixed and re-confirmed)

## Implemented But Not Explicitly Device-Measured

- [ ] Raw-editor bottom chrome offset vs the fixed toolbar — reasoned from CSS, not measured on a physical device
- [ ] Old `Ctrl/Cmd+E` toolbar toggle is now orphaned from the keyboard (swipe-up / hint-pill still works)

## Notes

- Dependency is `marked-extended-tables@^2.0.1` from the **npm registry**. An earlier
  `../marked-extended-tables` local-clone path was a reproducibility bug John caught
  ("why are you referencing an inline folder on my computer?") and is fixed.
- `marked` stays `^17`. The extension's declared `>=3 <16` peer range is the author's
  stated test ceiling, not a real boundary — measured PASS on marked 15/16/17 with a
  headless harness. Lesson recorded: don't pin a library to the version it was
  authored against.
- The raw-textarea fill went through two wrong arbitrary-number attempts (`50vh`,
  `dvh`-calc) before the right diagnosis: an element-tree screenshot + headless height
  probe showed the parent chain (`.app-shell` = `min-h-screen`) has no definite height,
  and milkdown only fills because its contenteditable content auto-grows. Fix: an
  `autogrow` action makes the textarea grow to `scrollHeight`, so it behaves like
  milkdown and the page owns the scroll. Not a magic number.
- Cross-app: ferrinode has the same markdown stack but its Text-mode fill correctly
  uses flex (its shell is `height:100dvh`, definite). Same symptom, different correct
  fix — not cross-ported.
- New file: `src/lib/markdown.ts`. Edits: `src/routes/editor/+page.svelte` (autogrow
  action, rawEdit routing, Ctrl+E, raw-editor CSS), `package.json`/lockfile.
- `nix develop -c bun run build` clean.
