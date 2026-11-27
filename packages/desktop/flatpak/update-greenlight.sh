#!/usr/bin/env bash
#
# Updates Greenlight on the Steam Deck (or any Linux with Flatpak) to the latest build from
# https://github.com/Veter1904/greenlight/releases
#
# It replaces every installed copy of io.github.unknownskl.greenlight (any branch, user and system
# installation) with the new build, so only one Greenlight is left and it is the new one.
# Your settings and login are kept (they live in ~/.var/app/io.github.unknownskl.greenlight).
#
# Run in Konsole (Desktop Mode):
#   curl -fsSL --proto '=https' --tlsv1.2 https://github.com/Veter1904/greenlight/releases/latest/download/update-greenlight.sh | bash
#
set -euo pipefail

REPO="${GREENLIGHT_REPO:-Veter1904/greenlight}"
APP_ID="io.github.unknownskl.greenlight"
BASE="https://github.com/${REPO}/releases/latest/download"

# Only HTTPS (also after redirects) and TLS 1.2 or newer for every download
CURL_SAFE=(--proto "=https" --proto-redir "=https" --tlsv1.2)

say() { printf '\n\033[1;32m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

command -v flatpak >/dev/null 2>&1 || die "flatpak was not found. This script is for SteamOS / Linux with Flatpak."
command -v curl >/dev/null 2>&1 || die "curl was not found."

# Branches of Greenlight that are installed in the given scope (--user or --system)
installed_branches() {
    LC_ALL=C flatpak list "$1" --app --columns=application,branch 2>/dev/null | awk -v id="$APP_ID" '$1 == id { print $2 }' || true
}

show_installed() {
    local scope found=0 branch
    for scope in --user --system; do
        for branch in $(installed_branches "$scope"); do
            printf '    %s  %s//%s\n' "$scope" "$APP_ID" "$branch"
            found=1
        done
    done
    [ "$found" = "1" ] || printf '    (not installed)\n'
}

say "Greenlight installs found on this system:"
show_installed

# Install where it already is (user is preferred, system only if that is the only place)
install_scope="--user"
if [ -z "$(installed_branches --user)" ] && [ -n "$(installed_branches --system)" ]; then
    install_scope="--system"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

say "Downloading the latest Greenlight build..."
curl "${CURL_SAFE[@]}" -fL --retry 3 --progress-bar -o "$tmp/greenlight.flatpak" "${BASE}/greenlight.flatpak" \
    || die "Download failed. Check the internet connection and that a release exists at https://github.com/${REPO}/releases"

if curl "${CURL_SAFE[@]}" -fsL --retry 3 -o "$tmp/greenlight.flatpak.sha256" "${BASE}/greenlight.flatpak.sha256"; then
    say "Verifying the download..."
    (cd "$tmp" && sha256sum -c greenlight.flatpak.sha256) || die "The checksum does not match, the download is corrupted. Run the script again."
fi

# Close Greenlight if it is running
flatpak kill "$APP_ID" >/dev/null 2>&1 || true

# Remove every copy, so an old one (other branch or other installation) can not be started instead of the new one.
# Without --delete-data the data in ~/.var/app/$APP_ID stays untouched.
for scope in --user --system; do
    for branch in $(installed_branches "$scope"); do
        say "Removing the old version $APP_ID//$branch ($scope, your settings are kept)..."
        flatpak uninstall "$scope" -y --noninteractive "$APP_ID//$branch" || true
    done
done

say "Installing the new version ($install_scope)..."
if ! flatpak install "$install_scope" -y --noninteractive --bundle "$tmp/greenlight.flatpak"; then
    die "Installation failed. Your settings are still in ~/.var/app/${APP_ID}. You can reinstall Greenlight from Discover and run this script again."
fi

# Handy launcher for the next update: "Update Greenlight" in the application menu (and it can be added to Steam)
if mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications" 2>/dev/null \
    && curl "${CURL_SAFE[@]}" -fsL --retry 3 -o "$HOME/.local/bin/update-greenlight" "${BASE}/update-greenlight.sh"; then
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

say "Greenlight installs now:"
show_installed
flatpak info "$install_scope" "$APP_ID" 2>/dev/null | grep -Ei '^\s*(version|branch|commit|date):' || true

say "Done! Start Greenlight as usual. If a Steam shortcut says the app was not found, add Greenlight to Steam again."
