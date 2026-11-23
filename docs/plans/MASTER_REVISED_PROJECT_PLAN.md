# Master Revised Project Plan

Status: **v1.0**, revised after the adversarial review (2026-10-23). This plan supersedes `plan.md` (historical) and §10 of `refs/CFD_Aircraft_Design_and_Simulation_Requirements.md` ("Intended Implementation Order").

**Document precedence:** [DATA_CONTRACTS](../architecture/DATA_CONTRACTS_AND_PIPELINE.md) (normative) > this plan > [PHASED plan](PHASED_IMPLEMENTATION_PLAN.md) > [TEST MATRIX](VALIDATION_AND_TEST_MATRIX.md) > [HANDOFF](IMPLEMENTATION_HANDOFF.md).

Related documents:
- Evidence: [DISCREPANCY_REGISTER.md](../audits/DISCREPANCY_REGISTER.md).
- Objections and dispositions: [ADVERSARIAL_PLAN_REVIEW.md](../audits/ADVERSARIAL_PLAN_REVIEW.md).

## 1. Situation

The repository is a browser VLM/stability MVP working on imported STL files. The governing requirements describe an OpenFOAM-based aircraft CFD platform. Of 85 functional requirements, the gap analysis (B §4) counts 1 implemented, 28 partial, 55 missing and 1 contradicted.

The MVP's displayed outputs are not trustworthy:

| Defect | Register entry |
|---|---|
| Induced drag has the wrong sign and is 9-16× too large | DR-01 |
| Single-row VLM diverges at narrow panels | DR-02 |
| Wing area is −63 % | DR-03 |
| Pitch dynamics are non-physical | DR-05 |
| The stability verdict is wing-alone | DR-06 |
| Identity is only a triangle count | DR-07 |

Several modules are correct and reusable (register §6):
- mass and inertia;
- the Biot–Savart kernel;
- the linear solver;
- STL parsing;
- region growth.

The defects share six root causes (register §2). This plan fixes those causes.

## 2. Decisions

