# AirFLOW: Start Here

This is the entry point for anyone continuing the project, human or coding agent. Read this page, then follow the reading order in §5.

Last updated 2026-10-23 by the repository audit (coordinator Opus 5.5; subagents Sonnet 5.5), after the adversarial review. Plan version **v1.0**.

## 1. Repository snapshot

| Item | Value |
|---|---|
| Branch and commit | `main` @ `25afe85` ("[PITCH RESPONSE and STATIC STABILITY MVP INIT]", 2026-07-18). `refs/` and `docs/` were untracked at audit time. |
| Stack | Vanilla ES modules; three.js r160, vendored as a single file; Node static server (`npm start`, port 4173); Node tests (`npm test`) |
| Tests | 23/23 pass on Node v24.21.0. They **do not** detect the Critical and High defects below (register RC-4). |
| Absent | React, bundler, dependencies, backend, OpenFOAM, Gmsh, Docker, CI. `reference/xflr5` is an empty orphan gitlink. |
| Audit host | Ubuntu 26.04, 16 cores, 14 GB RAM, Python 3.14.6 (numpy, jsonschema and scipy available) |

## 2. What actually works today (verified)

| Capability | Status |
|---|---|
| STL import, unit scale, axis permutation | Works. A det = −1 axis map inverts normals (DR-22). |
| Mass, volume, CG, inertia | **Correct.** Matches an analytic cylinder to 5 digits. |
| Triangle picking and region growth | Works. Brute force, 19-32 ms per pick on 197,772 triangles. |
| Manual labels (wing, H-tail, V-tail, fuselage) | Works. Identity is the triangle index plus a count only (DR-07). |
| Wing planform from labels | **Wrong.** −63 % area on a clean selection (DR-03); vacuous validity gate (DR-04). |
| VLM C_L and C_Lα | Lift consistent with lifting-line theory to within 3-6 %. Not convergent with N in single-row form (DR-02). |
| VLM C_Di | **Wrong**: sign, and 9-16× magnitude (DR-01) |
| Static margin | The formula is correct. The default verdict is wing-alone with an assumed mass (DR-06). |
| Pitch-response plot | **Non-physical** (DR-05) |
| CFD: generators, surfaces and bodies, boundary conditions, domain, meshing, solver, C_p, streamlines, C_L,max, Re | **Not implemented** |

## 3. Document authority and precedence

When documents conflict, the higher one wins:

**DATA_CONTRACTS (normative) > MASTER plan > PHASED plan > TEST MATRIX > HANDOFF.**

| Document | Status | Use it for |
|---|---|---|
| [`architecture/DATA_CONTRACTS_AND_PIPELINE.md`](architecture/DATA_CONTRACTS_AND_PIPELINE.md) | **Normative, v1.0** | Frame, formulas, regime flags, geometry rules, identity and naming, BC rules R1-R10, schemas, formats, gates |
| [`plans/MASTER_REVISED_PROJECT_PLAN.md`](plans/MASTER_REVISED_PROJECT_PLAN.md) | **Authoritative, v1.0** | Decisions DEC-01..17, requirement dispositions, milestones, tiers, risks, open questions |
| [`plans/PHASED_IMPLEMENTATION_PLAN.md`](plans/PHASED_IMPLEMENTATION_PLAN.md) | **Authoritative, v1.0** | Tasks, files, gates, dependency graph |
| [`plans/VALIDATION_AND_TEST_MATRIX.md`](plans/VALIDATION_AND_TEST_MATRIX.md) | **Authoritative, v1.0** | Definition of every test ID |
| [`plans/IMPLEMENTATION_HANDOFF.md`](plans/IMPLEMENTATION_HANDOFF.md) | Derived, v1.0 | The first tasks, with recipes and oracles |
| [`architecture/REVISED_SYSTEM_ARCHITECTURE.md`](architecture/REVISED_SYSTEM_ARCHITECTURE.md) | Authoritative, v1.0 | Subsystems, state ownership, the identity chain, backend layout |
| [`architecture/CURRENT_SYSTEM_ARCHITECTURE.md`](architecture/CURRENT_SYSTEM_ARCHITECTURE.md) | Snapshot of `25afe85` | What exists now |
| [`audits/DISCREPANCY_REGISTER.md`](audits/DISCREPANCY_REGISTER.md) | Authoritative | Defects DR-xx, root causes, the coordinator's verification log |
| [`audits/ADVERSARIAL_PLAN_REVIEW.md`](audits/ADVERSARIAL_PLAN_REVIEW.md) | Authoritative | 47 objections (RA, RB) with dispositions; unresolved items U-1..U-7; calibration data |
| `audits/REPOSITORY_IMPLEMENTATION_AUDIT.md`, `audits/UI_AND_SELECTION_AUDIT.md`, `audits/REQUIREMENTS_GAP_ANALYSIS.md`, `audits/MATHEMATICS_AND_CFD_CORRECTNESS_AUDIT.md` | Evidence records, with coordinator corrections in their headers | Detailed evidence and the traceability matrix |
| `refs/CFD_Aircraft_Design_and_Simulation_Requirements.md` | **Governing target, as modified** by the MASTER plan §3 | Stakeholder intent |
| `MVP_METHODOLOGY.md`, `CALCULATION_PIPELINE.md` | Accurate description of the current code. The defective method sections listed in register §5 are updated in M0. | Current behaviour |
| `plan.md` | **Historical**; contains maths errors (DR-33) | FS-xx numbering only |
| `refs/Qwen_markdown_20260918_2za7s34sd.md` | **Reference only**: describes a different codebase not present here; truncated | Nothing normative |

