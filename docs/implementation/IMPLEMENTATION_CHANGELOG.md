## REM-3b continuation checkpoint — 2026-11-06

REM-3b continuation: explicitly reject malformed options objects and missing or empty sweep/resolution surface arrays. Target 30 individual tests and npm 26 files passed; combined TAP timed out. See `docs/verification/rem-3b-continuation-2026-11-06/README.md`.

# Implementation Changelog

Chronological record of completed implementation phases, evolving from the audited
baseline (`776457a`, plan v1.0). Append-only. Each entry records the task IDs, source
commit, files changed, decisions, tests executed, observed results, limitations and next
dependencies. A version label alone is never proof of completion — the commit and the
passing tests are the evidence.

---

## 2026-10-23 — M0-5: linear-window guard and fit/trim contract (SOL-09, VLM-V7/V8)

- **Scope:** REM-2 final task. Implement the DATA_CONTRACTS §2.5 fit/trim
  contract (RB-21) and the matrix VLM-V7/V8 rows against the frozen Sol
  `fit-trim` counterexamples. Files: `src/vlmSolver.js` (`runVlmSweep` fit/trim
  block replaced by `linearFit`/`sampledClAt`/`resolveStabilityVerdict`;
  `twoPointSlopePerRad` for the R1/R2 diagnostic; VLM-V8 seed warning),
  `src/app.js` (verdict/undetermined display, pitch-ODE gating, verdictInputs),
  `src/projectState.js` (status-preserving persistence) + additive tests
  (85 → 101, no assertion touched).
- **Baseline / independent reproduction (before any change):** `npm test`
  85/85; all three frozen `fit-trim` rows byte-for-byte
  (clAlpha 0 / 4.705038725518481 / 4.74608826502212; trims −42.688° / −64.311°;
  `stable: false`; validity "ok"). Root causes confirmed: nearest-sample
  intercept (independent derivation: off by 1.4e-2 from the true LSQ
  intercept), `slope()` returning 0 for short windows presented as
  derivatives, no adjacent-slope test, no trim gates.
- **Contract implemented:** window |α| ≤ 5° of converged points (quarantine
  excluded — DEC-M0-5-1); ≥ 3 points AND every adjacent-pair slope within 5 %
  of the window least-squares slope (else the exact contract phrases
  "insufficient linear data" / "non-linear: not determined"); fitted intercept;
  trim = root of the certified C_m line, reported only if C_L(α_trim) > 0 from
  converged samples (DEC-M0-5-2) and inside the sampled sweep (DEC-M0-5-3),
  else "not determined" naming the withholding gate; undetermined fields null
  (no NaN); validity "ok" → "warning" with per-response messages; the bare
  `stable` boolean removed in favour of `cmSlopeNegative` + a §2.5
  `stabilityVerdict` gate (DEC-M0-5-4 — with mass provenance absent, all
  verdicts are withheld with the unmet conditions named); VLM-V8
  `seedReferencePlaceholder` warning; R1/R2 two-point slope exported as
  `clAlphaTwoPointPerRad` (bit-identical arithmetic).
- **Tests (additive):** `tests/solFindings.test.mjs` SOL-09 ×10 and
  `tests/vlmSolver.test.mjs` VLM-V7 ×3 + VLM-V8 — frozen counterexamples,
  fitted-intercept round-trip with independent LSQ cross-check (1e-9°),
  both trim gates in isolation + boundary inclusive/exclusive, quarantined
  exclusion, scale-free band (×1e-13/×1e13), synthetic 5 % boundary pinning
  (4.9 % passes / 5.1 % rejected), verdict rule set, seed flip with bit-equal
  values, cd0/cm0 badge invariance.
- **Independent verification:** two subagent rounds (own scripts): LSQ/trim
  algebra to ~3 ulp and 5.4e-15°; 1305-trial falsification of the trim gates
  (436 + 234 withholdings correct, 635 reports to 1.1e-14°, 0 escapes); band
  boundary exact; zero-incidence M0-3 values unchanged at 1e-13; old-vs-new
  certified slopes < 1e-12 relative. Adversarial diff review: no blockers;
  S1-S5 closed before commit. Browser smoke (demo + 6..12° window): no
  "Unstable", no NaN, "insufficient linear data" surfaced, verdict withheld
  naming all unmet conditions.
- **Sol replay:** exactly 5 of 50 rows changed vs the previous post-fix run —
  three `fit-trim` rows, `moment-reference` x = 0.25 (now honestly
  "non-linear: not determined", OBS-M0-5-2) and the badge field rename with
  bit-identical values; all physics rows byte-identical (OBS-M0-5-1).
- **Limitations carried:** relative band degenerates at exactly-zero slope;
  degenerate-abscissae windows judged against slope 0 (primitive-only);
  C_m window at the AC reference is genuinely non-linear → "not determined"
  (OBS-M0-5-2); app display rules have no automated DOM regression (M0a); two
  pre-existing out-of-domain input limitations found by the final independent
  math round (sweep-loop hang at |α| ~ 1e17; malformed `cm0`/`alphaMinDeg`
  silently coerced to 0) — assigned to REM-3 input validation (OBS-M0-5-4).
- **Next:** REM-3 (sidecar reconciliation, envelope/label re-assessment,
  proximity guards, elliptic tip-mode investigation) or M0-6 (M0a track).

## 2026-10-23 — M0-3: sweep conversion verification + incidence/c-4 convention (review §7.2)

- **Scope:** REM-2 third task. Verify (do not double-convert) the c/4 → LE sweep
  conversion; resolve the incidence/c-4 convention explicitly (Sol REVIEW §7.2
  item 2: measured projected c/4 sweep 25.03127°/25.07012° at input 25° with
  i = 10°/15° on b = 8, cr = 1, ct = 0.3, M = 1, N = 8); execute VLM-V6 with
  incidence and multi-row measure-back. One bounded change:
  `src/vlmSolver.js` `generateVlmPanels` only (commit `5eb07d7`) + additive
  tests (`tests/vlmSolver.test.mjs`, 78 → 85, no assertion touched).
- **Baseline / independent reproduction (before any change):** `npm test`
  78/78; all four frozen Sol `incidence-sweep` probe rows reproduced
  byte-for-byte; the discrepancy reproduced and **derived analytically** —
  under the leading-edge pivot the projected c/4 locus is
  `x = x_c/4(y) + c(y)(cos i − 1)/4`, i.e. non-straight on tapered planforms
  and off the input sweep by `(c_r − c_t)(1 − cos i)/(2b)` in tan (analytic
  replica matches the frozen values to 2e-14). Sweep conversion verified at
  zero incidence: measured LE line = `atan(tan Λ_c/4 + (c_r − c_t)/(2b))` to
  ~1e-14 on 4 configurations (single conversion; a double conversion is
  excluded by > 2°) and the c/4 line measures the input exactly.