| ID | Decision | Rationale |
|---|---|---|
| DEC-01 | **Target: an aircraft CFD platform** (the requirements, modified in §3). The existing VLM is kept as **Tier-0 flat-plate preliminary aerodynamics** and as a linear-range cross-check. **Owner confirmation Q-1 is needed before M1b, M2 and M3.** | Newest stakeholder intent. The VLM is a cheap oracle once fixed. |
| DEC-02 | **Repository frame:** x aft, y starboard, z up, SI; C_m nose-up positive; β per Etkin. The freestream is V(cos α cos β, −sin β, sin α cos β). | Already implemented. Formulas verified by Reviewer B. The sideslip sign is corrected. |
| DEC-03 | **Identity:**<br>• **Surfaces** (named face sets), **bodies** (closed shells, the unit of export and closure) and **components** (semantic groups).<br>• Imported meshes: `surfaceOf` over the file triangle order.<br>• Generated meshes: name-only surfaces, never tagged per triangle.<br>• **Patch name = surface name**, enforced with snappyHexMesh `regions` overrides.<br>• Hashes: `meshHash` or `paramsHash`; `inputsHash`; `physicsHash`. | RC-1; RA-01, RA-06, RA-07, RA-10, RA-11 |
| DEC-04 | **Picking:** brute force by default. three-mesh-bvh only after spike S-2, behind a tested `faceIndex → triangleId` mapping. | DR-13; measured 19-32 ms per pick |
| DEC-05 | **Parametric generators** in pure browser modules. Parts are closed and self-intersection-free by construction. Left halves are mirrors. | R-4.*; DR-11; RB-16 |
| DEC-06 | **No Boolean union on the CFD path.**<br>• Overlapping closed bodies are meshed by snappyHexMesh with `surfaceBooleanFeatures`.<br>• Buried caps must be strictly inside another body (R6b).<br>• Junction quality is measured in spike S-4.<br>• Manifold is the only union candidate (S-3).<br>• **three-bvh-csg is rejected** for export. | DR-14; RB-15 |
| DEC-07 | **Domain and boundary conditions:**<br>• L_ref = max(span, x-extent). Defaults 5/10/5 L_ref; minimums 3/6/3.<br>• `FARFIELD` (freestream type) on all outer faces, so one mesh serves an α range covered by the wake region.<br>• Half model with `symmetryPlane` when valid, never for C_L,max.<br>• TMR-bounded turbulence inflow.<br>• The 2-D validation case has its own domain. | DR-16, DR-17; RB-05, RB-12, RB-13, RB-14 |
| DEC-08 | **Solver:**<br>• A pinned OpenFOAM, ESI line (v2606 or the latest packaged for Ubuntu 26.04 at M4 start); the exact version is recorded.<br>• blockMesh + snappyHexMesh; simpleFoam + kOmegaSST.<br>• **M ≤ 0.3 hard limit; Re < 5e5 marks every coefficient `regime: invalid`.**<br>• The **wall treatment is decided by VAL-Y1.** Validation uses low-Re. Wall functions are refused where δ < 10 h₁.<br>• Gmsh is deferred. | RB-06, RB-11 |
| DEC-09 | **Backend:**<br>• Python (numpy, jsonschema, stdlib), CLI first.<br>• A local same-origin HTTP server (127.0.0.1) serves the app and `/api`.<br>• The backend is the authority on validation.<br>• Job directories. | RA-02, RA-14, RA-17 |
| DEC-10 | **UI framework decided at M1b entry.** The default recommendation is **Preact + htm**, vendored ESM with no build step and a React-compatible API, which satisfies "React or equivalent". React + Vite + TS only if the owner wants build tooling. The core and store stay framework-agnostic. Workspaces form a guided sequence with a persistent blocking-issues panel. | RA-15 |
| DEC-11 | **Validation ladder:**<br>1. Method oracles: Trefftz, lifting-line, the elliptic case, Helmbold-DATCOM, NACA tables.<br>2. 2-D NACA 0012, NASA TMR, on its own grid family, with compressibility measured rather than assumed.<br>3. 3-D rectangular wing: code-to-code, then VAL-E1a (C_p and tip vortex) and VAL-E1b (force balance).<br>4. GCI and domain studies.<br>5. Wing-body-tail stability only with VAL-E2. | RB-02, RB-05, RB-17, RB-18 |
| DEC-12 | **C_L,max:**<br>• Full model only, M ≤ 0.2, valid regime.<br>• Δα ≤ 1° near the peak; local quadratic fit.<br>• Ascending and descending continuation, compared per α.<br>• Labelled "steady-RANS stall-onset estimate".<br>• **"Not determined" is the expected common outcome.** | DR-18; RB-13 |
| DEC-13 | **Stability verdicts:**<br>• Need an H-tail, a non-default mass source, and linear-range data checked by the adjacent-slope rule.<br>• The verdict text names the model and its omissions.<br>• NP is taken at z_CG; SM only from CG-referenced C_m.<br>• **CFD static margin is "unvalidated" until VAL-E2.**<br>• The pitch-response plot is hidden until the short-period model (M8). | DR-05, DR-06; RB-01, RB-02, RB-10, RB-21 |
| DEC-14 | **Document authority** per [START_HERE.md](../START_HERE.md). Historical documents are not edited. Method documents are updated in the same change as the code. | DR-32 |
| DEC-15 | **Export:** one ASCII multi-solid STL **per body**, with solid names equal to surface names. `expectedEmpty` lists unwetted surfaces. Force groups are listed by surface. | DR-15; RA-01, RA-07 |
| DEC-16 | **NACA trailing edge:** blunt by default for CFD export (a₄ = −0.1015 plus a `te_base` surface); sharp is optional. | RB-15, RB-19 |
| DEC-17 | **Tier-0 VLM:**<br>• Multi-row (M ≥ 4) with a width/length guard ≥ 0.25.<br>• Freestream-aligned wake, length ≥ 10 b.<br>• General transverse-plane Trefftz drag, signed.<br>• Labelled "flat-plate inviscid: C_Lα ±5 %, C_Di ±8 %".<br>• Camber and twist added in M2-9. | DR-01, DR-02; RA-03; RB-03, RB-04, RB-07 |

## 3. Requirement dispositions

