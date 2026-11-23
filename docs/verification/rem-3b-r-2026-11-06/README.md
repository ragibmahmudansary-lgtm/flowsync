# REM-3b-R evidence, 2026-11-06

Branch `impl/m0`, HEAD `9a66316f63e22b9633e266716294eee68f9b2498`.
Node 24.21.0 and V8 13.6.233.17-node.53. All implementation and evidence
are uncommitted. The starting tree already contained the agent protocol,
independent audit, AUD-1, AUD-2, REM-3a and prior REM-3b. See
[starting status](start-status.txt), [final status](final-status.txt) and
[the frozen-file check](frozen-hash-check.txt).

## Arithmetic reproduction and independent comparison

Ran `node docs/verification/rem-3b-sol-2026-11-06/translated-wake.mjs` before
and after. At x=1e18 m the binary64 spacing is 128 m. The x components of the
quarter- and three-quarter-chord points, about 16 and 47.981 m relative to
the origin, both round to x=1e18. At x=1e16 and x=1e17 the roughly 31.981 m
chord offset rounds to 32 m instead. At α=β=0, adding 1,329 m to the x=1e18
bound coordinate and subtracting the bound coordinate yields 1,280 m. The
equivalent calculation at 1e16 and 1e17 yields 1,328 m. Those are two
separate losses.

[Pre](translated-wake-pre.jsonl) and [post](translated-wake-post.jsonl) retain
the probe's calculation using published world coordinates. Its post
`actualXDisplacement` still reconstructs a rounded **hypothetical** endpoint
from the published panel. The solver uses the displacement vector directly.
Writing the local bound-to-evaluation vector as `r = p - a` and the wake
displacement as `w = L e_w`, the downstream segment takes `(r, r-w, w)`
and the reversed upstream segment takes `(r-w, r, -w)`. The relative
singularity comparisons use these vectors. No segment is shortened or turned
by rounding an absolute downstream endpoint.

Generated geometry subtracts the first surface's root x and z from the
surface placements before making the chord points and normals. Moment arms
use the reference point in that frame. The separate loss in Trefftz is that
projecting absolute midpoint and leg origins can round them to the same
transverse position. Linearity gives `P(m)-P(a) = P(m-a)` for the orthogonal
projection `P`. The implementation evaluates the right-hand side and keeps
the forward-error calculation in the working frame.

The [oracle](wake-oracle.py) imports NumPy and reconstructs the four strips
from span, chord and incidence. It integrates each finite segment in axial
and radial coordinates and solves the independent matrix with NumPy. It
neither imports nor reads production source. Run
`OPENBLAS_NUM_THREADS=1 python3 docs/verification/rem-3b-r-2026-11-06/wake-oracle.py`.
The [vectors](wake-oracle.json) isolate the following effects.

| Axial configuration | Independent CL |
| --- | ---: |
| Intended chord, 1,329 m wake | 0.10390985448231327 |
| Intended chord, 1,280 m wake | 0.10391232672354568 |
| Rounded chord, 1,329 m wake | 0.12334305903362787 |
| Rounded chord, 1,280 m wake | 0.12334629309289771 |

The old translated CL was 0.12334629309289774. Its reference-relative Cm
also collapsed to zero. After correction CL is 0.10390985448231332 for all
axial offsets tested. The oblique α=3°, β=8° fixture gives CL about
0.244323354250166. Both single-case and sweep APIs agree with the independently
constructed equivalent at all five x/z placements through 1e18 m. Across
the cases, the maximum coefficient discrepancy is 4.11e-15 relative and
normalized force and circulation discrepancies are below 1.3e-15. The tests
use the independent report's 1e-9 relative method tolerance. Every case is
ok with zero kernel truncations and a 1,329 m nominal wake.

The independent oblique unit-horseshoe drag is 1/π N with unit circulation
and density. At x=1e18 and z=-1e18 the pre-edit absolute projection returned
raw zero without suppression. At x=1e16 it returned raw 0.2929577714 N and
suppressed the result. The post-edit result is 0.31830988618379086 N at all
three measured offsets, resolved within the existing 1e-12 relative analytic
tolerance. See [production measurements before](wake-measure-pre.jsonl) and
[after](wake-measure-post.jsonl), from `node <evidence>/wake-measure.mjs` run
with pre-edit and current source respectively.

Returned panel locations are still world-coordinate binary64 values.
Absolute neutral point and reference coordinates also round at that scale.
Supplied panels cannot recover geometry lost before the call. The raw case
path retains the existing original-frame collapsed-wake refusal and the
endpoint-y metadata checks. A common frame can still lose detail for
widely separated surfaces or already rounded inputs. The examples establish
equivalence for the tested translations and flows. There is no scientific
translation threshold or broader geometry-accuracy claim.

## Synchronous work measurement and policy

`timeout -k 3s 140s node docs/verification/rem-3b-r-2026-11-06/workload.mjs`
exited 0 before and after. Each workload ran in one Node process with wall
time, CPU time and process memory observations. The RSS high-water mark
includes prior entries in the same process and is not a per-case allocation
estimate. The 201 × 2,048 combination was assessed by counting, with an
actual refusal regression. The pre-edit product was not executed.

| Workload | Before, s | After, s |
| --- | ---: | ---: |
| 17 cases, 160 panels | 0.423 | 0.380 |
| 2 cases, 640 panels | 0.687 | 0.639 |
| 1 case, 2,048 panels | 4.874 | 5.019 |
| 2 cases, 2,048 panels | 10.298 | 10.596 |
| 17 cases, 640 panels | 6.345 | 5.810 |
| R1/R2, 160/640 panels, two angles each | 0.753 | 0.668 |
| Custom 512/2,048 plus R1/R2, two angles each | 12.000 | 11.790 |
| Custom 1,024 with oversized 3,840-panel refinement, refusal | 3.012 | 0.000117 |
| 3,840-panel plotting lattice, no finer grid, prescribed checks only | 0.783 | 0.678 |

