# Independent AirFLOW implementation audit

Date: 2026-11-06, Asia/Dhaka. Audited branch: `impl/m0`, HEAD
`9a66316f63e22b9633e266716294eee68f9b2498`. Original `main` and local `origin/main`
remain at `25afe85`. The initial working tree was clean. This audit adds only
this evidence directory; it does not fix production code, edit tests, change
approved plans or frozen evidence, close SOL findings, commit, or push.

**Verdict: G0 remains BLOCKED. Corrective development may continue.** The narrow
VLM benchmark implementation is substantially correct and REM-2 is implemented,
but REM-1's badge, uncertainty-scope, and input-validation claims are incomplete.
Known application defects still affect displayed/exported results. Passing 101
tests is reproducible; it does not establish the missing acceptance conditions.

## Findings, ordered by impact

**IA-01 — High: a green prescribed-resolution badge can use quarantined data
(SOL-02 re-verification fails).** `runVlmResolutionCheck` chooses `badge` solely
from deltas at `src/vlmSolver.js:1083–1086,1111–1112`. It computes `sweepsClean`
later at line 1124, but uses it only for the uncertainty label at line 1157.
The custom-grid branch correctly withholds on invalidity (1214–1218); the
prescribed branch does not. Its returned R1/R2 summaries also omit validity.

Reproduction: wing b=8,c=1 plus a coplanar forward surface b=3,c=0.5,
x_LE=-4; V=40, rho=1.225, S_ref=8, c_ref=1, reference=(0.4,0,0).
At alpha=0 the R1 and R2 cases are **invalid**, with 768 and 6,144 kernel
truncations, respectively. Nevertheless the badge is **green**, claim
`prescribed R1 vs R2`, dCLa=0.2815%, dCDi=0.9970%. The quarantined alpha=0
point is still used in that two-point diagnostic. This is not the old missing-yaw
bug; the beta forwarding repair works. See `edge-probe-results.json` and
`measurements.json` (`badges`, final entry). Fix the prescribed-path validity
gate and expose comparison validity before accepting SOL-02.

**IA-02 — High: quarantined coefficients can still be exported as ordinary
results (SOL-07).** `src/app.js:936–943` checks only that `state.lastVlm` exists.
It exports every row, with no validity, method, reference, source, or domain
columns. A real wing+tail case (M=4, N=32 per surface, alpha=10, tail x=4,z=0.6,
wake=800c) is invalid because near-field/Trefftz differ by -1.14%. The actual
export function still emits CL=0.9448874856, CDi=0.03626370366 and Cm=-0.2579798042
as a normal CSV row. The actual plot function correctly draws an unavailable
message for the same result. This inconsistency bypasses the quarantine.
Evidence: `app-probes.mjs`, `app-probe-results.json`. This was exercised by
executing the unchanged application function bodies with captured UI/export
boundaries; it is not claimed as a full browser test. Binding requirement:
`docs/verification/sol/REVIEW.md:329` and DATA_CONTRACTS §2.7 validity records.

**IA-03 — High: uncertainty-scope enforcement is materially overstated
(SOL-08 remains open).** `src/vlmSolver.js:849,1023` tests only beta=0 and
non-invalidity. A custom 1x4 rectangular grid with CL=0.354226 at 4 degrees,
a 12-row grid explicitly warned as unverified, an AR=1 wing, and alpha=35
degrees all receive `flat-plate inviscid estimate: C_Lα ±5 %, C_Di ±8 %`.
The 1x4 grid's lift is 8.12% above R2 and its efficiency is about 1.233.
The label contradicts its adjacent scope statement at lines 58–66 and the
rollup's claimed zero-yaw R1/R2 envelope enforcement
(`docs/implementation/IMPLEMENTATION_STATUS.md:49–52`). A correct current-grid
amber badge does not make this fixed uncertainty claim true. Define and enforce
the full geometry/resolution/angle/flow envelope; zero yaw alone is insufficient.
Evidence: `measurements.json`, `labels`; SOL-08's broader scientific coverage
question also remains unresolved. The literal uncertainty label originates in
the approved contract; the review explicitly challenges that scientific claim.

