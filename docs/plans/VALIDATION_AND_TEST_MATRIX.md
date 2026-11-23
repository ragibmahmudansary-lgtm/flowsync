# Validation and Test Matrix

Status: **v1.0**, revised after the adversarial review (2026-10-23). This document defines every test ID referenced elsewhere in `docs/`.

**Levels:**
- **U:** unit.
- **I:** integration.
- **N:** numerical verification against an independent oracle.
- **S:** scientific validation against reference or experimental data.
- **E:** end-to-end.
- **M:** manual checklist, signed in `docs/qa/MANUAL_CHECKLIST.md` by a named person on a recorded machine (RA-08).

**Principles:**
1. A self-consistency or trend test is never sufficient verification (RC-4). Every N or S test names an independent oracle, and the oracle code never imports the module under test (RA-13).
2. The "Cannot prove" column states the limits of each test, so a passing test is not over-read.
3. Gates marked *measured* were calibrated against coordinator or reviewer runs recorded in [ADVERSARIAL_PLAN_REVIEW.md](../audits/ADVERSARIAL_PLAN_REVIEW.md) §4. They are tolerances around known oracle approximations, not targets fitted to the code.
4. Tests marked **[OF]** need the pinned OpenFOAM and run under `pytest -m openfoam`.
5. Node performance budgets refer to the audit host (16 cores, Node 24). Browser budgets refer to the machine recorded in the QA checklist (RA-18).

---

## 1. Tier-0 VLM and reference geometry (M0, M2-9)

R1 and R2 are multi-row resolutions: R1 = (8⌈AR/2⌉ spanwise × 4 chordwise) and R2 = (16⌈AR/2⌉ × 8), with at least 16 spanwise panels. The wake is planar along +x with length ≥ 10 b.

