# Independent adversarial review: M0-1 and M0-2

**Reviewer:** Codex / Sol, independent of the implementation and original audit authors.  
**Date:** 2026-10-23, Asia/Dhaka.  
**Reviewed revision:** `ab1fb44e9a674d664dc85034edfccc79eb570b6c`, branch `impl/m0`; numerical implementation `d57783a1428d55848eace8c74ef11067370d6010`.  
**Verdict for proceeding to M0-3: GO WITH CONDITIONS.** This permits corrective development. It does **not** accept M0-1/M0-2 as correct throughout their exposed input domain, pass G0, approve engineering use of the graphs, or validate aircraft/CFD predictions.

The own-trailing-leg correction, force signs, coefficient normalization, and implementation of the normative general Trefftz formula survive this review in the tested rectangular, zero-yaw benchmark domain. The existing 54 tests pass. Nevertheless, deterministic probes falsify broader claims: small-scale models give severely wrong coefficients with `validity: ok`; the app's green resolution badge can assess a different flow and resolution than the plotted case; elliptic tip instability changes primary drag and pitching moment; and the purported positive-semidefinite drag test misses negative eigenmodes. The original audit's efficiency tables also use a different drag calculation from the final normative contract. Neither author's documentation can be treated as an independent correctness certificate.

## 1. Scope, independence, and evidence preservation

Only files in `docs/verification/sol/` were created for this review. Production source, existing tests, plans, original audits, reference documents, and implementation documentation were not changed. No fixes were attempted. The review remains a separate record for later comparison and remediation.

Read and cross-checked: the original mathematical audit and discrepancy register; relevant implementation/requirements/UI audit findings; original stakeholder requirements; approved MASTER, PHASED, validation matrix and original handoff; normative contracts §§1, 2.4–2.7 and architecture principles; current implementation handoff, issue log including all five OBS-M0-2 observations, changelog and M0 tracker; `vlmSolver.js`, its callers, graph/pitch/recognition paths, VLM tests and non-VLM regression suite; the implementation's reference program and results; and commit history/diffs from `776457a` through HEAD. The principal code changes are `af416b4` (M0-1) and `d57783a` (M0-2). Approved audit/plan/contract files have no changes between baseline `776457a` and reviewed HEAD.

The implementation's oracles are assessed as evidence, not adopted as authority. New probes use analytical Biot–Savart and elliptic-loading identities, a separate Galerkin lifting-line derivation with NumPy/LAPACK, dimensional invariance, deterministic eigendecomposition, and controlled changes of inputs. Importing the production module in `probes.mjs` and `analytic-drag.mjs` runs the device under review; the analytic expected values and Python oracles do not import it. No subagents authored this review.

The original audit scratch scripts were unexpectedly still available at `/tmp/claude-1000/-home-tanvir-Coding-AirFLOW/76bf9998-d405-4391-a3a5-0698b59e1664/scratchpad/opus/`. Two were copied verbatim, with hashes, into `evidence/`; they were not edited or used as the independent physics oracle. Their current contents establish the calculation mismatch described in SOL-05; they have no Git provenance proving that these exact bytes generated the historical tables.

### Reproduction

From the repository root, with Node v24.21.0 and Python with NumPy 2.4.6:

```bash
npm test
node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs
node docs/verification/sol/probes.mjs
python docs/verification/sol/psd-check.py
node docs/verification/sol/analytic-drag.mjs
python docs/verification/sol/llt-galerkin.py
```

The second command exposed all **54 individual passing tests**, no skips, in about 45 seconds; saved as [test-output.tap](evidence/test-output.tap). The ordinary isolated invocation on this host reports nine passing test files; that is not a nine-test failure or a replacement for counting the individual tests. The standalone implementation reference was **not** executed in place: its last line writes its original `RESULTS.md`, which would violate this review's preservation requirement.

Review evidence files:

| File | Purpose |
|---|---|
| [probes.mjs](probes.mjs), [probe-results.json](probe-results.json) | Deterministic production-solver counterexamples and numerical measurements |
| [llt-galerkin.py](llt-galerkin.py), [llt-results.json](llt-results.json) | Independent Galerkin lifting-line reference; 30/60/120 odd terms |
| [psd-check.py](psd-check.py), [psd-counterexample.json](psd-counterexample.json), [psd-panels.json](psd-panels.json) | Full geometry, explicit circulation vector and negative eigenvalue |
| [analytic-drag.mjs](analytic-drag.mjs), [analytic-results.json](analytic-results.json) | Exact prescribed elliptic loading and production replay of negative drag |
| [evidence/opus-vlm_multirow.mjs.txt](evidence/opus-vlm_multirow.mjs.txt), [evidence/opus-vlm_elliptic.mjs.txt](evidence/opus-vlm_elliptic.mjs.txt) | Read-only copies of original calibration scripts |
| [MANIFEST.json](MANIFEST.json) | Reviewed commit, baseline tracked-file hashes, review artifact hashes |

Numbers below are deterministic measurements from these files unless explicitly identified as a historical claim. File locations refer to the reviewed revision; unqualified paths are repository-relative. Severity describes impact if these outputs are trusted: **High** = materially misleading scientific output/false acceptance; **Medium** = significant verification or provenance gap/edge defect; **Low** = limited API robustness issue. No new Critical defect was demonstrated.

## 2. Confirmed findings