**IA-04 — Medium: missing circulation is still silently converted to zero
(SOL-10 correction is partial).** `src/vlmSolver.js:636` validates
`Number(circulation[j])`, and lines 417,438 evaluate the coerced number.
`[null]`, `['']` and `[false]` each produce D=0 for the unit horseshoe with no
error. The finite-array tests cover NaN/Infinity/undefined, not these values.
The exact original NaN counterexample now correctly throws; this finding
challenges the broader claim that missing scientific data is never coerced into
a plausible zero (lines 405–408), not that original narrow fix. Reject missing
and nonnumeric values before conversion. Evidence: `measurements.json`, `inputs`.

**IA-05 — Medium: the claimed full input identity omits geometry placement and
wake length.** `src/vlmSolver.js:1096–1108` records span/chords/angles but omits
`xLeadingRootM`, `zRootM`, and `wakeLengthFactor`/actual wake length. Moving the
same named surface from x=-4,z=0 to x=4,z=0.6 produces an **identical** identity
record although the flow problem and validity change. The solver does use the
correct positions; this is a traceability/cache-identity defect, not proof of
wrong geometry in the solve. Evidence: `edge-probe-results.json`,
`inputIdentityCollision: true`. Include all material inputs in future identities.

**IA-06 — High inherited/open: recognition and stale/pitch display paths still
violate G0 (DR-03/04/05/23; SOL-07).**

- Recognition remains vertex-binned at `src/recognition.js:140–172` and uses
  `warnings.length === 0 || areaM2 > EPSILON` at line 196. The exact 8,207-triangle
  centroid-y>=8 selection gives S=8.2999932219, `valid:true`, versus independently
  sliced 22.6572817280 on the historically clipped y>=8 domain: -63.37%.
- `invalidateVlm` clears result state but never the canvases
  (`src/app.js:995–1005`); `updateGraphs` returns immediately when no result
  exists (859). The function-level probe observes **zero redraws** after
  invalidation. When a new non-invalid result has undetermined Cm slope,
  `updateGraphs(null)` updates only the polar canvas and leaves the old pitch
  image intact (869,890–900). This latter path survives M0-5's null-derivative
  simulation guard and is not covered by its solver tests.
- The pitch plot remains enabled, titled as a linearized VLM pitch response
  (`src/app.js:890–899`). `src/stability.js:44,59–61` uses an ad-hoc relaxation
  model; with the initialized alpha=theta, d(alpha-theta)/dt=-1.25(alpha-theta),
  so alpha=theta is an invariant. It is not a short-period aircraft model.
  The required non-physical disclosure/hiding is absent. The source correctly
  prevents running it on null derivatives/invalid data (app 305–312), a useful
  partial correction, not completion of M0-8.

**IA-07 — Medium inherited/documented: finite malformed sweep inputs can hang
the API.** At `src/vlmSolver.js:875–884`, alpha=1e17 and step=1 cannot advance
in double precision. `timeout 2s node .../hang-probe.mjs` exits **124** without
completion using only four panels. This independently reproduces OBS-M0-5-4;
it is already assigned to REM-3, not a newly discovered regression. NaN beta,
`alphaDeg:'bad'`, and `cm0:'bad'` also silently become zero (655–656,887).
Auto N remains uncapped (240–242) while explicit N caps at 240 (283): AR=1e5
selects N=400,000, P=1.6 million at M=4. No such matrix was allocated here.
These require bounded validation/refusal, not an unannounced resolution cap.

**IA-08 — Low/Medium: current method/status documentation is stale.**
`CALCULATION_PIPELINE.md:537–549` still describes the removed `stable` field and
nearest-sample trim intercept, directly contradicting M0-5.
`MVP_METHODOLOGY.md:79` still says the numerical test tolerance is 16%.
`docs/implementation/IMPLEMENTATION_STATUS.md:8–10` stops its revision summary
at M0-4 despite listing later completed tasks below. The immutable START_HERE
snapshot is explicitly historical, so its old 23-test count is not a current
test claim. The editable method documents are current-behaviour documents and
should have been updated alongside the changed methods (START_HERE rule 6;
M0-16 remains unfinished). Historical PSD statements in the issue log/changelog
are superseded by DEC-REM-1-6, not evidence of a restored PSD property.

## What independently passes, and with what limits

