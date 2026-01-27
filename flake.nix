{
  description = "Wayland-Ready Tasks + Calendar + Manual Time Logging App";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };

        # Android SDK setup (uses writable SDK at ~/.local/share/android-sdk)
        androidSdkPath = "$HOME/.local/share/android-sdk";
        ndkVersion = "25.1.8937393";

        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" "rust-analyzer" ];
          targets = [
            "x86_64-unknown-linux-gnu"    # Dev machine (Linux desktop)
            "aarch64-linux-android"        # Android ARM 64-bit
            "armv7-linux-androideabi"      # Android ARM 32-bit
            "i686-linux-android"           # Android x86 32-bit
            "x86_64-linux-android"         # Android x86 64-bit
          ];
        };

        # Tauri 2 dependencies for Linux/Wayland
        tauriDeps = with pkgs; [
          # Build dependencies
          pkg-config
          openssl
          openssl.dev

          # WebKit and GTK
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

          # D-Bus (required by Tauri)
          dbus

          # Wayland support
          wayland
          wayland-protocols
          libxkbcommon

          # X11 fallback (for XWayland compatibility)
          xorg.libX11
          xorg.libXcursor
          xorg.libXrandr
          xorg.libXi
          xorg.libxcb
        ];

        # Libraries needed at runtime
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

        buildInputs = tauriDeps;

        nativeBuildInputs = with pkgs; [
          pkg-config
          gobject-introspection
          wrapGAppsHook3
        ];

      in
      {
        packages.default = pkgs.stdenv.mkDerivation {
          pname = "spredux";
          version = "0.1.0";

          src = ./.;

          nativeBuildInputs = with pkgs; [
            bun
            nodejs_22
            rustToolchain
            cargo-tauri
            pkg-config
            gobject-introspection
            wrapGAppsHook3
          ];

          buildInputs = tauriDeps;

          OPENSSL_DIR = "${pkgs.openssl.dev}";
          OPENSSL_LIB_DIR = "${pkgs.openssl.out}/lib";
          OPENSSL_INCLUDE_DIR = "${pkgs.openssl.dev}/include";

          buildPhase = ''
            export HOME=$(mktemp -d)
            bun install --frozen-lockfile
            bun run tauri build
          '';

          installPhase = ''
            mkdir -p $out/bin
            cp src-tauri/target/release/spredux $out/bin/
          '';

          postFixup = ''
            wrapProgram $out/bin/spredux \
              --prefix LD_LIBRARY_PATH : "${pkgs.lib.makeLibraryPath runtimeLibs}"
          '';
        };

        devShells.default = pkgs.mkShell {
          inherit buildInputs nativeBuildInputs;

          packages = with pkgs; [
            # Node.js runtime
            nodejs_22

            # Bun package manager
            bun

            # Rust toolchain (complete, with Android targets)
            rustToolchain
            cargo-watch
            cargo-tauri

            # Java (for Android builds)
            jdk17

            # Development utilities
            just
          ];

          # Environment variables for building and running Tauri
          OPENSSL_DIR = "${pkgs.openssl.dev}";
          OPENSSL_LIB_DIR = "${pkgs.openssl.out}/lib";
          OPENSSL_INCLUDE_DIR = "${pkgs.openssl.dev}/include";

          # pkg-config path for native dependencies
          PKG_CONFIG_PATH = pkgs.lib.makeSearchPath "lib/pkgconfig" [
            pkgs.glib.dev
            pkgs.gtk3.dev
            pkgs.webkitgtk_4_1.dev
            pkgs.libsoup_3.dev
            pkgs.cairo.dev
            pkgs.pango.dev
            pkgs.gdk-pixbuf.dev
            pkgs.atk.dev
            pkgs.harfbuzz.dev
            pkgs.openssl.dev
            pkgs.dbus.dev
            pkgs.wayland.dev
            pkgs.libxkbcommon.dev
          ];

          shellHook = ''
            # Library path for runtime
            export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath runtimeLibs}:$LD_LIBRARY_PATH"

            # GIO modules for HTTPS support
            export GIO_MODULE_DIR="${pkgs.glib-networking}/lib/gio/modules"

            # WebKit settings
            export WEBKIT_DISABLE_COMPOSITING_MODE=1

            # XDG for proper Wayland detection
            export XDG_DATA_DIRS="${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:$XDG_DATA_DIRS"

            # Ensure cargo/rustup paths are available
            export PATH="$HOME/.cargo/bin:$PATH"

            # Java for Android builds
            export JAVA_HOME="${pkgs.jdk17}"

            # Android SDK setup (uses writable SDK from flutter setup)
            if [ -d "${androidSdkPath}" ]; then
              export ANDROID_HOME="${androidSdkPath}"
              export ANDROID_SDK_ROOT="${androidSdkPath}"
              export NDK_HOME="${androidSdkPath}/ndk/${ndkVersion}"
              export PATH="${androidSdkPath}/platform-tools:${androidSdkPath}/cmdline-tools/latest/bin:$PATH"
              # NDK toolchain needs its own libc++ for the host clang
              export LD_LIBRARY_PATH="${androidSdkPath}/ndk/${ndkVersion}/toolchains/llvm/prebuilt/linux-x86_64/lib64:$LD_LIBRARY_PATH"
              ANDROID_STATUS="found at ${androidSdkPath}"
            else
              ANDROID_STATUS="not found (run 'flutter doctor' to set up)"
            fi

            echo "══════════════════════════════════════════════"
            echo "  SPRedux dev environment ready"
            echo "══════════════════════════════════════════════"
            echo "  Node:  $(node --version)"
            echo "  Bun:   $(bun --version)"
            echo "  Rust:  $(rustc --version)"
            echo "  Cargo: $(cargo --version)"
            echo "  Android SDK: $ANDROID_STATUS"
            echo ""
            echo "  Commands:"
            echo "    bun install            - Install JS dependencies"
            echo "    bun run tauri:dev      - Run Tauri in dev mode"
            echo "    bun run tauri:build    - Build release binary"
            echo "    bun run tauri android init  - Init Android project"
            echo "    bun run tauri android dev   - Run on Android device"
            echo "    bun run tauri android build - Build Android APK"
            echo "══════════════════════════════════════════════"
          '';
        };
      }
    );
}
