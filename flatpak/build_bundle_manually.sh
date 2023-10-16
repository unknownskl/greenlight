#!/bin/bash
echo Ensure Rust is installed, then Enter
read confirm
sudo pacman -Syu
sudo pacman -S python-aiohttp python-toml python-pipx flatpak flatpak-builder yarn npm nodejs base-devel git
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

git clone https://github.com/flatpak/flatpak-builder-tools
cd flatpak-builder-tools/
fbtPath=$(pwd)
pipx install ./node --force
export PATH=${PATH}:/home/imoc/.local/bin
cd ..

git clone https://github.com/unknownskl/greenlight.git
cd greenlight
git submodule update --init --recursive
cd xal-node
cargo update
cd xal-rs
cargo update
cd ..
cd ..
mkdir deps-dist
flatpak-node-generator yarn yarn.lock -o ./deps-dist/yarn-sources.json
flatpak-node-generator npm xal-node/package-lock.json -o ./deps-dist/npm-sources.json
python3 ${fbtPath}/cargo/flatpak-cargo-generator.py xal-node/Cargo.lock -o ./deps-dist/cargo-sources.json
cp -f ./deps-dist/* ./flatpak/
cd flatpak
flatpak-builder --force-clean build-dir ./dev.unknownskl.greenlight.yml
flatpak build-export export-dir build-dir
flatpak build-bundle export-dir Greenlight.flatpak dev.unknownskl.greenlight --runtime-repo=https://flathub.org/repo/flathub.flatpakrepo
cd ..
echo done