`oracle.py` imports only standard Python and NumPy. It does not import or read
production source, existing test helpers, or the implementation's reference
program. `measure.mjs` imports production solely to obtain observations. The
small independent VLM reconstructs its own geometry and solves with NumPy;
its finite-segment kernel uses axial/perpendicular coordinates, distinct from
the production r1-cross-r2 expression. Agreement verifies implementation of this
method, not accuracy against real aircraft.

| Check | Measurement / tolerance | Assessment |
|---|---|---|
| General signed Trefftz, unit-width horseshoe | D=1/pi=0.3183098861837907; error <1e-15 relative, tolerance 1e-12; qS=1 and 1e12 give identical dimensional drag | Pass: sign, normalization, self-leg contribution |
| Prescribed elliptic circulation | D_exact=pi/8; N128 error -0.6092%, N256 -0.3110%; gate 1% | Pass, biased finite-grid quadrature converges; not solved-elliptic exactness |
| Independent 4x16 VLM, rectangular and tapered 25-degree sweep/5-degree dihedral/3-degree incidence | Geometry max error 4.44e-16 m; CL/CDi/Cm relative error <=1.34e-15; normalized circulation max error <=7.00e-15; tolerance 1e-9 | Pass: full lattice/kernel/linear solve/force/drag/moment path in two ordinary cases |
| Rectangular R2 lift against new 120-odd-term Galerkin LLT | AR6/8/12 errors -3.9221%/-2.9956%/-2.0201%; gate 5%; 60-to-120-term slope change <=6.1e-12 relative | Pass VLM-V1 benchmark domain. AR4 error -5.5620%, reported, not gated as prescribed |
| R2 drag against LLT at the measured CL | AR6/8/12 ratios 0.947812/0.949965/0.951315; gate [0.90,1.05]; e=1.006460/0.986005/0.952953, gate [0.90,1.02] | Pass VLM-V2. Agreement against an approximate oracle, not a validated error bound |
| Scale 1e-3..1e3, auto N | Max CL/CDi/Cm drift <=1.45e-15 relative; circulation/scale <=2.17e-15 normalized max; gate 1e-6; no truncations, status ok | Pass SOL-01 ordinary scale counterexample; not all near-singular configurations |
| Segment kernel at relative distances 2e-6,0.1,1 across scales | Analytic axial integral matches; at 0.5e-6 relative radius it returns zero and counts the truncation | Pass declared cutoff/observable-engagement behavior; truncated singular flows are not solved |
| Tiny induced drag | CDi(0.001 degree)=2.63954199086e-10, nonzero; scales quadratically over 0.001/0.01/0.1 degrees | Original SOL-06 dead band corrected |
| Reference-area independence and sign errors | Unit-horseshoe dimensional D independent of qS; frozen replay rejects supplied -1 N near-field drag at both qS=1 and 1e12 | Original SOL-06 floor counterexample corrected. A proof that all operation-count error budgets are rigorous/tight is outside these checks |
| Fit/linearity | Five sweep sets: NumPy polyfit slope/intercept and independent adjacent-pair decisions agree; >5-degree-only and two-point windows rejected; ordinary coefficients preserved | Pass tested SOL-09 rules and fitted intercept; production suite additionally pins 4.9%/5.1% boundary |
| Trim | Programmed interior root 3 degrees returns 3.000000000000001 degrees; positive-lift and sweep-domain gates applied; rejected cases have explicit nulls | Pass fitted-line contract. Direct re-solve gives residual Cm=6.24e-5: exact fitted-line root is not an exact nonlinear-solver trim solution |
| Moment transfer | Changes of x and z reference match delta-z*Fx-delta-x*Fz to <=8.33e-17 coefficient; tolerance 1e-12 | Pass exact transfer/sign convention; no independent swept-wing+tail moment-accuracy validation |
| Neutral-point reference probe | x_ref=0,0.2,0.3,0.6 gives NP 0.24376..0.24454c (within 0.25 +/-0.01); x_ref=0.25 correctly yields null under 5% Cm-linearity rule | Useful partial VLM-V4 evidence; mandatory broad automated VLM-V4 coverage is absent |
| Frozen PSD counterexample | Four negative eigenvalues; lambda_min=-0.001896870665447473; replay rejects the measured negative drag | SOL-04 counterexample retained, not repaired into a PSD operator |
| Exact topology | Existing independent-oracle tests and demo regression pass 28 boundary / 5 non-manifold / 0 repeated-vertex degenerates / 1 edge-component | M0-10 acceptance passed; orientation output and general geometric degeneracy are not established by those four counts |

