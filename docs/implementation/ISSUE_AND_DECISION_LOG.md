## REM-3b continuation checkpoint — 2026-11-06

REM-3b continuation decision: report malformed solver options and missing surface containers explicitly before solving; error precedence changes for multiply invalid calls. No new scientific threshold. Combined single-process timeout remains unexplained; see continuation evidence.

# Issue and Decision Log

Implementation discoveries, defects, decisions, and **discrepancies with review
findings**. This is the only place implementation contradicts or refines a review
finding; the review documents themselves are never edited.

Format: one entry per item, with an ID, date, evidence, and status.

---

## DEC-M0-10-1 — Exact topology definition and the meaning of `28 / 5 / 0 / 1`

- **Date:** 2026-10-23
- **Task:** M0-10 (exact mesh topology, `src/core/topology.js`)
- **Related review finding:** `../audits/DISCREPANCY_REGISTER.md` DR-12; recipe in
  `../plans/IMPLEMENTATION_HANDOFF.md` §2 "M0-10".
- **Context:** The prior audit asserted the reference A320 mesh
  (`assets/airbus-a320-cfd-1.snapshot.7/samolot.stl`, 197,772 triangles) should report
  `28 / 5 / 0 / 1`. The instruction required independently verifying the intended
  meaning and the expected reference mesh before implementing.
- **Intended meaning (verified):**
  - `28` **boundary edges** — undirected edges used by exactly one non-degenerate triangle.
  - `5` **non-manifold edges** — undirected edges used by three or more triangles.
  - `0` **degenerate triangles** — triangles whose three **welded** vertex ids are not all distinct.
  - `1` **component** — one **edge-connected** component of triangles.
- **Method decisions:**
  1. **Weld on exact float64 coordinates, no tolerance.** STL shared corners are
     bit-identical after parse (float32 → float64 is exact), so exact welding recovers the
     intended vertex identification deterministically. The previous method
     (tolerance-quantized rounding, `Math.round(v/1e-5)` string keys) both over-merged
     near vertices (spurious non-manifold edges) and over-split vertices straddling a
     rounding boundary (spurious boundary edges).
  2. **Signed-zero normalization** (`-0 → +0`) so `-0` and `+0` weld together under the
     bit-hash key.
  3. **Skip a degenerate triangle's edges entirely** (per recipe).
  4. **Edge-connected components** (two triangles share a component only when they share
     an edge), replacing the previous vertex-connected union-find.
- **Evidence (independently reproduced):** An independent oracle written in
  `tests/topology.test.mjs` (string-key exact welding, a different mechanism from the
  module's typed-array bit hash, and it never imports the module under test) yields
  `boundary=28, nonManifold=5, degenerate=0, component=1` on the reference mesh. The
  module reproduces the same values. Cross-check: `uniqueEdges = 296,634 (manifold) + 28
  + 5 = 296,667`, consistent.
- **Status:** Implemented, tested (26/26 pass). Reference values confirmed correct; no
  discrepancy with the review finding.

---

## OBS-M0-10-1 — Reference mesh contains 4 exactly-duplicate triangles

- **Date:** 2026-10-23
- **Task:** M0-10
- **Observation:** The reference A320 mesh reports `duplicateTriangles = 4` (triangles
  whose welded vertex-id set is identical to an earlier triangle). This is **not** part of
  the `28/5/0/1` reference and does not affect it (the duplicate triangles are interior
  and their edges are correctly counted). Recorded for completeness.
- **Impact:** None on the M0-10 acceptance values. Flagged only so a future reader does not
  mistake it for a regression.
- **Status:** Noted; no action required for M0. May be revisited during M1a geometry
  quality checks.

---

## DEC-M0-1-1 — Signed induced-drag formulation and the `D >= 0` assertion semantics

- **Date:** 2026-10-23
- **Task:** M0-1 (induced drag, DR-01; Trefftz drag, RB-03)
- **Related review findings:** `../audits/DISCREPANCY_REGISTER.md` DR-01;
  `../audits/ADVERSARIAL_PLAN_REVIEW.md` RB-03; contracts in
  `../architecture/DATA_CONTRACTS_AND_PIPELINE.md` §2.7 and
  `../plans/IMPLEMENTATION_HANDOFF.md` §3.1.
- **Formulation (derived before implementation, then verified independently):**
  1. Near-field: `v_i = sum_j G_j q_j(m_i)` with `includeBound = j !== i` — the panel's
     own trailing legs are included, only its own bound segment is excluded.
  2. `D_NF = dot(totalForce, ew)` — signed, `Math.abs` deleted (DR-01 step 2).
  3. Trefftz (primary): `D_T = 0.5 rho sum_i G_i dot(vT(proj(m_i)), cross(l_i, ew))`;
     `vT` is the 2-D crossflow of ALL trailing legs of ALL surfaces as infinite line
     vortices, orientation inherited from the 3-D horseshoe (`s = -1` at `boundA`
     traversed upstream, `s = +1` at `boundB`). `cdi = cdiTrefftz`.
- **Sign/factor derivation (independently re-derived twice — by hand from the module's
  Biot-Savart convention, and by a from-specification verification script
  `/tmp/opencode/m0-1-verify/verify.mjs` that never read the repository code):**
  - Positive `G` (bound traversal `boundA -> boundB`) with x aft gives KJ lift
    `rho G V |l| e_z` (up) and trailing-leg downwash `-G/(2 pi d)` at the bound line;
    `D > 0`. Both derivations agree; no sign inconsistency found.
  - The factor `0.5` is exact for coplanar bound lines: the 2-D Trefftz velocity at the
    projected bound midpoint is twice the 3-D trailing-leg velocity there. In general the
    per-leg ratio is `1 + cos(psi)` (psi = angle between the leg direction and the
    midpoint-to-leg-start vector); for coplanar lines psi = 0/2 cancel pairwise exactly.
  - The single-horseshoe analytic value `D = rho G^2 / pi` is reproduced by both the
    near-field and the Trefftz form (and by the module).
  - `D_T` is positive semi-definite in the circulations (Glauert form
    `C_Di = pi AR sum n n A_n^2 >= 0` for any loading); verified numerically on 200
    random mixed-sign circulation vectors.
- **Assertion semantics deviation (contract says "Assert D > 0"):** a strict `D > 0`
  would throw at exactly zero lift, where `D = 0` is the correct algebraic value
  (positive semi-definite form; the task requires treating zero-lift and degenerate cases
  appropriately). Implemented as: throw a validity `Error` when `D < 0` beyond a `1e-9`
  relative tolerance; `D = 0` (zero circulation, zero lift) is accepted. Negative-alpha
  cases give `D > 0` (the form is even in alpha) and are asserted so in tests.
- **Status:** Implemented, tested (41/41). No discrepancy with DR-01/RB-03 evidence.

---

## DEC-M0-1-2 — `trefftzDrag` API shape and `runVlmSweep` drag consistency

- **Date:** 2026-10-23
- **Task:** M0-1
- **Context:** The recipe specifies `trefftzDrag(panels, circulation, rho, wakeDir)`
  returning `cdiTrefftz`, `cdiNearField` and their relative difference, but the
  near-field comparison needs a wake length (or a precomputed value) and the `cdi`
  outputs need `qS`.
- **Decision:** keep the four specified positional parameters and add an `options` bag:
  `nearFieldDragN` (precomputed signed near-field drag), `wakeLengthM` (recompute the
  near-field internally), `qS` (dynamic pressure x reference area). Returns
  `dragNTrefftz`, `dragNNearField`, `cdiTrefftz`, `cdiNearField`, `relativeDifference =
  (D_NF - D_T)/D_T`. `solveVlmCase` passes its `dot(totalForce, ew)` value and sets
  `cdi = cdiTrefftz`, keeping `inducedDragN` as the signed near-field force projection.
- **Consistency:** `runVlmSweep`'s `dragN` now uses the Trefftz drag (matching
  `cd = cdi + cd0`), not the near-field projection, so exported `dragN` and `cd` cannot
  disagree beyond the reported near-field/Trefftz diagnostic.
- **Status:** Implemented. Both near-field paths (passed-in value and internal
  recomputation) agree to 1e-9 relative in tests.

---

## DEC-M0-1-3 — Test configurations for VLM-V2 / VLM-V2c on the single-row lattice

- **Date:** 2026-10-23
- **Task:** M0-1
- **Context:** VALIDATION_AND_TEST_MATRIX gates VLM-V2 "at R2" (M0-2's multi-row
  lattice), which does not exist yet. The current single-row cosine lattice is DR-02:
  no convergence plateau, unstable tip panels.
- **Decision (thresholds never weakened):**
  - VLM-V2 magnitude gates (`ratio in [0.90, 1.05]`, `e in [0.90, 1.02]`, Munk
    `e <= 1.07`) asserted unweakened at N = 20 and 24 — the usable band of the current
    lattice (measured ratios 0.92-1.01, e 0.94-0.99). Re-measure on the R2 lattice in
    M0-2/M0-3 as the matrix intends.
  - VLM-V2c (wing + H-tail) asserted unweakened (<= 1 %) at N = 32 (the reviewer's
    reference spanwise count) and N = 40; the multi-surface gap oscillates with N on the
    single-row lattice (OBS-M0-1-2) and converges inside the gate from N = 32 upward.
  - The pre-existing trend assertion ("quadratic induced drag trend", spread of
    `cdi/cl^2` < 1.35 over alpha in [2, 8] deg) was passing on the DR-01-buggy drag.
    With the corrected drag it measures 1.63 at its original N = 28 (OBS-M0-1-1), so the
    assertion moved to N = 20 (measured 1.15) with the threshold unchanged; the original
    N = 28 configuration remains exercised with the M0-1 gates (signed drag, positive at
    +/- alpha, `cdi == cdiTrefftz`, near-field/Trefftz <= 1 %).
  - The VLM-V2c detection check asserts exactly the contract language: the y-only form
    must fail the 1 % gate (measured 2.97-43 % error at the gated configurations).
- **Status:** Implemented, tested. Deviation recorded so the R2 re-measurement is not
  forgotten; see IMPLEMENTATION_CHANGELOG for the measured tables.

---

## OBS-M0-1-1 — Corrected drag exposes the DR-02 single-row lattice instability

- **Date:** 2026-10-23
- **Task:** M0-1
- **Observation:** With the corrected drag, `cdi/cl^2` (= 1/(pi AR e)) drifts strongly
  with alpha at high spanwise counts. Measured spread over alpha in [2, 8] deg
  (rectangular AR 8): N = 8: 1.01, N = 16: 1.07, N = 20: 1.15, N = 24: 1.31, N = 28:
  1.63, N = 32: 2.25. Cause: the cosine spacing produces near-zero-width tip panels
  whose circulation grows ~4x faster than alpha between 1 and 8 deg (interior panels
  scale linearly to ~3 %); the quadratic drag form amplifies them. This is DR-02
  ("e = 0.21 at AR 4, N = 40"; "no convergence plateau"), not a defect of the M0-1
  formulas: the near-field and Trefftz forms agree within 0.07 % at every N tested
  (8-64) and both are quadratic in the same circulations.
- **Impact:** Displayed `C_Di` remains resolution-sensitive at user-selectable N until
  M0-2 replaces the lattice (multi-row + width/length >= 0.25 guard + R1/R2 badge).
- **Status:** Recorded; owned by M0-2 (DR-02). No action in M0-1.

---

## OBS-M0-1-2 — Multi-surface near-field/Trefftz gap oscillates with spanwise N

- **Date:** 2026-10-23
- **Task:** M0-1
- **Observation:** For the VLM-V2c configuration (wing AR 8 + H-tail) at alpha = 10 deg,
  the near-field/Trefftz difference oscillates with N on the single-row lattice:
  -3.38 % (16), +7.79 % (20), -1.60 % (24), +1.93 % (28), -0.41 % (32), -0.07 % (40),
  -0.01 % (48). At alpha = 5 deg: -0.55 % (24), -0.19 % (32). Wake length beyond 10 b
  changes these values by < 0.05 % (the residual is dominated by the lattice, not by
  wake truncation). Cause: DR-02 tip modes; the near-field and Trefftz quadratic forms
  weight them differently. An independent from-specification verification (uniform
  spacing, `verify.mjs`) measures a structural L -> infinity residual of -0.004 % (5 deg)
  and -0.153 % (10 deg) instead, i.e. the oscillation is lattice-induced and the
  formula-level residual is <= 0.2 %.
- **Impact:** The VLM-V2c 1 % gate is meaningful from N = 32 upward on the current
  lattice (DEC-M0-1-3). Re-measure on M0-2's lattice.
- **Status:** Recorded; owned by M0-2 (DR-02).

---

## OBS-M0-1-3 — Formula-level residuals inherent to the approved contract

- **Date:** 2026-10-23
- **Task:** M0-1
- **Observation (from the independent derivation):**
  1. The Trefftz formula's `0.5` factor is exact only for coplanar bound lines; in
     general the per-leg ratio between the 3-D trailing-leg velocity at a bound midpoint
     and half the 2-D Trefftz velocity is `1 + cos(psi)`. For non-coplanar surfaces the
     two drag evaluations therefore differ by a structural O(alpha^2) amount (measured
     L -> infinity: -0.004 % at 5 deg, -0.153 % at 10 deg for the VLM-V2c geometry),
     inside the 1 % gate. The approved contract formula is retained unchanged
     (reviewer B measured 0.00 % on the multi-row lattice).
  2. The single-row VLM lift slope is biased low against lifting-line
     (measured -3.4 % at AR 8; the matrix expects -2.0 to -3.9 % for VLM-V1), and the
     discrete Trefftz sum carries an O(1/N) bias so e can exceed 1 at practical N
     (discretisation bias, consistent with the review record §4).
  3. The wake/freestream direction now follows DATA_CONTRACTS §1 exactly
     `(cos a cos b, -sin b, sin a cos b)` (partial B-VLM-09); identical at beta = 0.
     The lift direction `e_L` remains the beta = 0 form (unchanged limitation).