| ID | Severity | Status / origin | Finding |
|---|---|---|---|
| SOL-01 | High | Confirmed; inherited DR-35, amplified by finer M0-2 panels | Absolute singularity thresholds destroy scale invariance while validity remains OK |
| SOL-02 | High | Confirmed M0-2 integration defect | Green R1/R2 badge ignores the actual yaw and custom plotted lattice |
| SOL-03 | High | Confirmed; OBS-M0-2-3 understated | Tip instability affects primary drag, moment and local loads, not only the secondary diagnostic |
| SOL-04 | Medium | Confirmed false-positive verification claim | Discrete Trefftz quadratic form is not PSD on the existing random-test geometry |
| SOL-05 | Medium | Confirmed calculation/provenance mismatch | Audit efficiency tables use collapsed y-only drag; OBS-M0-2-1's attribution lacked this evidence |
| SOL-06 | Medium | Confirmed M0-2 regression in reporting | “Roundoff” floor erases resolved positive drag and can suppress negative-drag errors |
| SOL-07 | High | Confirmed inherited, planned M0a quarantine unfinished | Current stability/pitch/stale/drag graphs remain unsuitable as scientific results |
| SOL-08 | Medium | Confirmed unsupported scope of claim | Fixed ±5%/±8% label is broader than the demonstrated oracle envelope |
| SOL-09 | Medium | Confirmed inherited; planned M0-5 / §2.5 work | Invalid fits produce zero slopes/Unstable; trim is unconstrained and can be outside sweep |
| SOL-10 | Low | Confirmed API defect | Nonfinite circulation silently becomes zero in drag evaluation |

### SOL-01 — Absolute epsilon silently corrupts physically similar small wings

**Locations:** `src/vlmSolver.js:2`, `198–208`, `253–256`, `268–273`, `570–578`, `421–429`; test coverage `tests/vlmOracles.test.mjs:593–611`. Normative requirement: `docs/architecture/DATA_CONTRACTS_AND_PIPELINE.md:179`; VLM-V5: `docs/plans/VALIDATION_AND_TEST_MATRIX.md:36`.

Use a rectangular wing, b=8c, M=4, auto N=32, α=4°, V=40 m/s, ρ=1.225 kg/m³, S=8c², moment reference (c/4,0,0), wake floor 10b. Scale **all geometry and references** together:

| c (m) | C_L | C_Di | C_m at c/4 | Residual | validity |
|---:|---:|---:|---:|---:|---|
| 1 | 0.328473669 | 0.004286228 | 0.001874052 | 1.58e-14 | ok |
| 0.1 | 0.328473669 | 0.004286228 | 0.001874052 | 1.50e-14 | ok |
| 0.01 | 2.121030357 | 0.185968809 | −0.732160929 | 1.28e-13 | ok |
| 0.001 | 1.156773385 | 0.052419414 | +0.639143293 | 1.98e-13 | ok |
| 1000 | 0.328473669 | 0.004286228 | 0.001874052 | 1.94e-14 | ok |

At 1 cm chord the lift is **6.46×** the baseline and induced drag **43.39×**. These are numerical changes; no Reynolds model exists that could explain them. A small residual merely proves solution of the modified, incorrectly truncated influence matrix.

The kernel compares |r1×r2|², with dimensions length⁴, to a fixed `1e-10`; endpoint lengths, projected length² and matrix pivots use the same numeric constant for different dimensions. The reference program uses a much smaller segment threshold (`scripts/m0-2-reference/verify.mjs:100–101`), so ordinary-scale agreement does not exercise this production defect. The current scale test stops at 0.1×, missing the matrix's required 0.001× case.

**Necessary correction:** implement M0-4 using a dimensionally meaningful relative distance to each segment, including endpoint, projection and solver safeguards; do not mechanically replace every epsilon by the same quantity. Require VLM-V5 across 1e-3..1e3 and verify C_Di, moments and local circulation as well as C_L. Until then, flag/refuse unsupported scales. This is scheduled work, not grounds to demand that M0-4 already be finished; it does prevent calling the core generally resolved.

### SOL-02 — The green badge can certify a different computation

**Locations:** `src/app.js:324–350`, especially missing `betaDeg` in `341–350`; `src/vlmSolver.js:523–550`; `src/app.js:353–358`, `src/vlmSolver.js:183–189`, `index.html:122–129`.

The plotted sweep receives `betaDeg: params.flowYawDeg` at app line 331. The resolution-check call does not pass beta, so it tests **β=0**. For the SOL-01 unit wing at α=4°:

| β | R1 C_L | R2 C_L | R1 C_Di | R2 C_Di | ΔC_L | ΔC_Di |
|---:|---:|---:|---:|---:|---:|---:|
| 0° | 0.328474 | 0.327618 | 0.00428623 | 0.00433129 | 0.260% | 1.051% |
| 5° | 0.321472 | 0.327105 | 0.00422056 | 0.00443879 | 1.752% | 5.171% |
| 20° | 0.297279 | 0.305964 | 0.00788896 | 0.04784840 | 2.921% | 506.524% |

Already at **5° sideslip**, both acceptance limits fail, while the app displays the zero-yaw green result. At 20° the result is spectacularly nonconvergent. Near-field/Trefftz agreement still looks excellent: at β=20°, relative differences are −0.0276% and −0.00455%. This is a concrete example of common-circulation agreement failing to verify circulation accuracy. The per-case validity is `ok` in every run. No claim of physical validity at β=20° is made; the defect is accepting/exposing it without scope enforcement and checking the wrong flow.

Separately, the helper unconditionally chooses auto R1/R2, irrespective of the plotted custom grid. For M=1,N=4, width/length=2 passes the aspect guard and reports `ok`; C_L=0.354226 differs **8.12%** from R2, e=1.23293, while the independent R1/R2 badge remains green. A panel shape guard does not establish sufficient resolution. The MASTER's DEC-17 calls for M≥4, but the UI exposes M=1..16.

