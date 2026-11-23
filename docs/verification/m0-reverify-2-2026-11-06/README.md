# M0-REVERIFY-2 evidence (2026-11-06)

Entry branch `impl/m0`, full HEAD `9a66316f63e22b9633e266716294eee68f9b2498`, Node 24.21.0, V8 13.6.233.17-node.53. The working tree already held the protocol, independent audit, AUD-1, AUD-2, REM-3a, REM-3b through REM-3b-R and M0-REVERIFY-1. See [status](entry-status.txt), [history](history.txt), [diff stat](entry-diff-stat.txt) and [tracked diff digest](entry-tracked-diff.sha256). The [M0-REVERIFY-1 frozen list](../m0-reverify-1-2026-11-06/frozen.sha256) passed all 389 hashes before and after review. All 143 [M0-REVERIFY-1 files](reverify-1.sha256) also matched their entry hashes after review. [Final source hashes](final-source.sha256) identify the tested files.

## Independent entry observations

`timeout 40s node docs/verification/m0-reverify-2-2026-11-06/solver-boundaries.mjs` recorded [entry results](solver-entry.jsonl) before any source correction. At β=3.25°, omitted and explicit false returned equal identities and comparison records. The true variant differed only in the identity flag, with the same comparison metrics and case coefficients. Its two cases warned with the VLM-V8 bounds-seed message. The false and omitted cases reported ok. The actual browser Run confirmed true/false with a symmetric synthetic wing and identical effective numerical inputs. Both download formats retained the exact β=3.25°, seed flag, and 0°/4° identity and coverage. The badge displays yaw rounded to one decimal place.

At `S_ref=2e-307 m²`, the solver produced four pairs of usable cases with finite coefficients and loads. Each two-point lift slope exceeded binary64's finite range. Both prescribed grid summaries carried invalidity and a reason, and both summary values per grid and both prescribed deltas were null. The custom 3×12/6×24 grid statuses independently failed, with metrics withheld. Browser Run completed both sweep samples while the comparison badge was amber and coverage false. Project and result downloads preserved these separate statuses. At `2e-306 m²`, both comparisons were usable. The custom badge was amber because its lift-slope delta was 1.73%, above the unchanged 1% gate.

The neighboring `3e-307 m²` fixture exposed a remaining defect. The slopes on all four grids were about 1.25–1.28e308 per radian, inside the finite range. Converting the per-degree slope by multiplying by 180 before dividing by π overflowed in the intermediate product. Both comparisons were falsely withheld with nonfinite-slope reasons through Run and both downloads. The targeted regression reproduced that false withholding [before the edit](representable-red.tap).

## Correction and separate verification

The [source change](solver-correction.diff) retains ordinary arithmetic and falls back to the direct lift difference divided by the 4° interval in radians if the original arithmetic is nonfinite. This is the same two-point diagnostic, with no cap or adjustment to the final slope, and the 1%/5% gates are unchanged. The [test delta](regression.diff) pins the recovered comparison, split validity and custom coverage isolation.

The same probe captured [final results](solver-final.jsonl). `python3 docs/verification/m0-reverify-2-2026-11-06/decimal-slope.py` evaluated the 0°/4° formula from saved binary64 case coefficients in 85-digit decimal arithmetic, with a separately supplied π and binary64 finite maximum. This is an arithmetic oracle on the measured case coefficients. It does not independently solve the flow. [Results](decimal-slope.json) give maximum slope relative error 1.30e-16 against 1e-14 and maximum delta absolute error 1.64e-16 against 1e-15 in fractional units. The first oracle run compared a small difference in relative units and failed at relative error 1.11e-14 (absolute error about 2.9e-17). That [attempt](decimal-initial.err) is retained. The final delta comparison uses absolute fractional error because subtracting nearby slopes amplifies relative error in their difference. The application thresholds did not change.

