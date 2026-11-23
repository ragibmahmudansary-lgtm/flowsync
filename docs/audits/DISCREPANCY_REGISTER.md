# Discrepancy Register and Coordinator Synthesis

Status: **Authoritative** (coordinator synthesis, Opus 5.5). Date: 2026-10-23. Fix proposals were aligned with plan v1.0 after the adversarial review. Repository: `main` @ `25afe85`, with `refs/` and `docs/` untracked.

This document reconciles the two independent Phase-1 audits. Subagent A covered architecture, UI and selection; Subagent B covered requirements, mathematics and CFD. Where the audits disagree, or where a claim drives a design decision, the coordinator re-verified it independently. The finding IDs `A-*` and `B-*` refer to the four companion audits:

- [REPOSITORY_IMPLEMENTATION_AUDIT.md](REPOSITORY_IMPLEMENTATION_AUDIT.md) (A)
- [UI_AND_SELECTION_AUDIT.md](UI_AND_SELECTION_AUDIT.md) (A)
- [REQUIREMENTS_GAP_ANALYSIS.md](REQUIREMENTS_GAP_ANALYSIS.md) (B)
- [MATHEMATICS_AND_CFD_CORRECTNESS_AUDIT.md](MATHEMATICS_AND_CFD_CORRECTNESS_AUDIT.md) (B)

**Evidence rules.**
- Code is evidence of implementation, not of correctness.
- Documentation is evidence of intent.
- Solver output is not a validated prediction.

Every entry below states whether the coordinator re-verified it.

---

## 1. Coordinator verification log

All scripts are in `/tmp/claude-1000/-home-tanvir-Coding-AirFLOW/76bf9998-d405-4391-a3a5-0698b59e1664/scratchpad/opus/`. They are throwaway files outside the repository. Every number below is real output.

### V-1: VLM induced drag (`vlm_drag_check.mjs`)

The script is independent of B's scripts. It compares four quantities on a rectangular wing at α = 4°, with the wake set to 2000 c:
- the repository's `cdi`;
- the raw signed force along the freestream;
- the near-field drag with the panel's own trailing legs included;
- an independent Trefftz-plane drag computed from the same circulation.

| AR | N (cosine) | CL | repo `cdi` | raw signed | near-field incl. self legs | Trefftz | CL²/(πAR) |
|---|---|---|---|---|---|---|---|
| 8 | 24 | 0.3281 | 3.855e-2 | **−3.855e-2** | 4.414e-3 | 4.414e-3 | 4.283e-3 |
| 8 | 40 | 0.3269 | 6.641e-2 | **−6.641e-2** | 5.769e-3 | 5.769e-3 | 4.251e-3 |
| 4 | 40 | 0.2640 | 8.580e-2 | **−8.580e-2** | 2.600e-2 | 2.600e-2 | 5.547e-3 |
| 12 | 40 | 0.3555 | 5.266e-2 | **−5.266e-2** | 3.875e-3 | 3.875e-3 | 3.352e-3 |

Conclusions:
- B-VLM-01 is confirmed. The raw drag is a thrust that grows with N. `Math.abs` hides the sign.
- When the self legs are included, near-field drag equals the Trefftz-plane drag to four digits.
- **New finding (refines B-VLM-02).** Even after the fix, cosine spacing with one chordwise row gives non-physical span efficiency at N = 40: e = 0.74 for AR 8 and e = 0.21 for AR 4. Fixing B-VLM-01 alone is therefore insufficient. The spacing defect must be fixed, and a convergence-in-N test is required.

### V-2: Exact-weld topology of the demo STL (`topo_exact.mjs`)

| Metric | Value |
|---|---|
| Triangles | 197,772 |
| Exact vertices | 98,895 |
| Degenerate triangles | **0** |
| Edge-use histogram | `{1: 28, 2: 296,634, 4: 5}` |
| Edge-connected components | 1 |
| Inconsistently oriented 2-use edges | 0 |

A's figures are correct. The app's reported values (8 boundary edges, 85 non-manifold edges, 80 degenerate triangles) are artefacts of its 1e-5 m bucket weld (A-GEO-01). B's audits quote the app's figures as the mesh's topology; that is corrected here. The mesh is still **not watertight** (28 open edges) and **not 2-manifold** (5 four-use edges), so B's conclusions about CSG and snappy input validity stand.

### V-3: Literal requirement flood rule (`select_planform_check.mjs`)