The dense pair passes scale as P² and elimination has a cubic term. The
pre-edit 640-to-2,048 per-case timing ratio is about 14–15 for these
fixtures. P² alone predicts 10.24 and the weighted proxy P²(4096 + P)
predicts about 13.3. The weight is a workload approximation. A job may
spend four maximum-case equivalents (103,079,215,104 units). This leaves
room for both angles of a 2,048-panel refinement and an ordinary plotted
sweep plus diagnostic grids, while removing the 201-maximum-case job.
The separate 201, 4,096 and 2,048 limits are retained.

The browser counts the plotted sweep and the comparison together. Standalone
sweep and comparison calls count their own work. A 50-point, 512-panel sweep
costs 2.34375 equivalents. Its 160/640/512/2,048 resolution job costs about
2.253 equivalents. Each fits on its own, and the combined Run refuses.
The work limit takes effect before panel generation or matrix allocation.
Over-limit requests receive an error without silently reducing resolution.
Accepted jobs can still take seconds or longer depending on hardware and
runtime. Timing below any particular browser latency target has not been
established. See [pre measurements](workload-pre.jsonl),
[post measurements](workload-post.jsonl) and [browser smoke](browser-smoke.md).

## Commands and test results

| Command | Result |
| --- | --- |
| Scratch pre-edit `timeout -k 3s 45s node --test --test-isolation=none --test-reporter=tap tests/rem3b-r.test.mjs` | [6 failed](red.tap), exit 1. Includes an absent combined entry point on the old tree. |
| `timeout -k 3s 100s node --test --test-isolation=none --test-reporter=tap tests/rem3b*.test.mjs` | [44 individual passes](targeted.tap), exit 0, 6.397 s. |
| `npm test` | [29 passing files](npm-test.txt), exit 0, 24.411 s. |
| `node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs` | [156 individual passes](all.tap), exit 0, 188.169 s. VLM-V2 matched-lift callback 40.745 s. |

The first npm run identified a stale AUD-1 app VM fixture after the app switched
to a combined entry point. The first combined run had the same fixture failure
and recorded 155/156 passes. Its outer session was interrupted, but the child
continued for part of the final runs and wrote the initial TAP. These durations
are not isolated performance comparisons. The final commands ran on the fixed
fixture and passed with zero failures, cancellations or skips. The prior
combined-run timeout did not recur. The prescribed command ran unmodified and
no runner workaround or test-only matcher change was applied in this phase.

## Frozen scratch replays

`bash docs/verification/rem-3b-r-2026-11-06/replay.sh <pre-edit-source-mirror>`
copies the frozen directories and source to a scratch mirror, links the
read-only demo asset input and bounds each probe at 100 s. The paired
`node docs/verification/rem-3b-r-2026-11-06/compare-replays.mjs` produced
[the row comparison](replay-comparison.json). Keys in that file are zero-based.

- **Sol probes** exited 1 at the expected NaN-circulation refusal after 50
  rows. The zero-net-lift probe and the final writes of PSD panels and probe
  JSON were unreached. The changed one-based rows against the immediate
  checkpoint are 3, 8–10, 12–16, 18, 20–23, 27, 34–39 and 49–50. The changes
  are roundoff in the measured fields and diagnostics, and the reported
  cancellation tolerance in the two still-refused -1 N cases. The largest
  tracked coefficient/raw-drag/peak-force drift is 1.875e-11 relative on the
  already-quarantined 16×64 ellipse's peak force. No validity category changed.
  Row 23 also carries the inherited AUD-1 identity and REM-3a withholding
  differences when compared against the original independent replay.
- **Analytic drag and PSD** exited 0. The six prescribed-loading rows are
  exactly equal. The deterministic negative mode is still refused
  (raw -0.0018968706654474725 N). The PSD script independently reproduced
  four negative eigenvalues using the preserved panel fixture, since the Sol
  probe stopped before its scratch panel write.
- **Independent edge probes** exited 0. The only change versus the last Sol
  replay is one R2 quarantined-case CDi at the 1e-16 relative scale. Input
  identities remain distinct and neutral-point rows are identical. The
  separate hang probe exited 1 at the explicit non-advancing increment
  refusal. The panel metadata probe exited 1 on the forged second row after
  reproducing the ordinary 80 m/CL row exactly.
- **Sol API and decimal** exited 0. All 16 API rows and all 14 independent
  decimal vectors match the previous checkpoint exactly.
- **Independent measurements and oracle** exited 0. Numeric fields or
  diagnostics changed in nine top-level measurement groups, with maximum
  tracked relative drift 1.56e-15 versus a fresh pre-edit measurement. Both
  independently reconstructed ordinary VLM cases pass 1e-9 relative, with
  max error about 7.0e-15 including circulation and coordinate error
  4.45e-16 m. The LLT gates for AR 6, 8 and 12, scale checks and moment
  transfer remain within the frozen criteria. The out-of-scope recognition
  discrepancy still reproduces. The old function-extraction app probe was
  omitted in favor of the current wired regression and browser run.

No approved method thresholds, benchmark acceptance gates or frozen inputs
changed. The fixed uncertainty claim stays withheld. Independent
re-verification of AUD-1, AUD-2, REM-3a and REM-3b remains pending. IA-06,
IA-08, the remaining SOL-07 display safeguards, proximity and elliptic
science stay open. G0 remains **BLOCKED**.
