# M0-REVERIFY-4 independent evidence (2026-11-06)

Independent review completed for the signed relative lift-slope delta. The entry
solver passed the new probes. The review required no production or test edit.
Branch `impl/m0` and HEAD `6c625a31f43892f71581fac8cde5a02a4ec9f168` matched
the handoff. HEAD changes only the two handoff documents relative to
`e2e62030e49dc7b597fbc4f90981263f8943f2e5`. Entry had 11 modified tracked files
and 89 untracked files from M0-REVERIFY-3, with an empty index diff. See the
[entry inventory](entry-status.txt), [full entry diff](entry-tracked.diff),
[history](history.txt) and [runtime](runtime.txt). The 389 frozen hashes, 143
M0-REVERIFY-1 blobs, 87 M0-REVERIFY-2 hashes and six tested-source hashes matched.
The new [entry manifest](reverify-3-inherited.sha256) captures the 88 inherited
M0-REVERIFY-3 evidence files and its archived entry prompt. Final checks preserve
all of these and the inherited solver/test diff. The [tested executable manifest](tested-executables.sha256) covers the 46 tracked source, test, vendor and app-entry files.

## Independent arithmetic

For each grid with represented endpoints `CL0` and `CL4`, the angle interval
is `4π/180 = π/45` radians. With `u = CL4 - CL0`, its slope is `45u/π`.
For coarse and fine increments `u_c` and `u_f`, the absolute relative delta
is equivalently `|u_f - u_c| / max(|u_c|, (π/45) × 1e-300)`. This shows
why the grid order matters and why the floor only limits the denominator.
If two finite slopes have opposite signs, their magnitudes add in the absolute
difference. Division by the same positive scale before taking their difference
preserves the real-number formula and can avoid intermediate overflow. An
ordinary finite subtraction continues on the original arithmetic path.

[The oracle](oracle.py) computes exact rational arithmetic on the represented
binary64 endpoint values and a 100-digit approximation to π. It uses the exact
represented denominator floor and the round-to-nearest binary64 overflow
midpoint `2^1024 - 2^970`. The observed data come from a separate probe.
Tolerances are 1e-14 relative for slopes, 1e-15 absolute for deltas up to 10
in fractional units, and 1e-14 relative for larger deltas. The absolute and
slope tolerances carry forward from earlier reviews. The relative tolerance
for the huge finite delta measures its error at the appropriate scale.
Maximum errors were 6.67e-17 relative for slopes, 2.44e-16 absolute for
ordinary-sized deltas, and 1.19e-16 relative for the huge delta. The tolerances
are for arithmetic verification. The 1% and 5% comparison gates are unchanged.

| Constructed API case | Observed relative lift-slope delta | Grid validity |
|---|---:|---|
| +1.71887e308 coarse, −5.72958e307 fine, overflowing subtraction | 1.3333333333333333 | Both valid |
| Same inputs with coarse and fine swapped | 4 | Both valid |
| Ordinary finite difference between negative slopes, both orders | 0.200000000000000 and 0.166666666666667 | Both valid |
| Nonzero coarse below the floor and the swapped order just above it | 1.5040142122184108 and 1.4999999999999998 | Both valid |
| Zero coarse with a small negative fine slope | 1.1459155902616465 | Both valid |
| Zero coarse and large finite final delta | 1.7188733853924698e308 | Both valid |
| Zero coarse with a truly overflowing final delta | Both metrics null | Both valid, aggregate invalid |
| Same truly overflowing input with grids swapped | 1 | Both valid |
| Nonfinite fine slope from finite points | Both metrics null | Coarse valid, fine invalid |

[Pre-edit capture](api-entry.jsonl.gz) and [oracle results](oracle-entry.json)
include 11 constructed comparisons, five solver flow states with prescribed and
custom records, and a separate seed probe. The HEAD-only [scratch control](api-head-control.jsonl.gz)
replaces only the solver with `git show HEAD:src/vlmSolver.js`. The
[same 17 rows](head-control-comparison.json) differ in exactly the two signed
overflow cases. HEAD withholds both metrics despite valid grid statuses. This
comparison isolates the inherited recovery. It is separate from the frozen
replay and the exact test runner.

The first flow probe used a three-sample plotted sweep even at extreme
normalization. It reached the existing nonfinite fit/stability output guard.
That [attempt](api-initial.jsonl.gz), [probe](probe-initial.mjs) and
[error](api-initial.err) are retained. The final extreme fixtures used a
two-sample plot to isolate comparison arithmetic. The ordinary fixtures kept
the −2°/0°/2° plotted sweep and verified the separate 0°/4° comparison protocol.
At ordinary zero yaw the prescribed deltas were 0.26045% and 1.05127%, and
custom was amber with coverage at 1.72788% and 0.62216%. At β=5° the prescribed
deltas were 1.75243% and 5.17067%, so the badge was amber with coverage.
At β=3.25° omission and explicit false gave equal results and identities.
True changed the effective seed identity and case warnings while preserving
the numerical coefficients and comparison metrics. The fixed uncertainty
claim stayed withheld.