The rule tested is BFS over adjacent faces with dihedral ≤ 30°, no seed cone and no cap. From wing-upper, H-tail and V-tail seeds it selects **123,273 triangles (62.3%)** in every case. From the fuselage-crown seed it selects 1 triangle. This confirms A-SEL-03: the requirement's rule cannot isolate components on a smooth CAD-exported mesh.

### V-4: Planform extraction (`select_planform_check.mjs`)

The selection is all triangles with centroid y ≥ 8 m: 8,207 triangles, outboard wing, both skins.

| Method | Area |
|---|---|
| Repo vertex-binned envelope | **8.30 m²** (span 10.01 m) |
| 400-station plane slicing | **22.66 m²** |

The repo result is −63% and still returns `valid: true`, even though `warnings` is non-empty. This confirms B-REC-01 and A-SEL-11/B-REC-02. B measured −69% on a slightly different selection.

### V-5: Code reading confirmations

| Claim | Location | Confirmation |
|---|---|---|
| Fingerprint is triangle count only | `src/projectState.js:37` | Confirmed |
| Non-demo project restore skips the unit/axis remap | `src/app.js:806-832` | Confirmed. Only `loadStlBuffer` (`:209`) applies `project.source` mapping. |
| `valid` is vacuous | `src/recognition.js:196` | Confirmed |
| α ≡ θ in the pitch model | `src/stability.js:47-61` | Confirmed: d(α−θ)/dt = −1.25(α−θ) with α(0) = θ(0) |
| Default VLM run is wing-alone | `src/app.js:321-323` | Confirmed: H-tail added only if assigned. The documented "SM −28.2 %, Unstable" is a wing-alone result. |
| Sweep input applied at the leading edge | `src/vlmSolver.js:273` | Confirmed |
| WebGL failure aborts the whole app | `src/app.js:88-98` | Observed in the built-in browser, which has no WebGL: "Startup failed. Error creating WebGL context."; no analysis possible. |
| `reference/xflr5` is an orphan gitlink | `git ls-tree HEAD reference/` | Confirmed: mode 160000, commit `dc0c97f`, no `.gitmodules`, empty directory |

### V-6: External facts the plan depends on

These were checked by web search on 2026-10-23. Snippet-level checks are labelled as such.

| Fact | Status | Source |
|---|---|---|
| Manifold `MeshGL` keeps per-triangle provenance (`runOriginalID`, `faceID`) through Booleans | Official docs, search-level | manifoldcad.org MeshGL docs |
| OpenFOAM `surfaceBooleanFeatures` generates feature edges for the intersection of two surfaces | Debian manpages, OpenFOAM v1912 docs | — |
| ESI OpenFOAM `freestreamVelocity`/`freestreamPressure` exist since v1806; the NACA 0012 verification guide rotates `U` with α on far-field patches | doc.openfoam.com, search-level | — |
| three-mesh-bvh has an `indirect` option | Changelog | **`faceIndex` semantics under it are undocumented**; must be tested (spike S-2) |

### V-7: Not verified

- No rendered pixels: the WebGL viewport, orbit and highlight are unverified visually.
- No CFD tooling is installed. No OpenFOAM, Gmsh, Docker or Podman.
- Host: Ubuntu 26.04, 16 cores, 14 GB RAM.
- The YouTube reference in the requirements was not accessed.
- The arXiv CSG benchmark (2607.15905) cited in B's audit is from a search summary only. **Do not quote its figures.**

---

## 2. Root causes

These root causes sit behind multiple symptoms.

| ID | Root cause | Symptoms (register IDs) |
|---|---|---|
| RC-1 | **No identity or provenance model.** Geometry identity is the array index plus a triangle count. Nothing names surfaces, patches, or where a triangle came from. | DR-07, DR-08, DR-09, DR-13, DR-14, DR-15, DR-45 |
| RC-2 | **No canonical topology.** Two ad-hoc welds use absolute-tolerance bucket hashing (`geometry.js`, `recognition.js`), and degenerate edges are counted. | DR-12, DR-30, DR-11 (partly) |
| RC-3 | **Derived quantities lack validity gates and provenance.** Every number is displayed whether or not its inputs are plausible or complete. | DR-04, DR-06, DR-23, DR-26, DR-27, DR-34, DR-43 |
| RC-4 | **Methods were never checked against independent references.** Tests assert self-consistency and trends (16% tolerance, CDi/CL² spread) that cannot detect sign, magnitude or convergence errors. | DR-01, DR-02, DR-03, DR-05, DR-21, DR-35 |
| RC-5 | **Monolithic imperative UI.** State is split across the DOM and a global object, with no store, no lifecycle and no workspaces. | DR-23, DR-24, DR-25, DR-28, DR-31, DR-45, DR-46 |
| RC-6 | **The specification layer is contradictory and under-specified.** It is unclear whether the product is VLM or CFD. Frames, L_ref, BC vocabulary and STL format are undefined, and no acceptance criteria exist. | DR-16, DR-17, DR-18, DR-19, DR-32, DR-33, DR-44 |