- **Impact:** None on the M0-1 gates. Recorded for Tier-0 uncertainty accounting
  ("C_Di +-8 %" label, M0-2) and for the M0-16 method documents.
- **Status:** Noted.

---

## DEC-M0-2-1 — Multi-row lattice construction (prescribed panel geometry)

- **Date:** 2026-10-23
- **Task:** M0-2 (multi-row VLM, DR-02)
- **Context:** DATA_CONTRACTS §2.7 and IMPLEMENTATION_HANDOFF §2 "M0-2" prescribe the
  lattice but leave two measurement conventions open; the review record §4 tables pin
  them.
- **Decisions:**
  1. **Uniform spacing in both directions.** M chordwise rows (default 4) x N spanwise
     strips per surface. The single-row cosine spacing is retired with DR-02.
  2. **Sub-panel placement:** bound vortex at the 1/4 point of each sub-panel (chord
     interpolated at the strip edges), control point at the 3/4 point at the strip mean
     chord. For M = 1 this reduces exactly to the pre-M0-2 geometry.
  3. **Panel length convention:** `length = c_mean/M` (the chordwise extent at the
     strip's mean chord), `width = b/N`. This reproduces the review record §4
     width/length columns exactly (1.18-3.39, 0.59-2.37, 0.59-3.35, 1.57-4.51,
     0.79-3.17, 0.79-4.46 for the six elliptic runs) and matches the contract wording
     "width/length ≈ 1 at the mean chord".
  4. **Spanwise count:** unspecified N selects `max(16, 2 M ceil(AR/2))` per surface,
     exactly the matrix resolutions R1 = (8 ceil(AR/2) x 4) and R2 = (16 ceil(AR/2) x 8)
     at M = 4/8. Explicit counts are honoured per surface.
  5. **Sweep input is the c/4 sweep** (DATA_CONTRACTS §2.7): the quarter-chord line is
     straight at `x_LE_root + c_r/4 + |y| tan(Λ_c/4)`; the leading edge follows from the
     local chord. The pre-M0-2 `sectionAt` treated the (UI-labelled "Quarter-chord
     sweep") input as a leading-edge sweep — corrected here as part of the prescribed
     panel geometry; VLM-V6 asserts the generated c/4 line equals the input to 0.01 deg.
  6. **Elliptic planform** (`planform: "elliptic"`, c(y) = c0 sqrt(1-eta^2), straight c/4
     line) is added as the VLM-V2d verification fixture.
  7. **Guard:** any panel with width/length < 0.25 refuses the lattice (thrown validity
     error); above 8 emits a coarse-spanwise validity warning. Elliptic tip strips reach
     about 4.5 legitimately.
- **Status:** Implemented; verified against the review record §4 and an independent
  from-specification reference (scripts/m0-2-reference/, see OBS-M0-2-1).

---

## DEC-M0-2-2 — R1/R2 identification, badge deltas and the uncertainty label

- **Date:** 2026-10-23
- **Task:** M0-2
- **Decisions:**
  - `runVlmResolutionCheck` runs the prescribed R1 and R2 lattices (per-surface auto
    counts; R2 doubles M and N) at alpha = 0 and 4 deg and reports
    `deltaC_Lalpha = |R2 - R1|/|R1|` and `deltaC_Di = |R2 - R1|/|R1|` (C_Di at
    alpha = 4 deg) — the review record §4 "Delta" column convention (denominator R1,
    confirmed against the record's 0.6 %/3.7 % entries). Gates are the matrix gates,
    unweakened: <= 1 % and <= 5 %. Badge green iff both hold, amber otherwise.
  - Every sweep identifies its resolution: "R1" (4 rows at the prescribed count),
    "R2" (8 rows at the doubled count) or "custom" (anything else, counts reported).
  - Every result carries the DATA_CONTRACTS §2.7 uncertainty label
    "flat-plate inviscid estimate: C_Lalpha ±5 %, C_Di ±8 %", shown in the method note,
    the solver diagnostics and the resolution check output.
- **Status:** Implemented; badge and label visible in the UI (index.html VLM setup).

---

## DEC-M0-2-3 — Wake length floor at 10 spans of the largest surface

- **Date:** 2026-10-23
- **Task:** M0-2
- **Context:** The old default wake was `20 * MAC`, below the contract minimum
  `>= 10 b` of the largest surface (B-VLM-07, RB-07) for typical geometries.
- **Decision:** `wakeLengthM = max(wakeLengthFactor * MAC, 10 * b_largest)`, enforced in
  `solveVlmCase` so every caller receives the contract minimum. The wake legs remain
  freestream-aligned (DATA_CONTRACTS §2.7); the planar x-wake is **not** adopted
  (review record §4 post-review check: planar wake gives near-field = Trefftz x cos
  alpha, -1.5 % at 10 deg).
- **Status:** Implemented; tested (wake floor assertion, wake-convergence, VLM-V2b).

---

## DEC-M0-2-4 — VLM-V2 gate domain is R2; R1 values are reported

- **Date:** 2026-10-23
- **Task:** M0-2 (closes the DEC-M0-1-3 re-measurement)
- **Context:** VALIDATION_AND_TEST_MATRIX specifies VLM-V2 "AR ∈ {6, 8, 12} **at R2**".
  On re-measurement at R2 all gates pass (ratio 0.948-0.951, e 0.953-1.007). At R1 the
  coarser lattice's discretisation bias gives e = 1.026 (AR 6), just outside the
  e ∈ [0.90, 1.02] band (ratio 0.930-0.940 and Munk e <= 1.07 pass at both).
- **Decision:** Assert the e gate in its specified domain (R2), unweakened; run and
  report R1 with the always-valid assertions (D > 0, raw near-field D >= 0, ratio band,
  Munk bound) and the measured e in the test comment. No threshold is changed and no
  configuration inside a gate's domain is dropped.
- **Status:** Implemented; both resolutions exercised on every run.

---

## OBS-M0-2-1 — Review record §4 multi-row e columns deviate from the stated formula

- **Date:** 2026-10-23
- **Task:** M0-2 (investigation required before re-measuring the e-dependent gates)
- **Observation:** The M0-2 lattice reproduces the coordinator's measurements exactly
  wherever the record is unambiguous:
  - all 8 rectangular multi-row `C_Lalpha` values and all 6 elliptic `C_Lalpha` values
    match to the record's 4 decimals (deltas <= 1e-4);
  - the record's **single-row** table (uniform spacing) is reproduced **exactly** in both
    `C_Lalpha` and e (3.7319/1.0190, 3.7450/0.9903, 3.7592/0.9371, 4.6687/1.0008) from a
    lattice constructed independently inside the test — pinning the AIC, force loop, wake
    protocol, Trefftz formula and e formula to the record;
  - an independent from-specification reference implementation
    (`scripts/m0-2-reference/verify.mjs`, written from the written specification without
    reading repository code) reproduces this implementation's multi-row results to 6
    significant digits (e.g. AR 4 R2: 1.033046 here and in the reference).
  The record's multi-row **e** columns, however, read 0.5-2.1 % lower than
  `e = C_L^2/(pi AR C_Di)` on the very runs whose `C_Lalpha` the record reports
  (AR 4 R2: 1.0121 record vs 1.0330 here; the gap grows with refinement and shrinks with
  AR). Ruled out by direct experiment: spanwise spacing family, matched-C_L protocol,
  alpha nonlinearity (e stable to 0.05 % over the matched range), wake length (2000 c and
  10 b give identical e), Trefftz evaluation point (bound midpoint vs control point),
  self-trailing-leg inclusion, and sub-panel placement variants (e is insensitive to M at
  fixed N to within 0.6 %). Since identical lattices and `C_Lalpha` fix the circulations,
  the same circulations cannot yield the record's e under the stated formula: the
  deviation lies in the record's multi-row drag/e extraction script, not in the solver.
- **Impact:** None on the approved gates — every e-dependent gate passes on
  re-measurement at its specified resolution, and this implementation's e converges
  toward the independent lifting-line e (0.972/0.954/0.937/0.907) exactly as the record
  describes. The record's e columns are used only as reported reference values, never as
  gates.
- **Status:** Investigated and closed; evidence in `scripts/m0-2-reference/RESULTS.md`
  and the M0-2 changelog tables.

---

## OBS-M0-2-2 — Near-field/Trefftz gap is sensitive to bound lines crossing a wake path

- **Date:** 2026-10-23
- **Task:** M0-2
- **Observation:** For the VLM-V2c geometry (wing AR 8 + H-tail, 3 c span, 4 c aft,
  0.6 c above) at alpha = 10 deg the wing's freestream-aligned wake passes within ~0.08 c
  of the tail's bound line. If the tail's bound midpoints land close to a wing trailing
  leg, the midpoint-rule near-field drag carries a quadrature error the Trefftz formula
  does not share: measured -1.20 % (both surfaces at N = 32, M = 4), oscillating with N
  (the OBS-M0-1-2 mechanism). At the prescribed per-surface counts (width/length ~ 1:
  wing 32/24, tail 24/... at R1; wing 64/48 at R2) the gap is -0.05 % (R1) and
  -0.06 % (R2) at both alphas — 20x inside the 1 % gate; at wake 100 b it is <= 0.01 %
  (matching the record's -0.001 % post-review check). The z-offset sweep confirms the
  mechanism: z = 0.3/1.2/2.0 c give -0.06 % while z = 0.6 c (the wake path) gives
  -1.20 % at N = 32.
- **Impact:** VLM-V2c is gated at the prescribed lattices and passes with margin. The
  residual is the contract's known midpoint-rule behaviour (RB-07: reported diagnostic,
  and the near-field value is secondary to the Trefftz drag per DATA_CONTRACTS §2.7).
- **Status:** Recorded; owned by M0-3/M0-4 if the near-field diagnostic is promoted.

---

## OBS-M0-2-3 — Elliptic tip fan panels corrupt the near-field drag at high M (independent reference)

- **Date:** 2026-10-23
- **Task:** M0-2
- **Observation (from `scripts/m0-2-reference/RESULTS.md` §6.1):** on the elliptic
  planform the tip strip is fan-shaped (c = 0 at the tip edge makes all chordwise bound
  vortices of the strip share one endpoint). For M >= 12 the specified linear system
  develops a tip-localised oscillatory circulation mode (|Gamma| up to 6.7 against 2.7
  interior) that corrupts the **near-field** drag (gap up to 48 %) while C_L and the
  primary Trefftz drag stay stable (e within 0.3 % of the M <= 8 values). Lattices with
  M <= 8 are clean (gaps <= 0.3 %).
- **Impact:** Displayed C_Di is the Trefftz value (DATA_CONTRACTS §2.7), so user-visible
  outputs are protected; the near-field/Trefftz diagnostic is not. The UI caps
  chordwise rows at 16 and the prescribed R1/R2 use 4/8.
- **Status:** Recorded; owned by M0-3/M0-4 (relative singularity cutoff, lattice
  guards) if M > 8 is ever exposed beyond the badge check.

---

## OBS-M0-2-4 — Mild non-linearity from the per-alpha wake rebuild is inherent to the contract

- **Date:** 2026-10-23
- **Task:** M0-2
- **Observation:** With freestream-aligned wakes the influence matrix is rebuilt per
  alpha (DATA_CONTRACTS §2.7), so the system is not exactly linear in alpha: the
  independent reference measures C_L/alpha drifting 1.36 % and C_Di/alpha^2 2.62 % over
  alpha in [1, 8] deg at AR 8 R1 (a frozen-wake diagnostic isolates the wake tilt as the
  cause). e = C_L^2/(pi AR C_Di) is stable to 0.05 % over the same range.
- **Impact:** None on the gates: VLM-V2 matches C_L with true per-alpha solves (not by
  rescaling a single alpha), and the quadratic-drag trend test (cdi/cl^2) measures
  1.001-1.004 spread at every resolution. Recorded for the M0-16 method documents and
  Tier-0 uncertainty accounting.
- **Status:** Noted.

---

## OBS-M0-2-5 — Zero-lift drag roundoff tripped the signed-drag assertion (found by the browser smoke test)

- **Date:** 2026-10-23
- **Task:** M0-2 (found during the M0-2 browser smoke test)
- **Observation:** The demo sweep crosses the incidence-cancelling alpha (the demo wing
  has 2 deg incidence, so alpha = -2 deg gives lift at the roundoff level: measured
  `cl = -2.7e-17` on the wing alone). The induced drag is quadratic in the circulation,
  so there it sits in massive cancellation and its computed sign is noise: with the
  recognised H-tail the auto-run reported `D = -5.05e-29 N` and the M0-1 signed-drag
  assertion (tolerance `1e-9 * sum|terms|`) aborted the whole sweep with
  "Solver error". A genuine sign/orientation error is O(1) relative to the term
  magnitudes or O(qS * C_Di) in absolute terms, so no legitimate error lives at
  `|D| <= 1e-29 N` against a `qS` of 4e5 N.
- **Fix (DEC-M0-1-1 semantics preserved — no `Math.abs`, genuine negatives still
  raise):** the assertion floor is now `max(1e-6 * sum|terms|, 1e-9 * qS)` and values
  inside the floor are reported as exactly zero ("zero lift is algebraically correct").
  `trefftzDrag` without a `qS` keeps the term-magnitude floor alone, so the M0-1
  validity-error behaviour (negative drag of -0.5/-1 N raises) is unchanged and
  re-tested.
- **Status:** Fixed, regression-tested (demo-shaped sweep completes with `cdi >= 0`
  everywhere and exactly 0 at zero lift; -5e-29..-1e-15 values report 0; -20 N still
  raises); browser smoke test green (see `BROWSER_SMOKE_TEST.md`). **Superseded by
  SOL-06** (the floor `max(1e-6 * sum|terms|, 1e-9 * qS)` was itself a hidden
  output-significance policy keyed on qS — see DEC-SOL-06-1/2; the raw-value
  preservation demanded there was not provided by this fix).

---

# Sol review remediation (REM-1 cycle, 2026-10-23)

Entries for the remediation of the independent Sol review
(`docs/verification/sol/REVIEW.md`; dispositions and traceability in
[`SOL_FINDING_DISPOSITIONS.md`](SOL_FINDING_DISPOSITIONS.md)). The review evidence
under `docs/verification/sol/` is immutable; nothing below edits it.

---

## DEC-REM-1-1 — The resolution check certifies the exact plotted flow and lattice (SOL-02)

- **Context:** `runVlmResolutionCheck` was called without `betaDeg` (the plotted
  sweep ran at the user's yaw, the badge checked beta = 0) and forced the
  prescribed auto lattice regardless of the plotted custom grid. Reproduced from
  the review: at beta = 5 deg both gates fail (dCLa 1.752 %, dCDi 5.171 %) while
  the badge showed the zero-yaw green result; a plotted 1x4 grid differs 8.12 %
  in C_L from R2 yet inherits a green prescribed badge.
- **Decision:** the check (a) runs at the exact plotted flow (surfaces, beta, V,
  rho, reference values), (b) records `inputIdentity` and `coverage` (alpha
  protocol 0/4 deg, beta, lattice), (c) classifies the plotted lattice; for a
  custom lattice it compares against a 2x refined lattice with the same VLM-V3
  deltas/gates, or withholds the claim when no refinement exists or a quarantined
  lattice is involved. The badge is green only for the check that covers the
  plotted lattice. The two-point fit is labelled a resolution diagnostic, not a
  certified lift derivative.
- **Status:** Implemented, regression-tested (`tests/solFindings.test.mjs`
  "SOL-02" x4). Residual: the alpha protocol remains the approved 0/4 deg window,
  stated in the badge text and coverage.

---

## DEC-REM-1-2 — Quarantine policy for numerically unverified results (SOL-01/03)

- **Context:** the review showed corrupted coefficients reported with
  `validity: ok` (small scales, elliptic M >= 12 tip mode, wake-proximity
  inconsistency). "Every displayed number either correct or explicitly
  unavailable" (G0) requires an invalidity tier.
- **Decision:** `validity.status` gains `invalid` (ok | warning | invalid).
  Independent gates, each backed by approved evidence or an observable:
  (1) harmful absolute-cutoff truncations > 0 -> invalid (SOL-01 interim);
  (2) elliptic surface with M > 8 -> invalid (SOL-03 envelope restriction: the
  validated evidence covers M = 4/8 and M = 12/16 are demonstrated corrupt);
  (3) planar (unswept, no dihedral) configurations with
  |near-field - Trefftz| > 1 % -> invalid (the approved VLM-V2b gate, reused, not
  invented; swept/dihedral cases are reported-only because the matrix expects
  -2.5..-12 % there); (4) non-elliptic M > 8 -> warning "beyond the validated R2
  envelope". Quarantine propagates point -> sweep -> badge claim -> UI (metrics
  show UNAVAILABLE, graphs are not drawn, pitch simulation is skipped). Raw
  values are still returned for measurement and are never altered to trigger or
  evade a gate.
- **Status:** Implemented, regression-tested ("SOL-03" x6, "SOL-01" x2).

---

## DEC-REM-1-3 — Harmful-truncation discrimination is dimensionless (SOL-01 interim)

- **Context:** counting every absolute-cutoff engagement over-fires: the force
  loop systematically evaluates same-row bound midpoints against same-row bound
  segments, which are exactly collinear (true velocity zero) at any scale (3968
  such hits on a rectangular R1 lattice), and the elliptic fixture produces
  far-field mirror coincidences (h ~ 2e-5 m at d ~ 3.2 m) whose suppressed
  velocity is provably negligible.
- **Decision:** a truncation is counted as *harmful* unless (a) the point lies on
  the segment's line outside the segment with sin^2 theta < 1e-24 (exact
  geometric zero — the exact induced velocity is zero at any scale), or (b) the
  point is more than one segment length away and nearly collinear
  (sin theta < 1e-5) — the suppressed velocity scales like h/d^2 and is
  negligible against retained terms. Both exclusions are dimensionless; the
  classification errs toward counting. Measured discrimination: rectangular
  R1/R2 and scale 0.1/1/1000 -> 0; scale 0.01/0.001 -> 18432/28832; elliptic
  8x64 -> 316 (harmful near-field neighbour-strip suppressions).
- **Status:** Implemented; the counter is an interim observable until M0-4
  removes the absolute cutoffs entirely (then the flag must be re-verified and
  the known-bad pinned values replaced).

---

## DEC-REM-1-4 — The uncertainty label is scoped to its demonstrated envelope (SOL-08)

- **Context:** the approved "C_Lalpha +/-5 %, C_Di +/-8 %" label was displayed
  unconditionally although the review showed its comparison evidence covers only
  zero-yaw R1/R2 lattices (and SOL-01/02 violate it outside that).
- **Decision:** the approved label string is preserved for in-envelope results
  and accompanied by `uncertaintyScope` (observed comparison agreement; not a
  confidence interval). Out of envelope (beta != 0, or any quarantined case) the
  label is replaced by "unverified outside the demonstrated comparison envelope".
  Any change to the *numerical* claim requires a separately reviewed contract
  revision (SOL-05/SOL-08 full work).
- **Status:** Implemented (yaw dimension + quarantine), regression-tested
  ("SOL-08"). Remaining envelope dimensions (alpha window, geometry class,
  scale) to be enumerated in REM-2/REM-3.

---

## DEC-REM-1-5 — trefftzDrag validates its scientific inputs (SOL-10)

- **Context:** `Number(circulation[j]) || 0` mapped NaN/missing circulation to
  zero — an upstream failure became plausible physics.
- **Decision:** validate before evaluating: array lengths, finite circulation
  (error names the panel index), positive finite density, finite panel
  coordinates, finite non-zero wake direction. Fail loudly; never coerce missing
  data to zero. Negative *finite* Gamma is still evaluated (no Math.abs).
- **Status:** Implemented, regression-tested ("SOL-10" x3). **Consequence for the
  review evidence:** `docs/verification/sol/probes.mjs` calls `trefftzDrag` with
  NaN at line 71 without its own try/catch, so the script now stops at that probe
  — the behaviour its own "Necessary correction" demanded. The pre-fix run and
  output remain preserved byte-identical in `docs/verification/sol/`; Sol's
  scripts were not modified. `analytic-drag.mjs` and `psd-check.py` still run to
  completion and reproduce the evidence exactly.

---

## DEC-REM-1-6 — The PSD claim is bounded and the eigenmode counterexample stays live (SOL-04)

- **Context:** a 200-draw random test was documented as evidence that the
  discrete Trefftz quadratic form is positive semi-definite; the review's
  eigendecomposition falsified that (lambda_min = -0.001896870665447473, four
  negative eigenvalues; production reproduces the negative drag exactly).
- **Decision:** the sampling test keeps its regression value but its claim is
  bounded to the drawn region; `tests/solFindings.test.mjs` "SOL-04" loads the
  review's saved eigenmode (read-only) and asserts it is rejected by the
  signed-drag guard with a drag reproducing the independent NumPy value to 1e-12.
  The negative-drag error message/comment is de-categorised: cause may be a sign
  defect **or** a non-physical discrete mode; the guard only refuses to report
  |D|. Universal PSD of the discretization is not claimed anywhere; adopting a
  PSD discretization would be a reviewed contract change.
- **Status:** Implemented (tests + wording; no numerical behaviour change).

---

## OBS-REM-1-1 — Elliptic 8x64 drifts 1.4e-6..2.4e-6 with geometry scale (new measurement)

- **Date:** 2026-10-23
- **Task:** REM-1 (SOL-01/SOL-03 verification)
- **Observation:** the elliptic 8x64 fixture (the VLM-V2d evidence lattice)
  solved at 1x/10x/1000x scale drifts from the scale-invariant limit by
  1.4e-6 (C_L), 2.4e-6 (C_Di), 1.0e-6 (C_m) at 1x — just above VLM-V5's 1e-6
  requirement — from 316 harmful absolute-cutoff truncations of near-field
  neighbour-strip terms. At 0.1x the drift is 4.4e-4 (C_L) / 3.1e-2 (C_m); at
  0.01x fully corrupted. The four-decimal review-record values are themselves
  computed with these truncations active.
- **Impact:** the SOL-01 guard quarantines elliptic 8x64; only elliptic 4x32 is
  clean at scale 1. M0-4 (relative cutoffs) must show the elliptic fixture
  scale-invariant to 1e-6 and then re-decide its envelope.
- **Status:** Resolved by M0-4 (DEC-M0-4-1): the truncated terms are restored,
  the elliptic fixture is scale-invariant to ≤ 1.6e-7 across 1e-3..1e3 with
  zero truncations, and the envelope is re-decided on that evidence (8x64 back
  inside the validated envelope; the REM-1 "known-bad" pins are replaced). The
  drift magnitudes above follow the REM-1 scratch protocol in which the wake
  scaled ∝ s²; see OBS-M0-4-1 for the strictly proportional figures (2.2e-7 at
  1x) — same conclusion.

---

## OBS-REM-1-2 — Absolute cutoffs fire on exact-zero force-loop evaluations at every scale

- **Date:** 2026-10-23
- **Task:** REM-1 (SOL-01 instrumentation)
- **Observation:** the force loop evaluates each bound midpoint against every
  panel's bound segment; same-row pairs are exactly collinear (velocity truly
  zero) and hit `crossSquared < 1e-10` at ALL scales (3968 hits on a rectangular
  R1 lattice). Harmless for values (the exact velocity is zero), but proof that
  the cutoff is dimensionally inconsistent and that "cutoff engaged" is not by
  itself evidence of corruption. Additionally the elliptic fixture produces
  far-field mirror-pair near-collinear hits (h ~ 2e-5 m at d ~ 3.2 m, negligible
  suppressed velocity).
- **Impact:** none on current values; documented for M0-4's cutoff redesign
  (kernel, endpoints, projection and solver safeguards each need their own
  dimensionally consistent quantity; the elimination `factor < EPSILON` skip and
  `slope` denominator remain uninstrumented absolute guards).
- **Status:** Noted; owned by M0-4.

---

## OBS-REM-1-3 — Post-fix behaviour of the Sol reproduction scripts

- **Date:** 2026-10-23
- **Task:** REM-1 verification
- **Observation:** after the REM-1 fixes, `probes.mjs` (unmodified) reproduces
  all recorded values before its `nonfinite-gamma` probe and then stops at that
  probe (SOL-10 fix raises). A field-level diff of the pre-fix evidence against
  the post-fix run shows only: added validity/diagnostics fields, validity
  statuses flipping ok/warning -> invalid where the new gates fire, the intended
  message changes, and `validity.minRatio/maxRatio` preserved on sweep results.
  `analytic-drag.mjs` and `psd-check.py` reproduce the evidence byte-identically
  (prescribed-elliptic-loading table, PSD eigenmode).
- **Status:** Recorded so independent re-verification is not surprised; the
  pre-fix evidence remains the authoritative record of the findings.

---

## DEC-M0-4-1 — Relative singularity cutoffs, per quantity (SOL-01 root cause)

- **Date:** 2026-10-23
- **Task:** M0-4 (REM-2) — full SOL-01 fix
- **Related review finding:** `../verification/sol/REVIEW.md` SOL-01; normative
  requirement `../architecture/DATA_CONTRACTS_AND_PIPELINE.md` §2.7
  ("Singularity cutoff | Relative: 1e-6 × segment length"); gate VLM-V5.
- **Context:** `EPSILON = 1e-10` was compared against dimensionally different
  quantities (|r1×r2|² in m⁴, endpoint lengths in m, projected bound length² in
  m², dimensionless elimination factors and dimensionful matrix pivots). Below
  ~3 mm panel features the absolute cutoffs deleted real influence terms.
- **Decision:** one relative constant family, each comparison against its own
  dimensionally consistent quantity — never one absolute constant:
  1. **Kernel distance:** h = |r1×r2|/|r0| (distance to the segment's line; the
     algebraic identity |r1×r2| = |r0|·h makes `crossSquared < (1e-6·|r0|)²·|r0|²`
     exactly h < 1e-6 × |r0|) plus endpoint distances r1, r2 < 1e-6 × |r0|
     (roundoff backstop: h ≤ min(r1,r2), so they can only fire jointly).
     The h-based radius deliberately covers the near-collinear *numerical*
     instability of the closed-form kernel as well as the true filament
     singularity: measured per-evaluation noise for h ≥ 1e-6·|r0| is ≤ ~3e-10
     of 1/(4π|r0|) — negligible against retained terms — while evaluations
     below it are counted as truncations and quarantine the case.
  2. **Projection (Trefftz):** |projected bound| ≤ 1e-6 × |bound| (ratio of
     lengths; the inclusive form catches the exactly-degenerate zero-length
     bound).
  3. **Leg coincidence (Trefftz 2-D):** |r| ≤ 1e-6 × |bound| of the leg's own
     panel.
  4. **Pivot:** |pivot| > 1e-10 × max|A| — a dimensionless ratio, homogeneous
     of degree 0 under uniform scaling (strict form rejects exact equality and
     all-zero/NaN matrices, which the old test silently accepted as NaN
     solutions).
  5. **Elimination skip:** removed entirely — a nonzero elimination factor is
     never suppressed (it is already dimensionless; dropping it is an
     unquantified approximation).
- **Also:** `normalize()` now degenerates only on the exact zero vector (it is
  scale free; the old length floor was a further face of the same dimensional
  inconsistency). `slope`/fit/trim keep a documented dimensionless
  (`FIT_EPSILON`) degeneracy check — their contract rework is M0-5 / SOL-09.
- **No floor, clip or Math.abs conceals any value**; the REM-1 truncation
  counter and quarantine are preserved (the counter's discrimination is
  dimensionless and unchanged except that a foot exactly ON a segment endpoint
  is now counted rather than excluded).
- **Status:** implemented; VLM-V5 1e-3..1e3 measured on C_L, C_Di (both
  extractions), C_m and local Γ to ≤ 2e-14 relative (gate 1e-6); SOL-01 remains
  an open finding until independent Sol re-verification.

---

## DEC-M0-4-2 — Value changes caused by the fix are corrections, measured before acceptance

- **Date:** 2026-10-23
- **Task:** M0-4 verification
- **Context:** restoring the truncated terms necessarily moves values that were
  computed with deleted near-field influence. Every moved value was
  independently demonstrated to be the corrected one before any test
  expectation was replaced:
  - pre-fix baseline reproduced the review's scale/elliptic tables byte-for-byte
    (independent script against `src/`, `/tmp/opencode/m0-4/baseline.mjs`);
  - analytic references hold across 1e-3..1e3 after the fix (finite-segment
    velocity −√2/4πs to ≤ 3.1e-16; single-horseshoe D = ρG²/π to ≤ 1.7e-16) —
    the pre-fix kernel returned **exactly 0** for the segment reference at
    1e-3 scale (new kernel-level counterexample, sharper than the review's
    unit-scale analytic check);
  - an independent subagent re-measured scale invariance and physical scaling
    (Γ ∝ VL exactly under V-doubling; F ∝ ρV²L²; M ∝ ρV²L³) with its own
    scripts; a second subagent audited the diff for dimensional consistency,
    degenerate-panel safety, stability and threshold weakening (PASS A–F).
- **Measured corrections (unit scale unless noted):** review scale rows
  c = 0.01/0.001: C_L 2.1210303566535007/1.1567733848183113 → 0.3284736687765…
  (= the c = 1 row to ~2e-16); elliptic 8×64: C_L 0.339624033126678 →
  0.339623957890163 (equals the clean limit OBS-REM-1-1 measured at 10×/1000×
  to ~1e-15); elliptic 12×64/12×96/16×64: C_L moves ≤ 3.5e-7 (504/2386/702
  restored terms), gaps 21.98 % → 22.02 %, 47.92 % → 48.40 %, 165.83 % →
  165.86 % (tip pathology unchanged); elliptic 4×32: C_L moves 6.7e-14. Cases
  with zero pre-fix truncations (SOL-02 badge deltas 1e-6 pins, wing+tail gap,
  PSD eigenmode 1e-12 pin, analytic horseshoe 1e-15 pin) are unchanged and
  their tests pass unmodified.
- **Status:** the three deliberately "known-bad" pins of REM-1 are replaced
  (`tests/solFindings.test.mjs`), with the pre-fix values left frozen in
  `docs/verification/sol/probe-results.json`.

---

## DEC-M0-4-3 — Auto-N prescription made rounding-robust (second root cause of scale dependence)

- **Date:** 2026-10-23
- **Task:** M0-4 (SOL-01, found during VLM-V5 verification)
- **Context:** the prescribed count N = max(16, 2·M·ceil(AR/2)) is
  integer-valued and discontinuous, while the computed aspect ratio carries
  ~1 ulp of rounding whose direction varies with geometry scale. Measured:
  wing+tail tail at 0.1× computes AR = 6.000000000000001 → ceil jumps 3 → 4 →
  N = 32 instead of 24 (coefficients move 3.2e-4/1.0e-4/2.8e-3 in
  C_L/C_Di/C_m); a tapered+swept+dihedral case at 1e-3× computes AR =
  10.000000000000002 → N = 48 instead of 40 (C_L off 9.9e-4 at that scale).
  Non-monotone in scale — the lattice choice, not the physics, changed.
- **Decision:** `ceilPrescribedRatio` snaps the ratio to its nearest integer
  when within 8·eps·max(1,|ratio|) (~12 ulps) before the ceil, so the lattice
  is a function of the exact geometry ratio. Genuinely fractional ratios are
  untouched; no physics value is adjusted. Without this, VLM-V5 scale
  invariance cannot honestly be claimed for auto-N fixtures at integer AR/2
  boundaries (which include AR = 6/8/10 planforms).
- **Verification:** `tests/vlmOracles.test.mjs` "VLM-V5: the auto-N
  prescription lattice is scale invariant" (review fixture M=4 auto N=32,
  8 scales 1e-3..1e3, plus the tail AR = 6 boundary at 0.1×). Measured
  post-fix drift ≤ 1.1e-14 with constant panel counts for wing+tail (224),
  tapered/swept/dihedral (160) and rectangular auto-N (128) across
  1e-3..1e3.
