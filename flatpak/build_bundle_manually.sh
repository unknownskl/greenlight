#!/bin/bash
echo Run this under flatpak folder. Ensure Rust is installed. Press Enter to continue
read confirm
sudo pacman -Syu
sudo pacman -S python-aiohttp python-toml python-pipx flatpak flatpak-builder yarn npm nodejs base-devel git
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

git clone https://github.com/flatpak/flatpak-builder-tools
cd flatpak-builder-tools/
fbtPath=$(pwd)
pipx install ./node --force
export PATH=${PATH}:${HOME}/.local/bin
cd ..

pushd ../xal-node
cargo update
pushd xal-rs
cargo update
popd
popd

flatpak-node-generator yarn ../yarn.lock -o ./yarn-sources.json
flatpak-node-generator npm ../xal-node/package-lock.json -o ./npm-sources.json
python3 ${fbtPath}/cargo/flatpak-cargo-generator.py ../xal-node/Cargo.lock -o ./cargo-sources.json
flatpak-builder --force-clean build-dir ./dev.unknownskl.greenlight.yml
flatpak build-export export-dir build-dir
flatpak build-bundle export-dir Greenlight.flatpak dev.unknownskl.greenlight --runtime-repo=https://flathub.org/repo/flathub.flatpakrepo

echo done
