## REM-3b continuation checkpoint — 2026-11-06

REM-3b continuation: container validation implemented/tested only; IA-04/IA-07 remain open pending full audit and independent re-verification. SOL-07 display, proximity and elliptic issues are not resolved; G0 BLOCKED.

# Sol Review — Finding Dispositions and Remediation Traceability

> **Purpose.** This is the working record of how the findings of the independent
> Sol review ([`docs/verification/sol/REVIEW.md`](../verification/sol/REVIEW.md),
> 2026-10-23) are being reconciled,
> corrected, quarantined or restricted. It is deliberately kept **separate** from
> the immutable review evidence under `docs/verification/sol/`, from
> `docs/audits/`, `refs/` and the approved plan documents, none of which may be
> edited to make a counterexample look like a historical pass.
>
> **Rules of this record.** Every finding is treated as evidence requiring
> investigation. A finding is not dismissed because the existing suite passes.
> Closure of a finding requires: (1) a root-cause disposition here, (2) a code
> change commit, (3) a regression test that reproduces the counterexample, and
> (4) independent evidence. Until all four exist, the finding stays **open**.
> Only an independent re-verification (GPT-6.1 Sol) may close findings or clear
> gate **G0**, which remains **BLOCKED**.

_Last updated: 2026-10-23 (M0-5 cycle, REM-2 final task: SOL-09 fit/trim
contract). Reviewer verdict under remediation: **GO WITH CONDITIONS for M0-3
development; G0 and scientific use of the current displays remain BLOCKED.** No
finding is closed here — only Sol's independent re-verification may close
findings._

---

## 0. Independent reproduction (REM-1, pre-fix)

Sol's reproduction suite was re-run unmodified on the reviewed revision
(`ab1fb44` code = `d57783a`), in a scratch mirror (scripts copied byte-identical;
`src/` reached by symlink) so that the committed evidence files in
`docs/verification/sol/` were **not** rewritten. Environment matches the review:
Node v24.21.0, NumPy 2.4.6.

- `npm test`: **54/54 pass** (unchanged baseline).
- `probes.mjs`, `psd-check.py`, `analytic-drag.mjs`, `llt-galerkin.py` all run to
  completion and reproduce **all five evidence artifacts byte-identically**:
  `probe-results.json`, `psd-panels.json`, `psd-counterexample.json`,
  `analytic-results.json`, `llt-results.json` (`diff` clean).
- Every quantitative claim in REVIEW.md §2 was checked against the regenerated
  probe output and matches: SOL-01 scale table (C_L 0.3285 → 2.1210 at 1 cm,
  validity `ok`), SOL-02 yaw table (β = 5°: 1.75 % / 5.17 %; β = 20°: 506.5 %),
  SOL-03 elliptic table (gap −0.25 % → +165.8 %, C_m +38 %, panel force ×11 at
  12×96 vs 8×64), SOL-04 (λ_min = −0.001896870665447473, 4 negative eigenvalues,
  production `trefftzDrag` throws for exactly that Γ), SOL-05 (body-plane e
  recovers the audit table: 1.01212/0.98981/0.97166/0.94115), SOL-06 (α = 0.001°
  reports C_Di = 0 with nonzero Γ; qS = 1e12 suppresses the −1 N near-field drag
  error), SOL-09 (α ∈ [6,12]° → slope 0, `stable: false`, validity `ok`;
  trim −42.688° / −64.311° outside the sampled range), SOL-10 (Γ = NaN → D = 0).
- Surviving mathematics independently re-confirmed: analytic segment velocity
  (−0.11253953951963826 vs −√2/4π to 1 ulp) and the single-horseshoe
  `D = ρG²/π` (exactly 1/π). `llt-galerkin.py` confirms the Glauert tables.
- New negative observation (REM-1): the elliptic tip mode has a sharp field
  signature — the outermost spanwise strip's circulation in individual chordwise
  rows jumps to 5–13 (vs smooth neighbours ≈ 0.25) or flips sign with growing
  amplitude (M = 12/16), while rectangular lattices at M = 12/16 and elliptic at
  M = 4/8 stay smooth. This localised mode corrupts the near-field force loop
  (C_m, local loads) and the near-field drag; Trefftz primary drag and C_L move
  much less, which is why the earlier "near-field diagnostic only" attribution
  (OBS-M0-2-3) understated the damage.

**Conclusion:** all ten findings are reproduced and stand as written. None is a
measurement artifact of the review.

## 1. Classification scheme

- **P-M0-3** — prerequisite to M0-3 (must be corrected before/with the first
  M0-3 corrective work).
- **W-M0-3** — correctable within the M0-3 task group (M0-3/4/5 row of the
  milestone tracker).
- **IND-M0** — independent M0 remediation (M0a/app, tests, documentation).
- **SCI** — requires further scientific investigation before a fix can be
  claimed.

## 2. Finding dispositions

### SOL-01 — scale-dependent corruption (High) — **OPEN → corrected in M0-4, pending Sol re-verification**

- **Reproduced:** yes, exactly (§0). Coefficients change by factors 6.5×/43× at
  1 cm chord with `validity: ok`; residuals stay ~1e-13 because the *truncated*
  system is solved exactly.
- **Root cause:** `EPSILON = 1e-10` is compared against dimensionally different
  quantities (`|r1×r2|²` in length⁴, endpoint lengths, projected r² in length²,
  matrix pivots). Below roughly 3 mm panel features the absolute cutoffs remove
  real influence terms; `solveLinearSystem` also skips elimination factors below
  the same absolute constant. **Second, independent root cause (found during
  M0-4 verification):** the integer-valued auto-N prescription `ceil(AR/2)` is
  discontinuous under ~1 ulp rounding of the computed aspect ratio, whose
  direction varies with scale — at AR/2 integer boundaries the lattice itself
  changes with scale (tail AR = 6: 24 → 32 strips at 0.1×; AR = 10: 40 → 48 at
  1e-3×), moving coefficients by ~3e-4. See DEC-M0-4-3.
- **Classification:** **W-M0-3** (the approved plan already assigns the relative
  cutoff to M0-4; the contract's normative value is `1e-6 × segment length`,
  DATA_CONTRACTS §2.7). Prerequisite to declaring the VLM core resolved.