| Area (m²) | Prescribed comparison | Custom comparison |
|---|---|---|
| 2e-307 | R1 and R2 invalid. Null summaries and deltas, amber, no coverage. | Both grids invalid. Metrics absent, amber, no coverage. |
| 2.09e-307 | R1 invalid with null summary. R2 valid with finite summary. Null deltas, amber, no coverage. | Both grids invalid, no coverage. |
| 2.1e-307 | Both valid, within the 1%/5% gates. | Both grids invalid. The passing prescribed comparison grants no custom coverage. |
| 3e-307 | Both recovered, green, coverage true. | Both recovered, amber for the measured 1.73% lift-slope delta, coverage true. |
| 2e-306 | Both valid. | Both valid. |

See [browser procedure and observed badges](browser-smoke.md) and [asserted download records](browser-downloads.json). The fixed uncertainty claim was withheld in every solver, browser and download record. The browser tested the Run and serialization boundaries. It did not establish scientific validity or browser latency at extreme references.

## Test results

The timeout wrapper was the only guard on the exact combined command. There were no Node flag changes, split-suite substitutes or new profiling runs.

| Stage | Command | Files | Individual results | Wall time |
|---|---|---:|---:|---:|
| Entry | `timeout -k 10s 330s node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs` | 29 input | 158 passed | 207.56 s |
| Final targeted | `timeout -k 5s 110s node --test --test-isolation=none --test-reporter=tap tests/aud1.test.mjs tests/aud2.test.mjs tests/rem3a.test.mjs tests/rem3b*.test.mjs` | 19 input | 58 passed | 29.01 s |
| Final npm | `timeout -k 5s 180s npm test` | 29 passed | File reporter | 35.04 s |
| Final exact | `timeout -k 10s 330s node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs` | 29 input | 159 passed | 207.75 s |

All four exited 0 with no failures or skips. [Entry TAP](combined.tap), [targeted TAP](targeted.tap), [npm output](npm.tap), [final TAP](final-combined.tap). VLM-V2 matched-lift took 42.81 s at entry and 42.69 s final. The final exact process recorded 210.27 s user and 0.51 s system CPU. Browser and bounded scratch probes ran during parts of the test sequence. These timings measure this run. The prior timeout did not recur.

## Frozen replay

Run [replay.sh](replay.sh) from the repository root with a disposable copy of `src`, `tests`, `docs`, `package.json`, and `index.html` and a link to the read-only demo STL at its repository-relative asset path. The copied scripts write only in the mirror. The replay uses `OPENBLAS_NUM_THREADS=1` and a 100 s timeout per probe.

- Sol stops after 50 rows at the expected NaN circulation refusal. The zero-net-lift probe and final JSON/PSD-panel writes are unreached. Zero rows differ from M0-REVERIFY-1 final. Compared with REM-3b-R, row 23 differs only in the inherited identity field. Compared with the older independent replay, one-based rows 3, 8–10, 12–16, 18, 20–23, 27, 34–39 and 49–50 differ, all inherited.
- The edge replay passes and matches M0-REVERIFY-1 final. It differs from REM-3b-R only in two identity records. The independent measurement summary and full measurement groups match M0-REVERIFY-1 final. The exact M0-REVERIFY-1 comparison probes also match its post-edit output.
- The legacy app VM stops at its stale `clearVlmResult` fixture. Its later redraw and JSON writes are unreached. No adaptation was needed for this phase's actual browser test. The original hang probe now exits 1 promptly with the no-progress refusal. The forged-panel probe reproduces the ordinary 80 m row and stops at the expected ordered-endpoint mismatch.
- Analytic drag, LLT, PSD, API and the independent VLM oracle pass and reproduce prior final stdout. The independent VLM reports maximum relative discrepancy about 7e-15 against 1e-9. Matched-lift drag ratios for AR 6/8/12 are about 0.94781/0.94997/0.95132 within the existing [0.90, 1.05] gate. AR 4 is reported separately. The PSD counterexample remains. The archived elliptic and multirow extractors, rational-grid oracle and independent translation reconstruction were outside this focused replay. Prior results remain in their own evidence.
- The complete [row and exit ledger](replay-comparison.json) distinguishes expected stops from completed probes.

The two M0-REVERIFY-1 corrections were independently exercised. This phase's follow-up arithmetic correction is implemented and tested, pending independent review. Administrative dispositions remain open. IA-06, IA-08, remaining SOL-07 safeguards, proximity and elliptic science remain outside scope. G0 remains **BLOCKED**.
