# Rust Desktop ADR

Status: accepted for migration prototype.

## Decision

Use EGui as the first native Rust desktop runtime and `egui-shadcn` as the shadcn-rs component kit.

## Context

The desktop migration needs a fast native loop for a dense task, habit, and calendar interface. The first milestone is not a full rewrite; it is a runnable native shell that can receive the existing DayLight markdown task model and GTK-style theme mapping.

The user selected EGui and shadcn-rs on 2026-04-30.

## Rationale

- EGui keeps the first migration batch small and makes `nix develop -c cargo run` a direct smoke path.
- `egui-shadcn` is available on crates.io as `egui-shadcn = "=0.5.0"` and matches the selected EGui path.
- The crate warns that its API is unstable, so the dependency is pinned exactly.
- The existing Tauri/Svelte app stays in place under `src-tauri` and `src`; the native desktop crate lives at the repository root for the migration path.

## Consequences

- Root `cargo run` launches the native EGui desktop prototype.
- Existing Tauri commands continue to use the existing Bun/Tauri workflow.
- GTK 4 theme parsing, hot reload, markdown task loading, and task mutation will be ported in later taskboard batches.

