#!/usr/bin/env bash
#
# Updates Greenlight on the Steam Deck (or any Linux with Flatpak) to the latest build from
# https://github.com/Veter1904/greenlight/releases
#
# It replaces the installed io.github.unknownskl.greenlight Flatpak (the same app, no second copy)
# and keeps your settings and login (they live in ~/.var/app/io.github.unknownskl.greenlight).
#
# Run in Konsole (Desktop Mode):
#   curl -fsSL https://github.com/Veter1904/greenlight/releases/latest/download/update-greenlight.sh | bash
#
set -euo pipefail

REPO="${GREENLIGHT_REPO:-Veter1904/greenlight}"
APP_ID="io.github.unknownskl.greenlight"
BASE="https://github.com/${REPO}/releases/latest/download"

say() { printf '\n\033[1;32m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

command -v flatpak >/dev/null 2>&1 || die "flatpak was not found. This script is for SteamOS / Linux with Flatpak."
command -v curl >/dev/null 2>&1 || die "curl was not found."

# Where is Greenlight installed? (Discover can use either)
scope=""
installed="no"
if flatpak info --user "$APP_ID" >/dev/null 2>&1; then
    scope="--user"
    installed="yes"
elif flatpak info --system "$APP_ID" >/dev/null 2>&1; then
    scope="--system"
    installed="yes"
else
    scope="--user"
    say "Greenlight is not installed yet. It will be installed for the current user."
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

say "Downloading the latest Greenlight build..."
curl -fL --retry 3 --progress-bar -o "$tmp/greenlight.flatpak" "${BASE}/greenlight.flatpak" \
    || die "Download failed. Check the internet connection and that a release exists at https://github.com/${REPO}/releases"

if curl -fsL --retry 3 -o "$tmp/greenlight.flatpak.sha256" "${BASE}/greenlight.flatpak.sha256"; then
    say "Verifying the download..."
    (cd "$tmp" && sha256sum -c greenlight.flatpak.sha256) || die "The checksum does not match, the download is corrupted. Run the script again."
fi

# Close Greenlight if it is running
flatpak kill "$APP_ID" >/dev/null 2>&1 || true

if [ "$installed" = "yes" ]; then
    say "Removing the old version (your settings are kept)..."
    # Without --delete-data the data in ~/.var/app/$APP_ID stays untouched.
    # shellcheck disable=SC2086
    flatpak uninstall $scope -y --noninteractive "$APP_ID"
fi

say "Installing the new version..."
# shellcheck disable=SC2086
if ! flatpak install $scope -y --noninteractive --bundle "$tmp/greenlight.flatpak"; then
    die "Installation failed. Your settings are still in ~/.var/app/${APP_ID}. You can reinstall Greenlight from Discover and run this script again."
fi

# Handy launcher for the next update: "Update Greenlight" in the application menu (and it can be added to Steam)
if mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications" 2>/dev/null \
    && curl -fsL --retry 3 -o "$HOME/.local/bin/update-greenlight" "${BASE}/update-greenlight.sh"; then
    chmod +x "$HOME/.local/bin/update-greenlight"
    cat > "$HOME/.local/share/applications/update-greenlight.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Update Greenlight
Comment=Update Greenlight to the latest build
Exec=$HOME/.local/bin/update-greenlight
Icon=$APP_ID
Terminal=true
Categories=Utility;
DESKTOP
fi

say "Done! Start Greenlight as usual (the Steam shortcut or the app menu entry did not change)."
# shellcheck disable=SC2086
flatpak info $scope "$APP_ID" 2>/dev/null | grep -Ei '^\s*(version|commit|date):' || true
