# Linux Release Guide

Quick reference for building DayLight releases and consuming them on NixOS without recompilation.

## Building a Release

```bash
# Enter dev shell
nix develop

# Install deps if needed
bun install

# Build release (produces binary + bundles)
bun run tauri:build
```

Outputs land in `src-tauri/target/release/`:
- `daylight` - standalone binary (~17MB)
- `bundle/deb/DayLight_0.1.0_amd64.deb`
- `bundle/rpm/DayLight-0.1.0-1.x86_64.rpm`

## Release Artifacts

For a GitHub release, upload:

```
DayLight-0.1.0-linux-x86_64.tar.gz   # Recommended for NixOS
DayLight_0.1.0_amd64.deb             # Debian/Ubuntu
DayLight-0.1.0-1.x86_64.rpm          # Fedora/RHEL
```

Create the tarball:

```bash
cd src-tauri/target/release
tar -czvf DayLight-0.1.0-linux-x86_64.tar.gz daylight
```

## NixOS Flake (Pre-built Binary)

Replace the `packages.default` in `flake.nix` with this to skip compilation:

```nix
{
  description = "Wayland-Ready Tasks + Calendar + Manual Time Logging App";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        # Runtime dependencies for the pre-built binary
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

      in
      {
        packages.default = pkgs.stdenv.mkDerivation rec {
          pname = "daylight";
          version = "0.1.0";

          src = pkgs.fetchurl {
            url = "https://github.com/YOURUSER/DayLight/releases/download/v${version}/DayLight-${version}-linux-x86_64.tar.gz";
            sha256 = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
          };

          nativeBuildInputs = with pkgs; [
            autoPatchelfHook
            wrapGAppsHook3
          ];

          buildInputs = runtimeLibs;

          sourceRoot = ".";

          installPhase = ''
            mkdir -p $out/bin
            cp daylight $out/bin/
            chmod +x $out/bin/daylight
          '';

          postFixup = ''
            wrapProgram $out/bin/daylight \
              --prefix LD_LIBRARY_PATH : "${pkgs.lib.makeLibraryPath runtimeLibs}" \
              --set GIO_MODULE_DIR "${pkgs.glib-networking}/lib/gio/modules"
          '';

          meta = with pkgs.lib; {
            description = "Tasks + Calendar + Manual Time Logging";
            platforms = [ "x86_64-linux" ];
          };
        };
      }
    );
}
```

## Getting the Hash

After uploading your release:

```bash
nix-prefetch-url https://github.com/YOURUSER/DayLight/releases/download/v0.1.0/DayLight-0.1.0-linux-x86_64.tar.gz
```

This prints the hash to plug into `sha256`.

## Keeping Dev Shell

If you want both (pre-built for users, dev shell for yourself), keep the dev shell section and just replace `packages.default`. The full flake would have both `packages.default` (pre-built) and `devShells.default` (build environment).
