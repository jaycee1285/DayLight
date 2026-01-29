# Linux Release Guide

Quick reference for building SPRedux releases and consuming them on NixOS without recompilation.

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
- `spredux` - standalone binary (~17MB)
- `bundle/deb/SPRedux_0.1.0_amd64.deb`
- `bundle/rpm/SPRedux-0.1.0-1.x86_64.rpm`

## Release Artifacts

For a GitHub release, upload:

```
SPRedux-0.1.0-linux-x86_64.tar.gz   # Recommended for NixOS
SPRedux_0.1.0_amd64.deb             # Debian/Ubuntu
SPRedux-0.1.0-1.x86_64.rpm          # Fedora/RHEL
```

Create the tarball:

```bash
cd src-tauri/target/release
tar -czvf SPRedux-0.1.0-linux-x86_64.tar.gz spredux
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
          pname = "spredux";
          version = "0.1.0";

          src = pkgs.fetchurl {
            url = "https://github.com/YOURUSER/SPRedux/releases/download/v${version}/SPRedux-${version}-linux-x86_64.tar.gz";
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
            cp spredux $out/bin/
            chmod +x $out/bin/spredux
          '';

          postFixup = ''
            wrapProgram $out/bin/spredux \
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
nix-prefetch-url https://github.com/YOURUSER/SPRedux/releases/download/v0.1.0/SPRedux-0.1.0-linux-x86_64.tar.gz
```

This prints the hash to plug into `sha256`.

## Keeping Dev Shell

If you want both (pre-built for users, dev shell for yourself), keep the dev shell section and just replace `packages.default`. The full flake would have both `packages.default` (pre-built) and `devShells.default` (build environment).
