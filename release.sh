#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
TAURI_CONF="$REPO_ROOT/src-tauri/tauri.conf.json"

VERSION=$(grep -oP '"version"\s*:\s*"\K[^"]+' "$TAURI_CONF" | head -1)
TAG="v${VERSION}"
APP_NAME="daylight"
ARCH="$(uname -m)"
PLATFORM="$(uname -s | tr '[:upper:]' '[:lower:]')"
TARBALL="${APP_NAME}-${TAG}-${PLATFORM}-${ARCH}.tar.xz"
REPO="jaycee1285/DayLight"
ASSET_URL="https://github.com/${REPO}/releases/download/${TAG}/${TARBALL}"

echo "==> Building ${APP_NAME} ${TAG} (${PLATFORM}/${ARCH})"

cd "$REPO_ROOT"
nix build

NIX_RESULT="$REPO_ROOT/result"
if [[ ! -d "$NIX_RESULT/bin" ]]; then
  echo "ERROR: nix build output not found at ${NIX_RESULT}/bin"
  exit 1
fi

STAGING=$(mktemp -d)
trap "chmod -R u+w $STAGING && rm -rf $STAGING" EXIT

# Copy the raw binary, stripping Nix wrapper scripts
mkdir -p "$STAGING/bin"
if [[ -f "$NIX_RESULT/bin/.${APP_NAME}-wrapped" ]]; then
  cp "$NIX_RESULT/bin/.${APP_NAME}-wrapped" "$STAGING/bin/${APP_NAME}"
elif [[ -f "$NIX_RESULT/bin/.${APP_NAME}-wrapped_" ]]; then
  cp "$NIX_RESULT/bin/.${APP_NAME}-wrapped_" "$STAGING/bin/${APP_NAME}"
else
  cp "$NIX_RESULT/bin/${APP_NAME}" "$STAGING/bin/${APP_NAME}"
fi
chmod u+wx "$STAGING/bin/${APP_NAME}"

# Strip Nix store paths for cross-machine portability.
# Building via `nix build` bakes this machine's /nix/store paths into the
# binary's RPATH and ELF interpreter. Those are unique per machine.
# autoPatchelfHook on the receiving machine will set correct paths at install.
echo "==> Stripping Nix store paths for cross-machine portability"
patchelf --remove-rpath "$STAGING/bin/${APP_NAME}"
patchelf --set-interpreter /lib64/ld-linux-x86-64.so.2 "$STAGING/bin/${APP_NAME}"

cp -r "$NIX_RESULT/lib" "$STAGING/"

echo "==> Creating ${TARBALL}"
tar -cJf "$REPO_ROOT/$TARBALL" -C "$STAGING" bin lib

if [[ "${SKIP_UPLOAD:-0}" == "1" ]]; then
  echo "==> SKIP_UPLOAD=1, leaving tarball at ${REPO_ROOT}/${TARBALL}"
else
  echo "==> Uploading to GitHub release ${TAG}"
  if gh release view "$TAG" --repo "$REPO" &>/dev/null; then
    gh release upload "$TAG" "$REPO_ROOT/$TARBALL" --repo "$REPO" --clobber
  else
    gh release create "$TAG" "$REPO_ROOT/$TARBALL" \
      --repo "$REPO" \
      --title "${APP_NAME} ${TAG}" \
      --notes "${APP_NAME} ${TAG}" \
      --latest
  fi
fi

echo "==> Release asset: ${ASSET_URL}"
echo "==> SHA-256 for Nix flake input:"
if [[ "${SKIP_UPLOAD:-0}" == "1" ]]; then
  nix hash file --type sha256 "$REPO_ROOT/$TARBALL"
else
  PREFETCH_JSON=$(nix store prefetch-file --json --hash-type sha256 "$ASSET_URL")
  echo "$PREFETCH_JSON" | grep -oP '"hash"\s*:\s*"\K[^"]+'
  PREFETCH_PATH=$(echo "$PREFETCH_JSON" | grep -oP '"storePath"\s*:\s*"\K[^"]+')
  if [[ -n "$PREFETCH_PATH" ]]; then
    nix store delete "$PREFETCH_PATH" 2>/dev/null || true
  fi
fi

echo "==> Done! https://github.com/${REPO}/releases/tag/${TAG}"