---

## 3. Register

Field key:
- **Req/claim:** the requirement or claim. **Ev:** source and evidence. **Exp/Obs:** expected versus observed.
- **RC:** root cause. **Cons:** consequence. **Sev/Dep:** severity and dependency.
- **Fix:** proposed correction. **Test:** verification or acceptance test.
- Severity uses Critical, High, Medium, Low. "Opus-verified" means re-checked by the coordinator.

### Critical and High

**DR-01 — VLM induced drag has the wrong sign and magnitude** (B-VLM-01). Opus-verified (V-1).
- **Req/claim:** CALCULATION_PIPELINE §11 and the "CDi" output.
- **Ev:** `src/vlmSolver.js:124` skips the whole self-horseshoe; `:147` applies `Math.abs`.
- **Exp/Obs:** Expected CDi > 0, close to the Trefftz value. Observed −3.9e-2 at N = 24 against +4.4e-3, and the error grows with N.
- **RC:** RC-4. **Cons:** Every CD, L/D and drag curve is wrong by 9-16×. Drag also leaks into Cm through the vertical offset (B-VLM-10).
- **Sev/Dep:** Critical; none.
- **Fix:** Evaluate the induced velocity with `inducedVelocityHorseshoe(..., includeBound = (j !== i))`. Report the signed value. Add the general transverse-plane Trefftz drag (all legs of all surfaces; DATA_CONTRACTS §2.7) as the primary CDi, without `Math.abs`.
- **Test:** VLM-V2 and VLM-V2b in the [test matrix](../plans/VALIDATION_AND_TEST_MATRIX.md).

**DR-02 — Cosine spanwise spacing with one chordwise row is unstable at the tips** (B-VLM-02). Opus-verified (V-1).
- **Ev:** `src/vlmSolver.js:30-32`; the UI allows up to 80 panels (`index.html:121`).
- **Exp/Obs:** Expected e ≈ 0.95-1.0 for a rectangular wing. Observed e = 0.21 at AR 4, N = 40, and a Γ_tip/Γ_mid ratio of 18.7 at N = 100 (B).
- **RC:** RC-4. **Cons:** Even corrected drag and the spanwise loading are untrustworthy at user-selectable N, while the diagnostics badge stays green (B-VLM-04).
- **Sev/Dep:** High; fix together with DR-01.
- **Fix (v1.0, DEC-17):** Multi-row lattice (M ≥ 4, uniform) with a single guard (panel width/length ≥ 0.25), a freestream-aligned wake ≥ 10 b, and an R1/R2 resolution check. Single-row VLM has no convergence plateau (review record §4).
- **Test:** VLM-V3.

**DR-03 — Planform extraction fails on real tessellations** (B-REC-01). Opus-verified (V-4).
- **Ev:** `src/recognition.js:140-172` bins by vertex.
- **Exp/Obs:** Expected S within 2% of the slice value. Observed −63%.
- **RC:** RC-4. **Cons:** Recognised S, MAC and span feed the VLM and the coefficients, so every recognised-wing result is wrong.
- **Sev/Dep:** High; none.
- **Fix:** Use triangle–plane slicing per span station. Use chordline extraction from the slice polyline, robust to vertex distribution.
- **Test:** REC-V1, REC-V2.

**DR-04 — Recognition validity gate is vacuous** (A-SEL-11, B-REC-02). Opus-verified (V-4, V-5).
- **Ev:** `src/recognition.js:196`.
- **Exp/Obs:** Implausible geometry should be rejected. A MAC of 21.7 m on a 37 m aircraft was shown as "Recognized wing".
- **RC:** RC-3. **Cons:** The stability verdict is computed from arbitrary selections.
- **Sev/Dep:** High; DR-03.
- **Fix:** `valid = errors.length === 0`. Add plausibility rules: symmetric span coverage, span ≤ bounds, chord < length, coverage ratio, triangle count. Separate errors from warnings.
- **Test:** REC-V3 (negative tests).