**Necessary correction:** pass the exact flow into resolution checks, record the check's full input identity, and make clear which lattice/α range it covers. Compare a custom current grid with a suitable refined grid or withhold its convergence claim. Reject or label unsupported yaw/angles. Do not equate prescribed R1/R2 agreement with current-grid convergence or absolute accuracy. Add integration coverage for β≠0 and custom grids; the helper-only test at `tests/vlmSolver.test.mjs:159–178` cannot catch the missing caller argument.

### SOL-03 — Elliptic tip pathology propagates into primary reported quantities

**Locations:** `src/vlmSolver.js:74–110`, `363–383`, `415–423`; rows accepted at `188–189`; UI at `index.html:122`; contested claim `docs/implementation/ISSUE_AND_DECISION_LOG.md:364–379`. Existing elliptic test: `tests/vlmOracles.test.mjs:431–454`.

At elliptic AR=8, c0=1 m, b=2π m, S=πb/4, α=4°, V=40, ρ=1.225, c_ref=1, r_ref=(0.25,0,0), wake=100b:

| M×N | C_L | C_Di, primary | e | C_m | near-field/Trefftz | max panel |F| (N) |
|---|---:|---:|---:|---:|---:|---:|
| 4×32 | 0.341636 | 0.00449824 | 1.03239 | 0.00139337 | −0.252% | 36.36 |
| 8×64 | 0.339624 | 0.00450673 | 1.01835 | 0.00146522 | +0.269% | 13.13 |
| 12×64 | 0.340999 | 0.00457155 | 1.01205 | 0.00196205 | +21.984% | 67.43 |
| 12×96 | 0.339864 | 0.00465088 | 0.98818 | 0.00202611 | +47.917% | 152.73 |
| 16×64 | 0.341355 | 0.00465756 | 0.99544 | 0.00238883 | +165.829% | 614.17 |

M=12,N=96 returns `validity: ok`, residual 8.60e-13 and pivot ratio 0.00847. Compared with 8×64, primary drag changes **3.20%**, e **−2.96%**, C_m **+38.28%**, and the largest local force grows over elevenfold despite finer subdivision. It also misses the written elliptic e≥0.99 gate, whose table does not restrict M to 4/8. M=16's only warning is “coarse spanwise spacing,” not an unstable solution. These measurements disprove “near-field only” and “e within 0.3%.” The gate tests only 4×32 and 8×64.

The user-facing geometry controls currently generate linear trapezoids rather than the elliptic fixture. Thus the exact elliptic counterexample is confirmed for the exposed solver API/fixture; a matching browser trapezoid failure has not been established. Even in the elliptic API, both integrated moment and local loads derive from the same corrupt force loop; selecting primary drag from Trefftz cannot protect them.

**Necessary correction:** quarantine the demonstrated unstable configurations, propagate numerical/mesh validity to all affected outputs, and investigate fan geometry/collocation and singularity treatment. Evaluate chordwise/spanwise refinements separately and inspect tip modes/local loads. Do not assert that a relative cutoff alone will cure a pathology also seen in the reference with its much smaller cutoff. Do not silently widen e gates or accept a small linear residual as a remedy.

### SOL-04 — A random test falsely suggests a PSD drag operator

**Locations:** `tests/vlmOracles.test.mjs:566–576`; production quadratic form `src/vlmSolver.js:246–279`; sign-error diagnosis `689–692`.

The test draws 200 arbitrary circulation vectors on a wing+tail lattice and finds nonnegative drag. That does not prove positive semidefiniteness. Rebuild its exact M=4,N=12-per-surface geometry (wing b=8,c=1; tail b=3,c=0.5,x=4,z=0.6; α=5°). Independently assemble D=ΓᵀQΓ from the two-dimensional kernel and diagonalize H=(Q+Qᵀ)/2:

- Four eigenvalues are below −1e-10.
- λ_min=**−0.001896870665447473**, λ_max=2.7383867741413743.
- The saved unit eigenvector gives ΓᵀQΓ=−0.001896870665447437 N.
- Production `trefftzDrag` with that vector throws for **D=−0.001896870665447428 N**, reproducing the independent calculation.

This is a mathematical counterexample to the test's stated universal property, not evidence that a positive-energy physical flow can have negative total induced drag. The discrete midpoint quadratic form is not an exact energy integral. The saved vector is not asserted to be the solution of a normal flat-plate boundary condition. A physical solution returning negative primary drag was **not** demonstrated in this geometry. The assertion's explanation that every negative drag must be a sign/orientation error is therefore too categorical: quadrature/discretization can cause it.

**Necessary correction:** replace random sampling as the basis of a universal PSD claim with deterministic operator checks over the claimed geometry domain; retain this eigenvector as a counterexample during remediation. Separate numerical nonpositivity from a proven orientation defect. If universal PSD is required, adopt and independently verify a discretization with that property, subject to a reviewed contract change.

### SOL-05 — OBS-M0-2-1 resolves to a concrete projection mismatch

**Locations:** original record `docs/audits/ADVERSARIAL_PLAN_REVIEW.md:398–440`; original handoff `docs/plans/IMPLEMENTATION_HANDOFF.md:73–81`; contradictory matrix sentence at `docs/plans/VALIDATION_AND_TEST_MATRIX.md:24`; normative general formula `docs/architecture/DATA_CONTRACTS_AND_PIPELINE.md:173–176`; implementation attribution `docs/implementation/ISSUE_AND_DECISION_LOG.md:306–337`.

