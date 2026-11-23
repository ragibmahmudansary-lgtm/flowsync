#!/usr/bin/env bash
# Run from repository root. The pre-edit source mirror is an optional argument.
set -eu
root=$PWD
ev=$root/docs/verification/rem-3b-r-2026-11-06
revision=$(git rev-parse HEAD)
mirror=$(mktemp -d /tmp/airflow-rem3br-replay.XXXXXX)
printf '%s\n' "$mirror" > "$ev/replay-mirror.txt"
cp -a src package.json "$mirror/"
ln -s "$root/assets" "$mirror/assets"
mkdir -p "$mirror/docs/verification"
cp -a docs/verification/{sol,independent-2026-11-06,rem-3b-sol-2026-11-06,rem-3b-deep-2026-11-06} "$mirror/docs/verification/"
export OPENBLAS_NUM_THREADS=1
cd "$mirror"
run() {
  local label=$1
  shift
  local status=0
  timeout -k 3s 100s "$@" > "$ev/replay-$label.stdout" 2> "$ev/replay-$label.stderr" || status=$?
  printf '%s\n' "$status" > "$ev/replay-$label.exit"
}
run probes node docs/verification/sol/probes.mjs
run analytic-drag node docs/verification/sol/analytic-drag.mjs
run psd python3 docs/verification/sol/psd-check.py
run edge-probes node docs/verification/independent-2026-11-06/edge-probes.mjs
run hang-probe node docs/verification/independent-2026-11-06/hang-probe.mjs
run panel-metadata node docs/verification/rem-3b-deep-2026-11-06/panel-metadata-probe.mjs
run api node docs/verification/rem-3b-sol-2026-11-06/api-probe.mjs
run decimal python3 docs/verification/rem-3b-sol-2026-11-06/decimal-oracle.py
run independent-measure node docs/verification/independent-2026-11-06/measure.mjs "$revision"
run independent-oracle python3 docs/verification/independent-2026-11-06/oracle.py
if [[ $# -gt 0 ]]; then
  cp -a "$1/src/." "$mirror/src/"
  mv docs/verification/independent-2026-11-06/measurements.json "$mirror/post-measurements.json"
  run independent-measure-pre node docs/verification/independent-2026-11-06/measure.mjs "$revision"
fi
