# M0-REVERIFY-3 evidence (2026-11-06)

Entry was clean on `impl/m0` at `6c625a31f43892f71581fac8cde5a02a4ec9f168`.
This follows the tested source/evidence commit `e2e62030e49dc7b597fbc4f90981263f8943f2e5`.
The intervening commit changed only the handoff and next prompt. The earlier
`9a66316f63e22b9633e266716294eee68f9b2498` was the prior phase's entry HEAD.
See [entry status](entry-status.txt), [history](history.txt), [entry diff](entry-diff.txt),
[run environment](runtime.txt) and [final source hashes](final-source.sha256).

## Independent entry observations

[API measurements](api-pre.jsonl) were captured before editing production.
[The oracle](oracle.py) works from the exact binary64 values decoded from
JSON. It uses 90-digit Decimal arithmetic, a separately supplied π, and the
round-to-nearest overflow midpoint above the largest finite binary64 value.
It evaluates the slope as `(CL4 - CL0) * 45 / π`. From these slopes and the
4° induced drag it derives grid validity, reasons and deltas, then applies the
existing 1%/5% gates. Tolerances are 1e-14 relative for slopes and 1e-15
absolute for deltas in fractional units, carried forward from M0-REVERIFY-2
for arithmetic comparisons. They do not adjust the scientific gates.

- At 3e-307 m² the historical degree-conversion product overflows on all
  four grids. The independent slopes are 1.2514e308 to 1.2819e308 per radian,
  and both comparisons report. At 2e-307 m² all four slopes exceed the finite
  range despite finite usable case data. Both claims are withheld.
- At 2.09e-307 m² only prescribed R2 is valid. At 2.1e-307 m² the prescribed
  comparison passes and both custom grids fail. At 2.12e-307 m² the
  prescribed comparison still passes and the custom refinement is valid,
  while the plotted coarse custom grid is invalid. The custom claim is
  amber and withheld, with a coarse-only reason, absent custom metrics and
  no plotted-grid coverage. The analogous prescribed withholding uses null
  deltas and null summary values on each invalid grid.
- Constructed inputs straddled the quotient limit in either grid. Adjacent
  zero-origin 4° coefficients `1.2550265657538346e307` and
  `1.255026565753835e307` fell on opposite sides of the independently
  calculated overflow midpoint and were classified accordingly. Large
  common offsets (around ±1.25e308) overran the old least-squares mean sum
  yet gave finite slopes. The reversed-order negative input also agreed
  with the independent comparison.
- At β=3.25°, omitted and explicit false seed flags were identical. True
  changed the effective identity and warning status without changing the
  coefficients, comparison or coverage. The ordinary AR 8 prescribed
  deltas were 0.2604545932% and 1.0512702177%. Custom comparison was amber
  at 1.7278818163% and 0.6221550604% with coverage. The fixed claim was
  withheld.

## New counterexample and separate correction verification

Both signed cases in the [entry oracle output](oracle-pre.json) failed.
The individually finite slopes for `CL4 = 1e307` and `CL4 = -1.1e307` with
`CL0 = 0` are about 1.43239e308 and −1.57563e308 per radian. Their signed
difference has magnitude around 3.00803e308, but the relative delta is 2.1
(or 21/11 with grid roles swapped). The entry API returned null deltas with
“comparison metrics are nonfinite” even though both grid statuses were valid.
The [new regression](regression-pre.tap) reproduced that failure on the entry
solver. The correction preserves subtraction first when the difference is
finite. If it overflows, the solver divides the two finite slopes separately
by the original coarse denominator before subtraction. The old denominator
minimum remains. The genuinely nonfinite final relative delta with a zero
coarse slope still withholds both metrics and retains the grid statuses.
[Source and regression diff](correction.diff).

Reproduce the API measurements with
`timeout -k 3s 40s node docs/verification/m0-reverify-3-2026-11-06/probe.mjs`.
Run `python3 docs/verification/m0-reverify-3-2026-11-06/oracle.py <capture.jsonl>`
on each capture. The entry oracle exits 1 for the two reproduced defects.
The red test used
`node --test --test-isolation=none --test-reporter=tap --test-name-pattern='large slopes of opposite sign' tests/aud1.test.mjs`.