| ID | Lvl | Check | Oracle and procedure | Pass | Negative or edge | Cannot prove |
|---|---|---|---|---|---|---|
| VLM-V1 | N | C_Lα, rectangular wings | Glauert lifting-line, ≥ 50 odd terms, implemented in the test. AR ∈ {6, 8, 12} at R2. | ≤ 5 % (*measured*: −2.0 to −3.9 %) | AR 4 reported, not gated (LLT invalid) | Real wings |
| VLM-V1b | N | C_Lα, swept and tapered wings | Helmbold-DATCOM: 2πAR/(2 + √(4 + AR²(1 + tan²Λ_c/2))). Cases Λ_c/4 ∈ {25°, 40°}, λ ∈ {0.35, 1}, AR 8-9.5. | ≤ 5 % (reviewer measured −1.2 to −1.8 % single-row; re-measure on multi-row) | — | Above ±5 % (oracle accuracy) |
| VLM-V2 | N | C_Di sign and magnitude | LLT C_Di at matched C_L; AR ∈ {6, 8, 12} at R2 | Trefftz D > 0; ratio ∈ [0.90, 1.05] (*measured* ≈ 0.96); e ∈ [0.90, 1.02] | Assert raw near-field D ≥ 0 | Profile drag |
| VLM-V2b | N | Near-field vs Trefftz | Unswept planar wing, wake ≥ 10 b | ≤ 1 % | Swept wings reported only: −2.5 % to −12 % is expected, from the midpoint rule on kinked lines (RB-07) | Γ correctness (both use the same Γ) |
| VLM-V2c | N | Multi-surface Trefftz | Wing AR 8 + H-tail (span 3 c, 0.6 c above the wing), α = 5° and 10°. Near-field with wake ≥ 10 b. | ≤ 1 % (reviewer measured 0.00 % with the general form) | The y-only form must **fail** this test (a detection check) | — |
| VLM-V2d | N | Exact elliptic case | Elliptic planform, straight c/4 line; AR ∈ {6, 8} at N ≥ 32 | e ∈ [0.99, 1.07] (*measured* 1.015-1.031); D > 0 | Munk bound: e ≤ 1.07 asserted in every VLM test | — |
| VLM-V3 | N | Resolution consistency | Rectangular wings, AR ∈ {4, 6, 8, 12}, R1 → R2 | ΔC_Lα ≤ 1 %; ΔC_Di ≤ 5 % (*measured* ≤ 0.6 %, ≤ 3.7 %) | A single-row lattice with width/chord < 0.25 is **refused** by the guard | Absolute accuracy |
| VLM-V4 | N | Neutral point | Planar rectangular wing; reference swept 0..0.6 c | NP = 0.25 c ± 0.01 c (*measured* 0.249-0.2515); C_mα sign flips at the NP | — | Swept-wing NP accuracy |
| VLM-V5 | N | Scale invariance | Wing scaled 1e-3..1e3 | C_L equal to 1e-6 relative | — | — |
| VLM-V6 | U | Sweep reference line | Measured c/4 line of the generated panels | Λ_c/4 = input ± 0.01° | Tapered, λ = 0.3 | — |
| VLM-V7 | U | Linear-window guard | α ∈ [6°, 12°] only | "insufficient linear data"; no NaN and no "Unstable" | 2-point window | — |
| VLM-V8 | U | Seed placeholder flag | Bounds seed | validity = warning, with a message | — | — |
| VLM-V9 | U | Analytic references | Trapezoid S, c̄, x_MAC | Equal to 1e-9 relative | λ = 1; λ = 0.1 | — |
| VLM-V10 | N | Camber and twist (M2-9) | Thin-airfoil integrals computed in the test. NACA 2412 at AR ≥ 20 (quasi-2-D). | α_L0 within 0.3°; C_m0,c/4 within 0.01 | Twisted rectangular wing: lift distribution sign | Thickness effects |
| REC-V1 | N | Planform extraction | Synthetic tapered swept wing tessellated with long slivers, both skins; analytic S, c̄, Λ | S and c̄ ≤ 2 %; Λ ≤ 0.5°; independent of station count | One skin only | Fillets and blends |
| REC-V2 | N | Demo outboard wing | Triangles with centroid y ≥ 8 m; **independent** 400-station slicer written in the test | S ≤ 2 % of the oracle (coordinator: 22.66 m²) | — | Inboard blend region |
| REC-V3 | U | Plausibility errors | Half-wing; MAC > 0.5 L_x; span > bounds | `valid = false` with a specific code | Each rule separately | — |
| STAB-V2 | U | Wing-alone guard | No H-tail | No verdict; "wing-alone" label | H-tail assigned but invalid | — |
| STAB-V3 | U | Assumed-mass guard (RB-01) | `mass.source = assumedUniform` | Verdict withheld | Edited manifest → verdict shown, with the model description and the statement that fuselage omission over-estimates SM | Correctness of the VLM SM |
| STAB-V1 | N | Short-period model (M8) | Closed-form 2 × 2 eigenvalues | Frequency and damping ≤ 2 %; α ≠ θ | Unstable case labelled divergent, plot truncated | Real dynamics |
| MASS-V1 | N | Mass properties (existing) | Analytic cylinder, box, tetrahedron; translation and rotation | ≤ 1e-6 relative | Open mesh flagged conditional | Real masses |
| FRAME-T1 | U | Signs | VLM (and CFD in CFD-T5) | α > 0 ⇒ C_L > 0; reference aft of the AC ⇒ C_mα > 0 | — | — |

## 2. Identity, topology, spatial index, selection, store (M0-M1)

