# Calendar Integration Report (Set Aside)

## Summary
We implemented Google OAuth + calendar fetch, added an ICS-based alternative, and introduced
a feature flag to gate calendar behavior. We paused after persistent CORS errors when
fetching ICS in the Tauri webview; the latest change routes ICS fetches through a Tauri
backend command to bypass CORS, but it requires a rebuilt Tauri binary to take effect.

## What Was Implemented
- **Google OAuth (loopback)**: Opens browser, listens on `127.0.0.1` for the callback, exchanges
  the code for tokens, and stores them in meta.
- **Calendar cache**: `calendar_cache.json` is loaded/saved and rendered in Today + Calendar.
- **Refresh scheduling**: Manual refresh + interval checks.
- **Feature flag**: `VITE_CALENDAR_ENABLED=true` gates calendar init/refresh.
- **ICS support**: Public + secret ICS URLs are parsed and merged into the cache.

## Key Files Touched
- `src/lib/calendar/google.ts` (OAuth helpers + Google events fetch)
- `src/lib/calendar/ics.ts` (ICS parser/fetcher)
- `src/lib/calendar/refresh.ts` (merge Google + ICS, refresh scheduling)
- `src/lib/domain/meta.ts` (calendar + ICS settings stored in meta)
- `src/lib/storage/storage.ts` (meta defaults + calendar cache load/save)
- `src/routes/settings/+page.svelte` (Settings UI for Google + ICS)
- `src/routes/today/+page.svelte`, `src/routes/calendar/+page.svelte` (render cached events)
- `src/routes/+layout.svelte` (calendar bootstrap + refresh on load)
- `src-tauri/src/lib.rs` (loopback OAuth + `fetch_url` command)
- `src-tauri/Cargo.toml` (added `tokio`, `reqwest`, `tiny_http`, `url`)
- `TASKBOARD.md`, `PRD.md` (scope updates)

## Primary Failure Mode
- **CORS in Tauri webview** when fetching ICS from Google:
  - Example error: `Origin http://localhost:1420 is not allowed by Access-Control-Allow-Origin`.
  - This happens if the ICS fetch is executed in the webview instead of via Tauri backend.

## Mitigation Attempted
- Added **Tauri backend fetch** command `fetch_url` (reqwest).
- Updated ICS refresh to **attempt `fetch_url` first** and fall back to `fetch()`.
  - This should bypass CORS *after* Tauri is rebuilt with the new command.

## Why It May Still Fail
- Running binary not rebuilt after adding `fetch_url`.
- Tauri bridge not available (`window.__TAURI__` undefined).
- Feature flag not enabled (`VITE_CALENDAR_ENABLED=true`).

## Next Steps (If Resumed)
1. Rebuild Tauri with new Rust command:
   - `VITE_CALENDAR_ENABLED=true bun run tauri:dev`
2. Verify Tauri bridge is present:
   - In devtools: `window.__TAURI__?.core?.invoke`
3. Retry “Refresh now” with ICS URLs.
4. If still failing, add logging around the ICS fetch path to confirm whether
   `fetch_url` is being used.
