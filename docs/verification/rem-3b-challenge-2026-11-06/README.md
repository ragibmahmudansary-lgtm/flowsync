# REM-3b challenge checkpoint — partial, 2026-11-06

Branch `impl/m0`, HEAD `9a66316f63e22b9633e266716294eee68f9b2498`; all work remains uncommitted. Instruction package, independent audit, AUD-1, AUD-2, REM-3a and prior REM-3b were pre-existing. `preexisting-tracked.diff` preserves the tracked starting diff. This is not independent re-verification.

Python `decimal-oracle.py` independently computes seven fixed shortest-decimal vectors with 1200-digit precision; `decimal-oracle.json` is its output. The implementation test matches exactly, with no tolerance, including subnormal increments, 1e-300 and 1e20, sign changes and a below-end boundary. This is a limited construction check, not exhaustive floating-point or scientific validation. Decimal spellings, not original mathematical intent, determine the grid; compatibility and rounding cases remain to be challenged.

A finite `[1e308,0,0]` reference with 4-degree incidence previously returned `cm: Infinity` with `validity: ok`. `node --test --test-isolation=none --test-reporter=tap tests/rem3b-overflow.test.mjs` failed before the fix (`overflow-red.tap`); solver now refuses nonfinite total moment or moment coefficient. No physics or numerical threshold changed. Further extremes and supplied-panel semantics remain unreviewed.

A 2048-panel (16 x 128) actual solve completed in 8.405 s, CL 0.32765492293491755 and existing unverified-grid warning (`solve-2048.txt`); added boundary regression requires finite CL and panel count, not agreement with a scientific oracle. Existing tests cover 2049 refusal, 4096/4352 generation and 201/202 sweep boundaries. Caps are operational only.

`timeout -k 5s 90s node --test --test-isolation=none --test-reporter=tap tests/rem3b*.test.mjs`: 25 individual tests passed (`target-current.tap`). `npm test` and the combined individual run are recorded below. Earlier combined run before the moment fix timed out and was killed after 180+5 seconds, exit 137, empty `all.tap`; previously isolated subsets and oracle-only pass do not identify the interaction. No pass or aggregate count is inferred.

Scratch mirror `/tmp/airflow-challenge`, final source: `timeout -k 3s 60s node /tmp/airflow-challenge/docs/verification/sol/probes.mjs` exit 1 at expected nonfinite circulation rejection; 50 JSON rows, only row 23 differs from frozen independent replay (prior REM-3a badge). Zero-net-lift and later file-writing probes were not reached. Frozen evidence untouched.

Browser smoke, local server 4174 and in-app browser: demo solved 17 cases/160 panels; blank step and Run showed `VLM failed: alphaStepInput must be a finite number.`, Solver error and cleared result; restoring 1 and Run recovered 17 cases/160 panels. Local listen required escalation after EPERM. This is manual browser automation, not the requested reusable automated actual-app boundary.

Full API and compatibility audit, actual-app automated error test, broader oracle and prior-diff review, and combined runner diagnosis remain incomplete. IA-04/IA-07 remain open; IA-06/IA-08, SOL-07 display, proximity and elliptic science unresolved. AUD-1/AUD-2/REM-3a await independent re-verification; G0 BLOCKED.

Final-source `timeout -k 5s 180s npm test`: 23 test files passed, 0 failed (`npm-current.tap`). This is a file count. Target 25 is an individual-test count. The full combined individual run is recorded separately below.

Final-source `timeout -k 5s 180s node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs` was killed (exit 137) after the timeout and kill-after; `all-current.tap` is empty. No individual full-suite count or pass is claimed. This final run overlapped other tests, so resource contention may contribute, but does not explain earlier isolated attempts; the root cause is unproven. `git diff --check` passed and tracked frozen paths show no diff. Full prior-diff review is not complete.