| ID | Lvl | Check | Pass | Negative or edge |
|---|---|---|---|---|
| TOPO-T1 | I | Demo exact topology | 28 boundary, 5 four-use, 0 degenerate, 1 edge-component, 0 inconsistent orientation | — |
| TOPO-T2 | U | Degenerate exclusion | Counted separately; no self-edges | — |
| TOPO-T3 | U | Weld robustness | Vertices 2e-9 m apart across a hash-cell boundary are merged by the relative weld; no collapse at mm scale | Vertices 1e-4 apart stay distinct |
| SPAT-T1 | U | Spatial-index queries | Ray, nearest, box, triangle–triangle and inside agree with brute force on 1,000 random queries over random meshes | Degenerate and coplanar triangles |
| LINT-T1 | U | Purity rule | No bare-specifier, DOM or three.js imports in `src/core`, `src/geometry`, `src/domain`, `src/export` | — |
| ID-T1 | U | SHA-256 determinism | Same input gives the same hash; a 1-ulp change gives a different hash | — |
| ID-T2 | U | Snapshot v2 round trip | Deep-equal | v1 → v2 migration fixture |
| ID-T3 | I | Mismatch rejection | Equal-count, different mesh → surfaces rejected | Silent autosave restore is impossible |
| ID-T4 | I | Restore order | Mapping applied before surfaces | — |
| ID-T5 | U | Improper axis map | Winding flipped; signed volume > 0 | — |
| ID-T6 | U | Non-finite vertices | Import refused with the triangle id | ±Infinity |
| ID-T7 | U | `paramsHash` and `inputsHash` | `paramsHash` depends only on the parameters and `generatorVersion`. `inputsHash` changes only when the relevant slices change. | Reordered JSON keys give the same hash |
| SURF-T1 | U | Invariants | Total and unique mapping (imported); names valid and case-insensitively unique; reserved names refused | — |
| SURF-T2 | U | Operation algebra | 1,000 seeded random operations keep the invariants | — |
| SURF-T3 | U | Undo | Full undo restores the initial state; a gesture coalesces into one entry | Undo beyond depth refused |
| SURF-T4 | U | Imported-name sanitisation | DATA_CONTRACTS §4.3 rules give deterministic output | Spaces, UTF-8, empty, duplicate, reserved, leading digit |
| SEL-T1 | I | Pick identity | 1,000 rays at random visible triangle centroids along the normal: 100 % exact `triangleId` (brute force; BVH default and indirect in spike S-2) | Coincident faces: deterministic tie rule |
| SEL-T2 | I/M | Interaction contract | Ctrl+Click selects one triangle; Ctrl+Shift+Click floods; colour (1, 0.4, 0) | Shift alone does nothing |
| SEL-T3 | U | Flood barriers | Never crosses surface boundaries or feature edges | Barrier off |
| SEL-T4 | I/M | A320 tagging workflow | Five surfaces in ≤ 15 operations; per-surface bounding boxes inside fixture ranges | — |
| SEL-T5 | U | Add/remove/replace | Exact set algebra | — |
| STORE-T1 | U | Store | One notification per action; caches invalidated by `inputsHash` | — |

## 3. Geometry generation (M2)

| ID | Lvl | Check | Oracle | Pass | Negative or edge |
|---|---|---|---|---|---|
| GEO-T1 | N | NACA sections (RB-19) | **Blunt:** tabulated NACA 0012 ordinates (Abbott & von Doenhoff App. I, edition cited in the fixture). **Sharp:** closed form with a₄ = −0.1036. **TMR fixture:** the TMR coordinate file. | Blunt within 1e-4 c of the tables; sharp within 1e-9 of its closed form; y_t,max = 0.0600 c at x ≈ 0.30 | 2412 camber maximum 0.02 at x = 0.4 |
| GEO-T2 | I | Body closure | 200 seeded random lifting surfaces | 0 open, 0 non-manifold, **no self-intersection** (SPAT), signed volume > 0 | Blunt trailing edge closed by `te_base` |
| GEO-T3 | N | Superellipse | 4ab Γ(1+1/n)²/Γ(1+2/n) | Area ≤ 0.5 %; closed ends | n = 1 produces feature edges |
| GEO-T4 | N | Parameter measure-back (RA-13) | Per-station leading- and trailing-edge points taken from generated vertices; least-squares lines | c/4 sweep, dihedral and twist within 0.05°; taper and span within 1e-6 relative | λ = 0.1, Λ = 60°, Γ = ±15° |
| GEO-T5 | I | Intersection pairs | — | Exactly the expected pairs | Clear tail: no pair |
| GEO-T5b | I | Manifold union (spike S-3) | — | Watertight; every output triangle maps to an input surface | — |
| GEO-T6 | U | Empennage presets (RB-16) | — | Expected names and placement; **each V-tail half has upward dihedral and correct incidence sign**; T-tail stabiliser at height s_v | Mirror check on left halves |
| GEO-T7 | I | `expectedEmpty` and R6b | — | A buried root cap is detected as `expectedEmpty` | An exposed cap → R6b error |