Detailed values: `oracle-results.json`, `edge-probe-results.json`,
`analytic-replay.json`, `psd-replay.json`. The standalone implementation reference
was inspected but not treated as an independent oracle or run in place because
it writes its checked-in RESULTS.md.

**Area-oracle boundary reconciliation.** Two new independent slicers agree on
about 24.92–24.93 m² when integrating the full bounds of the centroid-selected
triangles: y in [6.980521679,16.993284225]. Clipping the same triangles to y>=8
gives **22.657281728**, reproducing the historical **22.66**. Thus the historical
number is reproducible, but its extra integration-domain restriction is missing
from REC-V2's selection-only recipe. Pin that restriction when implementing
REC-V2; do not compare these two oracle domains interchangeably. Both demonstrate
the production extraction defect.

## Repository, history, and test reconciliation

- `git log` confirms baseline `776457a`, M0-10 `2c6ec84`, M0-1 `af416b4`,
  M0-2 `d57783a`, REM-1 `84cf90f`, M0-4 `bdaea41`, SOL-06 `a4d0859`,
  M0-3 `5eb07d7`, M0-5 `2ed3484`, and the subsequent documentation commits
  `352e21e` and `9a66316`. The handoff's REM-2 implementation chronology is real.
- `git diff 776457a HEAD -- docs/architecture docs/plans docs/audits refs plan.md`
  is empty; `git diff 84cf90f HEAD -- docs/verification/sol` is empty.
  All **13** frozen review-artifact hashes in the Sol manifest match.
  The main branch pointer is preserved; implementation source naturally differs
  from main. Local origin tracking refs match HEAD; no network push verification
  was attempted, so this is not a claim about remote state beyond local refs.
- `npm test`: exit 0, **10 test files pass**, 0 failures/skips, 45.07 s on
  Node v24.21.0. This host's isolated reporter counts files.
- `node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs`:
  exit 0, **101 individual tests pass**, 0 failures/skips, 69.59 s.
  Logs are preserved as `npm-test.txt` and `individual-tests.tap`.
- The frozen `probes.mjs` was copied unchanged into scratch mirrors with current
  source and source from `bf39f44` (pre-M0-5). Both stop at the expected uncaught
  NaN-circulation rejection; the later zero-net-lift and final JSON-writing code
  is **not** reached. All **50 preceding rows** are captured. Exactly **five**
  rows differ: badge-baseline diagnostic field rename, moment-reference,
  three fit-trim rows. This independently confirms the handoff's M0-5 replay
  claim. It is a partial replay with an expected error, not a completed script.
  See `replay-comparison.json`, `sol-replay.ndjson`, `sol-replay.stderr`.
- Frozen PSD, analytical loading and Galerkin scripts run in scratch; the new
  analytical loading values remain unchanged and the negative mode still raises.
- Changes to physics were disclosed: relative dimensional cutoffs/pivot ratios,
  removal of elimination skip, ulp-level auto-N snapping, incidence pivot, and
  drag suppression based on a forward-error budget. FIT_EPSILON=1e-10 and the
  1e-9-degree boundary allowance are explicit. No new hidden abs/floor correction
  was found in this diff. The old qS floor is absent. The numerical error-budget
  conservatism and near-singular scope remain limitations, not validated bounds.
- Pulling the verdict/seed gates into M0-5 expands its original task row but is
  explicitly recorded in DEC-M0-5-4, implements the higher-priority §2.5 rules,
  and does not constitute unexplained product scope creep. There is no observed
  premature M1/CFD feature work. Method documentation lag remains IA-08.

## M0 task → requirement → test → current evidence