**DR-05 — The pitch-response plot is not a physical model** (B-STAB-01). Opus-verified (V-5).
- **Ev:** `src/stability.js:38-75`.
- **Exp/Obs:** Expected short-period dynamics. Observed a 1-DOF gimballed pendulum with ad-hoc damping; α ≡ θ; an unstable case grows to 1424°.
- **RC:** RC-4. **Cons:** Misleading dynamic-stability impression.
- **Sev/Dep:** High; none.
- **Fix:** M0: hide the plot and label it non-physical. M8: a 2-DOF short-period approximation with an explicit Cm_q and CL_α source.
- **Test:** STAB-V1.

**DR-06 — Stability verdict from an incomplete configuration** (B-STAB-03 plus Opus). Opus-verified (V-5).
- **Ev:** `src/app.js:321-323` (wing-alone unless an H-tail is assigned); `app.js:756` prints "Stable/Unstable".
- **Exp/Obs:** Expected the verdict to require a tail, or an explicit "wing-alone" label. Observed the demo shows "Unstable, SM −28%". CALCULATION_PIPELINE §16 caveats it but does not name the missing tail.
- **RC:** RC-3. **Cons:** A false engineering conclusion.
- **Sev/Dep:** High; none.
- **Fix:** Block the verdict when no horizontal stabiliser is present, or label it "wing-alone (not an aircraft stability result)".
- **Test:** STAB-V2 (negative).

**DR-07 — Count-only mesh fingerprint** (A-SEL-01). Opus-verified (code).
- **Ev:** `src/projectState.js:37`.
- **Exp/Obs:** Expected a different mesh to be rejected. A project for another aircraft was accepted and 2,047 labels were applied (A, harness).
- **RC:** RC-1. **Cons:** Silent label corruption.
- **Sev/Dep:** High; M1 identity core.
- **Fix:** SHA-256 content hash of canonical positions and triangle order, plus a v1→v2 migration.
- **Test:** ID-T3.

**DR-08 — Project restore ignores units and axes for non-demo STLs** (A-SEL-02). Opus-verified (code).
- **Ev:** `src/app.js:806-832`.
- **Exp/Obs:** Expected the project's mapping to be applied. Observed a span of 0.017 m and CL(0) = 18.5 with no warning.
- **RC:** RC-1 and RC-5. **Cons:** Silent nonsense results.
- **Sev/Dep:** High; none.
- **Fix:** `restoreProjectState` applies `source.unitScale` and `axisMapping`, then remaps.
- **Test:** ID-T4.

**DR-09 — No surface, patch or boundary-condition model and no patch export** (A-SEL-07). Verified by grep (A, B).
- **Ev:** `COMPONENT_TYPES` has 4 enum labels. `serializeBinarySTL` writes one solid and is used only by tests.
- **Exp/Obs:** Expected named surfaces, BC tags and a JSON manifest (R-3.2-d, R-5.2-*). Observed none.
- **RC:** RC-1. **Cons:** The CFD requirements cannot start.
- **Sev/Dep:** High; M1 → M3.
- **Fix:** SurfaceRegistry, BoundaryAssignment and CaseManifest, per [DATA_CONTRACTS_AND_PIPELINE.md](../architecture/DATA_CONTRACTS_AND_PIPELINE.md).
- **Test:** BC-T1..T5.

**DR-10 — CFD pipeline absent** (B-CFD-01). Verified (`which`, `server.mjs`).
- **Exp/Obs:** Expected a backend, meshing and a solver (R-7.*). Observed a static file server only.
- **RC:** RC-6. **Cons:** No CFD number can exist. Any value labelled CFD today would be fabricated.
- **Sev/Dep:** Critical for the target; M4.
- **Fix:** Python case runner plus a pinned OpenFOAM.
- **Test:** CFD-T1..T6.

**DR-11 — The requirement's flood-fill rule cannot isolate components on imported meshes** (A-SEL-03). Opus-verified (V-3).
- **Req/claim:** R-3.1-d/e.
- **Exp/Obs:** Expected a component-sized region. Observed 62.3% of the aircraft from any wing or tail seed.
- **RC:** RC-6 (the specification). **Cons:** The literal implementation is useless on the demo.
- **Sev/Dep:** High; M1.
- **Fix:** Flood with an adjacent-dihedral limit (30° default) **and** a seed-normal cone, with barriers at existing surface boundaries and feature edges. Add split-by-plane and box tools. Parametric geometry gets surfaces by construction.
- **Test:** SEL-T3, SEL-T4.