- **REM-1 interim (exact, non-concealing):** the 3-D segment kernel and the
  Trefftz 2-D kernel now count every evaluation where an absolute cutoff
  suppresses a **harmful** term (`diagnostics.kernelTruncations`). Two classes of
  engagement are excluded by dimensionless, physically justified discrimination
  (exact geometric zeros — evaluation point on the segment's line outside the
  segment, where the exact velocity is zero — and far-field near-collinear
  suppressions whose velocity is provably negligible); everything else,
  including near-field term deletion, is counted. Any case with
  `kernelTruncations > 0` is reported `validity: invalid`. Measured: the SOL-01
  scale 0.01/0.001 rows count 18432/28832 truncations and are quarantined;
  scale 1/0.1/1000 and rectangular R1/R2 count zero; the elliptic 8×64 lattice
  counts 316 (see SOL-03's scale-drift measurement) and is quarantined too. The
  flag is observational, not a proxy threshold; it only ever invalidates.
- **Full fix (M0-4, this cycle):** per-quantity dimensionally consistent
  relative quantities — kernel distance h = |r1×r2|/|r0| and endpoint distances
  vs 1e-6 × |r0|; Trefftz projection and leg coincidence vs 1e-6 × |bound|;
  solver pivot vs 1e-10 × max|A| (dimensionless ratio); elimination skip
  removed entirely; `normalize()` degenerates only on the exact zero vector;
  auto-N prescription snapped to the exact geometry ratio (DEC-M0-4-1/2/3).
  No floor, clip or `Math.abs` replaces the cutoffs; the truncation counter and
  its quarantine are preserved and remain scale-invariant (the counter's own
  discrimination now counts a foot exactly on a segment endpoint).
- **Acceptance criteria — measured this cycle:**
  - VLM-V5 1e-3..1e3 on C_L, C_Di (Trefftz and near-field), C_m and local Γ:
    max relative drift **2.0e-14** (C_m worst; Γ 1.2e-14 active panels;
    dimensional scaling Γ ∝ VL, F ∝ ρV²L², M ∝ ρV²L³ verified exactly under
    V/ρ doubling) — gate 1e-6, unweakened. Also exercised on the elliptic
    8×64 fixture, the auto-N review fixture (M=4, N=32), a wing+tail case and
    a tapered+swept+dihedral+incidence case (≤ 1.1e-14, constant lattices).
  - `kernelTruncations === 0` across 1e-3..1e3 in every case; residuals
    ≤ 3.2e-14.
  - The Sol scale table is a pinned regression: all five rows equal to 1e-9
    relative (`tests/solFindings.test.mjs`); the corrected 0.01/0.001 rows
    equal the c = 1 row to ~2e-16.
  - Independent analytic references across 1e-3..1e3: finite-segment velocity
    −√2/(4πs) to ≤ 3.1e-16 (the pre-fix kernel returned exactly 0 at 1e-3);
    single-horseshoe D = ρG²/π to ≤ 1.7e-16.
  - No arbitrary floor replaces the cutoffs (independent diff audit PASS;
    threshold-weakening audit PASS — see DEC-M0-4-2).
- **Residual (recorded, not claimed solved):** the counter remains a necessary
  guard for genuinely near-singular configurations (near-endpoint/near-filament
  proximity within 1e-6 × |r0|, where the truncated velocity is large); such
  configurations are quarantined, not corrected. The `slope`/fit/trim
  dimensionless checks (`FIT_EPSILON`) are unchanged in role; the fit/trim
  CONTRACT itself was reworked in M0-5 (SOL-09) without touching this
  machinery (verified: SOL-06 values byte-identical in the M0-5 probe replay).
- **Closure:** NOT closed here. Corrected behaviour needs independent Sol
  re-verification.

### SOL-02 — resolution badge certifies the wrong computation (High) — **FIXED in REM-1**

- **Reproduced:** yes. App caller (`src/app.js`) omits `betaDeg` in the
  `runVlmResolutionCheck` call while the plotted sweep gets `flowYawDeg`; the
  helper also forces `spanwisePanels: "auto"`, so a custom plotted lattice is
  never the lattice being certified. At β = 5° both gates already fail
  (1.75 % / 5.17 %) while the badge showed the zero-yaw green result.
- **Root cause:** integration defect at the caller + no input identity/coverage
  in the check output + unconditional conflation of "prescribed R1/R2 agree"
  with "the plotted lattice is converged".
- **Classification:** **P-M0-3** (review sequence item 2 explicitly places it in
  the M0-3 corrective work).
- **Correction (this cycle):** `runVlmResolutionCheck` now (a) runs both sweeps
  at the **exact plotted flow** (β, V, ρ, reference values, surfaces), (b)
  records a full `inputIdentity` and `coverage` (α protocol 0/4°, β, lattice),
  (c) classifies the plotted lattice via `resolutionLabel`; for a **custom**
  lattice it runs the current lattice against a 2× refined lattice (or
  **withholds** the convergence claim when no refinement is possible or when a
  quarantined lattice is involved), and (d) the badge is green only when the
  check that covers the plotted lattice passes; claim status is explicit.
  The two-point (0/4°) fit is labelled a resolution diagnostic, not a certified
  lift derivative. Scope: uncertainty claims at β ≠ 0 are marked unverified
  (the demonstrated envelope of the ±5 %/±8 % comparison is zero yaw) — see
  SOL-08.
- **Acceptance criteria (tests added this cycle):** integration-level test with
  β = 5° asserting the check's identity equals the plotted flow and the badge is
  **amber** with the reproduced deltas (1.75 % / 5.17 % ± tolerance); custom
  M=1×N=4 asserting a current-vs-refined comparison (≈ 8 % C_L deviation from
  R2 must surface, badge never green); R1/R2 at β = 0 pinned to the measured
  0.26 % / 1.05 %; helper output carries `inputIdentity`/`coverage`.
- **Residual (recorded, not claimed fixed):** the α-protocol of the check is the
  approved VLM-V3 window (0/4°); coverage text states this. Convergence claims
  across arbitrary α windows remain future work.

### SOL-03 — elliptic tip instability corrupts primary outputs (High) — **QUARANTINED in REM-1; root cause OPEN (SCI)**

- **Reproduced:** yes. M = 12×64, 12×96, 16×64 on the elliptic fixture:
  near-field/Trefftz gap 22 %/48 %/166 %, C_m drift +38 % vs 8×64, max panel
  force 67/153/614 N vs 13 N at 8×64, e = 0.988 at 12×96 (below the written
  e ≥ 0.99 gate), all with `validity: ok` and tiny linear residuals. Circulation
  field shows the tip-localised alternating spike (§0).
- **New REM-1 measurement (scale drift of the elliptic fixture):** solving the
  8×64 elliptic case at 1×/10×/1000× geometry scale (all lengths, references and
  the wake scaled together) gives C_L drifts of **1.4e-6 / 1.2e-8** against the
  1000× limit (C_Di 2.4e-6, C_m 1.0e-6 at 1×), from 316 harmful absolute-cutoff
  truncations of near-field neighbour-strip terms (plus far-field mirror
  coincidences that are provably negligible and excluded). The 1× lattice is
  therefore *marginally* outside VLM-V5's 1e-6 scale-invariance requirement; at
  0.1× the drift is 4.4e-4 (C_L) / 3.1e-2 (C_m) and at 0.01× the solution is
  fully corrupted. Consequence: the SOL-01 guard quarantines elliptic 8×64 as
  well; the validated usable envelope is elliptic M = 4 (4×32 clean, 0
  truncations). This is the guard flagging a real residual, not a false alarm.
- **Root cause:** not yet established. Candidates recorded in the review
  (§7.2/§7.3): degenerating tip strips (chord → 0 ⇒ sub-panel length → 0, rows
  packing), control point not lying on the curved strip's planar quadrilateral
  (c(y_m) ≠ mean of edge chords), near-singular row coupling in the fan. The
  pathology is present in the reference implementation with its much smaller
  cutoff, so it is **not** caused by SOL-01's absolute epsilon and will not be
  cured by the relative cutoff alone.
- **Classification:** quarantine = **P-M0-3** (this cycle); mechanism/fix =
  **SCI** (own task, before any re-validation of elliptic M > 8).
- **Quarantine (this cycle):**
  1. **Envelope restriction:** elliptic planforms at chordwise rows > 8 are
     outside the validated envelope (VLM-V2d evidence covers M = 4/8 only;
     M = 12/16 demonstrated corrupt) ⇒ `validity: invalid`, message naming
     SOL-03. Not silently clipped: raw values are still returned for
     measurement, but every consumer must treat the case as unverified.  2. **Internal-consistency gate:** for unswept/undeformed (planar) surfaces the
     approved VLM-V2b gate (|near-field − Trefftz| ≤ 1 %) is now enforced as a
     validity gate; exceeding it marks the case invalid (this also catches the
     OBS-M0-2-2 wake-proximity hazard, where the two evaluations disagree).
     For swept/dihedral surfaces the gap is reported but not gated — the matrix
     itself expects −2.5..−12 % there from the RB-07 midpoint rule, so gating
     would be a false claim.
  3. **Unvalidated-envelope warning:** non-elliptic lattices at chordwise rows
     beyond R2 (M > 8) carry an explicit "beyond the validated R2 envelope"
     warning (no evidence of corruption, but no gate evidence either).
  4. Propagation: `runVlmSweep` validity is the worst status over its series;
     the resolution check withholds claims involving quarantined lattices; the
     UI hides numeric stability metrics when a case is invalid and shows the
     quarantine messages.
- **Acceptance criteria (tests added this cycle):** Sol's five elliptic
  configurations pinned — 4×32 stays `ok` with values unchanged to 1e-9; 8×64 is
  quarantined by the SOL-01 truncation guard with its values pinned (measured
  scale drift 1.4e-6, above the VLM-V5 1e-6 requirement — recorded as an open
  M0-4 item, not a closed finding); 12×64, 12×96, 16×64 report `validity:
  invalid` citing SOL-03; the OBS-M0-2-2 wing+tail N=32 α=10° case (gap −1.14 %)
  is flagged; rectangular 12×32/16×96 remain at most `warning`; no value is
  altered to achieve this.
- **Not claimed:** that elliptic 4×32 is "correct" — only that it lies in the
  validated envelope (VLM-V2d evidence) and reproduces the approved evidence
  with zero counted kernel truncations.
- **M0-4 update (this cycle):** restoring the truncated terms (SOL-01 fix)
  removes the truncation-based quarantine of 8×64; the envelope decision is
  re-made on the new evidence: elliptic 8×64 is now scale-invariant to
  ≤ 1.6e-7 across 1e-3..1e3 (VLM-V5 gate 1e-6) with zero truncations and stays
  inside the validated M ≤ 8 envelope — `validity: ok`. Its corrected values
  (C_L 0.339623957890163, C_Di 0.0045067312452539655) equal the clean limit
  OBS-REM-1-1 measured at 10×/1000× to ~1e-15. The M = 12/16 pathology is
  unchanged: their raw values move ≤ 3.5e-7 (C_L) with the restored terms and
  their gaps grow 21.98 → 22.02 %, 47.92 → 48.40 %, 165.83 → 165.86 %;
  the envelope restriction and the VLM-V2b consistency gate still quarantine
  them (independent of the truncation counter, which reads 0). The tip-mode
  root cause remains **OPEN (SCI)** and is not claimed addressed.

### SOL-04 — falsified PSD claim (Medium) — **claim corrected + counterexample pinned in REM-1**

- **Reproduced:** yes (λ_min = −0.001896870665447473; 4 eigenvalues < −1e-10;
  the saved unit eigenvector gives ΓᵀQΓ = −0.001896870665447437 N; production
  `trefftzDrag` throws for exactly that value).
- **Root cause:** a 200-sample random test was documented as evidence of a
  universal positive-semidefiniteness property of the discrete midpoint Trefftz
  quadratic form. The form is indefinite; the sampled region simply never hit a
  negative mode. The physical statement (a converged lifting flow has D ≥ 0) is
  separate from the numerical property of the discretization.
- **Classification:** **IND-M0** (tests; no production change).
- **Correction (this cycle):** the random-sampling test keeps its regression
  value but its claim is bounded to "sampled solutions remain non-negative"; a
  new deterministic test loads the review's saved eigenmode and asserts the
  *documented fact* that the discrete form returns the negative value and is
  rejected by the signed-drag guard — i.e. the counterexample stays live and any
  future universal PSD claim must confront it. The categorical explanation that
  every negative drag must be a sign/orientation error is amended (quadrature/
  discretization can also produce it) in the test commentary.
- **Acceptance criteria:** no test or document asserts universal PSD; the saved
  eigenmode is a pinned regression; the signed-drag guard behaviour is unchanged
  (genuine negative drags still raise).
- **Residual:** adopting a discretization that *is* PSD (if required) is a
  reviewed contract change — out of M0 scope.

### SOL-05 — audit tables use a different drag extraction (Medium) — **OPEN (IND-M0, documentation)**

- **Reproduced:** yes. Holding Γ fixed and switching the drag evaluation plane to
  ew = (1,0,0) recovers all four historical e values to printed precision
  (1.01212/0.98981/0.97166/0.94115); the surviving evidence scripts collapse the
  chordwise distribution per y-station and use `Math.abs(d)`.
- **Disposition:** production follows the higher-priority normative contract
  (general freestream-transverse formula) and is **not** at fault. The
  historical tables remain valid only as regression values for their own
  (y-only, |d|) extraction. OBS-M0-2-1's earlier attribution ("in the record's
  drag/e extraction") is confirmed; its supporting argument ("equal C_Lα fixes
  Γ") is withdrawn as invalid — one scalar does not identify a vector.
- **Classification:** **IND-M0**. Required: a versioned sidecar reconciliation
  that attaches exact geometry/wake/drag-extraction identity to every published
  benchmark value; the matrix's +x-wake sentence is recorded as a lower-priority
  contradiction, not an instruction to undo the freestream wake.
- **Acceptance criteria:** sidecar exists; historical files unchanged; future
  benchmark values carry full extraction identity; the ±5 %/±8 % numbers are
  re-assessed against the production formula before any further use (ties to
  SOL-08).
- **REM-1:** disposition recorded; sidecar deliberately deferred to its own
  documentation task (no code depends on it).

### SOL-06 — "roundoff" floor is a hidden significance cutoff (Medium) — **OPEN → corrected in SOL-06 (REM-2), pending Sol re-verification**

- **Reproduced:** yes (frozen evidence + re-reproduced byte-for-byte at HEAD
  before any change, `/tmp/opencode/sol-06/pre-fix-results.json`). α = 0.001°:
  C_L = 8.15e-5, nonzero Γ, C_Di reported as exactly 0 with no warning
  (quadratic scaling predicts ~2.6e-10, resolvable in double precision); the
  derived efficiency `e` was **infinite** at the dead-band alphas; `qS = 1e12`
  suppresses a supplied −1 N near-field drag entirely, `qS = 1` rejects it;
  the analytic 1/π horseshoe drag is overwritten to 0 at `qS = 1e12`;
  `solveVlmCase` with `refAreaM2 = 1e12` zeroes its dimensional drag.
- **Root cause:** `max(1e-6·Σ|terms|, 1e-9·qS)` is an output-significance policy
  presented as roundoff handling; keying it on `qS` lets reference area change
  dimensional force behaviour and mask sign errors.
- **Classification:** **W-M0-3** — scheduled with M0-4 (both concern absolute
  tolerance semantics). **Not closed** — only Sol closes findings.
- **Correction (SOL-06, REM-2; DEC-SOL-06-1..4):** the only tolerance on a drag
  value is now the **forward error of the evaluated sums in newtons** —
  γ_n·Σ|terms| + counted IEEE operation chains (u = 2^-53) acting on magnitudes
  ≥ |term| + coordinate-translation amplification (`sum|p|/|r|` terms;
  DEC-SOL-06-4, after an independent high-precision falsification of the first
  bound found a 4.4× under-coverage at 1e9 m coordinate offsets). `qS` is
  legal only in coefficient arithmetic. Raw signed values are always preserved
  (`dragNTrefftzRaw`, `dragNNearFieldRaw`); values inside the tolerance are
  reported as exactly 0 **only** with an explicit size-declared suppression
  (`suppressedToZero` + `reason` + `toleranceN`, plus a `solveVlmCase`
  validity warning) — numerically *unresolved*, not insignificant; a raw exact
  0 is never flagged; nothing is suppressed without an error basis
  (DEC-SOL-06-2/3). The near-field/Trefftz ratio is NaN ("not comparable")
  when either extraction is unresolved. Non-finite evaluations fail loudly.
  No floor, clip or `Math.abs` conceals any value; the signed-drag rejection
  survives unchanged for resolved negative drag. Near-zero-lift physics (zero
  circulation → exact 0; α = 0.001° → true tiny drag), not injected scalars,
  validates the zero case.
- **Acceptance criteria — measured this cycle:**
  - Sol's `roundoff-floor` probe: −1 N rejected **identically** at qS = 1 and
    1e12 (byte-identical messages declaring the tolerance); the analytic 1/π
    drag survives every qS bitwise; suppression decisions and tolerances are
    qS-independent (pinned).
  - Sol's `alpha` probe: C_Di(0.001°) = **2.639541990860498e-10** and
    C_Di(0.0001°) = 2.6395419879644464e-12 — the review's quadratic prediction
    (2.63954e-10) confirmed; C_Di follows k·sin²α across four decades to
    ~1e-8 relative; e finite ≈ 1.0022; the linear solutions (C_L, Γ, forces)
    are byte-identical to the frozen evidence.
  - Reference-area invariance: `solveVlmCase` dimensional forces and both raw
    drags bitwise equal at `refAreaM2` 1/8/1e12 with identical detection and
    validity; only coefficients change (pinned).
  - Physical dimensional consistency + scale invariance: the tolerance is a
    force scaling exactly as the force scale (s², pinned 1e-3..1e3) with
    tolerance/drag ≤ 1e-9 at normal coordinates (probe lattice 5.9e-12; no
    dead band — the ratio is Γ²-homogeneous, so the true tiny drags survive at
    every scale and offset) and identical decisions at every scale; the
    coordinate-translation amplification keeps |computed − 1/π| ≤ toleranceN
    from 0 to 1.3e12 m offsets (two independent exact-arithmetic rounds:
    every falsifier closed, Class A coverage 757×–1.6e11×, worst margin
    anywhere 38.2×, 0 wrong throws / 0 wrong suppressions in 456 adversarial
    evaluations).
  - VLM-V2's "raw near-field D" assertion now operates on
    `dragNNearFieldRaw` (and the near-field oracle comparison likewise).
  - `tests/solFindings.test.mjs` pins the review's two probes as regressions;
    `tests/vlmSolver.test.mjs` validates the zero case from physics and keeps
    the demo-sweep/−20 N regressions (strengthened across qS).
- **Residual (recorded, not claimed solved — OBS-SOL-06-1):** the bound is a
  worst-case forward-error bound (measured actual errors lie 1e4–1e7 below it
  in adversarial families); its tightness degrades with |coords|/|element| as
  double precision demands and suppression of normal-scale drag begins only
  where the worst-case bound itself reaches it (≳ 3e11 m coordinates on the
  probe lattice) — flagged, raw preserved, semantics "not provably resolved",
  never "measured noise". The 3-D segment kernel's internal near-parallel
  cancellation is not modelled in the bound (now covered incidentally:
  measured ≥ 2180× after the leg-weighted tightening) and under/flow outside
  the quadratic working range is out of Tier-0 scope (non-finite evaluations
  fail loudly). Independent re-verification and a diff audit passed (no
  threshold weakened; the one replaced assertion is the documented NaN
  "not comparable" contract).

### SOL-07 — displayed graphs/verdicts scientifically unsafe (High) — **OPEN (IND-M0 = M0a track)**

- **Reproduced:** yes, by code path (pitch ODE collapses α ≡ θ; unconditional
  "Stable/Unstable"; stale canvases on invalidation/error; "CD total" mixes
  assumed CD0 without mandated labels; geometry accuracy outside solver checks;
  demo report stale).
- **Disposition:** accepted as written. These are the already-planned M0a tasks
  (M0-6..M0-9, M0-11..M0-16) — not an M0-1/M0-2 regression. **G0 and any
  scientific use of the displays remain BLOCKED** until they are done and the
  demo report is regenerated.
- **REM-1 partial (minimal, no redesign):** quarantined (validity `invalid`)
  cases now show their numeric stability metrics as *unavailable* with the
  quarantine messages instead of silently rendering numbers. Stale-canvas
  clearing, pitch-graph quarantine, verdict gating, CD0/provenance labels and
  geometry validity remain open in the M0a tasks.
- **Acceptance criteria:** per the PHASED plan quarantine items + DATA_CONTRACTS
  §2.4–2.5; every plot/export carries reference values, method, domain, source
  and validity.

### SOL-08 — acceptance bands presented as general uncertainty (Medium) — **partially addressed (scope), claim OPEN**

- **Reproduced:** yes (label unconditional; demonstrated comparisons cover only
  zero-yaw R1/R2 lattices against approximate LLT/Helmbold references; SOL-01/02
  directly violate the numbers; VLM-V2's band admits −10 % while the UI says
  ±8 %).
- **Disposition:** the approved label string is preserved for in-envelope
  results (its provenance and claim live in the contract; changing the
  numerical claim requires a separately reviewed contract revision). Outside
  the demonstrated envelope the label is replaced by an explicit "unverified"
  statement and a scope note is attached to every result
  (`uncertaintyScope`): observed comparison agreement on R1/R2 zero-yaw
  lattices, not a confidence interval or validated error bound.
- **Classification:** scope enforcement **P-M0-3** (this cycle, minimal);
  full envelope definition + label revision = **IND-M0** with SOL-05's
  re-assessment.
- **REM-1:** β ≠ 0 (and any case already invalid) reports the label as
  unverified-outside-envelope. Remaining envelope dimensions (scale — covered by
  SOL-01's flag; α window; geometry class) to be enumerated in the REM-2 record.
  **REM-2/M0-4:** the scale dimension is now *verified* rather than flagged —
  VLM-V5 1e-3..1e3 on C_L/C_Di/C_m/Γ (≤ 2.0e-14) plus the auto-N prescription
  fix — so scale is no longer an unverified envelope dimension for the tested
  planform classes; the α window and geometry-class dimensions remain open.
- **Acceptance criteria:** no result outside the stated envelope displays the
  ±5 %/±8 % label; scope text accompanies every label; any changed numerical
  claim goes through contract review.

### SOL-09 — fit validity and trim (Medium) — **CORRECTED in M0-5 (linear-window guard + fit/trim contract), pending Sol re-verification**

- **Reproduced:** yes, byte-for-byte against the frozen `fit-trim` probe rows
  before any change (OBS-M0-5-1): α ∈ [6,12]° step 2 → zero slopes +
  `stable: false` + validity `ok`; the 0/4° two-point sweep accepted as a
  derivative (clAlpha 4.705038725518481) with trim −42.68825231435979° far
  outside its own [0, 4]° sweep; the 2..6° sweep reported trim
  −64.31108697968388° using the 2° moment as the zero-angle intercept. All
  three rows reproduce the frozen `probe-results.json` values exactly.
- **Root causes (three, all confirmed against the code and by measurement):**
  1. `slope()` returned **0** for an empty/short window and the result was
     presented as a derivative (`clAlphaPerRad: 0`), with `stable: false`
     rendering "Unstable" and validity silently "ok" — no linearity gate at
     all (DR-26 class).
  2. `trimAlphaDeg` used the **nearest sampled moment to α = 0**
     (`nearestAlpha(series, 0).cm`) as the intercept of the trim root instead
     of a fitted intercept, and applied **no in-range and no positive-lift
     gate** (DATA_CONTRACTS §2.5 "Trim" unimplemented).
  3. Two-point windows (the 0/4° protocol) were accepted as certified
     derivatives although the §2.5 contract requires ≥ 3 points and
     adjacent-pair slope consistency.
- **Correction (M0-5; `src/vlmSolver.js` `runVlmSweep` + new `linearFit`,
  `sampledClAt`, `resolveStabilityVerdict`; `src/app.js` display/verdict
  plumbing; `src/projectState.js` persistence):**
  - **Fit contract** (DATA_CONTRACTS §2.5, RB-21): the window is |α| ≤ 5° of
    **converged** points (quarantined points excluded — DEC-M0-5-1); a slope
    is certified only with ≥ 3 window points **and** every adjacent-pair slope
    within 5 % of the window least-squares slope, else the exact contract
    phrases "insufficient linear data" / "non-linear: not determined". The
    fitted intercept (meanY − slope·meanX) replaces the nearest-sample
    intercept. Undetermined fields are **null** — never NaN, never a silent
    zero slope, never `false`.
  - **Trim** (§2.5 "Trim"): α_trim = −intercept/slope from the certified C_m
    fit, reported only if C_L(α_trim) > 0 (evaluated from converged samples,
    DEC-M0-5-2) **and** α_trim lies inside the sampled sweep (inclusive,
    DEC-M0-5-3); otherwise `trimStatus` states "not determined" with the exact
    gate that withheld it.
  - **Validity honesty:** an undetermined fit raises the sweep validity from
    "ok" to "warning" with per-response messages (an adjacent-slope failure no
    longer claims a point-count problem); quarantined sweeps stay "invalid".
  - **Verdicts at the source** (§2.5 rules 1-4; reviewer finding S4): the bare
    `stable` boolean is **removed**. The solver exposes `cmSlopeNegative` (a
    slope fact) and `stabilityVerdict`, which is "determined" only when the
    linearity criteria hold **and** the caller supplies the contract evidence
    (H-tail present, massSource ≠ assumedUniform, modelDescription). Any
    missing condition withholds the verdict naming the unmet conditions
    (STAB-V2 wing-alone, STAB-V3 assumed-mass). Today no mass provenance
    exists, so no verdict can be shown — exactly the review's demand to
    withhold unqualified "Unstable" (DEC-M0-5-4).
  - **Two-point diagnostic separation:** the R1/R2 protocol slope is computed
    by its own `twoPointSlopePerRad` and exported as
    `clAlphaTwoPointPerRad` — bit-identical arithmetic (the pinned VLM-V3
    deltas unchanged), never a certified derivative field.
  - **VLM-V8:** `seedReferencePlaceholder` adds a validity warning naming the
    bounds-seed placeholder; values are provably unchanged by the flag.
- **Acceptance criteria status (measured, tests below):** VLM-V7 "insufficient
  linear data" for α ∈ [6,12]° with no NaN and no "Unstable" ✓ (solver and
  browser display); 2-point window rejected ✓; VLM-V8 seed placeholder =
  warning with a message ✓; trim in-range with positive lift or explicitly
  "not determined" ✓ (round-trip to 1e-9°, both gates tested in isolation);
  two-point R1/R2 diagnostic labelled and never a certified derivative ✓.
- **Tests (additive, 85 → 101):** `tests/solFindings.test.mjs` SOL-09 group
  (the three frozen counterexamples; fitted-intercept round-trip with an
  independent least-squares cross-check; out-of-sweep and non-positive-lift
  gates; inclusive/exclusive trim boundary; quarantined-point exclusion;
  scale-free band end-to-end at ×1e-13/×1e13; cd0/cm0 badge invariance;
  diagnostic renaming) and `tests/vlmSolver.test.mjs` VLM-V7/V8 groups
  (contract constants and the 5 % band pinned with synthetic windows; verdict
  rule set; seed flag flip with bit-equal values).
- **Independent verification (own scripts/derivations, two subagent rounds):**
  least-squares slope/intercept match an independent derivation to ~3 ulp (the
  sampled-neighbour intercept is off by 1.4e-2 — the defect's signature);
  trim round-trip max |Δα_trim| = 5.4e-15°; 1305-trial falsification of the
  trim gates (436 out-of-range roots withheld, 234 non-positive-lift roots
  withheld, 635 valid trims reported to 1.1e-14°); band classification
  boundary exact at 5 % (4.899 % passes, 5.101 % rejected); zero-incidence
  M0-3 values unchanged at 1e-13; old-vs-new certified slopes equal to < 1e-12
  relative. Adversarial diff review: no blockers; its S1-S5 findings (band
  pinning, VLM-V8 flip test, message wording, verdict gate at the source,
  `common` shadowing) were all **closed before commit**.
- **Note for re-verification:** the frozen `moment-reference` probe row now
  reports `cmAlpha: null, np: null` at x = 0.25 (the C_m window at the
  quarter-chord reference is measurably non-linear at the 5 % level —
  OBS-M0-5-2) while x = 0 and x = 0.5 rows are bit-identical; the three
  `fit-trim` rows and the `badge-baseline` field rename are the only other
  probe-output changes versus the previous post-fix run (5 of 50 rows; values
  of the two-point slopes bit-identical).

### SOL-10 — NaN circulation silently becomes zero (Low) — **FIXED in REM-1**

- **Reproduced:** yes (`Number(circulation[j]) || 0`).
- **Classification:** **P-M0-3** (API integrity; cheap; prevents hiding
  upstream failures).
- **Correction (this cycle):** `trefftzDrag` validates before evaluating:
  circulation array length, finite Γ (error names the panel index), positive
  finite density, finite panel coordinates and a finite non-zero wake direction.
  Missing scientific data is never converted into plausible zero.
- **Acceptance criteria:** Sol's `nonfinite-gamma` probe now raises naming the
  panel index; malformed inputs raise; negative *finite* Γ is still evaluated
  (no `Math.abs`); valid inputs give byte-identical values (all existing
  4-decimal regression tables unchanged).
- **Note for re-verification:** because the probe `probes.mjs` calls
  `trefftzDrag` with NaN without its own try/catch, the script now stops at that
  probe *by design of the demanded fix*. The pre-fix evidence is preserved
  byte-identical in `docs/verification/sol/`; the post-fix behaviour is covered
  by `tests/solFindings.test.mjs`. Sol's scripts are never modified.

### Review §7.2 item 2 — sweep with incidence (incidence/c-4 convention) — **RESOLVED by decision in M0-3, pending Sol re-verification**

- **Finding (review §7.2 item 2):** `sectionAt` sets x_LE = x_c/4 − c/4 and the
  bound points add `(cos i, 0, −sin i)·f·c`, so the projected total c/4 x is
  `x_c/4 + c(cos i − 1)/4`; measured projected c/4 sweep 25.03127° at i = 10°
  and 25.07012° at i = 15° (input 25°, b = 8, cr = 1, ct = 0.3, M = 1,
  N = 8). "Whether it violates the intended sweep/incidence convention
  requires explicit resolution in M0-3. ... Do not silently alter the
  incidence pivot or add another sweep correction."
- **Reproduction (before any change):** byte-for-byte against the frozen
  `probe-results.json` `incidence-sweep` rows; analytic replica of the LE-pivot
  locus matches to 2e-14° (OBS-M0-3-1). The sweep conversion itself is
  verified correct and applied **exactly once** (measured LE line =
  `atan(tan Λ_c/4 + (c_r − c_t)/(2b))` to ~1e-14 at i = 0; double conversion
  excluded by > 2°; no change to `sectionAt`).
- **Root cause:** the incidence rotation pivoted about the section leading
  edge, coupling the planform (c/4 sweep) to the incidence angle on tapered
  planforms — the same defect class as DR-21/B-VLM-03, reappearing at
  nonzero incidence.
- **Resolution (explicit, recorded — DEC-M0-3-1/2 in
  [`ISSUE_AND_DECISION_LOG.md`](ISSUE_AND_DECISION_LOG.md)):** incidence now
  rotates each section about its **local quarter-chord point**, the
  DATA_CONTRACTS §3.2 rotation convention; the projected c/4 line of the
  generated panels is exactly the input sweep at any incidence (VLM-V6 with
  incidence measured to ±1.4e-14°), and zero-incidence geometry is
  byte-identical to the pre-change code (M0-1/M0-2/M0-4/SOL-06 preserved).
  The residual ambiguity (matrix rows scoped zero-incidence; §2.7's LE formula
  is the planform definition, exact at i = 0) is recorded in DEC-M0-3-1 and
  was independently derived and assessed (quarter-chord pivot confirmed;
  LE-pivot reading judged strictly weaker). Consequences: at i ≠ 0 the
  projected LE locus is `tan Λ_c/4 + ((c_r − c_t)/(2b)) cos i` (asserted
  analytically in tests).
- **Acceptance evidence:** commit `5eb07d7`; `tests/vlmSolver.test.mjs`
  "M0-3" × 7 (VLM-V6 with incidence incl. per-station straightness and the
  matrix ± 0.01° gate; single-conversion measure-back; absolute-anchor
  q/LE/TE + control points + normals; elliptic anchors; multi-surface;
  negative-incidence sign); independent subagent verification (26,211-lattice
  falsification campaign worst 2.13e-14°; 177,462-edge rigid-rotation
  residuals ≤ 4.4e-14 rel; rectangular α/i equivalence to 1.0e-15 rel;
  translation invariance; 0 findings) + independent diff audit (no gate
  touched; tests purely additive); Sol replay diff exactly 3 intended rows
  (OBS-M0-3-1).
- **Status:** **corrected in M0-3 — pending Sol re-verification.** Carried
  residual: swept-planform α-vs-incidence wedge (characterized,
  OBS-M0-3-2) and the M2 GEO-T4 twist analogue. Only Sol may close this.

## 3. Observations disposition (OBS-M0-2-x)

Sol's §5 table is adopted: OBS-M0-2-1 → SOL-05 (argument withdrawn as stated,
conclusion confirmed); OBS-M0-2-2 → wake/grid sensitivity confirmed and now
caught by the consistency gate when it exceeds the approved 1 %; OBS-M0-2-3 →
superseded by SOL-03 (worse than stated); OBS-M0-2-4 confirmed (fit window work
in M0-5); OBS-M0-2-5 → superseded by SOL-06 (original event plausible roundoff;
repair overbroad — corrected in SOL-06 this cycle).

## 4. Remediation dependency order

| Cycle | Content | Findings | Status |
|---|---|---|---|
| **REM-1 (this)** | Reproduce all findings; dispositions; badge exact-flow + custom-grid coverage (SOL-02); elliptic tip quarantine + consistency gate (SOL-03); kernel-truncation observational guard (SOL-01 interim); PSD claim bound + eigenmode pin (SOL-04); uncertainty scope enforcement (SOL-08 partial); trefftz input validation (SOL-10); minimal quarantine display | SOL-02, SOL-03 (quarantine), SOL-10, SOL-04 (claim), SOL-01 (interim), SOL-08 (partial) | **done pending re-verification** |
| **REM-2 = M0b M0-3/4/5** | Relative singularity cutoff (kernel/endpoint/projection/pivot/elimination, dimensionally consistent per quantity) + VLM-V5 1e-3..1e3 on C_L, C_Di, C_m, Γ (SOL-01); raw-value-preserving drag significance policy (SOL-06); sweep conversion verification + incidence/c-4 semantics resolution (review §7.2, VLM-V6 with incidence) (M0-3); linear-window guard + fit/trim contract (SOL-09, M0-5, VLM-V7/V8) | SOL-01 (M0-4 **corrected, pending Sol re-verification**), SOL-06 (**corrected, pending Sol re-verification**), SOL-09 (**M0-5 corrected, pending Sol re-verification**), review §7.2 (**M0-3 resolved by decision DEC-M0-3-1, pending Sol re-verification**) | **done — M0-4 + SOL-06 + M0-3 + M0-5 implemented; all pending Sol re-verification** |
| **REM-3** | Benchmark sidecar reconciliation + envelope definition + label/claim re-assessment (SOL-05, SOL-08 full); near-field proximity guards (OBS-M0-2-2 full envelope); elliptic tip-mode scientific investigation (SOL-03 root cause) | SOL-05, SOL-08, SOL-03 (root cause) | planned |
| **M0a track** | Geometry slicing + validity gate, stability/pitch quarantine, hash/restore, staleness, demo report regeneration (M0-6..M0-16) | SOL-07 | planned (unchanged) |

Note: REM-2 deliberately groups the three absolute-tolerance corrections
(SOL-01, SOL-06, SOL-09-fit) with their scheduled M0-3/4/5 tasks — one coherent
numerics task group — rather than spreading incompatible tolerance rewrites
across cycles.

## 5. Traceability (finding → change → test)

Filled as commits land. Pre-fix reproduction: `docs/verification/sol/` (frozen).

| Finding | Change commit | Regression test (this cycle) | Independent evidence |
|---|---|---|---|
| SOL-01 (interim) | REM-1 commit `84cf90f` (harmful-truncation counter + quarantine) | `tests/solFindings.test.mjs` "SOL-01" ×2 | Sol scale table re-measured unchanged; counter observable in `diagnostics.kernelTruncations` (18432/28832 at 0.01/0.001; 0 at 0.1/1/1000) |
| SOL-01 (M0-4 fix) | M0-4 commit (relative per-quantity cutoffs, elimination-skip removal, rounding-robust auto-N) | `tests/solFindings.test.mjs` "SOL-01" ×2 (five-row scale table pinned to 1e-9; guard discrimination), `tests/vlmOracles.test.mjs` "VLM-V5" ×2 + "M0-4 analytic" | independent pre-fix reproduction (baseline byte-matches the review table); VLM-V5 drift ≤ 2.0e-14 (gate 1e-6) incl. Γ and dimensional scaling; analytic −√2/(4πs) and ρG²/π across 1e-3..1e3; independent subagent re-measurement + diff audit; Sol scripts re-run post-fix (OBS-M0-4-2) |
| SOL-02 | REM-1 commit `84cf90f` (`runVlmResolutionCheck` identity/coverage + caller) | `tests/solFindings.test.mjs` "SOL-02" ×4 | Sol yaw table re-measured; badge reproduces the β = 5° failures (1.752 %/5.171 %) |
| SOL-03 | REM-1 commit `84cf90f` (envelope restriction + consistency gate + sweep propagation); M0-4: 8×64 envelope re-made on new evidence, M>8 values corrected | `tests/solFindings.test.mjs` "SOL-03" ×6 (8×64 test rewritten as the scale-invariance regression; 12×64 pins corrected — values moved ≤ 3.5e-7 by the restored terms, quarantine intact) | Sol elliptic table + Γ-field signature + scale-drift measurement (1.4e-6 at 8×64, REM-1 protocol; see OBS-M0-4-1) |
| SOL-04 | REM-1 commit `84cf90f` (test + message/comment de-categorization) | `tests/solFindings.test.mjs` "SOL-04" | `psd-counterexample.json` eigen-decomposition (NumPy), reproduced to 1e-12 |
| SOL-08 (scope) | REM-1 commit `84cf90f` (label scoping) | `tests/solFindings.test.mjs` "SOL-08" | Sol SOL-08 text; envelope = zero yaw / in-envelope lattices |
| SOL-10 | REM-1 commit `84cf90f` (`trefftzDrag` validation) | `tests/solFindings.test.mjs` "SOL-10" ×3 | Sol `nonfinite-gamma` probe (pre-fix evidence preserved; script now stops at that probe by design of the fix) |
| SOL-06 | `a4d0859` (forward-error cancellation tolerance replacing the qS floor; raw preservation + explicit size-declared suppression; coordinate-translation amplification, leg-weighted) | `tests/solFindings.test.mjs` "SOL-06" ×5 (the review's `roundoff-floor` and `alpha` probes pinned; reference-area invariance; scale/dimensional consistency; translation coverage + non-finite guards), `tests/vlmSolver.test.mjs` reworked zero-case test, `tests/vlmOracles.test.mjs` VLM-V2 raw assertions | pre-fix counterexamples reproduced byte-for-byte (`/tmp/opencode/sol-06/pre-fix-results.json`); Sol probes re-run (OBS-SOL-06-2: exactly 4 intended row changes vs M0-4); two independent exact-arithmetic rounds (every falsifier closed; worst margin 38.2×; 0 wrong decisions in 456 adversarial evaluations) + diff audit (no threshold weakened) |
| SOL-05/07 | — | — | — (open; see §2) |
| SOL-09 (M0-5) | M0-5 commit (linearFit contract: ≥3 converged window points + 5 % adjacent-pair consistency + fitted intercept; trim gates C_L(α_trim) > 0 and in-sweep with explicit "not determined"; validity honesty; verdict gate at the source with cmSlopeNegative/stabilityVerdict; two-point diagnostic renamed) | `tests/solFindings.test.mjs` "SOL-09" ×10 (three frozen counterexamples; fitted-intercept round-trip + independent LSQ; both trim gates isolated; trim boundary inclusive/exclusive; quarantined-point exclusion; scale-free band ×1e-13/×1e13; cd0/cm0 badge invariance), `tests/vlmSolver.test.mjs` "VLM-V7" ×3 + "VLM-V8" (constants + 5 % band pinned synthetically; verdict rule set; seed flip with bit-equal values) | pre-change byte-for-byte reproduction of the frozen `fit-trim` rows; independent least-squares/round-trip derivation (5.4e-15° worst); 1305-trial falsification of the trim gates (0 escapes); band boundary exact at 5 %; zero-incidence M0-3 values unchanged at 1e-13; adversarial diff review (S1-S5 closed pre-commit); Sol replay diff exactly 5 intended rows (badge rename bit-identical, moment-reference x = 0.25 honestly undetermined per OBS-M0-5-2, three fit-trim rows) |
| review §7.2 item 2 (M0-3) | `5eb07d7` (incidence pivots about the local quarter chord; sweep conversion verified single, `sectionAt` unchanged) | `tests/vlmSolver.test.mjs` "M0-3" ×7 (VLM-V6 with incidence ±0.01° matrix gate + 1e-9° invariance + per-station straightness; single-conversion measure-back + rotated-LE locus; absolute-anchor q/LE/TE, control points, normals; elliptic anchors; multi-surface; negative-incidence sign) | pre-change byte-for-byte reproduction of the frozen `incidence-sweep` rows + analytic replica (2e-14); zero-incidence byte identity (1.07 MB snapshot diff empty; independent 10/10 incl. solves); independent derivation + 26,211-lattice falsification (worst 2.13e-14°), 177,462-edge rigid-rotation check, rectangular α/i equivalence 1.0e-15 rel, translation invariance, 0 findings; independent diff audit (no gate touched, additive tests, immutables empty); Sol replay diff exactly 3 intended rows (OBS-M0-3-1) |

## 6. Gate status

**G0 remains BLOCKED.** Nothing in REM-1 authorises scientific use of any
display or closes any Sol finding. MiMo may state that individual defects
*appear* corrected in the tested domain; only independent re-verification (Sol)
may close findings and clear G0. Evidence package for that re-verification will
be assembled when the M0-3 group (REM-2) and M0a display work are complete.

### AUD-1 follow-up — 2026-11-06
SOL-02 / IA-01 and IA-05: comparison quarantine, coverage, and expanded structured identity implemented/tested in the working tree, pending independent re-verification. See `../verification/aud-1-2026-11-06/` and CURRENT_HANDOFF.md. The earlier REM-1 FIXED heading does not supersede the independent audit counterexample. SOL-07 export quarantine (IA-02), SOL-08 scope (IA-03), and other open findings are unchanged. G0 remains BLOCKED.


AUD-2 / IA-02 (SOL-07 export portion): implemented/tested, pending independent re-verification, not closed. Quarantined sweep values withheld in versioned JSON with validity and provenance. Broader SOL-07 display, stale state, pitch and geometry remain open; G0 BLOCKED. Evidence: `../verification/aud-2-2026-11-06/README.md`.

### REM-3a update (2026-11-06)
SOL-05: historical-vs-production extraction sidecar created, evidence and provenance limits explicit; implemented/tested, pending independent re-verification. SOL-08 / IA-03: fixed numerical claim withheld on all cases and in app copy pending a reviewed complete envelope; implemented/tested, pending independent re-verification. This supersedes earlier claims that zero yaw alone establishes scope. Scientific basis and contractual claim remain open; independent review must assess the sidecar and policy. No finding closed, and G0 remains BLOCKED.

REM-3b partial / IA-04 / SOL-10: Trefftz circulation entry validation implemented/tested, pending independent re-verification. IA-04 is not closed: other malformed inputs still coerce. IA-07 remains open: sweep hang and uncapped automatic lattice remain. SOL-07, proximity and elliptic science remain open; G0 BLOCKED. Evidence: `../verification/rem-3b-2026-11-06/README.md`.

REM-3b continuation / IA-04 and IA-07: partial solver and Run input checks plus operational limits implemented; full API validation and independent re-verification remain outstanding. SOL-10 is not closed, nor are IA-04/IA-07. SOL-07 display, proximity and elliptic science remain open; G0 BLOCKED. See `../verification/rem-3b-cont-2026-11-06/README.md`.


REM-3b continuation (2026-11-06): endpoint count corrected and tested, but IA-04/IA-07 remain partial and open. Remaining API validation, operational-boundary and integration coverage require completion; see `docs/verification/rem-3b-review-2026-11-06/README.md` and current handoff. No independent re-verification; G0 remains BLOCKED.


**REM-3b validation continuation, 2026-11-06:** Partial geometry, lattice, case and resolution input checks and representable sweep progress added. IA-04/IA-07 remain open; comprehensive boundary tests and independent review remain. G0 BLOCKED. See `docs/verification/rem-3b-validation-2026-11-06/README.md` and current handoff.


### REM-3b continuation checkpoint (2026-11-06)

REM-3b remains partial. Negative cd0 and degenerate supplied panels now fail explicitly; these checks and existing work require compatibility review and independent re-verification. Targeted 13 individual tests passed; full and boundary verification remains incomplete. See `docs/verification/rem-3b-resume-2026-11-06/README.md`. IA-04 and IA-07 remain open; G0 remains BLOCKED. No scientific acceptance or finding closure is implied.


### REM-3b audit checkpoint (2026-11-06)

Explicit malformed lattice options now fail rather than default; legacy numeric options remain. A fresh probe shows endpoint snapping may add a sample beyond the supplied end (1 − Number.EPSILON, step 1). This remains unfixed. IA-04/IA-07 remain open, pending completion and independent re-verification; G0 remains BLOCKED. See `docs/verification/rem-3b-audit-2026-11-06/README.md` and CURRENT_HANDOFF.md.


### REM-3b decimal continuation — 2026-11-06

REM-3b / IA-04 and IA-07 remain open: decimal endpoint defect corrected in working tree, pending completion and independent re-verification. Negative cd0 and basic degenerate-panel checks are pre-existing partial work, not a full geometry audit. IA-06/08, SOL-07 display safeguards, proximity and elliptic science remain unresolved; G0 BLOCKED.

### REM-3b challenge checkpoint — 2026-11-06

Partial and uncommitted. Independent decimal vectors and the real 2048-panel solve boundary passed; an extreme finite reference previously returned infinite moment as valid, now explicitly refused with a red-before-fix regression. Complete API/compatibility audit and reusable actual-app error boundary remain. Combined individual runner timeout remains unexplained. IA-04/IA-07 remain open; IA-06/08, SOL-07 display, proximity and elliptic science remain unresolved. AUD-1/AUD-2/REM-3a await independent re-verification. G0 BLOCKED. See `../verification/rem-3b-challenge-2026-11-06/README.md` and CURRENT_HANDOFF.md. Operational caps are not scientific acceptance.

REM-3b investigation: finite offset overflow is refused at sweep assembly. IA-04/IA-07 remain open; this is not independent re-verification or closure of any SOL finding. AUD-1, AUD-2 and REM-3a still await independent re-verification; G0 remains BLOCKED.


### REM-3b follow-up checkpoint (2026-11-06)

The actual Run handler now has a reusable VM boundary regression covering real solver refusal and a simulated resolution-check failure; both clear stored results and set error status. This is limited coverage, not a DOM or full display test. No production behavior or scientific threshold changed. See `docs/verification/rem-3b-followup-2026-11-06/README.md`. REM-3b, IA-04/IA-07 and the broader app/API audit remain incomplete; prior AUD-1, AUD-2 and REM-3a await independent re-verification. G0 remains BLOCKED. No finding is closed.

## REM-3b deep continuation — 2026-11-06

Partial, uncommitted: generated nonfinite/degenerate panels are refused; a supplied-panel metadata inconsistency can change wake length and CL while reporting ok and remains unresolved. The combined individual-test runner timed out; no aggregate pass is claimed. See `docs/verification/rem-3b-deep-2026-11-06/README.md` and CURRENT_HANDOFF. IA-04/IA-07 remain open, prior AUD-1/AUD-2/REM-3a await independent re-verification; G0 remains BLOCKED. No scientific acceptance or finding closure is implied.

## REM-3b Sol checkpoint — 2026-11-06

SOL-10/IA-04 finite numeric circulation, absent versus supplied Trefftz options, and arithmetic normalization checks are implemented and tested, pending independent re-verification. IA-07's original hang explicitly refuses, with further endpoint, panel and Run regressions. The prescribed combined runner passed 149 tests after a test-only correction. Acceptance remains partial for translated wake arithmetic and cumulative synchronous workload. No change to the VLM-V3 gates or withheld fixed claim. The tested stale Run cleanup is a narrow portion of the display path. Remaining SOL-07 safeguards, IA-06, IA-08, proximity and elliptic science stay open. [Evidence](../verification/rem-3b-sol-2026-11-06/README.md). G0 **BLOCKED**.

## REM-3b-R checkpoint — 2026-11-06

IA-04/IA-07 acceptance corrections for translated wake arithmetic and cumulative synchronous work are implemented/tested, pending independent re-verification. SOL-01/06 relative cutoffs and signed-drag reporting still apply in the working frame. The projected-difference and finite-leg probes exercise the arithmetic separately. SOL-02 retains exact-flow identity, quarantine and the prescribed 0°/4°, 1%/5% VLM-V3 protocol. SOL-08's fixed claim remains withheld. The work guard is operational and browser refusal clears the previous Run. Remaining SOL-07 safeguards, IA-06, IA-08, proximity and elliptic science stay open. AUD-1, AUD-2 and REM-3a still await independent re-verification. See [REM-3b-R evidence](../verification/rem-3b-r-2026-11-06/README.md). G0 remains **BLOCKED**.


## M0-REVERIFY-1 — 2026-11-06

SOL-02 / IA-01 and IA-05: the entry audit re-observed quarantine and exact-flow coverage, then found the seed identity collision and nonfinite grid summaries. Their corrections are implemented/tested, pending independent review. SOL-07 / IA-02: export withholding and usable browser provenance corroborated for the tested paths. SOL-05/08 / IA-03: historical extraction and fixed-claim withholding corroborated; the scientific envelope remains open. SOL-10 / IA-04 and IA-07: malformed inputs, signed translation equivalence and operational refusal corroborated in the tested scope. IA-06, IA-08, remaining SOL-07 safeguards, proximity and elliptic science remain open. **G0 BLOCKED.** [Evidence](../verification/m0-reverify-1-2026-11-06/README.md).

## M0-REVERIFY-2 — comparison identity and representability (2026-11-06)

**SOL-02 / IA-01 / IA-05 remain open administratively.** Independently verified the effective seed flag, warning propagation, true slope overflow, per-grid reasons and comparison coverage at the requested boundaries. The newly found intermediate overflow correction is **implemented/tested, pending independent re-verification**. Both downloads retain the identity and validity records relevant to IA-02. SOL-08's fixed claim stays withheld. IA-06, IA-08, remaining SOL-07 safeguards, proximity and elliptic science stay open. G0 remains **BLOCKED**. [Evidence](../verification/m0-reverify-2-2026-11-06/README.md).

## M0-REVERIFY-3 — slope and signed delta (2026-11-06)

SOL-02 / IA-01 / IA-05: independently verified the inherited 0°/4° slope fallback, true overflow, grid-specific reasons, effective seed identity and applicable coverage on the recorded entry fixtures. A finite relative lift-slope delta between large opposite-signed slopes was falsely withheld. Its correction is **implemented/tested, pending independent re-verification**. IA-02 project and result downloads agree for the inherited recovery and withholding controls. SOL-08's fixed uncertainty claim stays withheld. Administrative dispositions stay open. IA-06, IA-08, remaining SOL-07 safeguards, proximity and elliptic science remain open. **G0 BLOCKED.** [Evidence](../verification/m0-reverify-3-2026-11-06/README.md).

## M0-REVERIFY-4 — Independent signed-delta corroboration (2026-11-06)

SOL-02 / IA-01 and IA-05 have independent corroboration for the inherited signed-delta recovery, coarse denominator, true aggregate overflow, separate grid validity and effective seed identity on the recorded fixtures. IA-02 project and result records agree for real prescribed and custom recovery and withholding. SOL-08 / IA-03 fixed uncertainty stays withheld, with the scientific envelope still open. This is scoped corroboration. Administrative dispositions remain open, including the broader IA-02 and SOL-07 conditions. IA-06, IA-08, remaining SOL-07 safeguards, proximity and elliptic science stay outside this phase. **G0 BLOCKED.** [Evidence](../verification/m0-reverify-4-2026-11-06/README.md).

## M0-EVIDENCE-RECONCILE — Ledger reconciliation (2026-11-07)

No finding is closed and no disposition changes. The [review ledger](../verification/m0-evidence-reconcile-2026-11-07/LEDGER.md) records each condition's source, evidence class, observed outcome and remaining gap.

- **SOL-02 / IA-01 and IA-05.** Corroborated for the tested inputs. The IA-01 prescribed green badge and the IA-05 identity collision reproduce on the audited commit `9a66316`. They are absent on the working tree, with withheld comparisons and distinct identities. The comparison arithmetic is corroborated for the represented inputs in the rational oracle. Still open: browser coverage at β ≠ 0 and on the IA-01 invalid fixture, and an exhaustive identity-field test. Commit of the tested solver change is pending (D4). Administrative dispositions stay open.
- **IA-02 (SOL-07 export portion).** Corroborated for the tested paths. Invalid-sweep JSON withholds values and keeps validity. Eight real downloads carry provenance, coverage and withholding. Still open: a browser export of an invalid sweep, restore → solve → export, source hashing (M0-9), and the JSON-only format decision (D2).
- **SOL-08 / IA-03.** The fixed claim is withheld on every tested output. The label was reproduced on `9a66316` and is absent on the working tree. The scientific envelope is still open. Restoring any claim is an owner decision (D1). The SOL-05 benchmark sidecar awaits independent review.
- **Limit (not a pass).** A three-sample plotted sweep at S ≈ 2–3e-307 m² throws the existing fit refusal (OBS-M0-EVIDENCE-1, D3).

IA-06, IA-08, remaining SOL-07 safeguards, proximity and elliptic science stay outside this phase. **G0 BLOCKED.**

## M0-EVIDENCE-GAP-CLOSE — Gap-closure checks (2026-11-07)

No finding is closed and no disposition changes. In the user's Brave through Claude in Chrome, the β = 5° prescribed check reproduces the API result exactly, and restore → solve → export reproduces the pre-save run exactly on the valid fixture. SOL-02 and IA-01 are corroborated at the browser boundary for the zero-yaw and β = 5° comparisons, and the IA-01 invalid fixture stays at the API and function boundary, because the UI cannot express a forward surface. IA-05 identity coverage has 32 passing tests for the material inputs. IA-02 is still open for the invalid-sweep browser export, which the UI cannot reach without a tail. SOL-07 item 3 (stale curves after a refused Run) is confirmed in the browser and remains open under M0-11. Administrative dispositions stay open. IA-06, IA-08, remaining SOL-07 safeguards, proximity and elliptic science stay outside this phase. **G0 BLOCKED.** [Evidence](../verification/m0-evidence-gap-close-2026-11-07/README.md).
