#!/usr/bin/env bash
# Run from the repository root. Frozen scripts write only inside the mirror.
set -eu
phase=docs/verification/m0-reverify-4-2026-11-06
prior=docs/verification/m0-reverify-2-2026-11-06
root=$PWD
mirror=$(mktemp -d /tmp/airflow-r4-replay.XXXXXX)
printf '%s\n' "$mirror" > "$phase/scratch-path.txt"
cp -a src tests docs package.json index.html "$mirror/"
asset=assets/airbus-a320-cfd-1.snapshot.7/samolot.stl
mkdir -p "$mirror/$(dirname "$asset")"
ln -s "$root/$asset" "$mirror/$asset"
cd "$mirror"
mv "$prior/replay" "$mirror/prior-replay"
bash "$prior/replay.sh" "$mirror"
mkdir -p "$root/$phase/replay"
cp -a "$prior/replay/." "$root/$phase/replay/"
python3 "$root/$phase/compare-replay.py" > "$root/$phase/replay-comparison.json"