**DR-12 — Topology metrics are weld artefacts, pinned by a test** (A-GEO-01). Opus-verified (V-2).
- **Ev:** `src/geometry.js:148-185`; `tests/demoRegression.test.mjs:18-19`.
- **Exp/Obs:** Expected 28 boundary edges, 5 non-manifold, 0 degenerate. Observed 8 / 85 / 80.
- **RC:** RC-2. **Cons:** Wrong watertightness reporting; the test enshrines the bug.
- **Sev/Dep:** High; M0/M1.
- **Fix:** A canonical exact (or relative-tolerance) weld into an indexed mesh, excluding degenerates from the edge map. Update the regression expectations.
- **Test:** TOPO-T1, TOPO-T2.

**DR-13 — Adopting three-mesh-bvh breaks `faceIndex == triangle id`** (A-LIB-02, B-CFD-15).
- **Ev:** The README states that an index is created and kept unless the `indirect` option is set. Opus confirmed the option exists; its `faceIndex` semantics are unverified.
- **Exp/Obs:** Expected stable ids. The hazard is that labels silently map to the wrong triangles.
- **RC:** RC-1. **Cons:** Silent corruption if BVH is adopted naively.
- **Sev/Dep:** High (conditional); M1.
- **Fix:** Never use `faceIndex` as identity. Map it through a `triangleId` lookup derived from the index buffer. Spike S-2.
- **Test:** SEL-T1 (1,000 random rays).

**DR-14 — three-bvh-csg is unsuitable for the watertight-export path** (A-LIB-03, B-CFD-05).
- **Ev:**
  - 0.0.18 requires three ≥ r179; the repo vendors r160 (npm registry, A).
  - The README requires 2-manifold input and warns the output may not be manifold.
  - Identity is kept only per brush material.
  - The demo STL is not 2-manifold (V-2).
- **RC:** RC-1 and RC-6. **Cons:** The requirement R-5.3-a/b, as written, cannot deliver a reliable watertight shell with patch identity.
- **Sev/Dep:** High; M2/M3.
- **Fix:**
  - CFD does not need a union: export closed per-component surfaces; snappyHexMesh handles intersecting closed surfaces, with `surfaceBooleanFeatures` for the junctions.
  - Where a union is needed, use Manifold (provenance-preserving), after spike S-3.
- **Test:** GEO-T5, MESH-T2.

**DR-15 — Binary STL cannot carry patch names** (B-CFD-04, D-13). Verified against OpenFOAM docs (B).
- **Req/claim:** R-5.3-d.
- **RC:** RC-6. **Cons:** Per-patch boundary conditions and per-component forces are impossible from a single binary STL.
- **Sev/Dep:** High; M3.
- **Fix:** One file per patch (binary allowed, with the name carried by file and manifest) or a multi-solid ASCII STL.
- **Test:** EXP-T2.

**DR-16 — The boundary-condition vocabulary cannot express an α sweep, and SYMMETRY is geometric** (B-CFD-03, D-14).
- **Req/claim:** R-5.2-b..e.
- **RC:** RC-6. **Cons:** A fixed box with only inlet/outlet blocks crossflow, so every α needs a re-mesh.
- **Sev/Dep:** High; M3.
- **Fix:** Add `FARFIELD` (freestream type) as the default for all outer faces, plus `SLIP_WALL`. Allow `SYMMETRY` only on the planar y = 0 domain face.
- **Test:** BC-T3, BC-T4.

**DR-17 — Domain sizing is under-specified** (B-CFD-02).
- **Req/claim:** R-5.1-a..d.
- **Exp/Obs:** L_ref is undefined and there are no lateral or vertical extents. If L_ref were the MAC, the domain would extend only 0.37 spans upstream.
- **RC:** RC-6. **Cons:** Unquantified boundary error.
- **Sev/Dep:** High; M3/M6.
- **Fix:** L_ref = max(span, fuselage length). Defaults: upstream 5 L_ref, downstream 10 L_ref, lateral/vertical 5 L_ref. The requirement's 3/6 L_ref is a hard minimum. A domain-size study is a gate.
- **Test:** DOM-T1, VAL-D1.

