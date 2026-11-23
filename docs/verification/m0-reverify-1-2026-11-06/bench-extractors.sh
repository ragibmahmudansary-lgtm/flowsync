#!/usr/bin/env bash
# Replay archived programs against a scratch solver; originals stay byte-for-byte.
set -eu
e="$PWD/docs/verification/m0-reverify-1-2026-11-06"
cd "$1"
d=docs/verification/sol/evidence
cat > extractor-adapter.mjs <<'JS'
import { solveVlmCase as solve } from './src/vlmSolver.js';
export function solveVlmCase(options) {
  // The archived panel records predate the API's explicit width/length field.
  // chordM in both extractors is the local sub-panel chord.
  return solve({ ...options, panels: options.panels.map(panel => ({
    ...panel, widthLengthRatio: (panel.boundB[1] - panel.boundA[1]) / panel.chordM
  })) });
}
JS
for variant in multirow elliptic; do
  source="$d/opus-vlm_${variant}.mjs.txt"
  for mode in current-api adapted; do
    if [[ $mode == current-api ]]; then module=src/vlmSolver.js; else module=extractor-adapter.mjs; fi
    sed "s|/home/tanvir/Coding/AirFLOW/src/vlmSolver.js|./$module|" "$source" > "extractor-${variant}-${mode}.mjs"
    code=0
    timeout -k 3s 45s node "extractor-${variant}-${mode}.mjs" > "$e/extractor-${variant}-${mode}.out" 2> "$e/extractor-${variant}-${mode}.err" || code=$?
    printf '%s\n' "$code" > "$e/extractor-${variant}-${mode}.exit"
  done
done
