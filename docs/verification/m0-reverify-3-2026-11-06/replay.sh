#!/usr/bin/env bash
# Run from the repository root. Prior replay code writes only inside the mirror.
set -eu
root=$PWD
phase=docs/verification/m0-reverify-3-2026-11-06
prior=docs/verification/m0-reverify-2-2026-11-06
mirror=$(mktemp -d /tmp/airflow-r3-replay.XXXXXX)
printf '%s\n' "$mirror" > "$phase/scratch-path.txt"
cp -a src tests docs package.json index.html "$mirror/"
asset=assets/airbus-a320-cfd-1.snapshot.7/samolot.stl
mkdir -p "$mirror/$(dirname "$asset")"
ln -s "$root/$asset" "$mirror/$asset"
cd "$mirror"
mv "$prior/replay" "$mirror/prior-replay"
bash "$prior/replay.sh" "$mirror"
cp -a "$prior/replay" "$root/$phase/"
python3 "$root/$phase/compare-replay.py" > "$root/$phase/replay-comparison.json"