| Task / claimed state | Governing requirement | Existing tests / new audit evidence | Determination |
|---|---|---|---|
| Phase 0 done | Preserve baseline and authority map | Git history; immutable diffs/hashes | Confirmed |
| M0-10 tested | Exact weld, skip repeated-vertex degenerates, edge components; PHASED M0a | topology.test.mjs:111,118,144; demoRegression:8; 28/5/0/1 | Confirmed declared acceptance; not all future M1 topology requirements |
| M0-1 tested | DATA_CONTRACTS §2.7 own self legs, signed general primary Trefftz | vlmOracles:355,386,408; vlmSolver:489,569; new independent VLM, unit/elliptic loading, LLT | Confirmed benchmark-domain correction; not arbitrary-input/PSD/scientific validation |
| M0-2 tested | §2.7 multi-row, shape guard, wake>=10b, R1/R2 badge, label | vlmSolver:30,57,75,420,449; vlmOracles:339,436,462,489; new LLT | Lattice/wake/benchmark correct; badge and uncertainty acceptance incomplete (IA-01/03) |
| REM-1 done pending re-verification | Sol §8 entry prerequisites; SOL-01/02/03/04/08/10 | solFindings regression groups; new canard/input/export probes | Partial: yaw/custom badge and named elliptic quarantine work, but IA-01/03/04 prevent blanket acceptance |
| M0-4 tested | Relative 1e-6 segment cutoff; VLM-V5 | vlmOracles:613,663,697; solFindings:60,88; new scale and kernel oracles | Independently corroborated ordinary-domain fix, near-singular proximity still quarantined |
| SOL-06 tested | Preserve resolved small/negative drag; unrelated reference values cannot suppress force errors | solFindings:334,363,392,411,462; new unit/tiny-drag checks and frozen replay | Original counterexamples corrected; universal error-budget proof unverified |
| M0-3 tested | §2.7 c/4 sweep and §3.2 local c/4 incidence rotation | vlmSolver:163,221,255,314,347,365,394; new swept/incidence geometry reconstruction | Corroborated; no double conversion found |
| M0-5 tested | §2.5 >=3 converged window samples, 5% pairs, fitted intercept, trim and verdict gates; VLM-V7/V8 | vlmSolver:684,714,737,776,841; solFindings:592–795; new NumPy fit checks and replay | Tested numerical contract corroborated; stale-pitch path and method docs remain outside completion |
| M0-6 planned | Slicing; REC-V1/V2 | Current recognition tests do not test sliver/demo slicing; new oracle reproduces defect | Not implemented; blocks DR-03 |
| M0-7 planned | Errors/warnings separation; REC-V3 | No acceptance negatives; source recognition:196 still vacuous | Not implemented; blocks DR-04 |
| M0-8 planned, part pulled forward | STAB-V2/V3, pitch quarantine, mass provenance, remove/wire dead stability helper | New verdict primitive tests pass; app hardcodes assumedUniform at app:357; pitch disclosure absent | Partial only; no app positive mass-provenance path or DOM regression |
| M0-9 planned | Hash identity + restore order; ID-T1/T3/T4 | projectAxis tests only matching-count success; projectState:35–40, app:908–921 unchanged | Not implemented; count-only acceptance and ignored mapping persist |
| M0-11 planned | Pure fresh/stale/absent model; VM-T2 | No core/hash.js or core/viewModels.js; new captured redraw test | Not implemented; stale canvases persist |
| M0-12 planned | UI-T1 degraded no-WebGL mode | app:90–95 still initializes viewer in startup's single try | Not implemented; no new browser failure experiment here |
| M0-13 planned | ID-T6 nonfinite vertex rejection | stlParser:33–35 directly stores floats; no rejection test | Not implemented |
| M0-14 planned, seed-warning partial | §2.7 labels, Cm reference provenance, CG seed height; VM-T1/VLM-V8 | Seed warning tested; app:422 uses bounds z, app:876 says CD total; CSV has no reference | Partial, not acceptance |
| M0-15 planned | SRV-T1; cache strings; orphan gitlink | server:21 unguarded decode; existing query imports/gitlink remain | Not implemented; no server crash run necessary for this source finding |
| M0-16 planned | Current method docs, generated demo report; DOC-T1 | No scripts/demo-report.mjs or DOC-T1; stale CALCULATION §14 | Not implemented |

**Missing G0 evidence is not a passing test.** No named comprehensive VLM-V4 or
VLM-V9 acceptance test exists. The MASTER gate includes V9 while the matrix
describes analytic reference geometry and M2 also schedules it; reconcile this
milestone-placement discrepancy explicitly. REC-V1..V3, ID-T1/T3/T4/T6,
staleness/degraded-mode/labels/server tests, and DOC-T1 remain missing. Positive
mass-provenance/display acceptance is not supplied by the solver's synthetic
`verdictInputs` tests. Automated DOM coverage is absent. No new browser smoke
test was performed for this audit; earlier manual-browser assertions were not
independently re-observed.