The surviving original script, preserved in `evidence/opus-vlm_multirow.mjs.txt:10–13`, sums Γ across chordwise rows, places the entire shed distribution at each **y** station, evaluates a y-only downwash and applies **Math.abs(d)**. The elliptic script also collapses chordwise circulation and ignores projected x-dependent transverse offsets (`evidence/opus-vlm_elliptic.mjs.txt:15–18`). These are not the final all-leg, freestream-transverse formula.

Hold current Γ fixed and change only the drag evaluation plane to ew=(1,0,0):

| AR, R2 | Audit e | General freestream e | Body-plane e using same Γ |
|---|---:|---:|---:|
| 4 | 1.0121 | 1.033045832 | 1.012124587 |
| 6 | 0.9898 | 1.006460146 | 0.989806013 |
| 8 | 0.9717 | 0.986004689 | 0.971664645 |
| 12 | 0.9412 | 0.952952966 | 0.941153001 |

All four audit values recover to their printed precision. With ew=(cosα,0,sinα), the transverse coordinate of an x-separated row includes −x sinα; collapsing rows discards this separation. A single-row rectangle cannot expose the mismatch because its rows have the same x. This explains why the single-row historical table matches both approaches.

**Disposition:** current production follows the higher-priority normative contract. The table mismatch is **not** proof that production's general formula is incorrectly coded. The historical artifacts provide a concrete explanation; MiMo's conclusion that equal integrated C_Lα uniquely fixes all circulations is logically invalid (one scalar does not identify an entire vector). A same-formulation reference implementation does not by itself assign blame to a historical script.

**Necessary correction:** preserve the original tables, publish a versioned sidecar reconciliation, and attach exact geometry/wake/drag-extraction identity to future benchmark values. Treat the matrix's +x-wake sentence as a documented lower-priority contradiction, not an instruction to undo the approved freestream wake. Reassess the evidence supporting the fixed uncertainty numbers with the actual production formula. No original audit or approved plan was edited here.

### SOL-06 — The “roundoff” repair is a significance cutoff with hidden side effects

**Locations:** `src/vlmSolver.js:279–283`, `669–697`; `tests/vlmSolver.test.mjs:301–313`; OBS claim `docs/implementation/ISSUE_AND_DECISION_LOG.md:400–421`.

The floor `max(1e-6 Σ|terms|, 1e-9 qS)` is many orders above IEEE double roundoff and does not check whether circulation/lift is near zero. A unit AR=8 wing at α=0.001° has C_L=8.15382e-5, nonzero Γ, but reports **exactly C_Di=0**, no warning. At α=0.01°, C_Di=2.63954e-8; quadratic scaling predicts about 2.63954e-10 at 0.001°, above numerical roundoff but below the chosen cutoff. This creates a dead band and can produce infinite derived efficiency/L/D.

A stronger dimensional counterexample uses the analytic unit horseshoe: ρ=Γ=1, exact D=1/π. With qS=1 its primary drag is 0.318309886 N; with qS=1e12 the same **dimensional** drag is overwritten by zero. Supplying nearFieldDragN=−1 throws at qS=1 and returns zero for both primary and near-field drags at qS=1e12. Arbitrary reference area should change coefficients, not dimensional force or the detection of a resolved negative force. This extreme reference case is an API counterexample, not a claim about a normal aircraft reference area.

**Necessary correction:** separate a declared output-resolution/significance policy from roundoff error. Preserve raw signed dimensional values and expose suppression explicitly. Base cancellation tolerances on actual floating-point operations/term magnitudes and validate near-zero lift cases from the physics, rather than injected tiny numbers paired with arbitrary nonzero Γ. Demonstrate that changing reference area cannot change raw force or mask its sign. VLM-V2's assertion at `tests/vlmOracles.test.mjs:372` calls the near-field value “raw,” but `match.inducedDragN` is already sanitized; it cannot verify the sign of the raw projection below this floor.

### SOL-07 — Existing graphs and verdicts are still scientifically unsafe

**Locations:** `src/app.js:293–308`, `775–825`, `863–870`, `922–933`; `src/stability.js:38–74`; `src/recognition.js:140–196`; `CALCULATION_PIPELINE.md:587–620`. Requirements: `docs/architecture/DATA_CONTRACTS_AND_PIPELINE.md:130–151`, `178–181`; quarantine tasks `docs/plans/PHASED_IMPLEMENTATION_PLAN.md:34–42`.

Confirmed by tracing the current display path:

1. **Pitch response is nonphysical.** Let δ=α−θ. The implemented ODE gives δ̇=−1.25δ, while δ(0)=0. Thus α=θ identically: the purported independent aerodynamic angle state adds no flight-path/lift dynamics. RK4 integrates the chosen equations; that does not make them a short-period aircraft model. The app automatically calls it after a successful VLM solve and titles the graph “Linearized pitch response from VLM Cm slope.” The original audit correctly identified this structural defect; it remains.
2. **Stable/Unstable is unconditional.** The renderer prints it from a boolean without tail, mass-source or linearity gating. An assumed-mass wing-only run can still appear to diagnose an aircraft. Improved induced drag does not establish aircraft static stability.
3. **Stale curves remain drawn.** `invalidateVlm` nulls data and clears lattice/metrics but never clears or greys either canvas. The solver-error catch likewise leaves the old pixels. These old curves can sit beside changed inputs or an error. This is confirmed by code path, not a newly performed pixel-level browser test.
4. **“CD total” is CDi + a user-entered constant.** Coefficient and load arithmetic is now consistent, but the graph and CSV lack the mandated assumed-CD0 label, moment-reference/source fields and validity/provenance. Mixing kN forces and kN·m moment on one unlabeled vertical scale also prevents quantitative physical comparison.
5. **Geometry accuracy remains outside the solver's checks.** The vertex-bin estimator and `valid: warnings.length===0 || areaM2>EPSILON` are unchanged. A numerically solved lattice based on incorrect selected geometry cannot become accurate by carrying a green badge. The demo report still lists 24 panels and the original defective CDi≈0.0087; it was not regenerated for M0-2.

