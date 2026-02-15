# StackBuild - DayLight

## Dev Stack
- **Frontend:** SvelteKit 2.0 + Svelte 5 (runes) + TypeScript 5
- **Backend:** Tauri 2.0 (Rust, custom-protocol feature)
- **Build Tool:** Vite 6 (dev server on port 43181)
- **Package Manager:** Bun
- **CSS:** Tailwind CSS 4.1.18 + Forms + Typography plugins
- **HTTP:** reqwest 0.12 (Rust), tiny_http (OAuth listener)
- **Async:** Tokio runtime

## Target
- **Desktop** (Linux/Wayland — WebKitGTK 4.1)
- **Android** (ARM64 primary, also armv7/i686/x86_64)

## Additional Key Libraries (UI)
- Skeleton UI v4 (@skeletonlabs/skeleton-svelte v4.0.0-next.33, Svelte 5 compatible)
- Tailwind CSS v4 with Forms + Typography plugins
- @iconify/svelte + unplugin-icons (Lucide icon set)
- 30+ generated themes from terminal configs (kitty .conf + YAML .yml) via `generate-skeleton-themes.ts`
- Runtime GTK4 theme detection (dark/light mode)

## Key Features
Privacy-first, cross-platform task manager for Android and Linux. Tasks stored as markdown files with YAML frontmatter, synced via Syncthing.

- Unlike Todoist/TickTick — fully offline, no cloud dependency, tasks are plain markdown files you own
- Unlike Obsidian Tasks — dedicated mobile UI with touch-first design, not a plugin
- GTD-style contexts and shortcode capture
- Smart date grouping: Past/Now/Upcoming/Wrapped
- Recurring tasks with per-instance rescheduling (defer one instance without breaking the series)
- Manual time tracking with 15-min snap clock-drag interface + project/tag reports
- Drag-and-drop weekly time planner (WeeklyTimeGrid, snap-to-grid, collision detection)
- Google Calendar read-only integration + ICS feed support
- Syncthing-ready peer-to-peer sync with conflict resolution
- 30+ color themes generated from terminal theme files

---

## Building Instructions

### Nix develop?
Yes — `flake.nix` with Rust + Bun + Node.js 22 + JDK17 + Android SDK/NDK + GTK/WebKitGTK deps.
```bash
nix develop                    # Enter dev shell (shows toolchain versions)
```

### Dev server?
```bash
bun install
bun run dev                    # Vite dev server at localhost:43181
```

### Tauri dev server?
```bash
bun run tauri:dev              # Full Tauri app with hot reload
```

---

## Android Build
```bash
bun run tauri:android          # Release APK (--target aarch64)
bun run tauri:android:debug    # Debug APK (auto-signed)
```

APK output: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`

### APK Signing (from ANDROID-BUILD.md)

**Create keystore (first time):**
```bash
keytool -genkey -v -keystore debug.keystore -alias androiddebugkey \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass android -keypass android -dname "CN=Debug"
```

**Sign APK:**
```bash
# Find latest build-tools, or use release-apk.sh which does this automatically
BUILD_TOOLS=$(ls ~/.local/share/android-sdk/build-tools/ | sort -V | tail -1)
~/.local/share/android-sdk/build-tools/$BUILD_TOOLS/apksigner sign \
  --ks debug.keystore --ks-pass pass:android \
  --out DayLight.apk \
  src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk
```

**Install:**
```bash
adb install -r daylight-signed.apk
```

- **Last Android build:** Not recorded (signing doc exists, builds confirmed working)

## Desktop Build
```bash
bun run tauri:build            # Release binary
```

- **Release script?** Yes — `release.sh` at repo root
  - Runs `nix build` for reproducible release binary
  - Creates tarball: `daylight-v{VERSION}-{PLATFORM}-{ARCH}.tar.xz`
  - Uploads to GitHub releases via `gh release`
- **Last build:** 2026-02-04 (last commit: "Major Theme Changes")

## Web Build
```bash
bun run build                  # SvelteKit static build → ./build/
```
- Uses @sveltejs/adapter-static (pre-rendered HTML + Vite bundle)
- Theoretically deployable as static site, but Tauri filesystem APIs won't work in browser context
- No separate web deployment configured
- **Last build:** 2026-02-01
