#!/usr/bin/env bash
#
# Playdown installer (macOS).
#   curl -fsSL https://raw.githubusercontent.com/z-alamsyah/playdown/main/install.sh | bash
#
set -euo pipefail

REPO="z-alamsyah/playdown"
APP="Playdown"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This installer currently supports macOS only."
  echo "For Windows/Linux, grab a build from: https://github.com/$REPO/releases"
  exit 1
fi

echo "==> Finding the latest Playdown release…"
DMG_URL=$(
  curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep -o 'https://[^"]*\.dmg' \
    | grep -m1 .
) || { echo "No .dmg asset found in the latest release."; exit 1; }

TMP="$(mktemp -d)"
trap 'hdiutil detach "$TMP/mnt" >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
MNT="$TMP/mnt"

echo "==> Downloading: $DMG_URL"
curl -fSL --progress-bar "$DMG_URL" -o "$TMP/playdown.dmg"

echo "==> Mounting…"
hdiutil attach "$TMP/playdown.dmg" -nobrowse -quiet -mountpoint "$MNT"

echo "==> Installing to /Applications…"
rm -rf "/Applications/$APP.app"
cp -R "$MNT/$APP.app" "/Applications/"
hdiutil detach "$MNT" -quiet

# App is unsigned — clear the quarantine flag so it opens without a prompt.
xattr -dr com.apple.quarantine "/Applications/$APP.app" 2>/dev/null || true

echo "==> Done. Launching $APP."
open "/Applications/$APP.app"