**DR-18 — C_L,max from steady RANS is unreliable** (B-CFD-09).
- **Req/claim:** R-6-d, R-9-d.
- **RC:** RC-6. **Cons:** A false C_L,max would be presented as a result.
- **Sev/Dep:** High; M8.
- **Fix:** Label it "RANS stall-onset estimate (unvalidated)". Use up- and down-sweeps, loss-of-convergence detection and a confidence flag. URANS is research tier.
- **Test:** CLMAX-T1..T3.

**DR-19 — Incompressible solver at M > 0.3** (B-CFD-09).
- **RC:** RC-6. **Cons:** Running the A320 at cruise (M 0.78) with simpleFoam is invalid.
- **Sev/Dep:** High; M3.
- **Fix:** Hard gate: Mach > 0.3 is rejected, with an explanation. A compressible solver is research tier.
- **Test:** BC-T6 (negative).

### Medium

| ID | Finding (source IDs) | Evidence | Root cause | Fix | Test |
|---|---|---|---|---|---|
| DR-20 | Reynolds number and viscosity are never computed (B-CFD-11) | grep, `src/` | RC-6 | ISA/user ν; compute and display Re and Mach; warn below Re 5e5 (transition) | ATM-T1 |
| DR-21 | Sweep input labelled quarter-chord but applied at the leading edge (B-VLM-03) | `vlmSolver.js:273`; `index.html` label | RC-4 | Convert for a linear taper: tan Λ_LE = tan Λ_c/4 + (c_r − c_t)/(2b), with b the full span | VLM-V6 |
| DR-22 | Default axis mapping is improper (det −1), so normals invert (B-MASS-03) | `axisMapping.js` default X→x, Z→y, Y→z | RC-1 | Record det; flip winding when det < 0 so outward normals are kept | ID-T5 |
| DR-23 | Plots are not cleared after invalidation (A-FLOW-01) | `app.js:770, 898-907` | RC-3/5 | Results carry an input hash; stale results are greyed out or blocked | UI-T2 |
| DR-24 | WebGL failure aborts the whole app (A-LIFE-02; observed by Opus) | `app.js:88-98` | RC-5 | Decouple analysis bootstrap from viewer init; show a degraded mode | UI-T1 |
| DR-25 | Heavy synchronous work on the main thread; progress never painted (A-LIFE-07, A-UI-05) | VLM 2.9 s at 160 × 161; first pick 942 ms | RC-5 | Precompute adjacency on load; Web Worker for VLM and topology | PERF-T1 |
| DR-26 | α window not containing ±5° gives CL_α = 0, SM = NaN and "Unstable" (A-FLOW-05) | `vlmSolver.js:204-224` | RC-3 | Require ≥ 3 points in the linear window, otherwise "insufficient data" | VLM-V7 |
| DR-27 | NaN coordinates propagate silently (A-FLOW-06) | STL parse path | RC-3 | Reject non-finite vertices on import, with the triangle id | ID-T6 |
| DR-28 | Selection interaction differs from the requirement: no Ctrl+Shift, default 18°, colour #FFC714 (A-SEL-12) | `app.js:476, 489-523` | RC-6 | Implement R-3.1-c..f as specified (with DR-11 changes) | SEL-T2 |
| DR-29 | Ctrl+click toggles each triangle (XOR), so the selection shrinks (A-SEL-04) | `app.js:514-518` | RC-5 | Explicit add / remove / replace modes | SEL-T5 |
| DR-30 | Absolute 1e-5 m bucket weld; misses across bucket boundaries; collapses at mm scale (A-SEL-05/06) | `recognition.js:32-56` | RC-2 | Canonical weld (exact, then optional relative tolerance with neighbour-cell check) | TOPO-T3 |
| DR-31 | No pan, no zoom-to-cursor, no focus-on-selection (A-SEL-10) | `app.js:413-450` | RC-5 | Pan, zoom-to-cursor, fit-to-selection | UI-T4 (manual) |
| DR-32 | Document authority conflict: VLM vs CFD; Qwen describes a foreign, truncated codebase (D-01, D-02, D-16) | REQUIREMENTS_GAP_ANALYSIS §1-2 | RC-6 | Authority map in [START_HERE](../START_HERE.md); owner question Q-1 | — |
| DR-33 | plan.md maths errors: CL = πARα; XZ projection; CL_slope > 5 (B-DOC-01/02/04) | plan.md L455, L244, L608 | RC-6 | Mark plan.md historical; do not implement from it | — |
| DR-34 | "CD total" includes a typed CD0 = 0.025 under the title "VLM coefficients" (B-GRAPH-01, D-08) | `app.js:775-781`, `vlmSolver.js:191` | RC-3 | Relabel "CDi (VLM) + assumed CD0"; record provenance per series | UI-T3 |
| DR-35 | Absolute 1e-10 epsilon breaks scale invariance: CL 0.33 becomes 26.3 at 1 mm chord (B-VLM-08) | `vlmSolver.js:2, 71` | RC-4 | Relative cutoff (core radius ∝ panel span) | VLM-V5 |
| DR-36 | Seed wing height = `bounds.center.z`; A320-tuned magic numbers (B-VLM-10, B-REC-04) | `app.js:365`, `stability.js:77-88` | RC-3 | Seed labelled as a placeholder; use the CG or the recognised z | VLM-V8 |
| DR-43 | Moment reference point not reported with Cm (D-09) | CSV, UI | RC-3 | Every Cm carries `momentReference` and its source | UI-T3 |
| DR-44 | Frame and sign conventions differ across documents (D-03) | Qwen L137 vs code | RC-6 | Single frame contract (see DATA_CONTRACTS §1) | FRAME-T1 |
| DR-45 | Autosave restores silently (demo only, single slot); an equal-count re-import keeps stale labels (A-FLOW-03/04) | `app.js:88-98, 205-213` | RC-1/5 | Hash-matched restore with prompt; clear on mismatch | ID-T3 |
| DR-46 | Manual reference edits overwritten silently on remap or clear (A-FLOW-02) | `app.js` remap path | RC-5 | User overrides stored separately and shown as overridden | UI-T5 |

