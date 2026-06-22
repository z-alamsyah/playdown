#!/usr/bin/env bash
#
# Playdown installer — macOS & Linux (incl. WSL).
#   curl -fsSL https://raw.githubusercontent.com/z-alamsyah/playdown/main/install.sh | bash
#
set -euo pipefail

REPO="z-alamsyah/playdown"
APP="Playdown"
OS="$(uname -s)"

# Print the first asset URL from the latest release matching a regex.
asset_url() {
  curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep -o "https://[^\"]*$1" | grep -m1 .
}

# ---------------------------------------------------------------- macOS ------
if [ "$OS" = "Darwin" ]; then
  echo "==> Installing Playdown (macOS)…"
  # Apple Silicon → aarch64, Intel → x64.
  case "$(uname -m)" in arm64) ARCH='aarch64' ;; *) ARCH='x64' ;; esac
  DMG_URL=$(asset_url "_${ARCH}\.dmg") \
    || DMG_URL=$(asset_url '\.dmg') \
    || { echo "No .dmg in the latest release."; exit 1; }
  TMP="$(mktemp -d)"
  trap 'hdiutil detach "$TMP/mnt" >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
  MNT="$TMP/mnt"
  echo "==> Downloading: $DMG_URL"
  curl -fSL --progress-bar "$DMG_URL" -o "$TMP/playdown.dmg"
  hdiutil attach "$TMP/playdown.dmg" -nobrowse -quiet -mountpoint "$MNT"
  rm -rf "/Applications/$APP.app"
  cp -R "$MNT/$APP.app" "/Applications/"
  hdiutil detach "$MNT" -quiet
  xattr -dr com.apple.quarantine "/Applications/$APP.app" 2>/dev/null || true
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

# ---------------------------------------------------------------- Linux ------
elif [ "$OS" = "Linux" ]; then
  echo "==> Installing Playdown (Linux)…"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT

  if command -v apt-get >/dev/null 2>&1 || command -v dpkg >/dev/null 2>&1; then
    URL=$(asset_url '_amd64\.deb') || { echo "No .deb in the latest release."; exit 1; }
    echo "==> Downloading: $URL"
    curl -fSL --progress-bar "$URL" -o "$TMP/playdown.deb"
    echo "==> Installing (needs sudo)…"
    sudo apt-get update -qq || true
    sudo apt-get install -y "$TMP/playdown.deb" || {
      sudo dpkg -i "$TMP/playdown.deb" || true
      sudo apt-get install -f -y
    }
  elif command -v dnf >/dev/null 2>&1; then
    URL=$(asset_url '\.x86_64\.rpm') || { echo "No .rpm in the latest release."; exit 1; }
    echo "==> Downloading: $URL"
    curl -fSL --progress-bar "$URL" -o "$TMP/playdown.rpm"
    sudo dnf install -y "$TMP/playdown.rpm"
  elif command -v rpm >/dev/null 2>&1; then
    URL=$(asset_url '\.x86_64\.rpm') || { echo "No .rpm in the latest release."; exit 1; }
    curl -fSL --progress-bar "$URL" -o "$TMP/playdown.rpm"
    sudo rpm -i "$TMP/playdown.rpm"
  else
    # Portable AppImage fallback — also serves as the `playdown` command.
    URL=$(asset_url '_amd64\.AppImage') || { echo "No .AppImage in the latest release."; exit 1; }
    mkdir -p "$HOME/.local/bin"
    DEST="$HOME/.local/bin/playdown"
    echo "==> Downloading: $URL"
    curl -fSL --progress-bar "$URL" -o "$DEST"
    chmod +x "$DEST"
    echo "==> Installed AppImage → $DEST"
    case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) echo "   (add ~/.local/bin to your PATH)";; esac
    echo "   If it won't launch (no FUSE, e.g. WSL): playdown --appimage-extract-and-run ."
  fi

  echo "==> Done. Run:  playdown ."
  if grep -qi microsoft /proc/version 2>/dev/null; then
    echo
    echo "WSL detected — GUI needs WSLg (Windows 11 / recent Win10) + a WSL2 distro."
    echo "If the window doesn't appear, ensure WSLg is enabled (wsl --update)."
  fi

# -------------------------------------------------------------- other --------
else
  echo "Unsupported OS: $OS."
  echo "Windows: download the .msi/.exe from https://github.com/$REPO/releases/latest"
  exit 1
fi