- **Status:** implemented and tested; recorded because it is a second,
  independent scale-dependence mechanism beyond the cutoffs the review named.

---

## OBS-M0-4-1 — Protocol clarification for OBS-REM-1-1's elliptic drift numbers

- **Date:** 2026-10-23
- **Task:** M0-4 verification
- **Observation:** OBS-REM-1-1's drift figures (8×64 elliptic: 1.43e-6 C_L,
  2.43e-6 C_Di, 9.65e-7 C_m at 1× vs 1000×; 4.4e-4/3.1e-2 at 0.1×) reproduce
  exactly with the REM-1 scratch script — but that script passed
  `wakeLengthFactor: 100 * b` with b already scaled, so the wake length grew
  ∝ s² (100 b·s), not "scaled together" as the disposition text states. Under
  strictly proportional scaling (wake ∝ s, the geometrically similar
  protocol VLM-V5 requires) the 1× truncation drift is 2.2e-7 (C_L) / 1.1e-8
  (C_Di) / 1.6e-7 (C_m) — the same order and the same conclusion (marginal vs
  the 1e-6 gate; 0.1×/0.01× fully corrupted). Both protocols were measured
  before the fix (`/tmp/opencode/m0-4/baseline-pre-fix.json`,
  `/tmp/opencode/sol-replay/elliptic-scale-drift.mjs`).
