# SPRedux Nix Build Guide

## Hardware Expectations

On an 11th-gen i5 with 16GB RAM:
- **Dev shell entry**: ~5-10 seconds (deps from binary cache)
- **`bun install`**: ~10-20 seconds
- **`bun run tauri:dev`**: ~60-90 seconds first run (Rust compile), ~5s subsequent
- **`bun run tauri:build`** (release): ~2-5 minutes (optimized Rust compile)

Almost all Nix dependencies come from the binary cache. The only local compilation is your Rust code.

---

## Option 1: Standalone Repo Flake (Recommended)

This is the flake to put at the repo root. Uses **nixos-24.11 stable** for maximum binary cache hits.

### `flake.nix`

```nix
{
  description = "SPRedux - Tasks + Calendar + Time Logging";

  inputs = {
    # Pin to stable for binary cache hits
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";

    # Minimal: just flake-utils, no heavy overlays
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-linux" ] (system:
      let
        pkgs = import nixpkgs { inherit system; };

        # Use packaged Rust from nixpkgs (no overlay = faster cache hits)
        # nixos-24.11 has Rust 1.82.x which is fine for Tauri 2
        rustToolchain = pkgs.rust-bin or pkgs.rustc;

        # Tauri 2 native dependencies
        tauriNativeDeps = with pkgs; [
          pkg-config
          gobject-introspection
          wrapGAppsHook3
        ];

        tauriBuildDeps = with pkgs; [
          # Core
          openssl
          openssl.dev

          # WebKit/GTK stack
          webkitgtk_4_1
          gtk3
          glib
          glib-networking
          libsoup_3
          cairo
          pango
          gdk-pixbuf
          atk
          harfbuzz
          librsvg

          # System
          dbus

          # Wayland
          wayland
          wayland-protocols
          libxkbcommon

          # X11 fallback
          xorg.libX11
          xorg.libXcursor
          xorg.libXrandr
          xorg.libXi
          xorg.libxcb
        ];

        runtimeLibs = with pkgs; [
          webkitgtk_4_1
          gtk3
          glib
          glib-networking
          libsoup_3
          cairo
          pango
          gdk-pixbuf
          openssl
          dbus
          wayland
          libxkbcommon
          xorg.libX11
          xorg.libXcursor
          xorg.libXrandr
          xorg.libXi
        ];

      in {
        devShells.default = pkgs.mkShell {
          nativeBuildInputs = tauriNativeDeps;
          buildInputs = tauriBuildDeps;

          packages = with pkgs; [
            # JS runtime
            nodejs_22
            bun

            # Rust (from nixpkgs, no overlay)
            cargo
            rustc
            rust-analyzer
            clippy
            rustfmt

            # Tauri CLI
            cargo-tauri
          ];

          # OpenSSL paths
          OPENSSL_DIR = "${pkgs.openssl.dev}";
          OPENSSL_LIB_DIR = "${pkgs.openssl.out}/lib";
          OPENSSL_INCLUDE_DIR = "${pkgs.openssl.dev}/include";

          # pkg-config search path
          PKG_CONFIG_PATH = pkgs.lib.makeSearchPath "lib/pkgconfig" [
            pkgs.openssl.dev
            pkgs.glib.dev
            pkgs.gtk3.dev
            pkgs.webkitgtk_4_1.dev
            pkgs.libsoup_3.dev
            pkgs.cairo.dev
            pkgs.pango.dev
            pkgs.gdk-pixbuf.dev
            pkgs.atk.dev
            pkgs.harfbuzz.dev
            pkgs.dbus.dev
            pkgs.wayland.dev
            pkgs.libxkbcommon.dev
          ];

          shellHook = ''
            export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath runtimeLibs}:$LD_LIBRARY_PATH"
            export GIO_MODULE_DIR="${pkgs.glib-networking}/lib/gio/modules"
            export WEBKIT_DISABLE_COMPOSITING_MODE=1
            export XDG_DATA_DIRS="${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:$XDG_DATA_DIRS"

            echo "SPRedux dev ready | Node $(node -v) | Rust $(rustc -V | cut -d' ' -f2)"
          '';
        };

        # Package for nix build
        packages.default = pkgs.stdenv.mkDerivation {
          pname = "spredux";
          version = "0.1.0";
          src = ./.;

          nativeBuildInputs = tauriNativeDeps ++ (with pkgs; [
            nodejs_22
            bun
            cargo
            rustc
            cargo-tauri
          ]);

          buildInputs = tauriBuildDeps;

          # Same env vars as devShell
          OPENSSL_DIR = "${pkgs.openssl.dev}";
          OPENSSL_LIB_DIR = "${pkgs.openssl.out}/lib";
          OPENSSL_INCLUDE_DIR = "${pkgs.openssl.dev}/include";

          buildPhase = ''
            export HOME=$(mktemp -d)
            bun install --frozen-lockfile
            bun run build
            cargo tauri build --bundles deb
          '';

          installPhase = ''
            mkdir -p $out/bin
            cp src-tauri/target/release/spredux $out/bin/

            # Desktop file
            mkdir -p $out/share/applications
            cat > $out/share/applications/spredux.desktop << EOF
            [Desktop Entry]
            Name=SPRedux
            Exec=$out/bin/spredux
            Type=Application
            Categories=Office;ProjectManagement;
            EOF
          '';
        };
      }
    );
}
```

