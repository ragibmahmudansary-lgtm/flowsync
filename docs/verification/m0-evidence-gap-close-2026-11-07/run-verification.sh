#!/usr/bin/env bash
# M0-EVIDENCE-GAP-CLOSE: the three exact verification commands, run sequentially.
set -u
EV=docs/verification/m0-evidence-gap-close-2026-11-07
cd "$(dirname "$0")/../../.." || exit 1
run() {
  local name=$1; shift
  date -Is > "$EV/$name.start"
  local s e rc
  s=$(date +%s.%N)
  "$@" > "$EV/$name.tap" 2> "$EV/$name.err"
  rc=$?
  e=$(date +%s.%N)
  echo "$rc" > "$EV/$name.exit"
  echo "wall=$(awk -v s="$s" -v e="$e" 'BEGIN{printf "%.2f", e-s}')" > "$EV/$name.time"
}
run targeted timeout -k 10s 600s node --test --test-isolation=none --test-reporter=tap tests/aud1.test.mjs tests/aud2.test.mjs tests/rem3a.test.mjs tests/rem3b*.test.mjs
run npm timeout -k 10s 900s npm test
run combined timeout -k 10s 900s node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs
run identity timeout -k 10s 600s node --test --test-isolation=none --test-reporter=tap tests/m0-evidence-identity.test.mjs
echo done > "$EV/run-verification.done"
