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

# Install the `playdown` CLI command into a PATH directory.
for dir in /opt/homebrew/bin /usr/local/bin "$HOME/.local/bin"; do
  mkdir -p "$dir" 2>/dev/null || true
  if [ -d "$dir" ] && [ -w "$dir" ]; then
    cat > "$dir/playdown" <<'WRAP'
#!/bin/sh
BIN="/Applications/Playdown.app/Contents/MacOS/playdown"
case "$1" in
  --version|-v|--help|-h) exec "$BIN" "$1" ;;
esac
target="${1:-.}"
abs=$(cd "$target" 2>/dev/null && pwd) || abs="$target"
open -a Playdown --args "$abs"
WRAP
    chmod +x "$dir/playdown"
    echo "==> Installed 'playdown' command → $dir/playdown"
    break
  fi
done

echo "==> Done. Launching $APP."
open "/Applications/$APP.app"