### Low

| ID | Finding | Fix |
|---|---|---|
| DR-37 | A malformed `%` URL crashes `server.mjs` (A-SRV-01, `server.mjs:21`) | try/catch around `decodeURIComponent` → 400 |
| DR-38 | `recognition.js` loaded twice (`?v=` mismatch) (A-ARCH-03) | Remove query-string cache busting, or use one import map |
| DR-39 | `computeStaticStability` is dead code validated by a test (A-ARCH-05, B-STAB-02) | Delete it, or wire it and retarget the test |
| DR-40 | `reference/xflr5` orphan gitlink; no XFLR5/AVL fixtures exist | Remove the gitlink, or add `.gitmodules`; benchmark data goes in `validation/` |
| DR-41 | `app.js`, `graphs.js` and `server.mjs` are untested; the 91% coverage figure excludes them (A test audit) | Extract logic into testable modules (M0/M1) |
| DR-42 | Requirement says "n < 2 is chined"; only n ≤ 1 gives corners (B-CFD-07). NACA trailing-edge closure and lofting order are unspecified (B-CFD-06) | Specified in the plan (M2) |

---

## 4. Contradictions among documents, code and goals

The full list is D-01..D-17 in [REQUIREMENTS_GAP_ANALYSIS.md](REQUIREMENTS_GAP_ANALYSIS.md) §2. The coordinator's resolution for each:

| Contradiction | Resolution |
|---|---|
| D-01 Scope: CFD (requirements) vs VLM (all other documents and the code) | Target = CFD platform (requirements, 2026-07-31; reaffirmed by this audit's brief). The VLM is retained as **Tier-0 preliminary aerodynamics and a linear-range cross-check**. Pending owner confirmation Q-1. M0-M2 work is valid under either answer. |
| D-02 Stack: React (Qwen "built", requirements "later"), C++/Qt (plan) vs vanilla (repo) | Framework-agnostic core and store. The UI framework is decided at **M1b entry**: the default is Preact + htm, vendored, no build ([MASTER plan](../plans/MASTER_REVISED_PROJECT_PLAN.md) DEC-10, revised per RA-15). |
| D-03 Frames and Cm sign | Repository frame retained: x downstream (aft), y starboard, z up, right-handed, SI, Cm positive nose-up about +y. Matches OpenFOAM forceCoeffs usage with `pitchAxis (0 1 0)`, subject to sign test CFD-T5. |
| D-04 Sweep reference | Λ is defined at c/4 in all inputs; the generator converts it (DR-21). |
| D-06 Selection interaction | Requirements govern, modified by DR-11. |
| D-07 Benchmark gates | Replaced by the numeric gates in [VALIDATION_AND_TEST_MATRIX.md](../plans/VALIDATION_AND_TEST_MATRIX.md). |
| D-13 / D-14 Binary STL; 4 BC tags | Modified (DR-15, DR-16). |
| D-16 Qwen release provenance | Unverified claim; Qwen is reference-only. |

---

## 5. Which existing plans remain valid

| Document | Disposition | Reason |
|---|---|---|
| `refs/CFD_Aircraft_Design_and_Simulation_Requirements.md` | **Governing target, as modified** by the disposition table in the [MASTER plan](../plans/MASTER_REVISED_PROJECT_PLAN.md) §3 | Newest stakeholder intent; its priority order (identification → tags → domain → generators → solver → UI) is largely kept |
| `MVP_METHODOLOGY.md` | **Valid as a description of current code**; its planform-envelope claim (L43-47) is superseded by DR-03 | Accurate scope and limitation statements |
| `CALCULATION_PIPELINE.md` | **Valid as a description of current code**; §6.1 (envelope), §11 (induced-drag velocity), §15 (pitch model) and §16 (demo interpretation) are **superseded**. Must be updated in the same change that fixes the code (M0) | Faithfully specifies the defects |
| `plan.md` | **Historical** (FS-xx numbering kept for traceability only) | C++/Qt plan; contains maths errors (DR-33) |
| `refs/Qwen_markdown_20260918_2za7s34sd.md` | **Reference-only, unverified, truncated** | Describes a codebase that does not exist here |

---

## 6. Overlooked work worth recovering (do not rewrite)

| Asset | Location | Why keep it |
|---|---|---|
| Mass, volume and inertia (signed tetrahedra, parallel axis) | `src/geometry.js:54-120, 206-260`, `src/massModel.js` | Verified to 5 digits against an analytic cylinder; translation-invariant (B) |
| Biot–Savart finite-segment kernel, horseshoe geometry, pivoted solver | `src/vlmSolver.js:63-83, 229-268` | Verified correct (B) |
| `includeBound` parameter | `src/vlmSolver.js:76` | Makes the DR-01 fix a one-line change |
| STL parser (binary/ASCII detection, robust) | `src/stlParser.js` | Correct; extend to read `solid` names |
| `serializeBinarySTL` | `src/stlParser.js:64` | Basis for per-patch export |
| Axis-mapping validation (each axis used once) | `src/axisMapping.js` | Correct contract; add determinant handling |
| Region growth with seed cone, local limit and cap | `src/recognition.js:62-95` | Better than the requirement's literal rule (DR-11); extend with barriers |
| RLE assignment persistence and versioned snapshot schema | `src/projectState.js` | Keep the format idea; change the fingerprint |
| Non-indexed render geometry with per-triangle colours | `src/app.js:452-487` | No colour bleed (A verified: 0 mixed-colour triangles); keep for highlight |
| Honest limitation labelling culture | MVP_METHODOLOGY §Validity, CALCULATION_PIPELINE §17 | Preserve in every new output |

---

## 7. Framework feasibility verdict

| Capability | Current stack (vanilla ES modules, three r160, Node static server) | Required change |
|---|---|---|
| Parametric NACA, fuselage and tail generation; real-time preview | **Feasible** in the browser | New `src/geometry/*` modules |
| Triangle picking at 2e5 triangles | **Feasible now**: brute force 6.5 ms per ray (Node), 19-32 ms per full pick (browser) | BVH only for hover, box or > 5e5 triangles; identity-safe (DR-13) |
| Surface identity, tagging, persistence | Feasible | New core modules + store (RC-1) |
| Watertight union with provenance | Not with three-bvh-csg at r160 (DR-14) | Not needed for CFD (per-component export). Manifold WASM if a union is required (spike S-3) |
| Domain definition and preview; case manifest | Feasible | New modules |
| Meshing, solving | **Impossible in browser** | Python case runner + pinned OpenFOAM (not installed; 14 GB RAM bounds ~5-8 M cells, an engineering estimate) |
| Surface Cp/Cf visualisation | Feasible for ≤ ~2 M surface triangles, from the measured 79 MiB for 2e5 | Server-side reduction to a binary surface format |
| Streamlines | Not in browser (volume field) | Server-side tracing; ship polylines |
| React/Tailwind/Zustand | Not present; not required for correctness | Decision at M1b entry; default Preact + htm, no build (DEC-10) |