## 4. Domain, boundary conditions, export, API (M3, M4b)

| ID | Lvl | Check | Pass | Negative |
|---|---|---|---|---|
| ATM-T1 | U | ISA, Re, Mach at 3 conditions | Within 0.1 % | M = 0.78 → error; Re 2e5 → `regime: invalid`; M = 0.25 → bias flag with value |
| DOM-T1 | U | Extents, names, minimums, half model | As specified | f_u = 2 → R9 error |
| BC-T1 | U | R1 completeness | — | Untagged surface → error naming it |
| BC-T2 | U | R2 symmetry | — | Non-planar face; β ≠ 0; asymmetric geometry; C_L,max run with a half model |
| BC-T3 | U | R3 far-field mode | — | — |
| BC-T4 | U | R4 tunnel orientation | — | Inlet and outlet swapped |
| BC-T5 | U | R5 wall on an outer face | — | Error |
| BC-T6 | U | R7/R8 references and regime | — | Missing S; M > 0.3; `wallFunction` with δ < 10 h₁ (UAV example) |
| BC-T7 | U | R6/R6b closure and buried surfaces | — | Open body; exposed root cap; junction penetration below the minimum |
| BC-T8 | U | R10 names and patch set | — | Reserved name; case-insensitive collision; force group referencing an `expectedEmpty` surface |
| EXP-T1 | I | Exported bodies re-import closed | Closed | Leaky imported shell → export refused |
| EXP-T2 | U | Multi-solid round trip | Names identical | Invalid name refused |
| EXP-T3 | U | Manifest consistency | Names, files and hashes consistent; `physicsHash` excludes provenance | Tampered file → refused |
| EXP-T4 | I | Cross-language parity | Positive fixtures valid in JS and Python; **each negative fixture yields the same rule id on both sides**; fixtures generated at test time | — |
| EXP-T5 | I [OF] | `surfaceCheck` on exporter output (RA-13) | Closed, no illegal triangles, no self-intersections | Deliberately open body → reported |
| API-T1 | I | API contract | POST, PUT and GET status codes and schemas per ARCH §8 | Unknown job → 404 |
| API-T2 | I | API security | Server binds 127.0.0.1 only | Names with `..`, `/`, `#`, `$` and `codeStream` rejected; oversize upload rejected; non-numeric physics fields rejected |
| API-T3 | I | Browser client | Round trip against a mock backend (no OpenFOAM) | Network failure surfaced, never silent |
| FMT-T1 | U | Binary field format | Writer/reader round trip; offsets multiples of 8; `Float32Array` construction never throws | Truncated file → clear error |

## 5. Backend, meshing, solving, extraction (M4-M5) [OF]