### `flake.lock` Pinning

After first `nix develop`, your `flake.lock` pins exact commits. To update later:

```bash
# Update all inputs
nix flake update

# Update only nixpkgs
nix flake lock --update-input nixpkgs
```

---

## Option 2: Home Manager Module

Add SPRedux to your existing NixOS/Home Manager config.

### In your flake inputs:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    home-manager.url = "github:nix-community/home-manager/release-24.11";

    spredux = {
      url = "github:YOUR_USER/spredux";
      inputs.nixpkgs.follows = "nixpkgs";  # Share nixpkgs
    };
  };
}
```

### Home Manager module:

```nix
# In your home.nix or a separate module
{ pkgs, inputs, ... }:

{
  home.packages = [
    inputs.spredux.packages.${pkgs.system}.default
  ];

  # Optional: add to app menu
  xdg.desktopEntries.spredux = {
    name = "SPRedux";
    exec = "${inputs.spredux.packages.${pkgs.system}.default}/bin/spredux";
    categories = [ "Office" "ProjectManagement" ];
    comment = "Tasks, Calendar, and Time Logging";
  };
}
```

---

## Build Steps

### Android (aarch64 only)

Your phone is aarch64. No need to build for armv7, x86_64-android, or i686-android.

```bash
# Enter dev environment
nix develop

# One-time setup
bun install
bun run tauri android init

# Debug build (faster, for testing)
bun run tauri:android:debug

# Release build (signed APK)
bun run tauri:android
```

These commands already target only `aarch64` via `package.json`:
```json
"tauri:android": "tauri android build --target aarch64",
"tauri:android:debug": "tauri android dev --target aarch64"
```

**Strip unnecessary targets from your Rust config** - edit your flake to only include what you need:

```nix
# Instead of 4 Android targets, just use:
targets = [
  "x86_64-unknown-linux-gnu"    # Your dev machine
  "aarch64-linux-android"        # Your phone
];
```

---

### Linux x86_64

```bash
# Enter dev environment
nix develop

# Install JS deps (one time)
bun install

# Development
bun run tauri:dev

# Release build
bun run tauri:build

# Output at: src-tauri/target/release/spredux
# Deb at: src-tauri/target/release/bundle/deb/
```

### Linux aarch64 (ARM64)

Same commands work on native aarch64 hardware (e.g., Raspberry Pi 5, Ampere, Apple Silicon VM).

```bash
nix develop
bun install
bun run tauri:build
```

### Cross-compile x86_64 → aarch64

Cross-compiling Tauri is tricky due to WebKitGTK. Recommended approaches:

**Option A: Build on native aarch64**
```bash
# On your aarch64 machine or VM
git clone https://github.com/YOUR_USER/spredux
cd spredux
nix develop
bun install
bun run tauri:build
```

**Option B: Use a CI runner (GitHub Actions)**
```yaml
# .github/workflows/build.yml
jobs:
  build-arm64:
    runs-on: ubuntu-24.04-arm64  # GitHub's ARM runners
    steps:
      - uses: actions/checkout@v4
      - uses: DeterminateSystems/nix-installer-action@main
      - uses: DeterminateSystems/magic-nix-cache-action@main
      - run: nix develop --command bash -c "bun install && bun run tauri:build"
```

---

## Speed Tips

### 1. Use direnv (auto-enters shell)

```bash
# .envrc
use flake
```

Then `direnv allow`. Shell loads automatically when you `cd` into the repo.

### 2. Cargo build cache

The flake preserves `~/.cargo` and `target/` between builds. First build is slow, subsequent builds are fast.

### 3. Parallel Rust compilation

Add to `src-tauri/Cargo.toml`:

```toml
[profile.dev]
# Faster dev builds
opt-level = 0
debug = true

[profile.release]
# Use all cores
codegen-units = 1  # Better optimization but slower
lto = "thin"       # Faster than "fat" LTO
```

Or for faster release builds (slightly larger binary):

```toml
[profile.release]
codegen-units = 16  # Parallel codegen
lto = false         # Skip LTO
```

### 4. Check what's compiling

```bash
# See if deps come from cache
nix develop --print-build-logs

# During cargo build, watch what's compiling
cargo build 2>&1 | grep Compiling
```

---

## Troubleshooting

### "WebKitGTK not found"

Ensure `PKG_CONFIG_PATH` is set. Re-enter shell:
```bash
exit
nix develop
```

### "GLIBC version" errors

You're mixing nixpkgs versions. Ensure all flake inputs use the same nixpkgs:
```nix
inputs.spredux.inputs.nixpkgs.follows = "nixpkgs";
```

### Slow first build

Normal. Rust compiles all dependencies once, then caches them. Check `target/` isn't being deleted.

### Out of memory during build

Add swap or limit parallel jobs:
```bash
cargo build -j 2  # Limit to 2 parallel jobs
```