- **Impact:** none on the disposition's conclusion; the wake-scaling wording is
  corrected here so independent re-verification is not surprised. The M0-4
  tests use the proportional protocol.
- **Status:** Recorded; closed as a documentation clarification.

---

## OBS-M0-4-2 — Post-fix behaviour of the Sol reproduction scripts (M0-4)

- **Date:** 2026-10-23
- **Task:** M0-4 verification
- **Observation:** Sol's scripts, run unmodified in the scratch mirror against
  the M0-4 code (`/tmp/opencode/sol-replay/probes-postfix-m04.txt`), differ
  from the frozen pre-REM-1 evidence in 34 of 52 probe entries. Field-level
  classification — every difference is accounted for:
  - **M0-4 corrections (intended):** the corrupted `scale` rows (c = 0.01/0.001)
    and the `elliptic-tip` rows carry the corrected scale-invariant values
    (e.g. scale 0.01: C_L 2.121 → 0.3285, e 0.9625 → 1.0016, min Γ −0.1148 →
    0.00251, max panel force 0.1008 N → 0.00505 N, pivot ratio 0.169 → 0.811);
    truncation counters are 0;
  - **REM-1-documented (unchanged semantics):** added validity/diagnostics/
    badge fields (`claim`, `currentGrid`, `inputIdentity`, `coverage`,
    `kernelTruncations`, `uncertaintyScope`), status flips, the de-categorised
    negative-drag message (`analytic-drag.mjs` `psdError`, OBS-REM-1-3);
  - **benign last-digit drift:** `diagnostics` pivot/residual digits on entries
    whose coefficient values are byte-identical — caused by removing the
    elimination-factor skip (DEC-M0-4-1.5).
  16 entries are byte-identical. `analytic-drag.mjs` analytic values are
  byte-identical (only the message text differs).
- **Status:** Recorded so independent re-verification is not surprised; the
  frozen evidence in `docs/verification/sol/` is untouched and remains the
  authoritative record of the findings.

---

# Sol review remediation (REM-2 cycle continued — SOL-06, 2026-10-23)

Entries for SOL-06 (drag significance and numerical cancellation policy), the
second REM-2 task. Dispositions and traceability in
[`SOL_FINDING_DISPOSITIONS.md`](SOL_FINDING_DISPOSITIONS.md). The review
evidence under `docs/verification/sol/` is immutable; nothing below edits it.

---

## DEC-SOL-06-1 — The cancellation tolerance is the forward error of the evaluated sums, never qS

- **Date:** 2026-10-23
- **Task:** SOL-06 (REM-2)
- **Context:** SOL-06 reproduced at HEAD: `max(1e-6 * sum|terms|, 1e-9 * qS)`
  erased resolved drag (alpha = 0.001 deg reported C_Di = 0 with nonzero Gamma
  against a true 2.63954e-10) and let the reference area mask a resolved
  negative force (supplied -1 N: rejected at qS = 1, silently zeroed at
  qS = 1e12; the analytic 1/pi horseshoe drag overwritten to 0 at qS = 1e12;
  `solveVlmCase` drag zeroed at `refAreaM2 = 1e12`). Both counterexamples were
  reproduced byte-for-byte against the frozen probe evidence before any change
  (`/tmp/opencode/sol-06/pre-fix-results.json`).
- **Decision:** the only tolerance admitted on a drag value is a NEWTONS
  forward-error bound of the arithmetic that produced it: gamma_n *
  sum|terms| for the accumulation plus per-term/per-leg counted IEEE operation
  chains (unit roundoff u = 2^-53) acting on magnitudes that dominate the term
  (`sum|contribution|` factors), plus the coordinate-translation amplification
  of DEC-SOL-06-4. qS is legal only in coefficient arithmetic (cl/cdi*/cm).
  Dimensionally the tolerance is a force and scales with the force scale, so
  suppression decisions are scale invariant (pinned 1e-3..1e3).
- **Consequences:** reference-area invariance holds by construction (bitwise
  identical dimensional outputs and detection at `refAreaM2` 1/8/1e12, pinned);
  alpha = 0.001/0.0001 deg report their true tiny drags (C_Di follows
  k·sin²alpha across four decades to ~1e-8 relative; e is finite again — the
  former dead band produced infinite derived efficiency); a resolved negative
  drag raises at every qS with a byte-identical message declaring the tolerance
  size. No floor, clip or `Math.abs` replaces the old floor.
- **Status:** Implemented and independently verified (two audit subagents +
  independent high-precision re-verification; the first verification round
  falsified the bound's completeness in extreme coordinate regimes and drove
  DEC-SOL-06-4). Pending Sol re-verification; the finding is not closed.

## DEC-SOL-06-2 — Unresolved drag is reported as exactly 0 only with an explicit, size-declared suppression

- **Date:** 2026-10-23
- **Task:** SOL-06 (REM-2)
- **Decision:** raw signed dimensional values are always preserved
  (`dragNTrefftzRaw`, `dragNNearFieldRaw` in `trefftzDrag` and `solveVlmCase`
  outputs). A value inside the worst-case forward-error bound cannot be
  PROVEN resolvable from zero at double precision (numerically unresolved
  within that bound), not insignificant: it is reported as exactly 0 and
  the result carries `{ suppressedToZero: true, reason, toleranceN }`
  (`trefftzSuppression` / `nearFieldSuppression`), the reason declaring the
  tolerance size and the raw field; `solveVlmCase` additionally warns
  ("SOL-06: ... numerically unresolved and reported as exactly 0 ..."). A raw
  value of exactly 0 (including -0, normalised on report) is a genuine zero
  with `suppressedToZero: false` — nothing is suppressed without evidence.
  The near-field/Trefftz `relativeDifference` becomes NaN ("not comparable")
  whenever either extraction is unresolved, instead of the former spurious
  0 or -1; both-zero raws give 0. The old assertion
  `Number.isFinite(relativeDifference)` on suppressed values was replaced by
  the documented NaN contract (the only assertion replaced in the diff).
- **Status:** Implemented; pinned regressions cover raw preservation, flag and
  size declaration, qS-invariance of all of it, and the physical zero case
  (zero-circulation solve, not injected scalars). Pending Sol re-verification.