| ID | Lvl | Check | Procedure | Pass | Negative | Cannot prove |
|---|---|---|---|---|---|---|
| CFD-T1 | I | Environment pin | Version string; utilities present; **`regions` name-override probe** with a 2-region STL; Python dependencies importable | Exact pin; patches named exactly by region | Wrong version → abort | — |
| CFD-T2 | S | 2-D NACA 0012 (NASA TMR), Re 6e6 (RB-05) | TMR coordinates and grid family (or an extruded mesh ≥ 100 c with point-vortex correction); TMR-conforming inflow. **The compressible solver at M = 0.15 is compared with TMR SST reference results like-for-like.** simpleFoam runs on the same mesh, and its difference is *reported* as the measured compressibility step. The snappyHexMesh slab is quantification only. | Compressible run: C_L within 2 % (absolute ≤ 0.01 at α = 0); C_D within 5 %; C_p RMS ≤ 0.05. α = 15° is gated **only if** steady per §7.3. | — | 3-D, junctions, stall |
| BLD-T1 | U | Deterministic builder | Same bundle twice | Byte-identical case (excluding timestamps); `regions` overrides present for every solid | — | — |
| MESH-T1 | I | Pre-mesh surface check | `surfaceCheck` | Closed; no illegal triangles | Leaky body → fails before snappyHexMesh | — |
| MESH-T2 | I | Wing-body-tail mesh (**M6 entry gate**) | Pipeline on bundle (b), using the S-4 recommendation | §7.2 gates incl. layer coverage and y⁺ area fraction | — | Adequacy (VAL-G1) |
| MESH-T3 | I | Patch set | `boundary` vs manifest | Patches = surfaces − `expectedEmpty` + domain faces | Renamed solid → stage fails | — |
| MESH-T4 | I | Leak detection | Fuselage with a hole | Fails with a leak or `locationInMesh` reason | — | — |
| CFD-T3 | U/I | Convergence gate (RB-09) | Synthetic logs (converged; oscillatory; drifting; C_L ≈ 0 at α = 0; continuation start), then real runs | Correct classification; the α = 0 case is judged by the absolute band | `nan` → failed | — |
| CFD-T4 | I | Failure taxonomy | Inject a failure per stage | Specific reason in `status.json` | — | — |
| CFD-T5 | N | Signs and moment transfer | Cambered and symmetric wings; two references | α > 0 ⇒ C_L > 0; transfer formula within 1 % using C_X, C_Z derived from C_L, C_D | Wrong `pitchAxis` sign detected | — |
| CFD-T6 | I | Reproducibility and provenance | Rerun the same bundle with the same decomposition | ≤ 1e-6 relative (serial), ≤ 1e-4 (parallel); provenance complete | — | Convergence quality |
| CFD-T7 | N | **Extraction** check | numpy integration of p and τ_w | ≤ 0.5 % of forceCoeffs | — | Physical correctness (same field) |
| CFD-T8 | N | Half vs full (RB-22) | `mirrorMesh` of the half mesh → full case | C_L, C_D, C_m ≤ 0.5 % | — | — |
| CFD-T9 | N | C_p **extraction** sanity | Stagnation point; pressure-force integration | C_p,max ∈ [0.98, 1.02]; within 1 % of the pressure part | — | Physics |
| XVAL-T1 | N | VLM vs RANS consistency | Rectangular wing, AR ≥ 6, α ≤ 4°; VLM at R2 | ≤ 10 %, tightened to 5 % after one calibration run with recorded rationale | — | Either being right |
| E2E-T1 | E | Browser → API → results | Rectangular wing, α ∈ {−2..6} | All gates pass; ResultBundle shown with validity and regime flags | — | — |

## 6. Validation and uncertainty (M6) [OF]

Proposed gates are fixed before runs. Gates for datasets not yet selected are set **after reading their stated uncertainty**. The v0.9 test **VAL-E1** is split into VAL-E1a and VAL-E1b (RB-17).

| ID | Check | Pass |
|---|---|---|
| VAL-G1 | GCI over 3 meshes; **effective** refinement ratio from cell counts; observed order reported; non-monotone sequences handled per Celik et al. (2008) | GCI_fine ≤ 2 % (C_L), ≤ 5 % (C_D); U(C_m) ≤ 0.005 |
| VAL-D1 | Domain study with the near-body mesh frozen and the outer blocks extended (RB-18) | **Richardson-estimated residual** at the production domain ≤ 0.5 % (C_L), ≤ 1 % (C_D), ≤ 0.002 (C_m) |
| VAL-I1 | Tolerances tightened 10× | Change < 0.1 % |
| VAL-Y1 | Wall functions vs low-Re on the validation wing (RB-06) | Differences reported; the production treatment is fixed for the validated regime only |
| VAL-E1a | NASA TP-3151 (McAlister & Takahashi, *NACA 0015 Wing Pressure and Trailing Vortex Measurements*, 1991). Reviewer-checked as real by search snippet; the report text is not yet read. Used as a **C_p-distribution and tip-vortex benchmark** only (RB-17). | C_p at the measured stations within the stated experimental uncertainty plus U_num. Tip-vortex core position: gate set after reading the report. |
| VAL-E1b | Force-balance 3-D wing dataset with documented tunnel corrections (selection open, U-2) | C_Lα and C_D gates set from the dataset uncertainty |
| VAL-E2 | Wing-body-tail dataset with C_m-α or NP (selection open, U-1) | NP within a bound set from the dataset uncertainty (indicative 0.05 c̄). Required before CFD SM loses its "unvalidated" label. |