- **Convention resolution (DEC-M0-3-1, recorded — not silent):** incidence
  rotates each section about its **local quarter-chord point**, the
  DATA_CONTRACTS §3.2 rotation convention. Chordwise points become
  `P(f) = q + (f − 1/4)·c·d`, implemented as the old LE-pivot expression plus
  the shift `(c/4)(1 − cos i, 0, sin i)` — exactly zero at i = 0. Consequences
  recorded: the projected c/4 line is exactly the input sweep at any incidence
  (VLM-V6 literal reading now holds); §2.7's LE conversion formula remains the
  planform definition (exact at i = 0; at i ≠ 0 the projected LE locus is
  `tan Λ_c/4 + ((c_r − c_t)/(2b)) cos i`, asserted analytically). The
  alternatives and the residual ambiguity are recorded in
  [`ISSUE_AND_DECISION_LOG.md`](ISSUE_AND_DECISION_LOG.md) (OBS-M0-3-2).
- **Preservation:** zero-incidence geometry and all derived outputs are
  byte-identical to the pre-change code (1.07 MB JSON snapshot diff empty;
  independent check 10/10 byte-identical incl. `solveVlmCase`, `trefftzDrag`,
  `runVlmSweep`, `runVlmResolutionCheck`) — M0-1, M0-2, M0-4 and SOL-06
  behaviour preserved exactly. Sol script replay (scratch mirror): exactly
  3 of 50 rows changed — the three nonzero-incidence `incidence-sweep` rows,
  now 25° to ±1.4e-14 (the probes' own `expectedSweep`); evidence untouched.
- **Tests (purely additive):** VLM-V6 with incidence (8 planform/geometry
  families × 8 incidence angles × M ∈ {1,4,8}, per-station straightness,
  incidence-invariance at 1e-9°, matrix gate ±0.01°); single-conversion
  measure-back + rotated-LE analytic locus; direct coordinate measure-back of
  q/LE/TE against absolute anchors (rigid rotation, pivot identity), control
  points and normals at incidence; elliptic anchors at incidence; multi-surface
  incidence; negative-incidence lift sign.
- **Independent verification:** two subagents. (1) Independent derivation from
  the contracts alone confirms the c/4 pivot (LE-pivot reading requires four
  conjunctive assumptions; ambiguity explicitly stated and preserved);
  falsification campaign found nothing: 26,211 lattices (i ∈ ±60°, λ ∈
  [0.05,1], Λ ∈ ±70°, Γ ∈ ±30°, M ∈ 1..16, elliptic) worst c/4 deviation
  2.13e-14°; 177,462 edges rigid-rotation residuals ≤ 4.4e-14 rel; physics
  equivalence C_L(α=0,i) = C_L(α=i,0) to 1.0e-15 rel on a rectangular wing;
  translation invariance ≤ 3.6e-12°; 0 non-finite values in adversarial
  extremes. (2) Diff audit: minimal diff, no gate/threshold/cutoff touched, no
  floor/clip/abs added, tests purely additive (166+/0−), immutables empty;
  its two findings closed (comment precision; control-point/normal/multi-surface
  test coverage added before commit).
- **Limitations / residuals:** displayed demo numbers move slightly (demo wing
  has i = 2°; the change is the intended correction); swept-planform
  α-vs-incidence equivalence carries the wedge residual
  `ΔΓ ≈ atan(tanΛ sin i)` (characterized, OBS-M0-3-2); GEO-T4's LE measure at
  nonzero twist is governed by the same convention and is M2 work; the matrix
  rows themselves remain as approved (immutable) — the incidence extension of
  VLM-V6 is recorded in the decision log (DEC-M0-3-2). Findings remain open
  pending Sol re-verification; G0 remains BLOCKED.
- **Next:** M0-5 (linear-window guard + fit/trim contract, SOL-09, VLM-V7/V8).



- **Scope:** REM-2 second task. Replacing the hidden output-significance floor
  `max(1e-6·Σ|terms|, 1e-9·qS)` — which erased resolved drag (α = 0.001° →
  C_Di = 0 with nonzero Γ, infinite derived efficiency) and let the reference
  area mask a resolved negative force (`qS = 1e12` silently zeroed a supplied
  −1 N drag that `qS = 1` rejected) — with a forward-error cancellation
  tolerance that never mentions qS.
- **Baseline / independent reproduction (before any change):** all four Sol
  counterexamples reproduced byte-for-byte against the frozen probe evidence
  (`/tmp/opencode/sol-06/pre-fix-results.json`): the α dead band, the
  qS-masked −1 N drag, the analytic 1/π horseshoe drag overwritten to 0 at
  `qS = 1e12`, and `solveVlmCase`'s zeroed dimensional drag at
  `refAreaM2 = 1e12`. `npm test` 77/77 before the change.
- **Code (`src/vlmSolver.js` only; DEC-SOL-06-1..4):**
  - the only tolerance on a drag value is the **forward error of the evaluated
    sums in newtons**: γ_n·Σ|terms| + counted IEEE operation chains (u = 2^-53)
    acting on magnitudes ≥ |term|, plus coordinate-translation amplification
    (`Σ|p|/|r|` terms — added after an independent exact-arithmetic
    falsification of the first bound found a 4.4× under-coverage at 1e9 m
    coordinate offsets); dimensionally a force, scaling exactly with the force
    scale (so suppression decisions are scale invariant); qS is legal only in
    coefficient arithmetic;
  - raw signed values preserved (`dragNTrefftzRaw`, `dragNNearFieldRaw`); a
    value inside the tolerance is reported as exactly 0 **only** with an
    explicit size-declared suppression (`suppressedToZero` + `reason` +
    `toleranceN`, plus a `solveVlmCase` validity warning) — numerically
    unresolved, not insignificant; exact zeros are never flagged and nothing is
    suppressed without an error basis (caller-supplied `nearFieldErrorBudgetN`,
    declared Trefftz fallback, or no suppression at all);
  - `relativeDifference` is NaN ("not comparable") when either extraction is
    unresolved; non-finite evaluations and malformed supplied drag/budget
    inputs fail loudly (SOL-10 consistency). No floor, clip or `Math.abs`
    conceals any value; resolved negative drag raises at every qS with a
    byte-identical message declaring the tolerance size.
- **Measured corrections (pinned regressions, `tests/solFindings.test.mjs`
  "SOL-06" ×5 + reworked `tests/vlmSolver.test.mjs` zero-case test):**
  C_Di(0.001°) = 2.639541990860498e-10 and C_Di(0.0001°) = 2.6395419879644464e-12
  (the review's quadratic prediction 2.63954e-10 confirmed; k·sin²α followed to
  ~1e-8 over four decades; e finite ≈ 1.0022), linear solutions byte-identical
  to the frozen evidence; the 1/π horseshoe and `solveVlmCase` dimensional
  forces bitwise qS/reference-area invariant; tolerance/drag ≤ 1e-9 with
  identical decisions across 1e-3..1e3; VLM-V2's "raw" assertions now operate
  on `dragNNearFieldRaw`.
- **Independent verification:** two audit subagents (diff audit: PASS 8/8 — no
  threshold weakened, the one replaced assertion is the documented NaN
  "not comparable" contract; qS-free semantics; bitwise value preservation of
  the bookkeeping refactor) and two independent 100+-digit exact-arithmetic
  rounds (`/tmp/opencode/sol-06-verify*/`): the first falsified the initial
  bound (4.4× under-coverage at 1e9 m coordinate offsets) and drove
  DEC-SOL-06-4; the second falsified the first amplification implementation
  (leg-count over-count → false suppression at ~6e9 m coordinates), drove the
  leg-weighted tightening, and then closed every falsifier — Class A margins
  757×–1.6e11×, worst margin anywhere 38.2× (bound holds), 0 wrong throws / 0
  wrong suppressions in 456 adversarial evaluations, no dead band at the
  probe/scale configurations (tolerance/drag 5.9e-12 probe, preserved across
  scales and alphas).
- **Limitations / residuals (OBS-SOL-06-1, preserved):** the bound is
  worst-case (measured actual errors lie 1e4–1e7 below it in adversarial
  families); its tightness degrades with |coords|/|element| as double
  precision demands, and suppression of normal-scale drag begins only where
  the worst-case bound itself reaches it (≳ 3e11 m coordinates on the probe
  lattice) — always flagged with the raw preserved. The 3-D kernel's internal
  near-parallel cancellation is not modelled (now covered incidentally:
  measured ≥ 2180×) and under/flow outside the quadratic working range is out
  of Tier-0 scope (non-finite evaluations fail loudly). Sol's scripts re-run
  in the mirror (OBS-SOL-06-2): exactly 4 intended row changes vs the M0-4
  post-fix run; `analytic-drag.mjs` values byte-identical.
- **Status:** nothing closed; G0 stays BLOCKED pending independent Sol
  re-verification.

## 2026-10-23 — M0-4: relative singularity cutoff + scale invariance (SOL-01 full fix, VLM-V5)

- **Scope:** REM-2 first task. Correcting the scale-dependent numerical
  behaviour SOL-01 identified: absolute `1e-10` singularity cutoffs (and a
  second, independent defect — a rounding-discontinuous auto-N prescription)
  destroyed scale invariance of the VLM core below ~3 mm panel features.
- **Baseline / independent reproduction (before any change):** `npm test`
  71/71; an independent scratch script reproduced the review's five-row scale
  table and the elliptic tables **byte-for-byte** (`/tmp/opencode/m0-4/
  baseline-pre-fix.json`), including the 18432/28832 truncation counts and the
  OBS-REM-1-1 drift under both wake-scaling protocols (OBS-M0-4-1). New
  kernel-level counterexample established: the analytic finite-segment
  reference (−√2/4πs) is truncated to exactly **0** at 1e-3 scale by the
  absolute cutoff.
- **Code (`src/vlmSolver.js` only):**
  - per-quantity dimensionally consistent relative cutoffs
    (DEC-M0-4-1): kernel distance h = |r1×r2|/|r0| and endpoint distances vs
    1e-6 × |r0|; Trefftz projection and leg coincidence vs 1e-6 × |bound|;
    solver pivot vs 1e-10 × max|A| (dimensionless ratio); elimination skip
    removed entirely; `normalize()` degenerates only on the exact zero vector;
  - rounding-robust auto-N prescription `ceilPrescribedRatio` (DEC-M0-4-3) —
    the second root cause of scale dependence (integer-boundary ceil of AR/2
    flipped the strip count with the scale's rounding direction);
  - the REM-1 truncation counter/quarantine is preserved (its discrimination is
    dimensionless and now also counts a foot exactly on a segment endpoint).
    No floor/clip/Math.abs replaces any cutoff; SOL-06's drag significance
    policy is untouched (separate task).
- **Measured corrections (pinned in tests after independent demonstration,
  DEC-M0-4-2):** the review's scale rows 0.01/0.001 (C_L 2.121/1.157) now
  equal the c = 1 row to ~2e-16; elliptic 8×64 corrected to the clean limit
  (0.339623957890163) and re-admitted to the validated M ≤ 8 envelope;
  elliptic 12×64/12×96/16×64 raw values move ≤ 3.5e-7 with the restored terms
  (gaps 22.02/48.40/165.86 %, tip pathology unchanged — SOL-03 root cause
  stays OPEN/SCI). Every zero-truncation pin (SOL-02 deltas, wing+tail gap,
  PSD eigenmode 1e-12, analytic horseshoe 1e-15) is unchanged and its test
  passes unmodified.
- **Verification:** `npm test` **73/73 pass** (68 pre-existing tests untouched
  and green; the 3 deliberately "known-bad" REM-1 pins replaced; 2 net-new
  tests). VLM-V5 1e-3..1e3 on C_L/C_Di(Trefftz+near-field)/C_m/local Γ:
  ≤ 2.0e-14 relative (gate 1e-6 unweakened) + physical scaling (Γ ∝ VL,
  F ∝ ρV²L², M ∝ ρV²L³ exact under V/ρ doubling) + `kernelTruncations === 0` +
  residuals ≤ 3.2e-14. Independent analytic references to ≤ 3.1e-16 across the
  range. Auto-N fixture + boundary-AR lattices (wing+tail, tapered/swept/
  dihedral+incidence) scale-invariant with constant panel counts. Independent
  subagent re-measurement (its own scripts) and an independent diff audit
  (dimensional consistency, degenerate-panel safety, stability bound,
  threshold-weakening audit) both PASS. Sol's frozen scripts re-run post-fix in
  the scratch mirror — every field-level difference classified
  (OBS-M0-4-2); `docs/verification/sol/` untouched.
- **Limitations:** genuine near-singular configurations (proximity < 1e-6 ×
  segment length) are quarantined by the counter, not solved; fit/trim
  dimensionless checks remain for M0-5 (SOL-09); SOL-06 drag significance
  policy unchanged; the elliptic tip-mode root cause (SOL-03) is untouched;
  no browser/UI change this cycle (no smoke test needed; `npm test` includes
  the demo regression).
- **Next:** SOL-06 (same cycle), then M0-3 (sweep/incidence semantics) and
  M0-5 (fit/trim, SOL-09).

## 2026-10-23 — REM-1: Sol review remediation — M0-3 entry prerequisites (SOL-02/03/10 fixes, SOL-01 interim, SOL-04/08 scoping) — commit `84cf90f`

- **Scope:** bounded remediation cycle before M0-3 corrective work. Independent
  reproduction of all ten Sol findings (all reproduced; evidence byte-identical),
  dispositions/traceability record, then the prerequisite corrections:
  exact-flow resolution badge (SOL-02), numerical-corruption quarantine
  (SOL-01 interim + SOL-03), input validation (SOL-10), PSD claim bounding
  (SOL-04), uncertainty-label scope (SOL-08 partial).
- **Evidence:** `docs/verification/sol/` (Sol review + reproduction scripts +
  results) committed verbatim as immutable evidence. Re-runs in a scratch mirror
  reproduced all five evidence artifacts byte-identically on the reviewed
  revision before any change. Full dispositions, root causes, classifications and
  finding-to-fix-to-test traceability:
  [`docs/implementation/SOL_FINDING_DISPOSITIONS.md`](SOL_FINDING_DISPOSITIONS.md).
- **Code:**
  - `src/vlmSolver.js`: kernel/truncation observability with dimensionless
    harmful-suppression discrimination (DEC-REM-1-3); validity tier `invalid`
    with the four quarantine gates of DEC-REM-1-2 (elliptic M > 8 envelope;
    planar near-field/Trefftz > 1 % = the approved VLM-V2b gate; harmful
    truncations; M > 8 unverified warning); `runVlmResolutionCheck` rewritten
    (exact plotted flow, `inputIdentity`/`coverage`, custom-lattice vs 2x refined
    comparison or withheld claim) (DEC-REM-1-1); uncertainty label scoped
    (DEC-REM-1-4); `trefftzDrag` input validation with panel-index errors
    (DEC-REM-1-5); signed-drag message/comment de-categorised (DEC-REM-1-6);
    per-point and aggregated sweep validity; `diagnostics.kernelTruncations`.
    **No coefficient, force, moment or drag value was changed** — the review's
    recorded values are pinned to 1e-9 in the new tests.
  - `src/app.js` / `src/graphs.js` / `index.html`: badge text names the checked
    flow/lattice and never certifies another computation (claim withheld shows
    as withheld); quarantined cases show metrics as UNAVAILABLE, draw no curves
    and run no pitch simulation; solver diagnostics state the resolution claim's
    beta/alpha coverage; method note carries the label scope.
  - `tests/solFindings.test.mjs` (new, 17 tests): Sol's counterexamples pinned —
    scale table (0.1/1/1000 clean + values; 0.01/0.001 quarantined + known-bad
    values), yaw badge (beta = 5 deg: 1.752 %/5.171 %, amber), custom-grid
    comparison and withheld claims, elliptic 4x32 clean / 8x64 quarantined
    (known-bad pinned, see OBS-REM-1-1) / 12x64 tip mode quarantined with values
    unchanged, rect M > 8 warning, OBS-M0-2-2 gap case flagged, sweep
    propagation, PSD eigenmode reproduces and is rejected (1e-12 vs NumPy),
    label scoping, SOL-10 validation and signed-input integrity.
    `tests/vlmOracles.test.mjs`: PSD sampling claim bounded (assertions
    unchanged).
- **Verification:** `npm test` **71/71 pass** (54 pre-existing, unchanged and
  unweakened, + 17 new). Sol scripts post-fix: `analytic-drag.mjs` and
  `psd-check.py` reproduce the evidence exactly; `probes.mjs` reproduces every
  recorded value before stopping at its unguarded `nonfinite-gamma` probe (the
  SOL-10 fix it demanded; pre-fix evidence preserved). New independent
  measurement: elliptic 8x64 scale drift 1.4e-6 (C_L) / 2.4e-6 (C_Di) at 1x
  (OBS-REM-1-1).
- **Limitations carried forward:** SOL-01 full fix (relative cutoffs, VLM-V5
  1e-3..1e3 on C_L, C_Di, C_m, Gamma) = M0-4; SOL-06 force-significance policy =
  REM-2; SOL-09 fit/trim = M0-5; SOL-05/08 full = REM-3; SOL-07 display
  quarantine = M0a tasks. **G0 remains BLOCKED; no finding is closed — closure
  requires independent Sol re-verification.**
- **Next dependency:** REM-2 = the M0-3/4/5 numerics group (relative singularity
  cutoff + VLM-V5; raw-value-preserving drag significance (SOL-06); sweep
  conversion verification + incidence/c-4 semantics (review §7.2); linear-window
  guard + fit/trim contract (SOL-09)).

---

## 2026-10-23 — M0-2: multi-row VLM lattice (DR-02, RA-03, RB-04, RB-07)

- **Scope:** M0-2 only (M0b track). Multi-row lattice, panel aspect guard,
  freestream-aligned wake >= 10 b, R1/R2 resolution badge, uncertainty label,
  re-measurement of the VLM gates on the R2 lattice (closes DEC-M0-1-3).
- **Code:**
  - `src/vlmSolver.js`: `generateVlmPanels` rebuilt as M chordwise rows x N uniform
    spanwise strips per surface (bound at the sub-panel 1/4 point, control at the 3/4
    point at the strip mean chord); per-surface auto N = `max(16, 2 M ceil(AR/2))`
    (= the matrix R1/R2 counts); `planform: "elliptic"` fixture; c/4 sweep convention
    in `sectionAt` (VLM-V6); single guard (refuse width/length < 0.25, warn above 8);
    `panelAspectDiagnostics`, `resolutionLabel`, `autoSpanwisePanels`,
    `runVlmResolutionCheck` (R1 vs R2 badge deltas); wake floor
    `max(20 MAC, 10 b_largest)`; `validity` + `uncertaintyLabel` on every result.
    The M0-1 signed near-field drag and general Trefftz drag are unchanged.
  - `index.html` / `src/app.js`: chordwise-rows control, spanwise panels with
    blank = auto, R1/R2 resolution badge, method note and solver diagnostics carry the
    flat-plate uncertainty label and validity messages.
  - `tests/vlmSolver.test.mjs` / `tests/vlmOracles.test.mjs`: multi-row geometry,
    guard, wake floor, R1/R2 badge; VLM-V1/V1b/V2/V2b/V2c/V2d/V3 re-measured on the
    prescribed lattices against independent oracles (Glauert LLT, Helmbold-DATCOM,
    complex-plane Trefftz, alternative-form near-field) plus the review record §4
    reproduction anchors.
  - `scripts/m0-2-reference/`: independent from-specification reference implementation
    and its results (written without reading repository code).
  - `CALCULATION_PIPELINE.md` §7/§8 and `MVP_METHODOLOGY.md` updated with the
    implemented method (the §8 freestream formula now matches DATA_CONTRACTS §1).
- **Verification (`npm test`, 53/53 pass):**
  - **Review record §4 reproduction:** all 8 rectangular and 6 elliptic multi-row
    `C_Lalpha` values match to 4 decimals; the single-row table matches exactly in
    `C_Lalpha` and e; elliptic panel width/length min-max match exactly.
  - **VLM-V3** (R1 -> R2, AR 4/6/8/12): delta C_Lalpha **0.16-0.59 %** (gate 1 %),
    delta C_Di **0.92-1.38 %** (gate 5 %); single-row width/chord < 0.25 refused.
  - **VLM-V2** (R2, matched C_L vs Glauert): ratio **0.948-0.951** (band [0.90, 1.05]),
    e **0.953-1.007** (band [0.90, 1.02]); Munk e <= 1.07 everywhere. R1 reported
    (e 0.965-1.026, DEC-M0-2-4).
  - **VLM-V2b:** near-field = Trefftz within **0.06 %** (gate 1 %) for M in {4, 8},
    N in {16, 24, 32}, alpha in {-5, 5, 10} deg, wake {10, 20} b, oracles reproducing
    both module values to 1e-9.
  - **VLM-V2c** (wing AR 8 + H-tail at the prescribed R1/R2 counts): **-0.05/-0.06 %**
    (gate 1 %) at both alphas, wake 10 b; the deliberately y-only Trefftz form errs
    3-40 % and fails the gate (detection proof). See OBS-M0-2-2 for the wake-path
    sensitivity off the prescribed counts.
  - **VLM-V2d** (elliptic, N >= 32): e **1.018-1.033** (band [0.99, 1.07]).
  - **VLM-V1** (R2 vs Glauert): -2.0 to -3.9 % for AR 6/8/12 (gate 5 %); AR 4
    reported (-5.6 %), not gated. **VLM-V1b** (Helmbold, c/2 sweep convention):
    -0.95 to -4.24 % (gate 5 %).
  - **DR-02 resolved:** `cdi/cl^2` spread over alpha in [2, 8] deg is **1.001-1.004**
    at R1, R2 and off-band counts (was 1.15-2.25 on the single-row lattice), and the
    quadratic trend test now runs at every resolution with the original 1.35 threshold.
  - **Independent cross-check:** `scripts/m0-2-reference/verify.mjs` (written from the
    specification alone) reproduces the solver to 6 significant digits across 12
    benchmark configurations and reproduces the analytic single-horseshoe
    D = rho G^2/pi to 1e-16 and the Glauert C_Lalpha values to 1e-6.
- **Limitations / open items:** OBS-M0-2-1 (review record e columns deviate from the
  stated formula; investigated, gates unaffected), OBS-M0-2-2 (near-field/Trefftz gap
  when bound lines cross a wake path), OBS-M0-2-3 (elliptic tip fan panels corrupt the
  near-field diagnostic at M >= 12), OBS-M0-2-4 (mild per-alpha non-linearity from the
  contract's wake rebuild), OBS-M0-2-5 (zero-lift drag roundoff tripped the
  signed-drag assertion — found by the browser smoke test, fixed with a roundoff-aware
  floor; genuine negatives still raise). Displayed numbers beyond the VLM core remain
  invalid (DR-03..DR-06).
- **Browser smoke test:** `npm start` + the procedure in
  `docs/implementation/BROWSER_SMOKE_TEST.md` — demo loads, auto-sweep completes,
  R1/R2 badge green (dCLa 0.40 %, dCDi 0.68 %), guard refusal and recovery verified,
  console clean.
- **Next dependencies:** M0-3 (sweep conversion, relative singularity cutoff,
  linear-window guard), M0-4/M0-5, then the M0-16 method pass.

## 2026-10-23 — M0-1: signed induced drag and general Trefftz drag

- **Milestone / task IDs:** M0b → **M0-1** (induced drag), DR-01, RB-03.
- **Implementation revision:** branch `impl/m0` (this commit).
- **Files changed:**
  - `src/vlmSolver.js` — force loop includes the panel's own trailing legs
    (`includeBound = j !== i`, DR-01); near-field drag is the **signed**
    `dot(totalForce, wakeDirection)` (`Math.abs` deleted); new
    `trefftzDrag(panels, circulation, rho, wakeDirection, options)` implementing the
    general transverse-plane formula of DATA_CONTRACTS §2.7 with no absolute values and
    a validity error on negative drag; `cdi = cdiTrefftz`, `cdiNearField` and the
    near-field/Trefftz relative difference reported; wake direction adopted from
    DATA_CONTRACTS §1 (partial B-VLM-09, identical at beta = 0); `runVlmSweep` `dragN`
    now consistent with `cd` (Trefftz + profile).
  - `tests/vlmOracles.test.mjs` (new) — independent oracles (general Trefftz in complex
    2-D crossflow, near-field KJ with an alternative Biot-Savart arrangement, Glauert
    lifting-line) that never import the module; VLM-V2, VLM-V2b, VLM-V2c plus sign,
    zero-lift, negative-alpha, degenerate, positive-semi-definiteness, wake-length
    convergence, scale-invariance and resolution-robustness checks.
  - `tests/vlmSolver.test.mjs` — signed-drag assertions at the original N = 28 config;
    validity-error test; trend test split (see DEC-M0-1-3).
  - `CALCULATION_PIPELINE.md` — §11/§12 corrected (own trailing legs, signed drag,
    Trefftz formula, `C_Di = D_T/(qS)`). Full method-document pass remains M0-16.
  - `docs/implementation/*` — status, changelog, issue log, milestone record.
- **Mathematical correction (justification in ISSUE_AND_DECISION_LOG DEC-M0-1-1):**
  the old force loop skipped the panel's own trailing legs (`if (i === j) continue`),
  which removed its own downwash contribution, and `Math.abs` concealed the resulting
  negative drag (audit evidence: `C_Di = -3.9e-2` against `+4.4e-3` expected). The
  corrected near-field drag and the new primary Trefftz drag were derived from the
  module's Biot-Savart convention and re-derived independently from specification
  (single-horseshoe analytic `D = rho G^2/pi`; the `0.5` factor proven exact for
  coplanar bound lines; positive semi-definiteness in the circulations).
- **Tests executed and observed results:** `npm test` → **41/41 pass** (25 pre-existing
  + 16 new). Key measured values (rho = 1.225, V = 40):
  - **VLM-V2** (rectangular, matched C_L vs Glauert LLT, wake 10 b): ratios
    `0.964/0.941/0.924` (AR 6/8/12, N = 20) and `1.014/0.969/0.939` (N = 24);
    e `0.989/0.996/0.981` and `0.940/0.967/0.965`. All inside the unweakened gates
    [0.90, 1.05] and [0.90, 1.02]; D > 0; raw near-field D >= 0. Glauert oracle
    independently reproduces `C_Lalpha = 4.5304/4.8377/5.1991`.
  - **VLM-V2b** (unswept planar wing, wake >= 10 b): near-field vs Trefftz
    |diff| <= 0.07 % across N in {16, 24, 32}, alpha in {-5, 5, 10} deg, wake
    {10, 20} b (gate 1 %). Module values reproduced by independent oracles to 1e-9
    relative.
  - **VLM-V2c** (wing AR 8 + H-tail span 3 c, 4 c aft, 0.6 c above; wake 10 b):
    |diff| = 0.19 % / 0.41 % (N = 32, alpha 5/10 deg) and 0.07 % / 0.07 %
    (N = 40) — inside the 1 % gate. The deliberately defective y-only Trefftz form
    errs by 8.0 % / 3.0 % / 43 % / 3.2 % — it **fails** the gate, proving the test
    detects the RB-03 defect.
  - **Sign/edge cases:** zero lift gives exactly D = 0 without raising; D(-5 deg) =
    D(+5 deg) to 1e-9 relative and strictly positive; degenerate zero-width panels
    change nothing; 200 random mixed-sign circulation vectors all give D_T >= 0.
  - **Convergence:** near-field/Trefftz gap shrinks monotonically
    `0.050 % -> 0.012 % -> 0.002 % -> 0.0005 %` at wake 10/20/50/100 b (AR 8,
    5 deg). Scale invariance holds at 0.1x/10x geometry to 1e-6 relative.
  - **Independent verification (from-specification subagent, `/tmp/opencode/m0-1-verify/`):**
    analytic single horseshoe `D = rho G^2/pi = 0.389930 N` reproduced; all sign
    conventions consistent; Trefftz/near-field agreement confirmed; Glauert values
    reproduced independently; y-only variant fails by +5.7 to +8.0 %.
- **Deviations from the original plan (recorded, thresholds never weakened):**
  VLM-V2 gated at N = 20/24 and VLM-V2c at N = 32/40 because the single-row lattice has
  no convergence plateau (DEC-M0-1-3); the pre-existing trend assertion moved from
  N = 28 (spreads 1.63 with corrected drag) to N = 20 (1.15) with its threshold
  unchanged (OBS-M0-1-1); the `D > 0` assertion is `D >= 0` with a validity error only
  on `D < 0`, so zero lift is handled algebraically correctly (DEC-M0-1-1).
- **Remaining limitations:**
  - DR-02 single-row lattice: `C_Di` remains N-sensitive at user-selectable resolution;
    magnitude gates are provisional until M0-2's R2 lattice (OBS-M0-1-1/2).
  - Structural formula residual for non-coplanar surfaces <= 0.2 % (OBS-M0-1-3); the
    approved contract formula is unchanged.
  - `e_L` and the beta-neighbourhood of the coefficients remain beta = 0 forms.
- **Next dependencies:** M0-2 (multi-row lattice, wake >= 10 b default, R1/R2 badge,
  uncertainty label) re-measures VLM-V2/VLM-V3 on R2; M0-16 updates the method
  documents (`CALCULATION_PIPELINE.md` §11 is already corrected here).

---

## 2026-10-23 — M0-10: exact mesh topology classification

- **Milestone / task IDs:** M0a → **M0-10** (topology correctness), DR-12.
- **Implementation revision:** commit `2c6ec84` on branch `impl/m0`.
- **Files changed:**
  - `src/core/topology.js` (new) — dependency-free exact-topology module.
  - `src/geometry.js` — removed the tolerance-welded `computeTopology`, re-exports the core module.
  - `tests/topology.test.mjs` (new) — independent, non-importing oracle + synthetic cases + reference-mesh check.
  - `tests/demoRegression.test.mjs` — corrected reference assertions to `28 / 5 / 0 / 1`.
  - `CALCULATION_PIPELINE.md` — corrected §3 demo values and §4.1 method text.
- **Architectural / mathematical decisions:** see
  [`ISSUE_AND_DECISION_LOG.md`](ISSUE_AND_DECISION_LOG.md) DEC-M0-10-1 (exact float64
  welding, signed-zero normalization, degenerate edge skipping, edge-connected components).
- **Tests executed and observed results:**
  - `npm test` → **26/26 pass** (23 pre-existing + 3 new).
  - Independent oracle reproduces `28/5/0/1` on the reference mesh; module matches the
    oracle on the reference mesh and on synthetic closed / degenerate / non-manifold /
    disconnected / duplicate cases.
  - Reference-mesh cross-check: `uniqueEdges = 296634 + 28 + 5 = 296667` (consistent).
- **Remaining limitations:**
  - Degenerate triangles contribute no edges and therefore form singleton components;
    the reference mesh has none (`degenerate = 0`), so this does not affect M0-10.
  - `duplicateTriangles = 4` observed on the reference mesh (OBS-M0-10-1), outside the
    `28/5/0/1` acceptance values.
- **Next dependencies:** M0-6/M0-7 (planform by slicing) depend on clean surface
  selection; topology is now trustworthy input for later geometry-quality gates.

---

## 2026-10-23 — Baseline: audited documentation and reference set

- **Milestone / task IDs:** Phase 0 (workspace discovery).
- **Implementation revision:** commit `776457a` on branch `impl/m0`.
- **Files changed:** added `docs/` (START_HERE, architecture, audits, plans) and `refs/`
  exactly as produced by the 2026-10-23 audit. **No content modified.** Preserved as the
  immutable, version-controlled evidence baseline.
- **Tests executed:** `npm test` → 23/23 pass on Node v24.21.0 (baseline).
- **Next dependencies:** M0 implementation.

### 2026-11-06 — AUD-1
Withhold resolution metrics and badges on missing, quarantined or nonfinite required cases; record normalized placement, lattice and wake identity and persist the comparison. See phase evidence and current handoff for verification and remaining limits. No numerical policy or convergence threshold changed. IA-02/03/04/06/07/08 remain open; G0 blocked.


AUD-2 (2026-11-06): replaced unsafe result CSV with versioned JSON retaining validity, input/reference provenance and comparison coverage; quarantined sweep values are null. Tests: 12 files / 109 individuals pass; browser demo download verified. Evidence: `../verification/aud-2-2026-11-06/README.md`. Independent review pending.

### REM-3a — 2026-11-06
Withhold the contract's fixed numerical claim for all current cases pending a defensible reviewed envelope; preserve its provenance and distinguish R1/R2 self-comparison from independent evidence. Reconcile historical body-plane extraction against freestream-plane output in `../verification/rem-3a-2026-11-06/BENCHMARK_SIDECAR.md`. Add claim to JSON and snapshots, correct static UI copy, and add boundary regressions. Review and full scientific validation remain outstanding; no solver physics or VLM-V3 threshold changed. Verification and failed initial tests are recorded in the phase evidence.

### 2026-11-06 — REM-3b partial
Trefftz circulation now rejects nonnumeric entries before evaluating drag; the prior conversion made null, empty string and false look like zero. A regression covers those, numeric strings, undefined, NaN, Infinity and valid numeric zero. The sweep and app boundaries are unfinished. Evidence and actual verification: `../verification/rem-3b-2026-11-06/README.md`. No independent review; G0 BLOCKED.

### 2026-11-06 — REM-3b continuation (partial)

Added sweep progress and resource refusal, explicit checking for several solver inputs, and strict numeric Run input parsing; browser smoke and preliminary regressions recorded in `../verification/rem-3b-cont-2026-11-06/README.md`. Caps are operational, not physical. Remaining API validation and acceptance coverage are unfinished; no independent re-verification or gate clearance.


2026-11-06 — Partial REM-3b: replaced absolute endpoint tolerance with pre-counted indexed sweep; regression reproduced before fix. Targeted 6 individual, npm 16 files, individual suite 119 passed. Further API and endpoint audit remains. See `docs/verification/rem-3b-review-2026-11-06/README.md`.


**REM-3b validation continuation, 2026-11-06:** Partial geometry, lattice, case and resolution input checks and representable sweep progress added. IA-04/IA-07 remain open; comprehensive boundary tests and independent review remain. G0 BLOCKED. See `docs/verification/rem-3b-validation-2026-11-06/README.md` and current handoff.


### REM-3b continuation checkpoint (2026-11-06)

REM-3b remains partial. Negative cd0 and degenerate supplied panels now fail explicitly; these checks and existing work require compatibility review and independent re-verification. Targeted 13 individual tests passed; full and boundary verification remains incomplete. See `docs/verification/rem-3b-resume-2026-11-06/README.md`. IA-04 and IA-07 remain open; G0 remains BLOCKED. No scientific acceptance or finding closure is implied.


### REM-3b audit checkpoint (2026-11-06)

Explicit malformed lattice options now fail rather than default; legacy numeric options remain. A fresh probe shows endpoint snapping may add a sample beyond the supplied end (1 − Number.EPSILON, step 1). This remains unfixed. IA-04/IA-07 remain open, pending completion and independent re-verification; G0 remains BLOCKED. See `docs/verification/rem-3b-audit-2026-11-06/README.md` and CURRENT_HANDOFF.md.


### REM-3b decimal continuation — 2026-11-06

REM-3b decimal continuation: replaced quotient epsilon snapping with exact arithmetic on shortest round-tripping decimal spellings, rounding each sample once; added scratch red regressions, focused boundary tests and method documentation. This is partial and not scientific validation; see `../verification/rem-3b-decimal-2026-11-06/README.md`.

### REM-3b challenge checkpoint — 2026-11-06

Partial and uncommitted. Independent decimal vectors and the real 2048-panel solve boundary passed; an extreme finite reference previously returned infinite moment as valid, now explicitly refused with a red-before-fix regression. Complete API/compatibility audit and reusable actual-app error boundary remain. Combined individual runner timeout remains unexplained. IA-04/IA-07 remain open; IA-06/08, SOL-07 display, proximity and elliptic science remain unresolved. AUD-1/AUD-2/REM-3a await independent re-verification. G0 BLOCKED. See `../verification/rem-3b-challenge-2026-11-06/README.md` and CURRENT_HANDOFF.md. Operational caps are not scientific acceptance.

### REM-3b investigation (partial, 2026-11-06)
Finite CD0 or CM0 can overflow the assembled sweep loads; the sweep now refuses nonfinite total drag, moment or coefficients. A regression records the former failure. This does not finish the API audit; see `docs/verification/rem-3b-investigation-2026-11-06/README.md`.


### REM-3b follow-up checkpoint (2026-11-06)

The actual Run handler now has a reusable VM boundary regression covering real solver refusal and a simulated resolution-check failure; both clear stored results and set error status. This is limited coverage, not a DOM or full display test. No production behavior or scientific threshold changed. See `docs/verification/rem-3b-followup-2026-11-06/README.md`. REM-3b, IA-04/IA-07 and the broader app/API audit remain incomplete; prior AUD-1, AUD-2 and REM-3a await independent re-verification. G0 remains BLOCKED. No finding is closed.

## REM-3b deep continuation — 2026-11-06

Partial, uncommitted: generated nonfinite/degenerate panels are refused; a supplied-panel metadata inconsistency can change wake length and CL while reporting ok and remains unresolved. The combined individual-test runner timed out; no aggregate pass is claimed. See `docs/verification/rem-3b-deep-2026-11-06/README.md` and CURRENT_HANDOFF. IA-04/IA-07 remain open, prior AUD-1/AUD-2/REM-3a await independent re-verification; G0 remains BLOCKED. No scientific acceptance or finding closure is implied.

## 2026-11-06 — REM-3b Sol geometry and Run correction

- Bound endpoints now supply wake span, with validation of redundant external panel geometry and unique surface definitions. Resolution records use safe name counts and plotted extents.
- Reject malformed supplied Trefftz options, pressure-reference and coefficient overflow, collapsed wake endpoints, nonfinite fit outputs and invalid fixed comparison series. The emitted decimal grid determines multi-point progress.
- Run failures and input edits clear stale visual results, and a successful run without pitch draws an unavailable plot. The UI distinguishes blank auto sizing from a malformed number.
- Corrected endpoint weighting in the test-only Illinois matched-lift search. The combined suite passed 149 tests with the existing convergence tolerances and gates.
- [Evidence](../verification/rem-3b-sol-2026-11-06/README.md) records the oracle, browser, replays, test commands, large-translation counterexample and runner controls. REM-3b remains partial and uncommitted. No independent finding was closed.

## 2026-11-06 — REM-3b-R, translated wakes and synchronous work

- Working-tree change on `9a66316f63e22b9633e266716294eee68f9b2498`. The solver constructs generated geometry and moment arms in a local frame, evaluates finite wakes by displacement and projects relative offsets in Trefftz. Returned panel coordinates remain rounded world values.
- Sweep and resolution plans now enforce aggregate work before solving. Browser Run preflights both together and uses its existing result-clearing path on refusal. A maximum-case solve remains supported and VLM-V3 and benchmark gates remain intact. Extended the real Run regression and adapted the AUD-1 VM fixture to the combined call.
- Targeted 44 individual passes, npm 29 passing files, prescribed runner 156 individual passes. Independent equivalent geometry and analytic projection agree within existing oracle tolerances. Browser verified refusal, both cleared canvases and recovery. The frozen replay results, workload derivation and limitations are in [the evidence](../verification/rem-3b-r-2026-11-06/README.md).
- IA-04/IA-07 implementation tested, pending independent re-verification. AUD-1, AUD-2 and REM-3a also await it. No finding closed. G0 remains BLOCKED.


## M0-REVERIFY-1 — 2026-11-06

Recorded a fresh independent re-verification of the four inherited patches. Added the effective reference seed flag to the comparison identity and withheld nonfinite two-point grid summaries with explicit reasons. Added two regressions and updated the method documents. The post-edit runner passed 158 individuals. The comparison protocol and benchmark gates were preserved. Independent review of these two changes remains pending. [Evidence](../verification/m0-reverify-1-2026-11-06/README.md).

## M0-REVERIFY-2 — 2026-11-06

- Independently exercised the M0-REVERIFY-1 comparison records through solver entry points, browser Run and both downloads.
- Fixed a false nonfinite-slope result when the conversion's intermediate product overflows and the per-radian result fits binary64. The existing ordinary calculation and gates are preserved. Added a regression covering recovery, split prescribed validity and failed custom coverage.
- Final verification passed 58 targeted individuals, 29 npm files and 159 individuals in the exact combined command. The frozen replay matched prior final Sol rows and independent measurements. [Commands, tolerances, downloads and replay limits](../verification/m0-reverify-2-2026-11-06/README.md).

## M0-REVERIFY-3 — 2026-11-06

- Independently checked the inherited 0°/4° slope quotient around the finite limit, including signed offsets, reversed input order and asymmetric prescribed and custom validity. The browser Run and four pairs of downloads preserved the applicable coverage, seed flag and fixed-claim withholding.
- The comparison API now normalizes each lift slope before subtraction when the difference of two finite slopes overflows. The ordinary relative delta, 1%/5% gates and true final-overflow handling remain in place.
- The new regression reproduced the defect before the correction. Final tests passed 59 targeted individuals across 19 files, 29 npm files and 160 exact-runner individuals across 29 files. The correction awaits independent re-verification. [Evidence and limitations](../verification/m0-reverify-3-2026-11-06/README.md).

## 2026-11-06 — M0-REVERIFY-4 independent signed-delta review

- Reviewed the M0-REVERIFY-3 solver and regression on `impl/m0` at `6c625a31f43892f71581fac8cde5a02a4ec9f168` plus the inherited working-tree diff. Added independent arithmetic, a separate HEAD-only control, browser Run and download evidence, frozen replay, method clarifications and implementation records.
- The signed overflow correction recovered 1⅓ and 4 for the two orders. The true final overflow kept valid grid statuses and withheld aggregate metrics. The real-flow controls retained their coverage, seed provenance and fixed-claim withholding. The 0°/4° protocol and 1%/5% gates passed.
- Targeted passed 59 individuals across 19 files. npm passed 29 files. The exact combined runner passed 160 individuals across 29 input files in 190.38 s. Frozen replay had zero changed Sol rows or independent measurement groups. Expected stops and unreached checks are recorded in the phase evidence.
- No executable edit was needed. Administrative dispositions remain open and **G0 BLOCKED**. Next is M0-EVIDENCE-RECONCILE. [Evidence](../verification/m0-reverify-4-2026-11-06/README.md).

## 2026-11-07 — M0-EVIDENCE-RECONCILE: review ledger for SOL-02/IA-01/IA-05, IA-02 and SOL-08/IA-03

- **Scope.** Documentation and evidence only. The working tree still holds the uncommitted M0-REVERIFY-3 change to `src/vlmSolver.js` (8 lines) and `tests/aud1.test.mjs` (+30). This phase changed no production or test file. HEAD is `6c625a31f43892f71581fac8cde5a02a4ec9f168`, and the index is empty.
- **Added.** [LEDGER.md](../verification/m0-evidence-reconcile-2026-11-07/LEDGER.md), [README.md](../verification/m0-evidence-reconcile-2026-11-07/README.md), `ledger-probes.mjs`, `extreme-fit-refusal-probe.mjs`, `run-verification.sh`, and their logs and outputs, including HEAD and pre-remediation solver controls.
- **Verified.** Both hash manifests matched: `tested-executables.sha256` (46/46) and `phase-evidence.sha256` (93/93). The rational oracle reproduced `oracle-entry.json` byte-for-byte. The browser checker passed on the eight retained downloads, whose hashes match the M0-REVERIFY-4 record. The IA-01 and IA-05 defects reproduce on the audited commit `9a66316` and are absent on the working tree. The IA-03 legacy label appears on the pre-remediation control and not on the working tree. Targeted 59 individuals across 19 files, `npm test` 160 across 29 files and the exact combined runner 160 across 29 files all passed with exit 0 and zero skips. The combined runner took 208.69 s, with no timeout.
- **Found, not changed.** A three-sample plotted sweep at S ≈ 2–3e-307 m² throws the existing nonfinite fit refusal. Two-sample sweeps and the comparison still return. This is recorded as a limit (L8) and as D3. The app's legacy-label branch in `src/app.js` is unreachable (cosmetic, for M0-16).
- **Not done.** No browser Run at β ≠ 0 or on the IA-01 invalid fixture. No invalid-sweep browser export. No restore → solve → export test. No exhaustive identity enumeration. No commit, push or merge. No finding closed. Administrative dispositions stay open. G0 BLOCKED.
- **Next.** [M0-EVIDENCE-GAP-CLOSE](../implementation/NEXT_CONVERSATION_PROMPT.md), after owner authorization of the local browser step. Owner decisions D1–D4 are listed in the ledger.

## 2026-11-07 — M0-EVIDENCE-GAP-CLOSE: browser checks and identity coverage

- **Changed.** `tests/m0-evidence-identity.test.mjs` (new, 32 tests). Production code unchanged. Records: the handoff, status, M0 tracker, decision log, SOL dispositions, the ledger addendum, the gap-close evidence directory and the next-step options review.
- **Browser (user's Brave, Claude in Chrome).** β = 5° prescribed check: amber, ΔC_Lα 0.01752425309329866, ΔC_Di 0.05170673842746727, equal to the API probe. Restore → solve → export on the valid fixture: exact provenance, series, validity and uncertainty label. Invalid-input Run: badges, diagnostics and export cleared, but the polar and pitch canvases keep the old curves (SOL-07 item 3, M0-11).
- **Limits.** The IA-01 forward surface and the AUD-2 tail cannot be entered in the UI, so the invalid-sweep browser export was not reached. Explicit 8-strip canard incidence is refused by the Trefftz guard, a solver finding for independent review.
- **Verified.** Targeted 59/59, `npm test` 192/192 (29 files), exact combined 192/192 (29 files), identity alone 32/32, all exit 0. The combined run took 524 s under heavy load, so the guard is raised to 900 s.
- **Correction.** The `dd7b2c5` commit message says three of 31 identity tests failed. The run had two.
- **Next.** M0-6 and M0-7. Options are in the next-step review. Administrative dispositions stay open and **G0 BLOCKED**.

## 2026-11-07 — UI refresh (presentation only)

- **Changed.** `src/styles.css` (dark "flight-deck" theme: elevation tokens on `:root`, focus ring, badge glyphs, uppercase labels, tabular numerals), `src/graphs.js` (one `PALETTE` object for canvas colours, with a map from the caller's light-theme series colours to dark ones), `src/app.js` line 446 (scene background `0xdce5ec` → `0x0b1119`, the only change there), `index.html` (`color-scheme` and `theme-color` meta tags). No id or DOM structure changed.
- **Not changed.** No physics, threshold, validity rule, export format, displayed number or test. No milestone status, finding or gate changed. G0 BLOCKED, D1–D4 open.
- **Verified.** `npm test` 192/192, exit 0 (99.0 s). With cleared autosave and default inputs, the app's Export results is byte-identical before and after (`d802d2bf…ac4a27`); Save project differs only in `savedAt`. Contrast: 38 pairs measured, all pass (body 13–16:1, muted 5.6–7.8:1, badges 9.2–9.7:1). Focus ring on every focusable control (47 of 50 controls; the other 3 are disabled). No horizontal scroll at 375 (iframe), 620, 621, 1180, 1181 or 1440. No console errors on load and Run. Evidence: [ui-refresh-2026-11-07](../verification/ui-refresh-2026-11-07/README.md).
- **Limits.** The 3D grid-helper colours (`app.js:455`) are outside scope and stay light; a CSS vignette softens them. Unavailable and withheld text has no class hook. 375 px was tested as an iframe because Brave will not resize below about 500 px. The repository has 30 test files, not 29 as earlier records say; the 192 individuals are unchanged.
- **Next.** The M0 implementation queue (a separate prompt).

---

## 2026-11-07 — P2-0: wing and drone baselines (evidence only)

- **Scope:** queue P2 phase P2-0. No `src/` or `tests/` change. Added `.gitignore` entries for the local wing and drone assets and zips, `docs/implementation/QUEUE_STATE.json`, the archived M0-6/M0-7 entry prompt (`continuation-prompts/m0-6-m0-7-entry-2026-11-07.md`), the queue prompt itself, and [`docs/verification/drone-baseline-2026-11-07/`](../verification/drone-baseline-2026-11-07/README.md): manifest, Node baseline script, independent numpy oracle (fresh subagent, did not open `src/` or `tests/`), browser baseline with screenshots.
- **Validation:** `npm test` 192 pass, 0 fail, exit 0 (106 s). Combined TAP runner: see the evidence README. Oracle self-check passed. The production region index sets equal the oracle's by SHA-256.
- **Limitations:** all wing and drone results are unverified; wing import time in the browser was not timed; no source behaviour changed.