## All SOL dispositions after this re-verification

| Item | Audit disposition |
|---|---|
| SOL-01 | Relative-scale counterexample corrected and independently corroborated; retain near-singularity limits. No administrative closure made |
| SOL-02 | Old missing-yaw/current-custom-grid bugs corrected; **remaining High prescribed-green/quarantine bug IA-01**, incomplete identity IA-05 |
| SOL-03 | Named high-M elliptic configurations quarantined and propagated; frozen replay confirms. Scientific tip-mode cause unresolved; no claim that relative cutoffs solved it |
| SOL-04 | Claim correction and deterministic negative-mode pin corroborated; operator remains indefinite. No physical solved negative-primary-drag counterexample established here |
| SOL-05 | Still open. Historical body-plane vs freestream-projected extraction mismatch remains; no versioned benchmark sidecar found |
| SOL-06 | Original floor/dead-band counterexamples corrected. General rigor/tightness of estimated forward-error budgets not established by this audit |
| SOL-07 | Still open: geometry, CSV, stale plots, pitch disclosure, provenance, and several labels remain unsafe. Source verdict/null gates are useful partial repairs |
| SOL-08 | Still open and scope enforcement fails IA-03; comparison agreement is not an uncertainty confidence bound |
| SOL-09 | Fitted-line/window/domain contract corroborated in tested domain; nulls/validity honest. Actual nonlinear trim accuracy remains a separate numerical approximation |
| SOL-10 | NaN/Infinity now rejected; broader missing/non-numeric circulation validation **incomplete**, IA-04 |
| Review §7.2.2 | Explicit local-c/4 pivot decision is compatible with higher-priority §3.2 and independently reconstructed geometry |
| Review §7.2.1/.3/.4/.5/.6 | Close-surface/wake map and curved elliptic collocation cause unverified; general moment/NP accuracy unverified; malformed-input hang and identity gaps confirmed; external validation absent |

## All DR items: current impact versus scheduled work

This table distinguishes fixes from planned/deferred scope. It does not rewrite
the frozen register or claim experiments for every historical UI defect.
Non-VLM source paths largely remain byte-unchanged from the audited baseline.

| DR | Current disposition and source / acceptance evidence |
|---|---|
| 01 | Corrected in tested domain: vlmSolver:711–750; independent drag/LLT checks |
| 02 | Multi-row rectangular resolution correction verified; exposed-domain reliability/badge qualification remains, IA-01/03 |
| 03 | Open, independently reproduced: recognition:140–172; M0-6 |
| 04 | Open: recognition:196; M0-7 |
| 05 | Open: stability:38–74 and app:890–899; M0-8 |
| 06 | Partial: verdict now withheld by app assumedUniform / source gates; valid-tail recognition and mass provenance still incomplete, M0-8 |
| 07 | Open: projectState:35–40 count-only identity; M0-9 |
| 08 | Open: app:916–921 restore does not remap source units/axes; M0-9 |
| 09 | Deferred M1/M3: labels only; no surface/patch/BC registry or export |
| 10 | Deferred M4: static server, no CFD runner; not an M0 failure |
| 11 | Open M1: recognition region growth remains existing MVP; no full surface barriers/tools |
| 12 | Corrected for declared exact-topology definitions: core/topology.js; passing 28/5/0/1 |
| 13 | Future BVH identity hazard, M1; no newly adopted BVH claiming resolution |
| 14 | Planning rejection of three-bvh-csg retained; manifold export path not implemented, later milestone |
| 15 | Deferred M3 patch export/manifest; binary STL still lacks patch names |
| 16 | Deferred M3 FARFIELD/SYMMETRY rules; no BC model implemented |
| 17 | Deferred M3/M6 domain extents/study; not implemented |
| 18 | Deferred M8 stall-onset qualification; no CLmax implementation/validation |
| 19 | Deferred CFD regime refusal; no CFD solver currently used |
| 20 | Deferred M3 atmospheric/Re model; absent |
| 21 | Corrected: vlmSolver:1322–1329, incidence pivot 131–146; new reconstruction corroborates |
| 22 | Open M1: axisMapping:19–32 permutes coordinates without winding correction |
| 23 | Open M0-11: app:859,995–1005, captured redraw evidence |
| 24 | Open M0-12: app:90–95 startup coupling; source inspection only |
| 25 | Open performance work: dense synchronous matrix/solve at vlmSolver:680–693,1231–1283; no new browser latency measurement |
| 26 | Corrected tested solver/display values: vlmSolver:922–1007 and app:838–855; stale canvas path remains DR-23 |
| 27 | Open M0-13: stlParser:25–42; no finite-coordinate rejection |
| 28 | Existing selection interaction unchanged; M1 UI work not complete |
| 29 | Existing toggle/XOR selection path unchanged; explicit mode work deferred M1 |
| 30 | Recognition adjacency still has tolerant bucket weld; exact topology module does not replace it; M1 |
| 31 | Existing navigation feature gaps unchanged, later UI work |
| 32 | Planning authority/scope disposition exists; owner Q-1 for later work remains; no conflicting CFD implementation found |
| 33 | Historical plan quarantined as intended; no evidence of implementing its incorrect formulas |
| 34 | Open M0-14: app:876 and CSV:941 still CD total, assumed CD0 not attached per series |
| 35 | Scale defect corrected in tested range; new scale/kernel checks pass |
| 36 | Partial M0-5 seed-warning fix; seed height still bounds center app:422, M0-14 |
| 37 | Open M0-15: server:21 unguarded URI decode; no SRV-T1 |
| 38 | Open M0-15: query-string imports remain in app/index |
| 39 | Open: computeStaticStability remains dead app code, tested separately; M0-8 cleanup |
| 40 | Open M0-15: orphan reference/xflr5 gitlink remains; no removal authorization assumed |
| 41 | Partial: source functions exercised by this audit; regular suite still lacks app/graph/server regression coverage |
| 42 | Planning correction exists; later geometry implementation remains absent |
| 43 | Open M0-14: Cm/CSV reference source not attached |
| 44 | Canonical frame and corrected beta formula implemented in VLM:657–663; external CFD/frame verification pending |
| 45 | Open M0-9: app:92–93,908–919 count-matched autosave/restore; no hash matching |
| 46 | Reference override tracking remains absent; existing remap/recognition controls overwrite, later UI work |