## 7. Stability and C_L,max (M8)

| ID | Lvl | Check | Pass | Cannot prove |
|---|---|---|---|---|
| STAB-C1 | N | Post-processor: NP invariance to CofR | NP shift ≤ 0.01 c̄ for CofR ±0.2 c̄ at z_CG | **Any CFD accuracy** (an identity of the transfer, RB-02) |
| STAB-C2 | N | Post-processor: CG shift ±0.1 c̄ | SM changes ∓0.1 ± 0.005 | Same |
| STAB-C3 | N | Tail plausibility (RB-02) | Tail-on minus tail-off ΔC_mα and dε/dα at the tail within ~20 % of VLM and lifting-line estimates | Accuracy (plausibility only) |
| STAB-C4 | I | Tail-wake resolution (RB-14) | ≥ 8 cells across the estimated wake thickness at the tail station, for every α in the sweep | — |
| CLMAX-T1 | U/N | Bracketing and fit | Reported only with ≥ 5 converged points spanning the peak, Δα ≤ 1°, quadratic-fit maximum with uncertainty | — |
| CLMAX-T2 | I | Hysteresis | Ascending and descending continuation; \|ΔC_L\| ≤ 0.05 at each α within ±3° of the peak, otherwise "not determined" | — |
| CLMAX-T3 | U | Negatives | Monotonic C_L → "not determined"; half model or M > 0.2 → refused | — |

## 8. View models, UI, performance, documentation

| ID | Lvl | Check | Pass |
|---|---|---|---|
| VM-T1 | U | Labels and provenance strings | "C_Di (VLM) + assumed C_D0"; C_m reference and source; seed flag; full verdict text with omissions |
| VM-T2 | U | Staleness view model | fresh / stale / absent from `inputsHash` or `physicsHash`; stale ⇒ the plot model is empty or greyed |
| VM-T3 | U | Blocking-issues view model | Every rule id maps to a message and the surfaces involved |
| VM-T4 | U | Uncertainty bands | Values only from the ResultBundle; nothing synthesised |
| VM-T5 | U | C_p colour map | Diverging, centred at 0; legend states V, ρ and the p∞ reference; C_f shown as \|τ_w\|/q∞ |
| UI-T11 | U | Plot integrity | Points only from results; unconverged points hollow; **lines break at unconverged points**; no interpolation; dimensional forces = C·q∞·S |
| UI-T1 | M | No-WebGL degraded mode | Import, VLM and plots work; banner shown |
| UI-T2 | M | Stale plots visible | Rendered staleness matches VM-T2 |
| UI-T3 | M | Labels visible | Rendered strings match VM-T1 |
| UI-T4 | M | Camera | Pan, zoom-to-cursor, fit |
| UI-T5 | I | User overrides | Overridden reference values survive a remap |
| UI-T6 | M | Workspaces | State preserved across steps; tree and inspector follow the selection |
| UI-T7 | M | BC visualisation | Per-face colours, legend, flow arrow, blocking panel |
| UI-T8 | I | Cell estimate | Backend estimate shown; factor-2 calibration recorded in M4 |
| UI-T10 | M | Accessibility basics | Keyboard paths; no colour-only encoding |
| UI-T13 | M | Job monitor | Failure reason visible; logs downloadable |
| PERF-T1 | I | Topology (Node, audit host) | ≤ 500 ms for 2e5 triangles (typed-array weld; reviewer measured 32 ms for the hash) |
| PERF-T2 | M | Pick latency | p95 ≤ 35 ms on the demo; long tasks measured with `PerformanceObserver('longtask')` |
| PERF-T3 | I | Generator latency | `uav-default` preset ≤ 100 ms (Node, audit host) |
| PERF-T4 | M | Surface-field render | 2e6 triangles ≥ 30 fps on the recorded GPU |
| SRV-T1 | U | Static server robustness | Malformed percent-escape → 400; process stays up |
| DOC-T1 | I | Demo report | CALCULATION_PIPELINE §16 equals the `scripts/demo-report.mjs` output |
| E2E-T2 | M | Full workflow | Generate → surfaces → domain/BC → run → results, per the checklist |