IDs follow [REQUIREMENTS_GAP_ANALYSIS.md](../audits/REQUIREMENTS_GAP_ANALYSIS.md) §3.1; `L` is the line number in the requirements file.

Disposition values:
- **Retain:** keep as written.
- **Modify:** keep with the stated change.
- **Replace:** meet the intent another way.
- **Defer:** later tier or decision point.
- **Reject:** not implemented.

| ID | Requirement (abridged) | Disposition | Change and justification | Milestone |
|---|---|---|---|---|
| R-1-a..e | Objectives | Retain | — | M1-M7 |
| R-1-f | Correctness before UI | Retain | Built into the milestone order and gates | all |
| R-2-a..d | Study the ANSYS workflow (YouTube) | Modify | Video not accessed (Q-6). ANSYS B-rep faces map to **surfaces**; triangles are only a selection tool. | M1 |
| R-2-e | Inputs and equations for the coefficients | Retain | DATA_CONTRACTS §2 | M0/M5 |
| R-3-a | Locate all components and faces | Modify | Generated geometry: by construction. Imported: user tools. Automatic classification deferred. | M1/M2 |
| R-3-b | Manual labelling | Retain | — | M1 |
| R-3.1-a/b | three-mesh-bvh, `computeBoundsTree()` | Modify | Optional and identity-safe, after spike S-2 (DEC-04) | M1b |
| R-3.1-c | Ctrl+Click via `faceIndex` | Modify | Ctrl+Click kept; identity via `triangleId` mapping | M1 |
| R-3.1-d/e | Ctrl+Shift BFS flood ≤ 30° | Modify | 30° adjacent limit plus seed cone plus barriers; the literal rule floods 62 % of the demo (DR-11) | M1 |
| R-3.1-f | `#FF6600` vertex-colour highlight | Retain | Run-coalesced partial updates (RA-19) | M1b |
| R-3.2-a..c, e | Locate, select, assign, inspect | Retain | Tree and inspector | M1b |
| R-3.2-d | Tags on face sets | Modify | Tags apply to named surfaces | M1/M3 |
| R-4.1-a | NACA 4-digit | Modify | Blunt trailing edge by default for export (DEC-16) | M2 |
| R-4.1-b..g | Loft, twist, dihedral, sweep, taper, transforms | Retain | Definitions fixed (DATA_CONTRACTS §3.2) | M2 |
| R-4.2-a | Superellipse fuselage | Retain | — | M2 |
| R-4.2-b | "n < 2 is chined" | Modify | Only n ≤ 1 gives corners (DR-42, confirmed by RB) | M2 |
| R-4.3-a..e | Five tail types | Retain | Mirror-based left halves; inverted-U per Q-5 | M2 |
| R-4.3-f | Tails identifiable and selectable | Retain | By construction | M2 |
| R-5.1-a | L_ref | Modify | max(span, x-extent) | M3 |
| R-5.1-b | Automatic enclosure | Retain | — | M3 |
| R-5.1-c/d | 3/6 L_ref | Modify | Minimums; defaults 5/10/5; residual-based domain study | M3/M6 |
| R-5.1-e, R-5.2-a | Domain faces visible and labelled | Retain | — | M3 |
| R-5.2-b..e | Four BC tags | Modify | Add `FARFIELD` and `SLIP_WALL`; `SYMMETRY` constrained | M3 |
| R-5.2-f..h | State, JSON manifest, review | Retain | Schema plus authoritative backend validation | M3/M4 |
| R-5.3-a/c | CSG union into one watertight shell | Replace | Closed per-body export plus mesher intersection features; optional Manifold union | M2/M3 |
| R-5.3-b | three-bvh-csg | **Reject** | Version cap, no manifold guarantee, identity loss (DR-14) | — |
| R-5.3-d | Binary STL export | Modify | Per-body ASCII multi-solid (DEC-15) | M3 |
| R-6-a..c | C_L, C_D, C_M | Retain | DATA_CONTRACTS §2.4-2.5 | M0/M5 |
| R-6-d | C_L,max | Modify | Qualified estimate only (DEC-12) | M8 |
| R-6-e | Static stability | Modify | DEC-13 gates; CFD SM unvalidated until VAL-E2 | M0/M8 |
| R-6-f | Reynolds number | Retain | Regime flags attached to every coefficient | M3 |
| R-6-g | Relation to the CFD setup | Retain | — | M3 |
| R-7.1-a | Node or Python backend | Retain (Python) | DEC-09 | M4 |
| R-7.1-b | Backend accepts STL + JSON | Modify | Manifest plus per-body STL over a same-origin API | M4b |
| R-7.2-a | Gmsh or OpenFOAM meshing | Retain (OpenFOAM) | Gmsh deferred | M4 |
| R-7.2-b..e | snappyHexMesh, simpleFoam, SST, Re | Retain | Regime and wall-treatment gates | M4 |
| R-7.3-a | VTK or JSON results | Modify | Function-object output → aligned binary with a JSON header | M5 |
| R-7.3-b/c | Three.js display; C_p contours | Retain | — | M7 |
| R-7.3-d | Streamlines | Modify | OpenFOAM `streamlines` function object; polylines | M5/M7 |
| R-8-a | React + Tailwind | Modify | Decided at M1b; default Preact + htm (DEC-10) | M1b |
| R-8.1-a..c | Tree, viewport, inspector | Retain | — | M1b |
| R-8.2-a | Zustand or Redux | Modify | Framework-agnostic store, same role | M1b |
| R-8.2-b | Real-time sliders | Modify | Preview in real time; validation and export are explicit steps | M2 |
| R-8.3-a | Separate tabs or workspaces | Retain | Guided workspaces | M1b |
| R-9-a..c, e..i | Result views | Retain | Validity-gated, with regime flags | M7 |
| R-9-d | C_L,max view | Modify | DEC-12 | M8 |
| R-10 | Implementation order | Modify | §4 | — |