**Necessary correction:** complete M0-6/7/8/11/14/16 before accepting displayed results; hide the pitch graph until the approved model/disclosure gate, withhold invalid stability verdicts, and clear stale/error curves. Attach provenance and applicability to exported data. These are known pending M0a tasks, not evidence of an M0-1 drag-sign regression.

### SOL-08 — Numerical acceptance bands are being presented as general uncertainty

**Locations:** unconditional constant `src/vlmSolver.js:12`, application at `422–423`, `498–499`, `551`; `index.html:129`; norm `docs/architecture/DATA_CONTRACTS_AND_PIPELINE.md:178`; matrix `docs/plans/VALIDATION_AND_TEST_MATRIX.md:14–16`, `28–34`.

The label is implemented as specified, but its unconditional scientific interpretation is unsupported. Passing approximate LLT/Helmbold comparisons on a few zero-yaw grids is not a probability interval or a validated error bound over all geometry/scale/yaw/angle inputs. SOL-01 and SOL-02 directly violate those numbers. SOL-03 shows that a seemingly converged scalar does not bound moment/local-load error. There is no coverage study, confidence level, propagation of geometric/mass/model uncertainty, or independent CFD/experimental validation supporting a universal interval.

Even within the intended envelope, R1/R2 proximity is not an asymptotic error estimate: two levels provide no observed order, monotonicity check or remaining-error estimate. The exact prescribed-loading calculation in §3 below demonstrates a systematic one-sided drag bias. The VLM-V2 band admits −10% against LLT while the UI says ±8%; those are defensible as different approximate references only when their scope and contributions are explicitly explained, not as interchangeable error bounds.

**Necessary correction:** preserve the approved label's provenance, qualify it as observed comparison agreement for a stated envelope, and mark out-of-envelope results unavailable/unverified. Any change to the approved numerical claim belongs in a separately reviewed contract revision. Do not imply a 95% confidence interval, physical aircraft accuracy, or validated uncertainty in C_m/NP. Geometry and regime restrictions must accompany the number.

### SOL-09 — Fit validity and trim do not meet the approved contract

**Locations:** `src/vlmSolver.js:479–488`, `633–644`; rendering `src/app.js:775–785`; norm `docs/architecture/DATA_CONTRACTS_AND_PIPELINE.md:130–144`.

For α=6..12° the fit window is empty: `slope` returns zero, `stable` is false and validity remains `ok`; the app renders “Unstable,” instead of insufficient linear data. Two points 0/4° are accepted as a slope, including inside the resolution helper, despite the general ≥3-point contract. With cm0=0.02, the 0/4° sweep reports trim **−42.688°**, outside the sweep and without a positive-lift/in-range check. A 2..6° sweep reports −64.311° and uses the 2° moment as though it were the zero-angle intercept.

**Necessary correction:** implement the ≥3-point and adjacent-slope tests, propagate invalid/undetermined derivative status, fit an actual intercept, and require a positive-lift trim within the sampled range (or explicitly state it is not determined). Separate a deliberately defined two-point convergence diagnostic from an accepted physical lift derivative. This is already scheduled M0-5/§2.5 work.

### SOL-10 — NaN circulation is silently replaced by no circulation

**Locations:** `src/vlmSolver.js:252`, `264`, `288`, `295`.

`Number(circulation[j]) || 0` maps NaN or a missing entry to zero. The one-panel analytic probe with Γ=NaN returns D=0 rather than rejecting invalid input. This matters for an exported numerical API and can hide upstream failures; a negative finite input is not the same issue. A malformed finite linear solve was not shown to generate NaN here.

**Necessary correction:** validate array length, finite circulation, positive density and finite panel coordinates before evaluating drag; fail with the panel index. Missing scientific data must not become a physically plausible zero.

## 3. Mathematical verification that survived falsification

### Kernel, orientation, drag factor, signs and reference values

For a unit-strength segment from (0,−1,0) to (0,1,0), at P=(1,0,0), integrating dl×r/(4π|r|³) gives v_z=−√2/(4π). Production returns −0.11253953951963826 versus −0.11253953951963827 analytically. The algebraic finite-segment expression is correct away from its absolute cutoff.

For an x-directed wake and a unit-width straight bound vortex, the bound-midpoint velocity induced by its two own semi-infinite legs is w=−Γ/(πb). Each infinite Trefftz leg doubles its semi-infinite counterpart at a common streamwise origin. Therefore D=ρΓ²/π for that horseshoe, and the Trefftz factor 1/2 gives the same result. The probe returns exactly 1/π for Γ=ρ=1. Production includes these self trailing legs and excludes only its own bound segment (`src/vlmSolver.js:366–379`), fixing the original DR-01 mechanism.

The general transverse formula follows by Kutta–Joukowski projection: (v×l)·ew=v·(l×ew). At the common-origin planar limit the far-wake transverse velocity is twice the bound-plane trailing velocity. The transverse vortex kernel ew×r/(2πr²), the opposite signs at A/B, and the signed scalar product in production are consistent with this derivation. The factor-of-two argument is not a proof that arbitrary noncoplanar, finite, midpoint-discretized near-field and Trefftz values must agree exactly; SOL-04 disproves an overly broad energy interpretation.