[Browser Run and both download formats](browser-smoke.md) corroborate the
inherited finite recovery and withheld controls. The correction uses signed
coefficient pairs constructed for the exported comparison API. The browser
fixtures test real solver-produced slopes and the serialized comparison
boundary. The Decimal check evaluates arithmetic on represented inputs.
The selected adjacent cases do not prove correctly rounded results for
every endpoint pair. These checks establish neither an aerodynamic envelope
nor browser latency at extreme reference values.

The separate [final capture](api-post.jsonl) and [oracle report](oracle-post.json)
pass. The recovered deltas are 2.0999999999999996 and 1.9090909090909092.
Maximum slope relative error is 6.67e-17 and maximum absolute delta error
is 3.43e-16. All other API rows are byte-identical after canonical JSON
formatting. The 0°/4° slope computation itself was unchanged.

## Test results

| Guarded command | Files | Individuals | Wall time |
|---|---:|---:|---:|
| `timeout -k 10s 110s node --test --test-isolation=none --test-reporter=tap tests/aud1.test.mjs tests/aud2.test.mjs tests/rem3a.test.mjs tests/rem3b*.test.mjs` | 19 input | 59 passed | 25.34 s |
| `timeout -k 10s 180s npm test` | 29 passed | File reporter | 32.72 s |
| `timeout -k 10s 330s node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs` | 29 input | 160 passed | 211.78 s |

Exit 0, zero failures, cancellations or skips. [Targeted TAP](targeted.tap),
[npm output](npm.tap), [combined TAP](combined.tap). VLM-V1/V1b/V2/V3 passed
at their existing gates. Matched-lift VLM-V2 took 42.09 s. The combined run
used 214.50 s user and 0.44 s system CPU. The browser actions finished before
the combined run, and the scratch replay and final API capture waited for it.
The historical timeout did not recur. The exact command used no runner
workaround or new V8 profiling. The retained REM-3b Sol traces remain the
comparison for a future recurrence.

## Frozen replay

From the repository root, run
`bash docs/verification/m0-reverify-3-2026-11-06/replay.sh`. This creates a
disposable source mirror with a read-only demo asset link and invokes the
unchanged M0-REVERIFY-2 replay driver there. The driver uses 100 s per probe
and one OpenBLAS thread. The frozen measurement command retains the historic
revision string as an argument for output comparison. The source actually
executed is the final working-tree copy recorded in the phase hashes.

- Sol emitted 50 rows, with zero changed rows relative to M0-REVERIFY-2,
  and stopped with the expected NaN circulation refusal. The zero-net-lift
  check and final JSON/PSD-panel writes were unreached.
- Edges, independent measurements and M0-REVERIFY-1 counterexamples match
  the previous replay. No independent measurement group changed. Ordinary
  R2 cases at AR 4/6/8/12 are identical. Analytic drag, LLT, PSD, API and
  independent oracle complete with byte-identical stdout. The matched-lift
  drag ratios are 0.94781/0.94997/0.95132 for AR 6/8/12 against [0.90, 1.05].
  AR 4 is reported separately under the matrix. The retained PSD
  counterexample still reproduces.
- The frozen app VM still stops at its stale `clearVlmResult` fixture.
  Its later redraw and JSON checks are unreached. The real browser verified
  Run and download behavior separately. The original hang probe exits at
  the expected non-advancing-step refusal. The panel probe emits the unchanged
  80 m baseline and stops at the expected forged ordered-endpoint refusal.
- Archived elliptic/multirow extractors, the rational-grid oracle and the
  independent translation reconstruction were outside this focused replay.

[Replay results](replay-comparison.json) record all twelve exits and
comparisons. All 389 frozen, 143 M0-REVERIFY-1 and 87 M0-REVERIFY-2 file
hashes matched at entry and final. The administrative dispositions remain
open. G0 remains **BLOCKED**.