## 4. Milestones and gates

The milestone order differs from the requirement's for dependency reasons (RA-04, RA-05, RA-09):
- The quarantine half of M0 and the VLM numerics run in parallel.
- M1 splits into core contracts (M1a) and interaction (M1b).
- Generators come before domain and BCs, because watertight named geometry is a prerequisite.
- The OpenFOAM baseline (M4a) starts as soon as Q-4 is answered.
- G4 is wing-only. The wing-body-tail mesh is the M6 entry gate.
- Verification (M5) is separated from validation (M6).

The full dependency graph is in the [phased plan](PHASED_IMPLEMENTATION_PLAN.md).

| Milestone | Gate (summary) | Stop condition |
|---|---|---|
| M0a + M0b | VLM-V1..V9 pass, including V1b and V2b-V2d. REC-V1..V3 pass. STAB-V2 and STAB-V3, TOPO-T1 and TOPO-T2, ID-T1, ID-T3, ID-T4 and ID-T6 pass. Every displayed number has a validity status. Demo report regenerated. | Any of DR-01..DR-08 still affects a displayed number |
| M1a | TOPO-T3, SPAT-T1, SURF-T1..T4, SEL-T1/T3/T5, ID-T5/T7, EXP-T2/T4 and LINT-T1 pass | Identity breaks under any operation |
| M1b | Store and undo tests. Manual QA signed. A320 tagged by documented workflow (SEL-T4). | — |
| M2 | GEO-T1..T7 pass on 200 random assemblies. VLM-V9. | Any body not closed, or self-intersecting |
| M3 | Positive and negative fixtures agree in JS and Python with the same rule ids. BC-T1..T8. | A rule-violating bundle can be exported |
| M4a | CFD-T1, including the `regions` probe. CFD-T2 on the TMR grid. EXP-T5. | 2-D gates missed after the documented tuning budget → escalate |
| M4b | MESH-T1/T3/T4, CFD-T3/T4/T6, API-T1..T3, E2E-T1 (wing). S-4 reported. | — |
| M5 | CFD-T5, T7, T8, T9; XVAL-T1; FMT-T1. Regime flags on every coefficient. | — |
| M6 (entry: MESH-T2) | VAL-G1, VAL-D1, VAL-I1, VAL-Y1, VAL-E1a. VAL-E1b once U-2 is resolved. VAL-E2 selected. | Failure is reported honestly, and claims are restricted to the validated regime |
| M7 | Views gated by validity. VM-T1..T5. UI-T11. PERF-T4. | Any plot without provenance |
| M8 | STAB-C1..C4, CLMAX-T1..T3, STAB-V1 | — |