The freestream formula has unit norm and satisfies e_L·ew=0 even at nonzero beta with the current revised components. Thus the old observation that the unchanged lift-axis vector is necessarily nonorthogonal at β≠0 no longer follows after correcting the freestream. Yaw convergence remains problematic for a different reason (SOL-02). For α>0, positive Γ gives +z lift; r×F gives a positive nose-up M_y for a reference aft of the aerodynamic center. Current moment probes recover the sign flip and x_NP≈0.24376..0.24441 c, within VLM-V4's ±0.01 c tolerance. This is not an independent validation of a swept aircraft NP.

Doubling S and c_ref gives C_L and C_Di halves and C_m quarters, with identical dimensional lift and Trefftz drag at normal force levels. The wake floor remains 10b in this reference-only experiment. Dimensional sweep drag now agrees with (C_Di+CD0)qS. The force-suppression exception is SOL-06. No new global sign inversion, missing 1/2, or normalization error was found in the ordinary benchmark range.

### Independent lifting-line reference

For a rectangular wing, take Γ=2bV ΣA_n sin(nθ), a0=2π, μ=a0/(4AR). The lifting-line equation is

`α sinθ = Σ A_n sin(nθ) [sinθ/μ + n]`.

Project onto odd sine modes. The required analytic integral is

`I_kn = ∫₀^π sinθ sin(kθ) sin(nθ)dθ = 1/[1−(k−n)²] − 1/[1−(k+n)²]`.

Thus `[I_kn/μ + (π/2)n δ_kn] A_n = (π/2)α δ_k1`, with C_L=πAR A1 and C_Di=πAR ΣnA_n². This differs from the tests' theta collocation and handwritten elimination and uses no production lattice or kernel. At 120 odd terms:

| AR | C_Lα /rad | e_LLT |
|---:|---:|---:|
| 4 | 4.028386731 | 0.972311604 |
| 6 | 4.530424988 | 0.953934766 |
| 8 | 4.837704011 | 0.936670380 |
| 12 | 5.199084949 | 0.906558648 |

60→120 changes C_Lα by less than 4e-11 /rad. The test suite's Glauert values survive this independent calculation. Current R2 lift slopes at AR=6/8/12 are roughly 3.94/3.01/2.03% low at α=4°, consistent with their approved 5% test band. LLT is an approximate model at finite AR; excluding AR=4 from this accuracy gate is not proof of absolute VLM correctness there. The Helmbold expression is likewise an approximate swept-wing reference, not an experimental uncertainty bound.

### Exact elliptic loading, separated from an elliptic planform

Specify Γ(y)=Γ0√[1−(2y/b)²] rather than ask the solver for Γ on an elliptic wing. Classical lifting-line downwash is w=−Γ0/(2b), L=ρVΓ0πb/4, and D=ρπΓ0²/8. These identities give an analytic drag oracle independent of the solver's influence matrix or planform generator.

For ρ=Γ0=1, D_exact=π/8=0.392699081699. Production's midpoint drag on independently constructed uniform strips is:

| N | D | Relative error |
|---:|---:|---:|
| 16 | 0.376102100 | −4.226% |
| 32 | 0.383821519 | −2.261% |
| 64 | 0.388057167 | −1.182% |
| 128 | 0.390306815 | −0.609% |
| 256 | 0.391477885 | −0.311% |
| 512 | 0.392079663 | −0.158% |

This supports the sign, factor and limiting value for a clean planar loading, and reveals slow, biased finite-grid quadrature. It does **not** establish universal PSD or correctness of the solved Γ. An elliptic *planform* is not, by itself, a prescribed exact elliptic circulation for the full finite-chord, tilted-wake lifting-surface problem. VLM-V2d is consequently a useful approximate diagnostic, not an exact finite-AR force solution. The loosened e≤1.07 threshold is an engineering tolerance for discretization, not Munk's exact physical bound.

### Multi-row construction and convergence

Uniform strip edges, the sub-panel 1/4 and 3/4 placements, row summation of horseshoe strengths, normals, per-surface auto counts, lower aspect refusal, upper warning and 10b largest-span wake floor match the normative recipe in the ordinary test domain. R1/R2 rectangular changes measured by the suite are plausible and remain inside the approved gates. Quarter-chord sweep conversion has already been substantially implemented in M0-2 (`sectionAt`, lines 622–630), so M0-3 should verify and reconcile that existing behavior before adding another conversion.

Two-level agreement does not prove convergence to the correct solution. Separate spanwise/chordwise refinement, tip circulation, wake proximity and force/moment behavior are needed to delimit an admissible domain. The high-M ellipse and yaw cases falsify any broad assertion that the multi-row layout and width/length guard have eliminated resolution sensitivity.

## 4. Oracle and acceptance-threshold assessment