## DEC-SOL-06-3 — Supplied drag values carry their own error budget; nothing is suppressed without a basis

- **Date:** 2026-10-23
- **Task:** SOL-06 (REM-2)
- **Decision:** a caller-supplied `nearFieldDragN` may be accompanied by
  `nearFieldErrorBudgetN` (its own computation's forward error — `solveVlmCase`
  passes the budget of its force projection). Without a caller budget the
  companion Trefftz budget is the declared fallback basis (named in the
  suppression reason). With NO basis at all (empty sums, budget 0) nothing is
  ever suppressed: the raw value is reported as-is and a resolved negative one
  raises — suppression requires evidence. Supplied non-finite drags and
  malformed budgets fail loudly (SOL-10 consistency: missing scientific data
  is never treated as "not supplied").
- **Status:** Implemented; pinned (the review's `roundoff-floor` probe rejects
  -1 N identically at qS = 1 and 1e12; the zero-basis case rejects -1e-30 N).
  Pending Sol re-verification.

## DEC-SOL-06-4 — Bound composition, coordinate-translation amplification, and documented scope

- **Date:** 2026-10-23
- **Task:** SOL-06 (REM-2)
- **Context:** the first implementation of DEC-SOL-06-1 (operation counts +
  term magnitudes only) was independently falsified by a high-precision
  re-verification (`/tmp/opencode/sol-06-verify/`): projections and point
  differences act on coordinate magnitudes |p| and leave absolute error
  ~ u·|p| in the differences r the kernels divide by — uncounted, the bound
  under-covered by 4.4x on a 128-panel wing at 1e9 m coordinate offset
  (2.7e6x at 1.3e12 m; a realistic regime for a georeferenced aircraft
  platform).
- **Decision:** the counted basis now includes this amplification as
  `DISTANCE_ERROR_SENSITIVITY * OPS_PER_PROJECTION * sum|p| / |r|` per kernel
  evaluation (dimensionless, scale invariant; distances floored at the
  relative singularity cutoffs below which terms are already truncated and
  counted). A second independent re-verification round (518 cases, exact
  arithmetic) then falsified the FIRST amplification implementation for
  over-counting each leg's factor against the sum of all leg magnitudes
  (~leg-count over-count; false suppression onset at ~6e9 m coordinates) —
  the bookkeeping now weights each leg's factor by its own contribution
  magnitude, and the amplification factors divide before multiplying (no
  intermediate overflow). Documented scope of the bound (OBS-SOL-06-1): it is
  a WORST-CASE forward-error bound (typically 1e4–1e7 above the measured
  actual error); values inside it cannot be PROVEN resolvable from zero and
  are suppressed only with the explicit flag and preserved raw; it does not
  model (C) over/underflow outside the double range: non-finite raw values or
  tolerances fail loudly ("drag evaluation is not finite"), and
  subnormal-range quadratic outputs (e.g. Gamma = 1e-300 → true ~1e-601 N
  underflowing to a computed 0) remain outside the Tier-0 regime.
- **Status:** Implemented; the second independent re-verification round
  (518 cases; `/tmp/opencode/sol-06-verify2/`) closed every round-1 falsifier
  (Class A coverage margins 757×–1.6e11×; the Class B slanted-panel family now
  2180×–1.05e6×) with worst margin anywhere 38.2× (still ≥ 1: the bound
  holds), 0 wrong throws and 0 wrong suppressions in 456 adversarial
  evaluations, and no dead band at the probe/scale configurations
  (tolerance/drag = 5.9e-12 probe / 1.5e-12 unit wing at normal coordinates,
  preserved at every scale and every alpha — the ratio is Γ²-homogeneous, so
  the true tiny drags survive at offsets too). At coordinate offsets the bound
  tightness degrades proportionally to |coords|/|element| as the worst-case
  double-precision resolution demands (tolerance/drag 3.6e-9 @ 1e3 m,
  3.6e-6 @ 1e6 m, 3.6e-3 @ 1e9 m on the probe lattice); suppression of
  normal-scale drag begins only where the worst-case bound itself reaches the
  drag (≳ 3e11 m coordinates on the probe lattice) and is always flagged with
  the raw preserved. Pending Sol re-verification.

## OBS-SOL-06-1 — Residual scope of the cancellation tolerance (preserved for review)

- **Date:** 2026-10-23
- **Task:** SOL-06 verification (two independent exact-arithmetic rounds:
  `/tmp/opencode/sol-06-verify/` and `/tmp/opencode/sol-06-verify2/`)
- **Observation:** preserved residuals of the DEC-SOL-06-1/4 bound:
  1. **Worst-case tightness and the suppression horizon.** The bound is a
     worst-case forward-error bound; measured actual errors lie 1e4–1e7 below
     it in adversarial families (e.g. an offset-1e9 configuration with true
     error 1.2e-14 N against a bound of 1.0e-4 N). Its tightness degrades with
     the dimensionless coordinate ratio |p|/|element| exactly as double
     precision demands (tolerance/drag 5.9e-12 at normal coordinates,
     3.6e-9 at 1e3 m, 3.6e-6 at 1e6 m, 3.6e-3 at 1e9 m offsets on the probe
     lattice). Consequently "suppressed" means "not PROVABLY resolvable from
     zero within the worst-case bound", never "measured noise": a normal-scale
     drag is suppressed only where the bound itself reaches it (≳ 3e11 m
     coordinates on the probe lattice) and then the flag, the bound size and
     the raw value are all exposed. Genuine tiny drags survive at every tested
     offset (the tolerance/drag ratio is Γ²-homogeneous, so α = 0.001° drags
     are reported wherever the α = 5° drag is).
  2. (Class B) the 3-D segment kernel's internal cancellation for
     near-parallel far alignments is not modelled in the bound, but the
     coordinate-translation term now covers the measured slanted-panel family
     incidentally (margins 2180×–1.05e6×; the first bound under-covered it
     4.7×). The documented exclusion is conservative, not load-bearing.
  3. (Class C) over/underflow outside the quadratic working range:
     normal-range inputs with underflowing quadratic OUTPUTS (circulation
     1e-300 → true drag ~3.2e-601 N computed as 0 with a 0 bound, reported as
     an exact zero; 1e-160 → subnormal) are outside the Tier-0 regime and
     unflagged; non-finite inputs, raw values or tolerances fail loudly
     ("... is not finite"). Two loud-rejection corners remain: a finite raw
     drag whose bound overflows to Infinity (circulation ≳ 2e153 pre-tightening,
     moved up by the leg-weighted bookkeeping) and an amplification-factor
     overflow at |coords| ≳ 5e306 (NaN bound) — both throw instead of the old
     silent 0, both far outside physical inputs.
  4. The 1 % near-field/Trefftz gate is bypassed ("not comparable", NaN) when
     either extraction is suppressed; the SOL-06 suppression warning then
     carries the information. Pre-existing in kind (the old snap produced a
     NaN or a spurious -100 % there too). Byte-level pins of the frozen Sol
     probe values (tests/solFindings.test.mjs alpha rows; the 1/pi horseshoe)
     are environment-pinned to Node 24 as the rest of the suite's byte pins;
     all physical claims carry explicit relative tolerances.
- **Status:** Recorded, unresolved; none of these hides a value (raws are
  preserved and suppression is flagged). For Sol's independent assessment.

## OBS-SOL-06-2 — Post-fix behaviour of the Sol reproduction scripts (SOL-06)

- **Date:** 2026-10-23
- **Task:** SOL-06 verification
- **Observation:** Sol's `probes.mjs`, run unmodified in the scratch mirror
  (`/tmp/opencode/sol-replay/probes-postfix-sol06b.txt`; it still stops at the
  `nonfinite-gamma` probe by design of the SOL-10 fix — OBS-REM-1-3), differs
  from the M0-4 post-fix run (`probes-postfix-m04.txt`) in exactly 4 of 50
  entries, all intended SOL-06 corrections:
  - `alpha` 0.0001: C_Di 0 → 2.6395419879644464e-12, e null (infinite) →
    1.0021985739958723, C_Di,NF 0 → 2.6378937892913686e-12, gap 0 →
    −0.0006244260104946481;
  - `alpha` 0.001: C_Di 0 → 2.639541990860498e-10 (the review's quadratic
    prediction: 2.63954e-10), e null → 1.002198573922262, C_Di,NF 0 →
    2.6378937921857406e-10, gap 0 → −0.0006244260104459777;
  - `roundoff-floor` qS = 1 and qS = 1e12: both now raise the identical
    message declaring the cancellation tolerance (3.04e-15 N after the
    leg-weighted DEC-SOL-06-4 tightening; 2.23e-15 N before it) — error
    detection no longer depends on qS.
  All other rows (including `single-horseshoe` = 1/pi and
  `reference-normalization`) are byte-identical to the M0-4 post-fix run; the
  alpha rows' linear solutions (cl, Gamma, panel forces, pivot/residual) are
  byte-identical to the frozen review evidence. `analytic-drag.mjs` values are
  byte-identical (only the psdError message now declares its tolerance).
- **Status:** Recorded; the frozen evidence in `docs/verification/sol/` is
  untouched and remains the authoritative record of the findings.

---

# M0-3 cycle (sweep conversion verification + incidence/c-4 convention, 2026-10-23)

## DEC-M0-3-1 — Incidence rotates each section about its local quarter-chord point (review §7.2)

- **Date:** 2026-10-23
- **Task:** M0-3 (review §7.2 item 2; recorded resolution, per the review's
  "do not silently alter the incidence pivot" condition — this entry is the
  explicit resolution it demands; the frozen review is not edited).
- **Issue (reproduced before any change):** `sectionAt` places the unrotated
  section LE and `generateVlmPanels` rotated the section about that LE point:
  `P(f) = LE + f·c·d`, `d = (cos i, 0, −sin i)`. The projected quarter-chord
  locus is then `x_c/4,proj(y) = x_c/4(y) + c(y)(cos i − 1)/4` — the c/4 line
  of the generated panels is **not** the input sweep on a tapered planform and
  is not even straight (the deviation term varies with c(y)). Reproduced
  byte-for-byte against the frozen Sol probe evidence (b = 8, cr = 1,
  ct = 0.3, Λ = 25°, M = 1, N = 8): measured c/4 sweep 25.007834540617555 /
  25.031272567124777 / 25.070117968128535° at i = 5/10/15° (review §7.2:
  25.03127/25.07012). An independent analytic replica
  `tan Λ_meas = tan Λ + (c_r − c_t)(1 − cos i)/(2b)` matches those values to
  2e-14° — the discrepancy is fully explained, not numerical noise.
- **Contract analysis (authority: DATA_CONTRACTS > MASTER > PHASED > TEST
  MATRIX > HANDOFF):**
  1. DATA_CONTRACTS §2.7 "Sweep input: Λ is defined at c/4" and the audit
     correction D-04/DR-21 (B-VLM-03) mean the input is the **quarter-chord
     sweep of the generated surface** — the same defect class as the pre-M0-2
     LE-sweep misreading reappears at nonzero incidence under an LE pivot;
  2. DATA_CONTRACTS §3.2 fixes the project's section-rotation convention:
     "applied as a rotation about +y **through the local c/4 point**" (stated
     for twist; incidence is the uniform-incidence special case of the same
     rotation, the only section-angle parameter in Tier-0);
  3. VLM-V6 ("measured c/4 line of the generated panels = Λ input ± 0.01°")
     and GEO-T4 ("c/4 sweep ... within 0.05°", measured from generated
     LE/TE vertices via `q = LE + 0.25(TE − LE)`) are measure-backs on the
     **generated** geometry; both hold exactly at any section angle under a
     c/4 pivot and fail on tapered planforms under an LE pivot (the review
     measured VLM-V6 failing from i = 5.65° onward in its own case);
  4. parameter orthogonality: setting surface incidence must not change the
     measured planform sweep of a design-tool parameterization;
  5. Sol's own probe declares `expectedSweep: 25` incidence-independently.
- **Decision:** incidence rotates each section about its local quarter-chord
  point. With q the unrotated local c/4 anchor, `P(f) = q + (f − 1/4)·c·d`;
  implemented as the old expression plus the shift `(c/4)(1 − cos i, 0, sin i)`
  (exactly zero at i = 0, so zero-incidence lattices are identical to the
  pre-M0-3 code to the last bit). The measured projected c/4 line is now
  exactly the input sweep at any incidence (VLM-V6 with incidence to
  ±1.4e-14° measured).
- **Consequences recorded (honest scope):**
  - DATA_CONTRACTS §2.7's conversion `tan Λ_LE = tan Λ_c/4 + (c_r − c_t)/(2b)`
    is the **planform definition** — exact as the projected LE line at i = 0.
    At i ≠ 0 the projected LE locus of the rotated surface is
    `tan Λ_LE(i) = tan Λ_c/4 + ((c_r − c_t)/(2b)) cos i` (a rigid rotation
    cannot keep both the projected c/4 and LE lines of a tapered section at
    their unrotated slopes); this exact consequence is asserted in the tests,
    and the c/4 line — the contracted parameter — is the invariant one;
  - **residual ambiguity preserved (not hidden):** the matrix rows as scoped
    are zero-incidence (where both pivots coincide), and a defensible
    "LE pivot intended" reading would require four conjunctive assumptions
    (matrix silence at incidence, §2.7 read as an all-incidence LE identity,
    §3.2 scoped to twist only, and VLM-V6 scoped to i = 0); an independent
    derivation judged that reading strictly weaker but not logically
    impossible. The c/4 pivot is chosen on grounds (1)-(5) above. Sol may
    re-decide; nothing in the frozen evidence was altered;
  - nonzero-incidence results move slightly (the demo wing has i = 2°): this
    is the intended correction, measured and recorded, not a threshold move.
