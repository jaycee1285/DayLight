# Voice-Input Capture Widget — Taskboard

> Natural language → structured DayLight tasks/habits/notes via on-device LLM.
> Started: 2026-05-13 · Status: Not started (planned)

---

## Model Choice

**tiiuae/Falcon-H1-Tiny-Tool-Calling-90M** (GGUF, via `mradermacher` quants)

| Property | Value |
|---|---|
| Parameters | 91.1M |
| Architecture | falcon-h1 |
| GGUF size (Q4_K_M) | ~0.2 GB |
| Official llama.cpp support | ✅ yes |
| Tool-calling trained | ✅ yes |
| Source | [hf.co/tiiuae/Falcon-H1-Tiny-Tool-Calling-90M](https://huggingface.co/tiiuae/Falcon-H1-Tiny-Tool-Calling-90M) |
| GGUF quants | [mradermacher/Falcon-H1-Tiny-Tool-Calling-90M-GGUF](https://huggingface.co/mradermacher/Falcon-H1-Tiny-Tool-Calling-90M-GGUF) |

**Why this model over Nandi/SmolLM:** GGUF already exists (no conversion needed), smaller (91M vs 150M), officially supports llama.cpp, trained specifically for tool-calling.

**Recommended quant:** Q4_K_M (~0.2 GB). Fast, good quality-to-size ratio. Q8_0 (~0.2 GB) is also viable on devices with spare RAM — "fast, best quality" per mradermacher.

---

## Architecture Overview

```
User taps widget → Floating EditText overlay → Dictate/type raw text
→ Tauri command: parse_voice_input(text)
→ llama.cpp loads Falcon-H1-Tiny → single autoregressive decode → JSON tool call
→ Rust resolves dates/recurrence → writes .md file (or creates task/habit)
→ Confirmation dialog shows preview → User confirms/cancels
→ Store updates → UI re-renders
```

### Three intents

| Intent | Trigger language | Output |
|---|---|---|
| **TASK** | "Buy groceries every Wednesday", "Review PRs by Friday" | `Tasks/Buy groceries.md` with full YAML frontmatter, recurrence, tags |
| **HABIT** | "Track drinking water daily, target 8 glasses" | `Tasks/Drink water.md` with `habit_type`, `habit_goal`, `habit_unit` |
| **NOTE** | "Add a note titled Meeting Notes [spews freely]" | `Tasks/meeting-notes.md` — minimal frontmatter, raw body text |

### What stays unchanged

The existing DayLight store layer (`markdown-store.svelte.ts`, `frontmatter.ts`, `RecurringInstanceService.ts`) needs **no modifications**. The voice widget feeds structured params into the same `addTask()`, `addHabit()`, and `saveTask()` functions that already exist.

---

## Phase 1: In-App Voice Capture Panel

Skip the floating overlay initially. Build the pipeline inside the existing app.

### Tasks

- [ ] **1.1** Research `llama.cpp` Rust bindings for Tauri
  - Options: `llama-cpp-rs` crate, or custom FFI via `build.rs`
  - Verify Android NDK cross-compilation works with current flake
  - *Blocker: none — can prototype on desktop first*

- [ ] **1.2** Download Falcon-H1-Tiny-Tool-Calling-90M Q4_K_M GGUF
  - Store in `src-tauri/src/models/` for dev, download to app data dir for prod
  - Verify it loads and produces output on desktop

- [ ] **1.3** Write prompt template for three-intent tool-calling
  - System prompt defines TASK / HABIT / NOTE intents with JSON schemas
  - Examples for each intent type with current date injection
  - Save to `src-tauri/src/voice_widget/prompt.rs`

- [ ] **1.4** Write `parse_voice_input(text: &str) → serde_json::Value` in Rust
  - Loads model (cached after first call), builds prompt, runs inference
  - Extracts JSON from output (handle malformed outputs gracefully)
  - Returns structured result: `{ intent, title, scheduled, recurrence, tags, project, body }`

- [ ] **1.5** Write `voice_task_resolver.rs` — date/recurrence post-processing
  - Maps fuzzy date strings ("tomorrow", "next Friday") → YYYY-MM-DD
  - Maps natural recurrence ("every Wednesday", "every 2 weeks") → RRULE
  - Validates output: ensures RRULE has BYDAY if FREQ=WEEKLY, etc.
  - *Reuses logic already in `shortcode/parser.ts` — port the date parsing*

- [ ] **1.6** Add Tauri commands to `src-tauri/src/main.rs`:
  - `parse_voice_input(text)` → returns parsed JSON for preview
  - `create_task_from_voice(params)` → calls existing store, writes .md
  - `create_note_from_voice(params)` → writes raw markdown file
  - `create_habit_from_voice(params)` → calls existing store

- [ ] **1.7** Build `VoiceCapturePanel.svelte` — in-app UI
  - Text input field with 🎤 button (integrates with existing ONNX voice app)
  - "Parse & Create" button → calls Tauri command → shows preview
  - Preview dialog with title, scheduled, recurrence, tags, project
  - [✏ Edit] [✅ Create] [❌ Cancel] buttons
  - Uses the `parseShortcodes()` from `$lib/shortcode/parser.ts` as a client-side pass before sending to Rust

- [ ] **1.8** Add a floating action button (FAB) to the main layout
  - Opens VoiceCapturePanel as a bottom sheet
  - Accessible from `/today-bases`, `/calendar`, anywhere

### Done when
- Can dictate "Buy groceries every Wednesday afternoon" → confirms → task appears in tomorrow's view with correct RRULE
- Can dictate "Add a note titled Brain Dump [speaks for 2 min]" → confirms → .md file written to Tasks/
- Can dictate "Track pushups daily, target 50" → confirms → habit file with proper frontmatter

---

## Phase 2: Android Floating Widget Overlay

Global access outside the app. Standard Android foreground service pattern.

### Tasks

- [ ] **2.1** Create `VoiceWidgetPlugin.kt` in `src-tauri/gen/android/app/src/main/java/com/daylight/app/`
  - Foreground service with `TYPE_APPLICATION_OVERLAY`
  - Small floating bubble (chat head style)
  - Tap expands to capture panel (EditText + mic button + Parse button)

- [ ] **2.2** Add Android permissions to `tauri.conf.json`:
  - `SYSTEM_ALERT_WINDOW` (user-granted in Settings)
  - `FOREGROUND_SERVICE`
  - `FOREGROUND_SERVICE_SPECIAL_USE` (Android 14+)

- [ ] **2.3** Implement IME integration for voice input
  - Mic button in overlay triggers Android `SpeechRecognizer` or invokes external ONNX voice app via Intent
  - Transcribed text populates the EditText
  - *Alternative: keep the existing ONNX voice app as the IME — the overlay just accepts committed text*

- [ ] **2.4** Wire overlay → Tauri commands for parsing
  - Floating panel sends text to Rust via Tauri invoke
  - Shows preview as a dialog overlay (same as Phase 1)
  - Confirms → writes .md → notifies user

- [ ] **2.5** Add settings toggle in DayLight Settings to enable/disable the floating widget
  - On by default on Android, off on desktop
  - Option to customize model quant (Q4 vs Q8) for memory-constrained devices

### Done when
- Widget bubble appears on Android home screen
- Tapping it → dictating "Schedule dentist for next Tuesday" → creates task with correct date
- Works even when DayLight app is in background

---

## Phase 3: Polish & Edge Cases

- [ ] **3.1** Handle LLM hallucination / malformed JSON
  - Fallback: if Nandi/Falcon output is invalid JSON, run regex-based parser on the raw text
  - Show error state: "Couldn't parse — try rephrasing" with original text still in the input

- [ ] **3.2** Habit detection refinement
  - "Track water daily, target 8 glasses" → `habit_type: target`, `habit_goal: 8`, `habit_unit: glasses`
  - "Don't snack after 8pm" → `habit_type: limit`
  - "Meditate daily" → `habit_type: check`

- [ ] **3.3** Existing task matching
  - If parsed title matches an existing task, offer to reschedule it instead of creating a duplicate
  - "Buy groceries" already exists → "Reschedule existing task?" prompt

- [ ] **3.4** Multi-task parsing
  - "Add groceries for tomorrow and schedule dentist for Friday" → parse as two intents
  - Show multi-preview, confirm all at once

- [ ] **3.5** Model loading optimization
  - Pre-load model at app startup (warm start)
  - Show "Model loading..." indicator on cold start
  - Lazy-load only when VoiceCapturePanel is first opened

- [ ] **3.6** Offline-first guarantee
  - Model lives in app's private storage
  - No network calls during parsing
  - Widget works in airplane mode

---

## New Files (Planned)

```
src-tauri/src/
├── voice_widget/
│   ├── mod.rs                          # Module root
│   ├── commands.rs                     # Tauri command definitions
│   ├── inference.rs                    # llama.cpp model loading + inference
│   ├── prompt.rs                       # System prompt + example templates
│   ├── resolver.rs                     # Date/recurrence post-processing
│   └── preview.rs                      # Structured preview for confirmation dialog
├── models/
│   └── falcon-h1-tiny-90m-Q4_K_M.gguf  # Model file (gitignored, downloaded at build)
src/lib/
├── components/
│   ├── VoiceCapturePanel.svelte        # In-app capture UI
│   └── VoicePreviewDialog.svelte       # Confirmation dialog
├── services/
│   └── voice-parse.ts                  # Client-side shortcode pass + date resolver
android/app/src/main/java/com/daylight/app/
└── VoiceWidgetPlugin.kt                # Android floating overlay service (Phase 2)
```

## Modified Files

| File | Change |
|---|---|
| `src-tauri/Cargo.toml` | Add `llama-cpp` or `llama-cpp-rs` crate |
| `src-tauri/src/main.rs` | Register voice_widget commands |
| `src-tauri/capabilities/default.json` | Add Android overlay permissions (Phase 2) |
| `src-tauri/tauri.conf.json` | Add Android permissions + asset config |
| `src/lib/components/Navbar.svelte` or `+layout.svelte` | Add FAB trigger for VoiceCapturePanel |
| `src/routes/settings/+page.svelte` | Add toggle for floating widget + model quant selector |
| `.gitignore` | Add `src-tauri/src/models/*.gguf` |

## Dependencies

| Dependency | Purpose |
|---|---|
| `llama.cpp` (via FFI) | GGUF model inference on Android NDK |
| `llama-cpp-rs` or custom bindings | Rust wrapper for llama.cpp |
| `serde`, `serde_json` | JSON parsing/serialization |
| Android `WindowManager` API | Floating overlay (Phase 2) |

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Falcon-H1-Tiny struggles with complex phrasing | Medium | Fallback regex parser; train small LoRA adapter later |
| Model export/inference on Android NDK fails | Medium | Test on desktop first; fall back to ONNX if llama.cpp Android build is problematic |
| 90M params isn't enough for tool-calling accuracy | Low-Medium | Upgrade to Falcon-H1-Tiny-350M or Nandi-150M (still tiny, still fits in RAM) |
| Android kills the floating widget service | Low | Foreground service with persistent notification |
| Model file size (~200MB) adds too much to APK | Low | Download on first run, not bundled in APK |
| GGUF format isn't supported by current llama.cpp version | Low | mradermacher provides official GGUF files; llama.cpp supports falcon-h1 arch |

---

## Notes

- **Model source**: The GGUF files are from `mradermacher`'s static quants. They cover Q2_K through Q8_0 and f16. Q4_K_M is the recommended sweet spot.
- **Why GGUF over ONNX**: GGUF exists out of the box — no conversion pipeline to maintain. llama.cpp has mature Android NDK support and handles the autoregressive decode loop natively.
- **transcrust connection**: The existing ONNX pipeline in `~/repos/transcrust` could theoretically be reused for the LLM, but the autoregressive loop would need to be written from scratch. GGUF + llama.cpp avoids that glue code entirely.
- **Session context**: Voice input was discussed 2026-05-13. User has an existing ONNX-based voice input app used alongside keyboard. The widget's job is capture + LLM parsing, not ASR.
