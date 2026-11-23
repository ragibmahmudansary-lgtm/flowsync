#!/usr/bin/env bash
# Run from the repository root with a disposable source/evidence mirror.
set -eu
out="$PWD/docs/verification/m0-reverify-2-2026-11-06/replay"
mkdir -p "$out"
cd "$1"
export OPENBLAS_NUM_THREADS=1
run() {
  local label=$1 code=0
  shift
  timeout -k 3s 100s "$@" > "$out/$label.out" 2> "$out/$label.err" || code=$?
  printf '%s\n' "$code" > "$out/$label.exit"
}
d=docs/verification
run sol node "$d/sol/probes.mjs"
run edges node "$d/independent-2026-11-06/edge-probes.mjs"
run app node "$d/independent-2026-11-06/app-probes.mjs"
run hang node "$d/independent-2026-11-06/hang-probe.mjs"
run analytic node "$d/sol/analytic-drag.mjs"
run llt python3 "$d/sol/llt-galerkin.py"
run psd python3 "$d/sol/psd-check.py"
run panel node "$d/rem-3b-deep-2026-11-06/panel-metadata-probe.mjs"
run api node "$d/rem-3b-sol-2026-11-06/api-probe.mjs"
run measure node "$d/independent-2026-11-06/measure.mjs" 9a66316f63e22b9633e266716294eee68f9b2498
run oracle python3 "$d/independent-2026-11-06/oracle.py"
run prior-counterexamples node "$d/m0-reverify-1-2026-11-06/counterexamples.mjs"
gzip -n -c "$d/independent-2026-11-06/measurements.json" > "$out/measurements.json.gz"