| Existing evidence | What it establishes | What it cannot establish / action |
|---|---|---|
| Complex-plane Trefftz oracle, `tests/vlmOracles.test.mjs:34–79` | Alternative coordinate arithmetic for the approved formula | Same Γ, geometry and midpoint functional; cannot validate the functional or solved loading. SOL-04 applies to oracle and implementation alike. |
| Alternative Biot–Savart near-field oracle, lines 91–118 | Valuable independent algebra check at ordinary separations | Receives production panels/Γ and shares KJ model; not an independent full-flow solution or geometry oracle. |
| Glauert oracle, lines 126–164 | Independent classical loading/drag comparison | Model error at moderate AR; does not cover yaw, local high-M modes or general aircraft. Survives independent Galerkin cross-check. |
| Helmbold, lines 173–175, 484–517 | Approximate lift-slope check for selected swept/tapered wings | No primary drag/moment/local-load validation for those wings. Its test uses `(2cr+ct)/3` as ref chord at line 509, not the general trapezoid MAC; lift comparison is unaffected, but it must not become a MAC/moment oracle. |
| Historical four-decimal tables, lines 255–335 | Useful regression values for a specified old calculation | Not independent reference truth; original scripts import the production kernel and use a different drag extraction. Preserve both versions (SOL-05). |
| R1/R2, lines 457–473 | Selected two-grid agreement | No observed order or remaining error, no custom-grid/yaw integration guarantee. |
| Random PSD, lines 566–576 | 200 sampled positive values | Universal claim falsified by saved eigenvector; no statistical sample count can replace a PSD proof. |
| Implementation's separate reference program | Reproduces specified algorithm with separate code and a smaller cutoff | Reimplementation independence is useful but does not remove shared contract/model error. Its “without reading code” authorship claim cannot be verified from committed bytes alone. |
| Zero-drag tests | Correct at zero circulation for a zero-incidence single wing | Zero **net lift** on a multi-surface system does not imply zero circulation or drag; see `zero-net-lift` review probe. |

The R2-only e gate is explicitly in the matrix; not gating the R1 e≤1.02 condition is a legitimate scope choice, not itself threshold manipulation. M0-1's move to N=20 for the old quadratic trend was documented as an interim single-row limitation; M0-2 adds several resolutions. The remaining 16% slope smoke test (`tests/vlmSolver.test.mjs:187–192`) is weak but accompanied by stronger LLT/Helmbold checks. The quadratic trend tolerance 1.35 permits 35% spread and has little power against the 0.1–0.4% variation now reported. Do not use either smoke test as the basis of the ±5/±8 statement.

The suite has no deterministic coverage for the eigenmode, exact elliptic prescribed loading, the required small-scale endpoints, high-row tip validity, caller beta propagation or stale-canvas display. Existing negative-drag tests inject a negative near-field scalar; they do not demonstrate detection of a negative **computed** primary quadratic form. New counterexamples here address those omissions without changing existing tests.

## 5. OBS-M0-2-1 through OBS-M0-2-5 dispositions

| Observation | Independent disposition | Required follow-up |
|---|---|---|
| OBS-M0-2-1 | **Calculation mismatch confirmed and explained**, not a demonstrated production formula defect. Body-plane evaluation recovers the historical table; surviving scripts corroborate. Original claim that matching C_L fixes Γ is invalid. | Versioned benchmark reconciliation; preserve historical records and script copies. SOL-05. |
| OBS-M0-2-2 | **Wake/grid sensitivity reproduced.** At α=10°, 100b wake, common N=32 gives −1.140% NF/Trefftz; auto gives +0.00967%. Primary C_Di also changes about 1.20% between these configurations while C_L changes little. | Do not generalize auto-count success to all downstream surface placements/counts. Check proximity at collocation AND force points; align grids or apply a justified intersurface treatment. Full failure envelope remains unverified. |
| OBS-M0-2-3 | **Confirmed and materially worse than stated.** Primary drag, moment and local loads change; M=12,N=96 misses e≥0.99 and still reports OK. | Quarantine affected domain; investigate lattice/modes. SOL-03. |
| OBS-M0-2-4 | **Mild α dependence confirmed**, compatible with rebuilding a tilted wake. C_L/α is not a constant derivative. At α=1/4/8°, C_L/α≈4.6742/4.7050/4.7688 for the default wake. | Fit and certify a stated window using the approved adjacent-slope rule; treat α-dependent model/discretization effects separately from experimental uncertainty. No global sign defect demonstrated. |
| OBS-M0-2-5 | **Original tiny negative drag is plausible roundoff; repair overbroad.** The original −5e-29 N browser event was not independently replayed with its exact saved state. Its current synthetic regression passes, but does not validate the size/meaning of the floor. | Preserve raw drag; distinguish numerical tolerance from output significance; add reference invariance and nonzero tiny-lift cases. SOL-06. |

