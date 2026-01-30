#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
TAURI_CONF="$REPO_ROOT/src-tauri/tauri.conf.json"

VERSION=$(grep -oP '"version"\s*:\s*"\K[^"]+' "$TAURI_CONF" | head -1)
TAG="v${VERSION}"
APP_NAME="spredux"
ARCH="$(uname -m)"
PLATFORM="$(uname -s | tr '[:upper:]' '[:lower:]')"
TARBALL="${APP_NAME}-${TAG}-${PLATFORM}-${ARCH}.tar.xz"

echo "==> Building ${APP_NAME} ${TAG} (${PLATFORM}/${ARCH})"

cd "$REPO_ROOT"
bun install
bun run tauri:build

BINARY="$REPO_ROOT/src-tauri/target/release/${APP_NAME}"
if [[ ! -f "$BINARY" ]]; then
  echo "ERROR: Binary not found at ${BINARY}"
  exit 1
fi

STAGING=$(mktemp -d)
trap "rm -rf $STAGING" EXIT

cp "$BINARY" "$STAGING/"

echo "==> Creating ${TARBALL}"
tar -cJf "$REPO_ROOT/$TARBALL" -C "$STAGING" "${APP_NAME}"

echo "==> Uploading to GitHub release ${TAG}"
if gh release view "$TAG" --repo jaycee1285/SPRedux &>/dev/null; then
  gh release upload "$TAG" "$REPO_ROOT/$TARBALL" --repo jaycee1285/SPRedux --clobber
else
  gh release create "$TAG" "$REPO_ROOT/$TARBALL" \
    --repo jaycee1285/SPRedux \
    --title "${APP_NAME} ${TAG}" \
    --notes "${APP_NAME} ${TAG}" \
    --latest
fi

echo "==> Done! https://github.com/jaycee1285/SPRedux/releases/tag/${TAG}"