- **Status:** Implemented (`5eb07d7`); verified independently (see
  OBS-M0-3-1/2); **pending Sol re-verification**.

## DEC-M0-3-2 — VLM-V6 executed with incidence; measure-back methodology

- **Date:** 2026-10-23
- **Task:** M0-3
- **Decisions:**
  - VLM-V6 is executed **with incidence and multi-row lattices** (the approved
    M0-3 requirement; the review notes "Existing VLM-V6 only uses zero
    incidence and M = 1"). The VALIDATION_AND_TEST_MATRIX row itself is an
    approved plan document and is not edited; the extension is recorded here.
  - Measure-back uses **only generated panel vertices**. For a strip with M
    rows (bound vortex of row k at chord fraction (k + 0.25)/M of the edge
    section): the edge quarter point is
    `q = bound(row 0) + 0.25·(bound(row M−1) − bound(row 0))` (valid for any
    M ≥ 1), and for M ≥ 2 the edge LE/TE follow from the same two rows
    (`LE = bound(row 0) − (0.25/(M−1))·Δ`, `TE = bound(row M−1) +
    (0.75/(M−1))·Δ`, `Δ = bound(row M−1) − bound(row 0)`). Absolute anchors
    (x_LE,root + c_r/4 + |y| tan Λ, z_root + |y| tan Γ) are checked separately
    so the tests are not self-referential.
  - Gates are the approved gates, not loosened: VLM-V6 ± 0.01°; straightness
    asserted at every strip edge; the exact incidence-invariance of the
    measured sweep is asserted additionally at 1e-9° (a strengthening).
- **Status:** Implemented in `tests/vlmSolver.test.mjs` ("M0-3" groups × 7).

## OBS-M0-3-1 — Pre-change reproduction and Sol replay diff

- **Date:** 2026-10-23
- **Task:** M0-3
- **Observation:** (a) Pre-change reproduction is byte-for-byte against the
  frozen `probe-results.json` `incidence-sweep` rows (24.999999999999996 /
  25.007834540617555 / 25.031272567124777 / 25.070117968128535 at i =
  0/5/10/15). (b) Post-change Sol replay in the scratch mirror
  (`/tmp/opencode/sol-replay/probes-postfix-m0-3.txt`; script unmodified,
  still stops at `nonfinite-gamma` — OBS-REM-1-3) differs from the SOL-06
  run in **exactly 3 of 50 rows**, all the nonzero-incidence
  `incidence-sweep` rows: 25.007834540617555 → 24.999999999999986,
  25.031272567124777 → 24.999999999999996, 25.070117968128535 →
  24.999999999999986 — i.e. exactly the review §7.2 correction, landing on
  the probe's own `expectedSweep: 25` to ±1.4e-14. The i = 0 row is
  byte-identical; every other row is byte-identical.
- **Status:** Recorded; frozen evidence untouched.

## OBS-M0-3-2 — Alpha/incidence equivalence residual on swept planforms (characterized)

- **Date:** 2026-10-23
- **Task:** M0-3 verification (independent subagent)
- **Observation:** On a rectangular unswept wing, C_L(α = 0, i) equals
  C_L(α = i, 0) to 1.0e-15 relative (rigid-rotation equivalence: the local
  c/4 points are collinear on the rotation axis) — incidence is exactly "the
  same angle" as alpha there. On swept/tapered planforms the two differ by
  8.1e-5 (i = 1°) to 3.4e-2 (i = 30°) of C_L: per-station rotation about the
  local c/4 (the §3.2 convention) is not a single-axis rigid rotation of the
  whole surface; the wedge is analytically an effective dihedral increment
  ΔΓ ≈ atan(tanΛ·sin i), predicting ΔC_L/C_L ≈ (tanΛ sin i)² = 4.2e-3 vs
  4.57e-3 measured at i = 8°. This is inherent to the contract's rotation
  convention (also true for §3.2 twist), not a defect of the implementation.
- **Status:** Recorded; relevant for M2 geometry (GEO-T4 at twist) and for any
  future alpha-vs-incidence comparison; no Tier-0 output claims hinge on it.

## OBS-M0-3-3 — Scratch-artifact tolerance mismatch in the SOL-06 analytic replay (explained)

- **Date:** 2026-10-23
- **Task:** M0-3 verification
- **Observation:** The SOL-06-cycle scratch file `analytic-postfix-sol06.txt`
  declares `psdError ... numerical cancellation tolerance 2.8575041107239655e-12 N`,
  while the committed HEAD code (before any M0-3 change) yields
  3.2047748868928183e-13 N on the same frozen inputs. A pre-change checkout
  (`git show HEAD:src/vlmSolver.js`) reproduces 3.2047748868928183e-13
  byte-for-byte, so the scratch file predates the final leg-weighted
  DEC-SOL-06-4 tightening (the same mid-turn movement as the OBS-SOL-06-2
  note "3.04e-15 N after the tightening; 2.23e-15 N before it"). The reported
  drag D is byte-identical in all runs; no repository evidence is affected;
  M0-3 did not touch the tolerance code (the diff audit confirms it absent
  from the change).
- **Status:** Recorded for evidence hygiene so the scratch discrepancy does
  not confuse re-verification.

---

## DEC-M0-5-1 — "Converged points" for the Tier-0 fit window, and flat-window semantics

- **Date:** 2026-10-23
- **Task:** M0-5 (SOL-09 fit/trim contract)
- **Context:** DATA_CONTRACTS §2.5 requires "≥ 3 converged points in the fit
  window" and §2.6 excludes unconverged points from fits. The Tier-0 VLM is a
  direct linear solve — there is no iteration whose convergence could be
  tested — so the CFD convergence gate (§7.3) has no Tier-0 analogue.
- **Decision (interpretation, recorded — not silent):** a Tier-0 point counts
  as **converged** iff its per-case validity status is not "invalid" (it is not
  quarantined by the SOL-01/SOL-03 gates) and its coefficients are finite.
  Warning-level points (SOL-06 suppression, coarse spacing, VLM-V8 seed) count
  as converged — a flagged value is not an unconverged one. Quarantined points
  are excluded exactly like unconverged CFD points; retained points form the
  adjacent pairs (a quarantine gap makes one wider pair, the contract's
  "adjacent"). If Sol defines a Tier-0 residual convergence gate later, this
  mapping is the only line to change.
- **Flat-window semantics (recorded with it):** a window whose response is
  exactly constant passes the adjacent-pair test trivially (all pair slopes are
  exactly the least-squares slope 0) and is **certified** as slope 0 — a flat
  response is linear. The separate `FIT_EPSILON` degeneracy check then keeps
  trim and the verdict "not determined" (a zero C_m slope defines no trim
  root), so no silent verdict can arise. A zero least-squares slope with
  *varying* data has a zero-width relative band and is judged "non-linear: not
  determined" (limitation, OBS-M0-5-3).
- **Status:** implemented (`runVlmSweep` converged filter); pinned by the
  quarantined-point test (SOL-09 group) and the flat-window synthetic test.

## DEC-M0-5-2 — C_L(α_trim) for the positive-lift gate is evaluated from converged samples

- **Date:** 2026-10-23
- **Task:** M0-5 (SOL-09 trim contract)
- **Context:** §2.5 reports α_trim "only if C_L(α_trim) > 0 and α_trim lies
  inside the sweep". C_L exists only at sampled α, so the sign test needs a
  defined evaluation at the fitted root. Two candidates: the fitted C_L line
  (certified only inside the fit window; extrapolated outside it) or the
  sampled C_L series (data everywhere inside the sweep).
- **Decision:** piecewise-linear evaluation from **converged sampled C_L**
  (exact sample when one sits at α_trim; bracketing interpolation otherwise;
  "not determined: no converged C_L sample brackets alpha_trim" when none
  does). Never drawn or exported as a sample. Rationale: the gate is a
  data-based domain check, not part of the linear model; sampled data is the
  only C_L evidence that exists over the whole sweep. Under certified
  linearity the two candidates cannot disagree on the sign inside the window,
  so the choice cannot hide a disagreement the contract would resolve
  differently.
- **Status:** implemented (`sampledClAt`); round-trip tests re-check the gate
  with an independent test-side interpolation (SOL-09 group).

## DEC-M0-5-3 — The in-sweep trim gate is inclusive at the boundary, with a 1e-9° representation tolerance

- **Date:** 2026-10-23
- **Task:** M0-5 (SOL-09 trim contract) — resolves a discrepancy flagged by
  BOTH independent verification rounds (adversarial review N3; math
  verification "EDGE 2").
- **Context:** "α_trim lies inside the sweep" must be evaluated on floats: the
  sampled range endpoints are accumulated values and the fitted root carries
  ~1e-15° relative rounding. A strictly literal float comparison would
  withhold a root that is mathematically AT the boundary (a false "not
  determined" in the safe direction); an unbounded tolerance would admit
  extrapolated trims (the unsafe direction the frozen counterexamples
  exploited at 40-60° out of range).
- **Decision:** inclusive comparison against the ACTUAL sampled extremes with
  a ±1e-9° representation tolerance (the same accumulation convention the
  sweep loop already uses at its end). A root more than 1e-9° outside the
  sampled sweep is never reported. Both directions are pinned by tests (root
  at the boundary reported; at boundary + 1e-6° withheld). The residual
  literal deviation (≤ 1e-9°, physically nil) is disclosed here for Sol to
  re-decide rather than silently chosen away.
- **Status:** implemented; frozen counterexamples unaffected (42.7°/64.3° out).

## DEC-M0-5-4 — The stability-verdict rule set is enforced at the solver source (STAB-V2/STAB-V3 elements pulled forward, explicitly)

- **Date:** 2026-10-23
- **Task:** M0-5 — scope movement recorded per the "never silently absorb
  another task" rule.
- **Context:** M0-5's acceptance says "no NaN and no 'Unstable'" and the
  adversarial review (S4) showed that a bare `stable: false` from the solver
  can still render "Unstable" whenever the fit is certified, bypassing the
  §2.5 verdict rules 1/2/4 (H-tail present, mass source ≠ assumedUniform,
  model description printed) — the frozen SOL-07 item 2 defect class. Those
  rules were scheduled as M0a display work (STAB-V2/STAB-V3). The codebase has
  **no mass-provenance concept at all** (every manifest is the default
  uniform-density lump), so condition 2 can never be satisfied today.
- **Decision:** implement the §2.5 verdict gate at its SOURCE now: the bare
  `stable` boolean is removed; the solver exposes `cmSlopeNegative` (slope
  sign, a fact) and `stabilityVerdict` = "determined"/"not determined", the
  latter unless the fit is certified AND the caller supplies
  {horizontalStabilizerPresent, massSource ≠ "assumedUniform", modelDescription}.
  Unmet conditions are named in the record; the app renders the verdict with
  its model description (rule 4) or "not determined — <unmet conditions>".
  Because mass provenance does not exist yet, the app passes
  `massSource: "assumedUniform"` honestly and every verdict is withheld —
  "withhold invalid stability verdicts" (review §8.3) is satisfied in the only
  way the current data permits.
- **Consequences (recorded):** STAB-V2/STAB-V3 matrix rows are now partially
  implemented ahead of their M0a schedule but remain covered only by the M0-5
  solver-level tests, not by their own matrix tests — they stay open work with
  a reduced scope (mass provenance + verdict display polish + matrix tests).
  M0a's display quarantine (SOL-07 item 2) is thereby narrowed but not
  closed. `computeStaticStability` (stability.js) still computes its own
  slope-based `stable` for the M8-era linear model and is NOT wired to VLM
  output — do not connect it without a null gate (reviewer nit N6).
- **Status:** implemented (`resolveStabilityVerdict`, `TIER0_MODEL_DESCRIPTION`);
  pinned by the verdict rule-set test (VLM-V7 group).

## OBS-M0-5-1 — Pre-change reproduction and Sol replay diff (M0-5)

- The three frozen `fit-trim` rows of `probe-results.json` reproduce
  **byte-for-byte** on pre-change code (`/tmp/opencode/m0-5/repro-fit-trim.mjs`),
  including trim −42.68825231435979° / −64.31108697968388° and the zero slopes
  with `stable: false` + validity "ok". The root causes are confirmed by the
  code path (nearest-sample intercept; `slope()` returning 0 for short windows)
  and by independent derivation (the sampled-neighbour intercept is off by
  1.4e-2 from the true least-squares intercept on the 2..6° window).
- Post-fix Sol replay (scratch mirror `/tmp/opencode/sol-replay`, evidence
  untouched): **exactly 5 of 50 rows changed** versus the previous post-fix run
  (`probes-postfix-m0-3.txt`): the three `fit-trim` rows (the counterexamples),
  the `moment-reference` row's x = 0.25 entry (OBS-M0-5-2), and the
  `badge-baseline` r1/r2 field rename `clAlphaPerRad` →
  `clAlphaTwoPointPerRad` with **bit-identical values** (4.705038725518481 /
  4.692784236045663). All physics rows — M0-1 drag, M0-4 scale tables, SOL-06
  alpha/dead-band rows, M0-3 incidence rows — byte-identical.
- Certified-slope arithmetic is preserved exactly: the 2..6° window still
  reports C_Lα = 4.74608826502212 (frozen value, pinned at 1e-12 in tests).

## OBS-M0-5-2 — The C_m window at the quarter-chord reference is measurably non-linear (characterized, not fixed)

- **Finding (measured):** for the planar rectangular wing with the moment
  reference at the quarter chord (the aerodynamic centre), C_m(α) in the
  |α| ≤ 5° window is not linear at the contract's 5 % adjacent-pair level: the
  least-squares slope is ≈ 4.8e-4/deg while the adjacent-pair slopes deviate up
  to ≈ 6e-4/deg (20.7 % of the slope at step 2; the deviation converges to
  ~3e-4/deg as the step refines — genuine curvature of the computed moment
  curve, not roundoff: the adjacent slopes vary smoothly with α). The frozen
  `moment-reference` probe row therefore now reports `cmAlpha: null, np: null`
  at x = 0.25 while x = 0 and x = 0.5 rows are unchanged and still yield
  x_NP ≈ 0.24376/0.24441 c.
- **Interpretation:** dC_m/dα ≈ 0 at the AC; the window data is
  curvature-dominated, so a linear derivative cannot be certified at 5 %
  relative precision — "non-linear: not determined" (RB-21) is the contract's
  honest outcome, and SM/NP from that window would be indistinguishable from
  noise. The pre-fix values were produced by fits that fail the contract's own
  linearity test. Alternative reading preserved for Sol: one could argue a
  near-zero slope deserves a special "marginal" classification rather than
  "non-linear"; the contract text does not provide one, and none was invented.
- **Scope:** affects only references within ~1 % chord of the AC on
  near-planar wings (measured: x = 0.20 still passes at 3.3 % deviation; real
  configurations with tails pass comfortably — demo-shaped case 1.5 %).
  Consequence for displayed results: "Cm alpha: not determined" instead of a
  fabricated derivative — no value is adjusted.

## OBS-M0-5-3 — Residual numerical limitations carried out of the review rounds

- **Relative band degenerates at exactly-zero slope:** the 5 % band has zero
  width when the least-squares slope is exactly 0; any varying data is then
  judged non-linear (recorded in DEC-M0-5-1). A slope of exactly 0 with exactly
  flat data is certified (documented semantics). No additive floor was added to
  the band (that would weaken the contract).
- **Degenerate abscissae:** `linearFit` forces slope 0 when the window's x
  spread underflows `FIT_EPSILON` (all α equal); such a window is judged
  against that slope and is practically always "non-linear". Unreachable
  through `runVlmSweep` (α accumulates strictly); reachable only through the
  exported primitive.
- **refChordM is not a pure coefficient knob:** it also sets the wake-length
  floor (≥ 20·c̄), so absurd reference chords legitimately quarantine the case
  (discovered while building the scale-free band test, which uses `refAreaM2`
  instead). Not a defect; recorded so a future reviewer does not read the
  quarantine as a fit regression.
- **App rendering is untested by construction** (no DOM harness): the "no
  Unstable / no NaN / verdict-with-description" display rules were smoke-tested
  manually in the browser this cycle (demo + 6..12° window) but remain without
  an automated regression (M0a work: display test harness).
- **Reviewer findings disposition:** adversarial review S1 (band pinning) →
  synthetic boundary tests + constant assertions; S2 (VLM-V8 flip) → test
  rewritten on an "ok" baseline with bit-equal derived fields; S3 (message
  wording) → per-response/per-status messages; S4 (bare verdict) →
  DEC-M0-5-4; S5 (`common` shadowing) → renamed + cd0/cm0 invariance pinned
  (the claimed input loss was notional: the options spread carries cd0/cm0 and
  they cannot move a VLM-V3 delta); math-verification findings M1 (message
  over-claim) → same as S3; M4/M10a (band degeneracy, record hygiene) →
  OBS here + record fields split (certified slope/intercept vs
  leastSquaresSlopePerDeg diagnostic); M8/M9/M10b (boundary window, trim slop,
  mixed-case trim) → DEC-M0-5-3 + tested; the boundary-window exclusion
  reported by the math round did not reproduce (±5° and 4.999999999999998°
  points are admitted by the window epsilon — measured).

## OBS-M0-5-4 — Final independent math round: re-verification at the committed tree + two pre-existing input limitations

- **Date:** 2026-10-23 (post-commit round; tree hash verified unchanged
  before/after the run)
- **Scope:** the math-verification round re-ran its full campaign against the
  FINAL M0-5 tree after the `stabilityVerdict` refactor landed mid-session:
  2,944 checks, **0 failures** (two independent LSQ formulations; fit algebra
  < 1e-12 rel; trim round-trip worst 8.9e-16°; 123-cm0 falsification per config
  with 0 gate violations; band semantics exact incl. the inclusive 5 %
  boundary; field hygiene over 102 sweeps + 4 resolution checks; certified
  slopes and VLM-V3 deltas bit-identical (`Object.is`) old-vs-new incl. the
  frozen badge pins; mixed quarantined/converged windows constructed through
  the public API and gap-skipping pairs verified; all-invalid sweeps honest).
- **Characterization notes (not defects; recorded so the next reviewer has the
  measurements):**
  1. The positive-lift gate is **strictly** `C_L(α_trim) > 0` on the evaluated
     value, per the contract text (which specifies no minimum): a root at
     +1e-8° with physical C_L = 8.16e-10 passes and is reported. A zero-lift
     root at exactly α = 0 is refused. If Sol wants a lift floor, that is a
     contract revision, not an implementation choice.
  2. The degenerate flat-window corner (`linearFit` certifying slope exactly 0)
     re-confirmed **unreachable through the public API** (no physical response
     is bit-constant; the quarter-chord C_m spread is 4.18e-3 — genuine
     curvature, not noise) and every downstream trim/verdict path guards it via
     `FIT_EPSILON`; semantics recorded in DEC-M0-5-1.
  3. API shape note: `result.stable` is deliberately **absent** (consumers read
     `undefined`), replaced by `cmSlopeNegative` + `stabilityVerdict` —
     DEC-M0-5-4; tests assert `stable === undefined` on purpose.
  4. The C_m window of the frozen rectangle is non-linear in **all** windows
     (adjacent-pair slopes 0.000214→0.000577, ~10× the band) and wing+tail C_m
     is marginal at fine steps (5.18 % vs 5 % at h=1, certified at h=2) — the
     expectation for Sol re-verification, extending OBS-M0-5-2.
- **Two PRE-EXISTING out-of-domain input limitations (NOT M0-5 regressions;
  assigned to REM-3's input-validation scope — review §7.2 "malformed-input
  bounded negatives"):**
  - `alphaMinDeg ≈ 1e17` with step 0.1 makes the sweep loop **hang** (the float
    increment is a no-op at that magnitude). Absurd input, but a hang is not a
    bounded negative; the loop needs a progress guard.
  - Malformed numerics are silently coerced: `cm0: NaN` becomes 0 and
    `alphaMinDeg: null` becomes 0 (`finite()`/`Math.min` fallbacks) — the same
    "missing data becomes plausible zero" policy class SOL-10 rejected for
    `trefftzDrag`. Run-option validation should follow the SOL-10 precedent.
  Neither is touched in M0-5 (out of the task's contract scope; fixing them
  silently would have mixed an input-validation rewrite into a fit/trim change).
- **Status:** recorded; both limitations open for REM-3. Nothing in the M0-5
  contract was falsified; no threshold was changed; G0 remains BLOCKED.

### DEC-AUD-1-1 — 2026-11-06
Use per-case validity and finite CL/CDi at 0° and 4° for the resolution diagnostic, accepting sweep warnings caused by the intentionally insufficient two-point derivative fit. Invalid/missing comparison metrics are null and cannot pass gates. This neither certifies a derivative nor resolves IA-03 uncertainty scope. Maintain VLM-V3 delta arithmetic and thresholds. Structured comparison identity records the normalized inputs and effective wake without introducing a hashing scheme. IA-01/05 require independent re-verification. G0 remains blocked.


DEC-AUD-2-1: use versioned JSON instead of CSV to preserve nested validity and provenance; this is an intentional incompatible export format change. Match plot policy by withholding all numerical results on invalid/missing sweep validity and independently withhold invalid/missing point validity. Nonfinite fields become null. IA-02 pre/post evidence and limitations: `../verification/aud-2-2026-11-06/README.md`. No new scientific acceptance band.

### DEC-REM-3a-1 — conservative claim withholding (2026-11-06)
The normative §2.7 fixed label and Sol's evidence of unsupported generality are both preserved. Zero yaw alone does not define a defensible full envelope (IA-03). Until scientific review establishes one, do not apply the label to any result; retain the literal constant for provenance and present unverified status and scope. This is an interim withholding policy, not a new scientific band or contract revision. R1/R2 is a self-comparison. A reviewed envelope, -10% VLM-V2 versus ±8% reconciliation, and independent moment/NP validation remain open. Sidecar documents the lower-priority +x-wake conflict and projection evidence; original script bytes lack proven historical provenance. See `../verification/rem-3a-2026-11-06/`.

### REM-3b partial — 2026-11-06
Decision: Trefftz circulation must already be a finite number, matching finite coordinate and density checks; numeric strings are not scientific values at this API. Numeric zero remains valid. Scratch reproduction returned zero for null, empty string and false; 1e17 sweep step 1 timed out after 3 seconds (exit 124). IA-04 remains open at other boundaries and IA-07 is not fixed; resource policy and app validation require coordinated follow-up. No scientific envelope or physics limit was chosen. See `../verification/rem-3b-2026-11-06/README.md`.

### REM-3b continuation — provisional operational caps, 2026-11-06

Synchronous execution provisionally refuses more than 201 sweep points, 4,096 generated panels or 2,048 dense-solve panels. These limits bound resource use rather than define scientific acceptance. The first 2,048 generation cap broke an existing 3,840-panel no-refinement diagnostic and was raised. These choices and floating-point endpoints need further review and boundary tests; geometry and other explicit API inputs still coerce/default. See `../verification/rem-3b-cont-2026-11-06/README.md`. IA-04/IA-07 remain open.


2026-11-06 — Partial REM-3b endpoint policy: quotient near-integer snap within four machine-epsilon-scaled units; indexed samples and preflight cap. This is a representational operational policy, not scientific tolerance. Indexed rounding changes require additional boundary and impact review; API validation remains incomplete. Evidence: `docs/verification/rem-3b-review-2026-11-06/README.md`.


**REM-3b validation continuation, 2026-11-06:** Partial geometry, lattice, case and resolution input checks and representable sweep progress added. IA-04/IA-07 remain open; comprehensive boundary tests and independent review remain. G0 BLOCKED. See `docs/verification/rem-3b-validation-2026-11-06/README.md` and current handoff.


### REM-3b continuation checkpoint (2026-11-06)

REM-3b remains partial. Negative cd0 and degenerate supplied panels now fail explicitly; these checks and existing work require compatibility review and independent re-verification. Targeted 13 individual tests passed; full and boundary verification remains incomplete. See `docs/verification/rem-3b-resume-2026-11-06/README.md`. IA-04 and IA-07 remain open; G0 remains BLOCKED. No scientific acceptance or finding closure is implied.


### REM-3b audit checkpoint (2026-11-06)

Explicit malformed lattice options now fail rather than default; legacy numeric options remain. A fresh probe shows endpoint snapping may add a sample beyond the supplied end (1 − Number.EPSILON, step 1). This remains unfixed. IA-04/IA-07 remain open, pending completion and independent re-verification; G0 remains BLOCKED. See `docs/verification/rem-3b-audit-2026-11-06/README.md` and CURRENT_HANDOFF.md.


### REM-3b decimal continuation — 2026-11-06

REM-3b decimal policy: treat each finite Number’s shortest round-tripping decimal spelling as exact for sweep-grid arithmetic, then round each resulting sample once. No epsilon admits a point outside that decimal interval. Numbers arriving after prior arithmetic may already have lost intent; the policy is a compatibility change requiring independent review. Operational caps remain non-scientific; full boundary coverage is unfinished.

### REM-3b challenge checkpoint — 2026-11-06

Partial and uncommitted. Independent decimal vectors and the real 2048-panel solve boundary passed; an extreme finite reference previously returned infinite moment as valid, now explicitly refused with a red-before-fix regression. Complete API/compatibility audit and reusable actual-app error boundary remain. Combined individual runner timeout remains unexplained. IA-04/IA-07 remain open; IA-06/08, SOL-07 display, proximity and elliptic science remain unresolved. AUD-1/AUD-2/REM-3a await independent re-verification. G0 BLOCKED. See `../verification/rem-3b-challenge-2026-11-06/README.md` and CURRENT_HANDOFF.md. Operational caps are not scientific acceptance.

### REM-3b sweep offset overflow (2026-11-06)
Finite extreme CD0/CM0 yielded infinite drag/moment with ok validity. Refuse nonfinite assembled outputs rather than report them; no physics or scientific gate is changed. The rest of the extreme-input audit and independent verification remain open.


### REM-3b follow-up checkpoint (2026-11-06)

The actual Run handler now has a reusable VM boundary regression covering real solver refusal and a simulated resolution-check failure; both clear stored results and set error status. This is limited coverage, not a DOM or full display test. No production behavior or scientific threshold changed. See `docs/verification/rem-3b-followup-2026-11-06/README.md`. REM-3b, IA-04/IA-07 and the broader app/API audit remain incomplete; prior AUD-1, AUD-2 and REM-3a await independent re-verification. G0 remains BLOCKED. No finding is closed.

## REM-3b deep continuation — 2026-11-06

Partial, uncommitted: generated nonfinite/degenerate panels are refused; a supplied-panel metadata inconsistency can change wake length and CL while reporting ok and remains unresolved. The combined individual-test runner timed out; no aggregate pass is claimed. See `docs/verification/rem-3b-deep-2026-11-06/README.md` and CURRENT_HANDOFF. IA-04/IA-07 remain open, prior AUD-1/AUD-2/REM-3a await independent re-verification; G0 remains BLOCKED. No scientific acceptance or finding closure is implied.

## DEC-REM-3b-SOL — span identity, arithmetic guards and verification limits

- DATA_CONTRACTS §§1, 2.7 ground per-surface span in the y extent of bound endpoints. The redundant endpoint y fields are checked exactly. Width and aspect fields are checked when their companion metadata is present. Bound midpoint agreement uses a binary64 rounding allowance. Generated name collisions fail before solving. Human-readable Tier-0 names and raw single-group panels without a supplied name retain their uses. Hand-built narrow historical panels retain raw measurement access with invalid status at the existing 0.25 guard.
- A nominal finite wake must advance from each bound endpoint. An extreme translated case still stores a shortened, noncollapsed leg. At x=1e18 m the 1,329 m nominal length becomes 1,280 m and chord geometry also rounds. No translation limit or new aerodynamic tolerance was inferred. REM-3b-R requires a derivation and tests for a translation-local representation or arithmetic refusal. Product caps are separate from a measured synchronous workload policy.
- Decimal sample count and rounding use the actual indexed grid. Preserve the single-point stagnation refusal for the frozen IA-07 probe. Correctly advancing multi-point grids at the binary64 spacing transition are accepted. [Audit and measured results](../verification/rem-3b-sol-2026-11-06/README.md).

The combined runner was doing repeated dense solves in the matched-lift oracle. Corrected the test-only Illinois update and kept its existing tolerances and all scientific gates. The combined run then passed 149 individual tests. The profile establishes progress and identifies expensive paths without establishing a V8 defect.

## DEC-REM-3b-R-1 — Work in a local frame and use relative wake vectors

- DATA_CONTRACTS §2.7 governs the freestream-aligned wake and the ten-span minimum. The minimum uses the actual per-surface endpoint-y range. The matrix's introductory +x sentence does not override the normative freestream direction.
- At a binary64 x origin of 1e18 m, the coordinate spacing is 128 m. The 1,329 m nominal displacement rounds to 1,280 m if added to a bound point in that frame. Chord positions with local x coordinates near 16 m and 48 m both round to the same world x. The independent axial integral distinguishes the two losses. The separate oblique unit-horseshoe probe isolates cancellation in the old projection of absolute points.
- Build generated geometry relative to the first surface's root x and z and move the moment reference into that frame. Form the leg vectors directly from the prescribed offset and project differences in Trefftz. The same signed force laws, singularity cutoff and aerodynamic gates apply. Absolute panel positions returned to callers remain world-coordinate binary64 values. For supplied panels, arithmetic can use only represented inputs and retains the original-frame collapsed-wake refusal. Input coordinates with already-lost detail and far-separated geometry within one working frame remain limits. No scientific translation threshold was added.

## DEC-REM-3b-R-2 — Preflight estimated synchronous work

- The independent ceilings previously allowed 201 × 2,048 panel solves. Two such solves took 10.30 s before the change and an in-limit custom resolution check including that refinement took 12.00 s. A P² proxy alone under-represents the larger case. The measured scale from 640 to 2,048 panels and the quadratic pair loops plus cubic elimination motivate `W(P) = P²(4096 + P)`.
- Cap each synchronous job at `4 × W(2048) = 103079215104` units. This preserves one maximum case and room for the two-angle largest refinement with ordinary coarse and prescribed checks. The worst allowed sweep work drops by a factor of 50.25. The choice is a host-calibrated work policy and carries no latency guarantee or scientific gate. Standalone sweep and comparison calls enforce their respective totals. Browser Run preflights the sum before either solve and surfaces the existing clear-on-error path. Explicit oversized grids and impossible refinements retain their respective resource-error and withheld outcomes. There is no implicit downsampling.
- The independent runner, fixture checks, workload timings and replay differences are recorded in [REM-3b-R evidence](../verification/rem-3b-r-2026-11-06/README.md). Independent re-verification remains pending. G0 stays BLOCKED.


## M0-REVERIFY-1 — 2026-11-06

The same numerical reference can carry either measured or bounds-seed validity, so its normalized seed flag belongs in the comparison identity. Omitted and explicit false identify the same input. At finite S_ref=2e-307 m², finite cases produced infinite two-point slopes. Apply the existing availability policy to each affected grid summary before calculating comparison deltas. Each affected grid carries invalid comparison validity, a specific reason and null summary values. Ordinary comparison arithmetic, 0°/4° sampling and 1%/5% gates are preserved. Browser and replay observations are separated from red/green evidence for the correction. [Evidence](../verification/m0-reverify-1-2026-11-06/README.md).

## M0-REVERIFY-2 — 2026-11-06

The entry Run withheld both comparisons at `S_ref=3e-307 m²` despite four slopes around 1.25–1.28e308 per radian. Converting by multiplying the per-degree slope by 180 before dividing by π overflowed the intermediate. The solver now retains ordinary results and falls back to the direct 0°/4° quotient in radians when needed. At `2e-307 m²` the final slopes exceed the finite range and all affected grid summaries remain withheld. At `2.09e-307 m²` only R2 is usable, and at `2.1e-307 m²` the prescribed comparison passes while the custom comparison remains invalid with no coverage. This is a representability decision within the existing diagnostic. The fixed uncertainty claim stays withheld. [Entry results, regression, decimal oracle and browser evidence](../verification/m0-reverify-2-2026-11-06/README.md).

## M0-REVERIFY-3 — Finite signed grid deltas (2026-11-06)

The inherited 0°/4° quotient recovers from intermediate overflow and withholds genuinely nonfinite slopes on the independent entry fixtures. With opposite-signed slopes near 1.43e308 and −1.58e308 per radian, their subtraction overflows even though the absolute difference normalized by the coarse slope is about 2.1 (about 1.90909 after swapping grids). The API previously withheld both comparisons while reporting each grid as valid. For finite slopes with an overflowing difference, divide each slope by the existing coarse magnitude denominator before subtracting. This is algebraically the same relative delta. The ordinary path, denominator minimum, grid validity and scientific gates are preserved. A genuinely nonfinite final delta continues to withhold the aggregate. The signed reproduction uses constructed coefficient pairs at the exported comparison API. [Independent entry and separate correction evidence](../verification/m0-reverify-3-2026-11-06/README.md).

## OBS-M0-REVERIFY-4 — Signed comparison arithmetic (2026-11-06)

With represented lift increments `u_c` and `u_f`, the relative delta equals `|u_f - u_c| / max(|u_c|, (π/45) × 1e-300)`. Swapping grid roles changes the denominator. The rational oracle corroborates the inherited fallback with individually finite opposite-signed slopes and an overflowing difference. Only the two signed rows change against the separate HEAD-only solver. The zero-coarse control distinguishes a huge finite final delta from true aggregate overflow, which leaves both grid statuses valid. The first extreme-area three-sample plot reached the fit/stability guard and is retained as a boundary on the evidence. Two-sample real Run controls independently confirm finite recovery and withholding on prescribed and custom grids. No new comparison defect was reproduced in the tested scope. [Evidence](../verification/m0-reverify-4-2026-11-06/README.md).

## OPEN-M0-EVIDENCE-1 — Fixed uncertainty claim: owner policy (2026-11-07)

The fixed ±5 %/±8 % label is withheld on every tested output (SOL-08 / IA-03). It was reproduced on the audited commit and is absent on the working tree. The approved text is retained as provenance only. No reviewed envelope exists, so no output can meet the in-envelope condition. Two options are open: (a) keep permanent withholding and retire the label through a reviewed contract revision, or (b) define and independently review an envelope before restoring any claim. The implementation recommends (a) for now. The owner has not decided. This blocker has recurred since REM-1, and the protocol's Sol-audit guidance applies (see the ledger's recurring-blocker section). Evidence: [LEDGER L5](../verification/m0-evidence-reconcile-2026-11-07/LEDGER.md).

## OPEN-M0-EVIDENCE-2 — Export format: JSON-only versus CSV (2026-11-07)

The CSV export that carried quarantined values is gone. The current export is JSON `airflow.vlm-results` v1, with withheld values, provenance and coverage. This is a breaking format change, and AUD-2 says consumers must migrate. The owner must accept it or ask for a withheld-value CSV. The owner has not decided. Evidence: [LEDGER L6](../verification/m0-evidence-reconcile-2026-11-07/LEDGER.md).

## OPEN-M0-EVIDENCE-3 — Commit traceability (2026-11-07)

The tested M0-REVERIFY-3 solver change and the M0-REVERIFY-3 to -4 records and evidence are uncommitted, and so are this phase's files. The owner must decide whether to commit them, and in what grouping. No commit or push was made. Evidence: [LEDGER D4](../verification/m0-evidence-reconcile-2026-11-07/LEDGER.md).

## OBS-M0-EVIDENCE-1 — Three-sample plotted sweep refuses at extreme reference (2026-11-07)

At S = 3e-307 m² and 2e-307 m², a three-sample plotted sweep (0/2/4°) throws "Nonfinite sweep fit or stability output produced by VLM inputs." from `solveSweep`. A two-sample sweep and the 0°/4° comparison return. No value is shown, so this is a completeness limit, not a value leak. The browser controls used two samples. Owner decision D3 chooses between keeping the whole-run refusal and per-sweep withholding. Reproduction: [extreme-fit-refusal-probe.mjs](../verification/m0-evidence-reconcile-2026-11-07/extreme-fit-refusal-probe.mjs).

## OBS-M0-GAP-CLOSE-1 — Stale curves survive a refused Run (2026-11-07)

After a Run is refused (for example `alphaStepInput = 0`), the status, solver badge, resolution badge, diagnostics and export are cleared, but the polar and pitch canvases keep their last curves. Observed in the user's Brave through Claude in Chrome (ink 97400 pixels before and after) and in headless Brave. This is SOL-07 item 3 and M0-11 in the phased plan. Not fixed in this phase. Evidence: [browser-results.json](../verification/m0-evidence-gap-close-2026-11-07/browser-results.json).

## OBS-M0-GAP-CLOSE-2 — Trefftz guard refuses small canard incidence on an explicit lattice (2026-11-07)

With an explicit 8-strip spanwise count and 4 chordwise rows, a canard incidence of ±0.5°, 1° or 2° on the 8 m wing with a 3 m canard at x = −4 m is refused with "Trefftz-plane induced drag is negative … Refusing to report |D|". The refusal is fail-closed, and the automatic lattice solves the same cases. The identity test records the refusal as a known limit. Needs independent scientific review before any change. Evidence: [identity test](../../tests/m0-evidence-identity.test.mjs) and [identity.tap](../verification/m0-evidence-gap-close-2026-11-07/identity.tap).

## OBS-M0-GAP-CLOSE-3 — Built-in browser pane has no WebGL (2026-11-07)

The built-in browser pane has no WebGL context (`GL_VENDOR = Disabled`, sandboxed), so the app fails at startup there ("Error creating WebGL context") and cannot load the demo or run the VLM. The user's Brave, through Claude in Chrome, has WebGL and runs the app. Matches M0-12, degraded mode.

## OBS-P2-0-1 — Wing and drone baselines before the P2 queue (2026-11-07)

Evidence: [`drone-baseline-2026-11-07`](../verification/drone-baseline-2026-11-07/README.md). Current recognition on identical triangle sets against an independent numpy oracle: one-sided wing area −41.8 %, root chord −60 % (root taken at mid-span), `valid` true with only the "both skins" warning; drone wing region area +1.6 % but quarter-chord sweep −5.35°; with winglets area +6.6 %, tip chord +72 %. All `valid: true` (DR-04 on new geometry). Every wing and drone figure is unverified (units assumed mm for the wing; Tier-0; bounds-seed placeholder where used).

## OBS-P2-0-2 — The 42,600 kg caution does appear for non-demo meshes (2026-11-07)

The queue prompt states the caution appears only for `sourceName === "samolot.stl"`. `src/massModel.js` (the `airframe-mesh` check) also warns, and the browser shows it for the wing and the drone. The value itself is still applied silently to mass, inertia and stability inputs for any imported mesh (warned, not blocked). Not fixed in P2-0; belongs to the P2-E question on DR-34/DR-36/DR-43.

## OBS-P2-0-3 — Projection identity wording and the half-wing record (2026-11-07)

For a closed single-skin-pair wing, planform area = `0.5 · Σ|n_vertical|·A`; the oracle gives 0.0247294 m² by that identity and by 400-station slicing (equal to 9 digits). The prompt's "divided by two again" would halve it and is not used. The app shows a one-sided wing or a one-sided partial selection as "Recognized wing" with half-wing values and no warning; P2-A adds the half-wing warning. Pending in P2-A: the gap convention for panels separated by a gap (gross-planform bridging versus populated stations only; the oracle reports both, 0.6305 versus 0.3966 m² for the drone wing region).