For OBS-2, the primary drag samples are not a proof of physical wake/wing interaction accuracy. The specified wing+tail acceptance case is narrow and its successful auto counts remain useful. The [AVL User Primer, “Vortex Lattice Spacing Distributions”](https://web.mit.edu/drela/Public/web/avl/avl_doc.txt) independently cautions about trailing legs near downstream control points and intersurface spacing; it also documents slow efficiency convergence for uniform spacing. These support testing the hazard, not selecting an unreviewed fix by analogy.

## 6. Alignment with governing requirements and approved work

The original requirements call for a CFD platform, coefficient and stability mathematics, geometry/selection/domain correctness before polished result pages (`refs/CFD_Aircraft_Design_and_Simulation_Requirements.md:6–16`, `27`, `132–142`, `197–224`). The MASTER explicitly retains VLM as Tier-0, with CFD/validation deferred. Absence of OpenFOAM or airfoil stall physics is therefore **not a failed M0-1/M0-2 deliverable** and is not counted as a newly discovered defect.

| Requirement / task | Review determination |
|---|---|
| M0-1 self legs, signed primary general Trefftz, consistent sweep drag | Implemented correctly for the ordinary benchmark domain; sign assertion now has SOL-06 and quadrature SOL-04 qualifications. |
| M0-2 multi-row, uniform layout, aspect guard, wake floor | Implemented; hard aspect shape rule is not an accuracy/stability guarantee. Counterexamples remain admitted. |
| M0-2 R1/R2 badge | Helper implemented; caller checks wrong yaw and does not certify custom current grid. SOL-02. |
| M0-2 uncertainty label | Literal label implemented; scientific scope not enforced. SOL-08 challenges the approved claim as well as its implementation. |
| M0-3 sweep | Conversion largely implemented ahead of task closure; do not double-convert. Incidence convention needs review (below). |
| M0-4 relative cutoff; VLM-V5 | Not implemented; scheduled. Severe confirmed residual SOL-01. |
| M0-5 linear window; VLM-V7 | Not implemented; scheduled. SOL-09. |
| M0a quarantine / geometry / validity | Incomplete and declared pending; active graphs still fail the scientific display goal. SOL-07. |
| G0 | **Not met.** Passing current tests is insufficient; original gate requires more tests and every displayed number correct or unavailable. |

The authority order resolves the matrix's +x-wake sentence in favor of normative freestream alignment. It does not make internally inconsistent calibration data valid. The higher-level plan and original audit are reviewable scientific claims, not protected truth; SOL-05 and SOL-08 preserve their contradictions explicitly.

## 7. Unverified concerns and bounded negative findings

1. **Wake/collocation proximity outside the tested tail placement.** Source and numerics justify concern about larger failures. A complete z/x/N/α failure map, mesh-independent reference for close-coupled surfaces, and a solved β=0 negative primary-drag case were not obtained. Do not report those as confirmed defects.
2. **Sweep with incidence.** `sectionAt` sets x_LE=xc/4−c/4, then bound points add `(cos i,0,−sin i)fc`. The projected total c/4 x is therefore xc/4+c(cos i−1)/4. On b=8, cr=1, ct=0.3, input 25°, M=1,N=8, measured projected c/4 sweep is 25.03127° at i=10° and 25.07012° at i=15°; zero incidence gives 25°. This is a confirmed geometric discrepancy from a literal projected-line interpretation; whether it violates the intended sweep/incidence convention requires explicit resolution in M0-3. Existing VLM-V6 only uses zero incidence and M=1. Do not silently alter the incidence pivot or add another sweep correction.
3. **Collocation on curved elliptic strips.** c(ym) differs from the mean of edge chords, so the selected control point need not sit on the planar quadrilateral implied by the endpoints. The fan mode warrants investigating this geometric distinction; its exact causal contribution has not been isolated.
4. **Moment accuracy.** Rectangular reference transfer/sign checks pass the loose VLM-V4 bound. There is no independent swept wing+tail moment/neutral-point benchmark. Near-field force error is still multiplied by CG offsets in the moment. No uncertainty bound for NP/static margin is established.
5. **High-AR/performance and malformed public inputs.** Auto N has no upper cap although explicit N is capped at 240; M is capped at 16. Dense O(P³) elimination plus main-thread sweeps can be costly. Empty sweeps, duplicated surface names, invalid beta/alpha defaulting, overlapping surfaces and finite matrix residual gating deserve bounded negative tests. No new measured browser latency or crash claim is made here.
6. **External accuracy validation.** No independent AVL/VSPAERO solution, RANS field, tunnel dataset or actual-aircraft validation was generated. The [AVL User Primer](https://web.mit.edu/drela/Public/web/avl/avl_doc.txt) supports the general thin-surface/small-angle model scope, separates direct forces from Trefftz drag, and uses reference normalization consistent with this review. Its x-aligned wake differs from this contract, so a future comparison must document that modeling difference. Merely citing AVL is not a code-to-code validation.

No physical interpretation of the demo aircraft, real-aircraft stability, drag polar accuracy, stall, viscous drag, compressibility, or uncertainty coverage is approved by this review. The mathematical/contract checks are narrower than those claims.

## 8. Conditions and remediation sequence for M0-3

**GO WITH CONDITIONS** is appropriate because the next task is corrective development and M0-4/5 and M0a quarantine are already approved unfinished work. None of the demonstrated failures requires halting read-only work or abandoning the valid self-leg correction. An unconditional GO would conceal material residuals; a BLOCK on all further development would prevent the scheduled repairs that address them.

1. **At M0-3 entry:** carry SOL-01..10 and all OBS dispositions as open review findings; use this frozen report for later comparison. Reconcile that c/4 conversion is already present. Verify tapered multi-row geometry, zero/nonzero incidence semantics, and direct coordinate measurement before modifying sweep logic.
2. **During M0-3 corrective work:** fix or explicitly quarantine the wrong-flow/current-grid badge and high-M unstable configurations. A green baseline badge cannot accompany an unsupported plotted case as evidence of its numerical adequacy.
3. **Before accepting the VLM core/G0:** implement relative cutoffs and linear-window validity, repair/redefine force suppression, and add deterministic counterexamples plus analytical loading and proper input checks. Preserve the numerical evidence and review/approve any changed gate before treating the new results as passing. Document the exact benchmark projection and scope of uncertainty.
4. **Before presenting/exporting engineering conclusions:** complete M0a geometry/validity/staleness/verdict/pitch quarantine and regenerate the demo report. Every plot/export needs reference values, method, applicable domain, source and validity. No pass of the current suite waives this condition.

Closure of a finding needs a new remediation record pointing to the changed commit, reproduction result and independent evidence. Do not edit this report, original audits or approved plans to turn a counterexample into a historical pass. This verdict remains **GO WITH CONDITIONS for M0-3 development; G0 and trustworthy scientific presentation remain blocked by the conditions above**.