## Conditions for a plausible G0

G0 is plausible after bounded corrective work; it is not closeable on this tree.
There is no evidence that the valid self-leg correction or the entire VLM must
be discarded. Complete the planned M0a safeguards and missing acceptance tests,
repair IA-01/03/04/05, gate CSV as carefully as plots, reconcile benchmark/area
domains, and regenerate the demo/method documents. Investigate or explicitly
exclude the unresolved elliptic/proximity domain with enforceable validity
rules. Re-run the preserved counterexamples and independent oracles, including
UI/export paths, before requesting independent review closure.

What is **correct**: ordinary-domain lattice/kernel/linear solve and signed drag,
scale handling in the tested range, incidence convention, fitted-line/window
rules and source verdict withholding. What is **incorrect**: the green badge
on invalid comparison data, broad uncertainty labels, missing-data coercion,
quarantine-bypassing CSV, current recognition, stale canvases, and undisclosed
pitch presentation. What is **unverified**: general close-surface robustness,
elliptic high-M repair, general moment/NP accuracy, universal error-budget
bounds, browser-wide behavior, uncertainty coverage, and any actual-aircraft or
CFD accuracy. These distinctions preserve the MASTER's Tier-0 scope.

## Reproduction and evidence

From repository root (Node 24.21.0, NumPy 2.4.6):

```sh
npm test
node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs
node docs/verification/independent-2026-11-06/measure.mjs 9a66316f63e22b9633e266716294eee68f9b2498
OPENBLAS_NUM_THREADS=1 python docs/verification/independent-2026-11-06/oracle.py
node docs/verification/independent-2026-11-06/app-probes.mjs
node docs/verification/independent-2026-11-06/edge-probes.mjs
timeout 2s node docs/verification/independent-2026-11-06/hang-probe.mjs
```

The last command intentionally times out (124), it is not a successful solver
run. The other probes exit 0; their outputs include both passing checks and
counterexamples, so an exit code is not their correctness verdict. Frozen Sol
scripts must be run only in a scratch copy, because they write beside themselves.
The new oracle reads measurements, never production modules; it does not adjust
acceptance thresholds to hide a mismatch. Audit files are listed and hashed in
`MANIFEST.json` for subsequent verification.