Reproduce from the repository root.

```sh
phase=docs/verification/m0-reverify-4-2026-11-06
timeout -k 3s 40s node "$phase/probe.mjs" > /tmp/airflow-r4-api.jsonl
python3 "$phase/oracle.py" /tmp/airflow-r4-api.jsonl
```

## Real browser Run and both downloads

The local in-app browser used the demo bounds reference state with an 8 m
rectangular wing, 1 m root chord, tip chord and MAC, zero sweep, dihedral and
incidence, 17 m root leading x, 40 m/s, density 1.225 kg/m³, zero yaw and
CD0/CM0, and a 0°–4° sweep with a 4° step. The browser retained the numerical
inputs from the prior fixture. The test set each area and lattice explicitly,
clicked **Run horseshoe VLM**, observed the resulting badge and solve status,
then triggered and parsed **Save project** and **Export results** downloads.
The initial loopback bind returned EPERM. The authorized local retry used
`PORT=4175 npm start`.

| Area (m²) | Grid | Visible and serialized outcome |
|---|---|---|
| 3e-307 | R1, 128 panels | Two cases solved. Green, coverage true, 0.26% and 1.05%. |
| 2e-307 | R1, 128 panels | Two cases solved. Amber and withheld, both slopes nonfinite, null prescribed summaries and deltas. |
| 3e-307 | Custom 3×12, refined 6×24 | Two cases solved. Amber with coverage, 1.73% and 0.62%. |
| 2.12e-307 | Custom 3×12, refined 6×24 | Two cases solved. Amber and withheld. The coarse custom slope is invalid, the refinement is valid and custom deltas are absent. The prescribed comparison still passes. |

[Both download records and file hashes](browser-downloads.json) preserve exact
0°/4° coverage and the applicable identity, reasons and per-grid status. The
eight files also retain the bounds seed warning, finite plotted coefficients
and loads, and the fixed uncertainty withholding. All four comparisons,
provenance records and series agree with the prior browser run. Recheck using
`node docs/verification/m0-reverify-4-2026-11-06/check-browser.mjs /home/tanvir/Downloads`.
The browser exercised actual solver output, including inherited single-grid
slope recovery. The signed-difference overflow is a constructed API input.
These probes cover the tested representability cases and serialization.
They establish neither universal correct rounding nor flow-model accuracy
or latency at extreme references.

## Test commands

| Command, each under an outer timeout guard | Input files | Passing results | Wall |
|---|---:|---:|---:|
| `node --test --test-isolation=none --test-reporter=tap tests/aud1.test.mjs tests/aud2.test.mjs tests/rem3a.test.mjs tests/rem3b*.test.mjs` | 19 | 59 individuals | 21.31 s |
| `npm test` | 29 | 29 files | 24.38 s |
| `node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs` | 29 | 160 individuals | 190.38 s |

The guards were `timeout -k 10s 110s`, `timeout -k 10s 180s` and
`timeout -k 10s 330s`, respectively. All three exited 0 with zero failures,
cancellations and skips. See [targeted TAP](targeted.tap), [npm output](npm.tap)
and [exact combined TAP](combined.tap). VLM-V1/V1b/V2/V3 passed the existing
gates. VLM-V2 matched-lift took 39.46 s. The exact process used 192.35 s
user and 0.39 s system CPU. The historical timeout did not recur. No runner
workaround or new profiling was required. The [REM-3b Sol evidence](../rem-3b-sol-2026-11-06/README.md)
retains the earlier per-solve traces, V8 profile and test-only Illinois correction.

## Frozen replay

From the repository root run `bash docs/verification/m0-reverify-4-2026-11-06/replay.sh`.
The driver copies the tested working-tree source and probes to a disposable
mirror, links the read-only demo STL and uses the retained replay driver
with a 100 s per-probe limit and one OpenBLAS thread. The frozen measurement
script still takes the historical revision string for reproducible comparison.

- All 12 stdout streams are byte-identical to M0-REVERIFY-3. All 50 Sol rows,
  independent edge groups and independent measurement groups are identical.
  The Sol replay stops at the expected NaN circulation refusal. The later
  zero-net-lift check and final JSON/PSD-panel writes are unreached.
- The frozen app VM stops at its stale `clearVlmResult` helper. Its redraw
  and final JSON checks are unreached. The hang probe promptly refuses the
  non-advancing sweep. The panel probe emits the 80 m baseline and refuses
  the forged ordered endpoints. The real browser check above is separate.
- Analytic drag, LLT, PSD, edges, API, independent measurements, independent
  oracle and the M0-REVERIFY-1 counterexamples complete. Matched-lift drag ratios
  at AR 6/8/12 are 0.94781/0.94997/0.95132 against [0.90, 1.05]. AR 4 is
  reported separately. The retained PSD counterexample still reproduces.
  Archived multirow and elliptic extractors, the rational sweep grid oracle
  and the independent translation reconstruction are outside this replay.

[Exit and comparison ledger](replay-comparison.json). Administrative
dispositions stay open and **G0 remains BLOCKED**.
