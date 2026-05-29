# Rust Desktop Migration

Run the native desktop migration prototype:

```bash
nix develop -c cargo run
```

The current prototype is intentionally small. It verifies the selected runtime and component layer:

- EGui native window
- `egui-shadcn` Button, Input, Tabs, and dialog-like window usage
- Desktop layout scaffold for V1 daily tasks

## Scope

V1 includes daily task views, add/edit task dialogs, manual/active time tracking, and a quick popup daemon for compositor shortcuts.

V2 adds habits and calendar views.

Out of scope for this desktop migration:

- Weekly planner drag/drop
- Time-block resizing
- Markdown editor
- Mobile layout parity

The existing Svelte/Tauri app remains available and is not deleted by this migration.