## 5. Capability tiers (revised per RB-01, RB-02, RB-06)

| Tier | Milestones | What may be claimed | What may not be claimed |
|---|---|---|---|
| **Minimum viable functionality** | M0-M5 | Tier-0 **flat-plate inviscid** estimates of C_Lα and C_Di (±5 % / ±8 %) and a VLM NP, stated with the model's omissions. Parametric aircraft with named surfaces and bodies. Validated case export. Converged RANS C_L, C_D, C_m for generated wing or wing-body cases in the linear range, with verified extraction, provenance and regime flags. | Accuracy against reality; C_L,max; any stability verdict on an assumed mass; anything at Re < 5e5 |
| **Scientifically validated CFD workflow** | + M6 | Coefficients with GCI uncertainty and a validation error band, **within the validated regime**: the Re/M range, α range, configuration class and **wall treatment** of VAL-E1a/E1b/VAL-Y1. | **CFD static margin**, until VAL-E2 passes. Results outside the regime. Post-stall. **If Q-2 = small UAV (Re < 2e6), this tier is unreachable without a validated transition model.** |
| **Validated stability (extension)** | + M8 with VAL-E2 | CFD static margin for wing-body-tail with numerical and validation uncertainty | — |
| **Research** (not committed) | — | URANS/DDES near stall, compressible solver (M > 0.3), transition (unless promoted by Q-2), adjoint methods, automatic recognition, 6-DOF | — |

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OpenFOAM not packaged for Ubuntu 26.04 | Medium | Blocks M4 | Container or source build (Q-4); M4a starts early |
| Layer collapse at trailing edges and junctions | High | C_D and C_m error | Blunt trailing edge by default; R6b overlap rules; layer-coverage and y⁺ area gates; spike S-4 |
| snappyHexMesh `regions` override behaves differently on the pinned version | Low-Medium | Identity chain breaks | CFD-T1 probe before M4b; fallback is a deterministic name map applied by the builder |
| 14 GB RAM (about 6e6 cells, estimated) | High | GCI on full configurations infeasible | GCI on wing and wing-body; cluster option (Q-3) |
| forceCoeffs sign or syntax drift | Medium | Silent sign errors | Version pin; CFD-T5; extraction check CFD-T7 |
| Regime mismatch (UAV) | Depends on Q-2 | Invalid physics | Hard regime flags; transition promoted only by decision |
| Validation data access and licensing | Medium | M6 and M8 | Public datasets; citation and licence recorded with the data; U-1 and U-2 |
| Manual tagging of smooth imported meshes | High | UX | Plane split, barriers, box; generated geometry is primary for CFD |

## 7. Open questions (owner) and unresolved items

| ID | Question | Blocks |
|---|---|---|
| Q-1 | Confirm the CFD target, with the VLM kept as Tier-0 | M1b, M2, M3 |
| Q-2 | Regime: transport at approach speeds (Re ~ 1e7-2e7) or GA (Re ~ 2e6-6e6)? Or small UAV (Re ~ 3e5, which **requires transition modelling** for any valid result)? | Validation datasets (U-1, U-2); wall treatment; transition scope (U-6) |
| Q-3 | Compute budget: this host (16 cores, 14 GB) or a cluster? | Mesh ceilings; GCI scope |
| Q-4 | Permission and method to install OpenFOAM: native, container or source | M4a |
| Q-5 | Meaning of "inverted-U" tail | M2-4 (interpretation provided) |
| Q-6 | Workflow specifics in the YouTube reference | Informational |
| Q-7 | Licence and provenance of the A320 demo STL | Redistribution; any demo CFD |
| Q-8 | Product name (AirFLOW or FlowSync) | Cosmetic |

Unresolved technical items U-1..U-7 are listed in [ADVERSARIAL_PLAN_REVIEW.md](../audits/ADVERSARIAL_PLAN_REVIEW.md) §3.