## 4. Key decisions (v1.0)

1. **Scope.** The target is a CFD platform. The existing VLM becomes **Tier-0 flat-plate preliminary aerodynamics** and a cross-check (DEC-01). Owner confirmation **Q-1** is needed before M1b, M2 and M3.
2. **Frame.** x aft, y starboard, z up, SI. C_m positive nose-up. β follows the Etkin convention. U∞ = V(cos α cos β, −sin β, sin α cos β) (DEC-02).
3. **Identity.**
   - **Surfaces** (named face sets), **bodies** (closed shells, the export unit) and **components** (semantic groups).
   - **Patch name = surface name**, enforced with snappyHexMesh `regions` overrides.
   - Generated geometry is identified by name only.
   - Hashes: `meshHash`/`paramsHash`, `inputsHash`, `physicsHash` (DEC-03, DEC-15).
4. **Geometry.** Parametric generators produce closed bodies, with a **blunt** NACA trailing edge by default. There is no Boolean union on the CFD path: overlapping bodies plus `surfaceBooleanFeatures`, with buried caps required to be strictly inside another body. three-bvh-csg is rejected (DEC-05, DEC-06, DEC-16).
5. **Domain and boundary conditions.**
   - `FARFIELD` on all outer faces, so one mesh serves an α range covered by the wake region.
   - Half model only when valid, never for C_L,max.
   - Turbulence inflow within NASA TMR bounds.
   - The 2-D validation case uses its own domain (DEC-07).
6. **Solver.**
   - Pinned ESI OpenFOAM; snappyHexMesh; simpleFoam + SST.
   - **M > 0.3 is refused. Re < 5e5 marks every coefficient `regime: invalid`.**
   - The wall treatment is fixed by validation, not assumed (DEC-08).
7. **Backend.** Python (numpy, jsonschema, stdlib), CLI first, then a same-origin local API that is the authority on validation (DEC-09).
8. **UI.** A framework-agnostic core and store. The framework is decided at **M1b** (default Preact + htm, no build). Guided workspaces with a blocking-issues panel (DEC-10).
9. **Claims.**
   - Stability verdicts need a tail, a real mass and linear data.
   - **CFD static margin is labelled "unvalidated" until VAL-E2 passes.**
   - C_L,max is a qualified estimate, and "not determined" is the normal outcome (DEC-12, DEC-13).

## 5. Reading order and starting point

1. This page.
2. [`plans/IMPLEMENTATION_HANDOFF.md`](plans/IMPLEMENTATION_HANDOFF.md): the first tasks, with recipes and oracles.
3. [`plans/MASTER_REVISED_PROJECT_PLAN.md`](plans/MASTER_REVISED_PROJECT_PLAN.md) §2 and §4.
4. [`architecture/DATA_CONTRACTS_AND_PIPELINE.md`](architecture/DATA_CONTRACTS_AND_PIPELINE.md) §2.7 (for M0b) and §4 (for M1a).

**The first milestone is M0, in two parallel tracks that need no owner input:**
- **M0b (VLM numerics).** Start with **M0-1**: own trailing legs plus a signed, general Trefftz drag, at `src/vlmSolver.js:121-147`.
- **M0a (quarantine and app correctness).** Start with **M0-10**: exact topology, as `src/core/topology.js`.

**M4a** (OpenFOAM pin and the 2-D NACA 0012 case) can start whenever the owner answers **Q-4**.

## 6. Rules for contributors

- A number without a validity record and provenance is not a result.
- Do not implement from `plan.md` or the Qwen handoff.
- Every numerical method needs an independent-oracle test, and the oracle must not import the code under test.
- Update method documents in the same change as the code.
- Never present solver output outside the regime validated in `validation/REPORT.md` (M6).
