# Adding SPRedux to Your NixOS Config (ELI5)

Your config repo at `/home/john/repos/config` uses a modular setup with:
- **System modules** in `modules/` (NixOS-level)
- **User modules** in `home/` (Home Manager-level)
- **External flakes** imported in `flake.nix` and passed down

Here's how to wire up SPRedux.

---

## Step 1: Add a Package Output to SPRedux

Right now, SPRedux's flake.nix only has a `devShell` (for development). It doesn't export a runnable package. You need to add one.

In `/home/john/repos/SPRedux/flake.nix`, add a `packages` output alongside the existing `devShells`:

```nix
# Inside the 'in' block, after devShells.default = ...

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

  # These need to be set for the build
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

  # Runtime library wrapping
  postFixup = ''
    wrapProgram $out/bin/spredux \
      --prefix LD_LIBRARY_PATH : "${pkgs.lib.makeLibraryPath runtimeLibs}"
  '';
};
```

**Why?** NixOS/Home Manager can only install *packages*. A devShell is just an environment for you to work in—it doesn't produce anything installable.

---

## Step 2: Add SPRedux as a Flake Input

In `/home/john/repos/config/flake.nix`, add SPRedux to your inputs:

```nix
inputs = {
  # ... your existing inputs ...

  spredux = {
    url = "path:/home/john/repos/SPRedux";
    # Or if you push to GitHub later:
    # url = "github:yourname/SPRedux";
  };
};
```

---

## Step 3: Pass It Through to Home Manager

In your `flake.nix` outputs, you already pass things via `extraSpecialArgs`. Add `spredux`:

```nix
# Find where you define home-manager.users.john
# It's probably in your nixosConfigurations, looks like:

home-manager = {
  extraSpecialArgs = {
    inherit gtk-themes ob-themes walls zen-browser claude-desktop;
    # Add this:
    inherit spredux;
  };
  users.john = import ./home/home.nix;
};
```

**What's happening?** `extraSpecialArgs` is how you pass custom stuff into Home Manager modules. Without this, your home modules can't "see" the spredux flake.

---

## Step 4: Create a Home Manager Module

Create `/home/john/repos/config/home/spredux.nix`:

```nix
{ pkgs, spredux, ... }:

{
  home.packages = [
    spredux.packages.${pkgs.system}.default
  ];
}
```

That's it. This says "install the default package from the spredux flake."

---

## Step 5: Import the Module

In `/home/john/repos/config/home/home.nix`, add the import:

```nix
imports = [
  # ... your existing imports ...
  ./spredux.nix
];
```

---

## Step 6: Rebuild

```bash
cd ~/repos/config
sudo nixos-rebuild switch --flake .
```

---

## The Flow (Visual)

```
SPRedux/flake.nix
    │
    └──▶ packages.default (the built Tauri app)
              │
              ▼
config/flake.nix
    │
    ├── inputs.spredux = "path:../SPRedux"
    │
    └── extraSpecialArgs = { spredux = ...; }
              │
              ▼
config/home/home.nix
    │
    └── imports = [ ./spredux.nix ]
              │
              ▼
config/home/spredux.nix
    │
    └── home.packages = [ spredux.packages.x86_64-linux.default ]
              │
              ▼
        ~/.nix-profile/bin/spredux  ✓
```

---

## Quick Reference: Your Existing Patterns

Looking at your config, you already do this exact thing for:

| Flake | Where consumed | Pattern |
|-------|----------------|---------|
| `zen-browser` | `modules/zen-browser.nix` | System-level package |
| `claude-desktop` | `modules/claude-desktop.nix` | System-level package |
| `walls` | `home/walls.nix` | Home Manager file copy |
| `gtk-themes` | `home/gtk-themes.nix` | Home Manager packages |

SPRedux follows the `gtk-themes` pattern: user-level package via Home Manager.

---

## Troubleshooting

**"attribute 'spredux' missing"**
You forgot Step 3 (extraSpecialArgs). The module can't see it.

**"packages.x86_64-linux.default is undefined"**
Step 1 isn't done—SPRedux doesn't export a package yet.

**Build fails with missing deps**
The package derivation in Step 1 might need tweaking. Tauri builds are finicky in Nix. You may need to add a `preBuild` phase to set up the cargo cache, or use `buildRustPackage` instead of `stdenv.mkDerivation`.

---

## Alternative: Quick & Dirty (Skip Package Output)

If you just want to run SPRedux from the dev shell without packaging it properly:

```nix
# In home/spredux.nix
{ pkgs, ... }:

{
  home.file.".local/bin/spredux-dev" = {
    executable = true;
    text = ''
      #!/usr/bin/env bash
      cd /home/john/repos/SPRedux
      nix develop --command bun run tauri:dev
    '';
  };
}
```

This creates a script that drops into the dev shell and runs the app. Not a real install, but works for a personal-use app you're actively developing.
