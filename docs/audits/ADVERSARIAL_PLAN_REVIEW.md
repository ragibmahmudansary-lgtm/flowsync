# Adversarial Review of the Revised Plan

Status: **Authoritative** record of the Phase-5 review and its dispositions (2026-10-23).

**Process.** Two fresh Sonnet 5.5 reviewers attacked plan v0.9 independently:
- **Reviewer A** reviewed the software architecture, sequencing, interfaces, UI and tests.
- **Reviewer B** reviewed the science, mathematics, physical modelling, solver and validation.

The coordinator (Opus 5.5) resolved every objection as **ACCEPTED**, **PARTIALLY ACCEPTED**, **REJECTED** or **UNRESOLVED**, giving the evidence and reasoning. The plan documents were then revised to v1.0. Each disposition names the document change it caused.

**Raw reviews.** These are working files outside the repository:
- `/tmp/claude-1000/-home-tanvir-Coding-AirFLOW/76bf9998-d405-4391-a3a5-0698b59e1664/scratchpad/reviewA/REVIEW_A.md`
- `/tmp/claude-1000/-home-tanvir-Coding-AirFLOW/76bf9998-d405-4391-a3a5-0698b59e1664/scratchpad/reviewB/REVIEW_B.md`

The objections and evidence that matter are restated below, so this document stands alone.

**Evidence tags.**
- **[V]** verified by the reviewer by command, source or document.
- **[S]** suspicion or recall.
- **[C]** checked by the coordinator.

---

## 1. Reviewer A: software, sequencing, interfaces, tests

### Critical

**RA-01: The identity invariant is false for snappyHexMesh, and no patch-name mapping exists.** **ACCEPTED.**

Objection:
- [V] OpenFOAM `searchableSurfaces.C` names regions `<surface>_<solid>`.
- A single-region surface gets its bare name.
- A per-region `regions { <solid> { name X; } }` override exists.
- snappyHexMesh creates patches with exactly these names.
- So plan v0.9's "names survive unchanged" invariant, its "`name` or `component_region`" diagram label and the MESH-T3 "exact bijection" contradict one another. Buried caps (`root`, `te_base`) and half-model-excluded parts (`wing_l` at y < 0) produce zero-face patches. `forceGroups` were keyed by component, but `forceCoeffs` needs patch names.

Disposition: this is correct and would have surfaced only at M4b.

Changes made:
- DATA_CONTRACTS §4 now defines **`patchNameOf(body, surface) = surface`**.
- The case builder emits an explicit `regions { <solid> { name <surface>; } }` override for every region, so the patch name equals the surface name. CFD-T1 verifies this on the pinned version with a 2-region test case.
- **Expected-empty surfaces** (buried caps, out-of-domain parts) are computed by the exporter, listed in the manifest as `expectedEmpty`, and excluded from force groups.
- Half-model export clips: bodies entirely at y < 0 are omitted and recorded as such.
- `forceGroups` are now lists of **surfaces**. The builder resolves groups to patches.
- MESH-T3 now reads: "`boundary` patches == manifest surfaces − expectedEmpty + domain faces".

**RA-02: There is no browser ↔ backend transport.** **ACCEPTED.**

Objection:
- [V] No task covers upload, API, CORS or a zip reader.
- `server.mjs` is GET-only.
- E2E-T1 ("ResultBundle loads in the UI") and M7-3 (job monitor) cannot be satisfied.
- Zip-slip and name injection into OpenFOAM dictionaries are not addressed.

Disposition. New task **M4-9** puts the transport before E2E-T1:
- The Python backend serves the static app **and** `/api` from one local origin (127.0.0.1), so there is no CORS. `server.mjs` stays for frontend-only work.
- There is no zip on the critical path:
  - `POST /api/jobs` carries the manifest JSON;
  - `PUT /api/jobs/{id}/geometry/{name}.stl` uploads each body;
  - `GET` endpoints serve status, logs, `result.json` and field files.
- A zip bundle remains an optional offline export.
- Injection is closed in two layers:
  - all names match `^[A-Za-z][A-Za-z0-9_]*$`, and the backend re-validates them;
  - numeric fields are schema-typed numbers;
  - templates interpolate only validated values;
  - file paths are built from validated names only, never from client paths.
- Contract tests **API-T1..T3** were added.

### High

**RA-03: The G0 VLM gates cannot pass, and three documents gave three different guards.** **ACCEPTED.**

Objection [V], from the reviewer's single-row uniform-spacing runs:
- C_Lα vs lifting-line is −9.3 % at AR 4 (the gate allowed ≤ 7 %).
- The C_Lα spread over N = 16→64 is 2.4-2.9 % (the gate required < 1 %).
- The guard was stated as chord/width ≤ 20 in one document and width/chord ≥ 0.1 in another.
- Multi-row VLM (M1-11) appeared only in the handoff.

[C] The coordinator independently measured the same effect, plus divergence of single-row VLM at high N. At AR 4, N = 256, e = 0.61. See §4.

Changes made:
- **Multi-row VLM moves into M0b** (task M0-2).
- One guard constant: panel width/length ≥ 0.25.
- The gates are re-derived from coordinator measurements with a fixed panel aspect ratio of 1 (§4):
  - VLM-V1: AR ≥ 6, within 5 % of LLT;
  - VLM-V2: e ∈ [0.90, 1.02];
  - VLM-V3: C_Lα change ≤ 1 % and C_Di change ≤ 5 % between resolutions R1 and R2.

**RA-04: G4 depends on M5, and the riskiest meshing case gated everything.** **ACCEPTED.**

Objection: E2E-T1, CFD-T3 and CFD-T6 need the coefficient parser and the ResultBundle writer, both M5 tasks. M4-2 needs M3-5's schema. G4 required the wing-body-tail mesh (MESH-T2), but only M8 needs it.

Changes made:
- A **minimal coefficient parser and ResultBundle writer** (M4-6b) moved into M4b. M5 now adds cross-checks only.
- M4-2 uses a provisional schema copied from DATA_CONTRACTS §7.1; M3-5 makes it final. The schema has one source (`schemas/`) and is versioned.
- **G4 is wing-only.** MESH-T2 (wing-body-tail) is now a gate at M6 entry, required before M8-2.

**RA-05: M1 sat on the critical path of everything, and its prerequisites contradicted each other.** **ACCEPTED.**

Changes made:
- M1 is split:
  - **M1a (core contracts):** topology, hashing, surface model, spatial index, schemas. Pure, with no UI.
  - **M1b (interaction):** selection UX, store, viewport, shell, framework adoption.
- M2 core and M3 core depend on M1a only. M2-6 and M3-4 (UI) depend on M1b.
- The task graph was redrawn with the missing edges `M1b→M2-6`, `M1b→M3-4` and `M1a→M3-6`.

**RA-06: Generated-geometry overrides, identity and undo were undefined.** **ACCEPTED.**

Objection: generated `triangleId`s depend on tessellation parameters, so a resolution change renumbers them (the same failure class as DR-07). `sourceHash` is meaningless for generated sources. Slider drags would flood the undo journal.

Decisions:
1. **Generated geometry is never tagged per triangle.** Identity is the surface name, assigned by construction. Users may rename surfaces and assign BCs at surface level only. Triangle-level manual tagging applies to imported meshes only.
2. **Generated source identity** = SHA-256 of the canonical parameter JSON plus `generatorVersion`. This also answers RA-10.
3. **Undo** coalesces per gesture: one slider drag is one entry.
4. Tag transfer onto a re-exported imported STL (nearest-centroid) is **deferred** to M7 as optional.

DATA_CONTRACTS §4 and ARCH §4 were changed accordingly.

**RA-07: "Component" cannot be the closure unit for a closed fused shell.** **ACCEPTED.**

Objection: R6 required each *component* to be closed, but a watertight fused imported shell tagged into components yields open components.

Change: a new concept, **`body`**, is a closed shell and is the unit of closure and export. It carries one STL file with one solid per surface. **`component`** stays a semantic grouping used for force breakdown and the UI.
- Generated parts: one body per part.
- An imported fused shell: one body with many surfaces.

R6, DATA_CONTRACTS §4/§5/§7.1 and EXP-T1 were updated.

**RA-08: The test strategy cannot test the UI behaviour it claims.** **ACCEPTED.**

Objection: `app.js:41-52` queries the DOM at import time, so it cannot be imported in Node. UI-T2 at store level would pass on the buggy canvas code. Several gates are manual, but there is no harness and no named signer.

Decisions:
- Every UI rule that matters is a **pure view-model function** with unit tests: stale gating, colour mapping, label and provenance strings, plot point filtering. Canvases render only what the view model returns.
- A **manual QA checklist** (`docs/qa/MANUAL_CHECKLIST.md`, created in M1b) is signed by a named human on a WebGL-capable machine for each M-level UI gate.
- A browser automation harness (Playwright) is an explicit M7 decision. It is not assumed earlier.

### Medium-High and Medium

**RA-09: M0 duplicated M1, M0-9 needed hashing from M1-2, and G0 needlessly gated M4a.** **PARTIALLY ACCEPTED.**

Accepted:
- A minimal `src/core/hash.js` moves into M0-9.
- M0-10 is implemented directly as the M1a topology module (`src/core/topology.js`), so it is not throwaway.
- **M4a no longer waits for G0.** It starts as soon as the owner answers Q-4.
- M0 is split into **M0a (quarantine and app correctness)** and **M0b (VLM numerics)**.

Rejected: the reviewer's proposal to fold M0-6/7/11/12 into M1.
- M0-6/7 (planform slicing and plausibility) fix numbers the Tier-0 tool shows for imported meshes. M1 does not replace that path.
- M0-11/12 are cheap (canvas clearing; isolating viewer initialisation) and remove misleading output now.

**RA-10: `meshHash` of generated geometry is not reproducible across JS engines.** **ACCEPTED.**

Objection: `Math.cos` and `Math.pow` are implementation-approximated in ECMAScript.

Changes made:
- Generated sources are identified by the parameter hash (RA-06). `meshHash` applies only to imported meshes, whose parsed floats are deterministic.
- `crypto.subtle` is used in both Node 24 and the browser [V by reviewer].
- Snapshot save is async.

**RA-11: `caseHash` mixed provenance into physics identity.** **ACCEPTED.**

Change: three hashes.
- **`inputsHash`:** cheap, live staleness hash of store slices. No STL serialisation.
- **`physicsHash`:** SHA-256 over the canonical physics content of the manifest plus body file hashes, computed at export.
- **Provenance:** app version, git commit (recorded by the backend, which can read git), timestamps. Excluded from both hashes.

**RA-12: No shared spatial index, though six features need one.** **ACCEPTED.**

Change: `src/core/spatial.js` (uniform grid plus triangle AABB tree) added as M1a-4. Its consumers are the R2 symmetry check, intersection pairs, inside tests, `locationInMesh`, barriers and the self-intersection test.

**RA-13: Several tests cannot detect what they target.** **ACCEPTED.**

Changes made:
- GEO-T2 now includes self-intersection detection.
- New **EXP-T5 [OF]** runs OpenFOAM `surfaceCheck` on exporter output as soon as M4-1 is done.
- GEO-T4 now defines its measurement: per-station leading- and trailing-edge points from generated vertices, with a least-squares line.
- REC-V2's oracle must not import `recognition.js`.
- The handoff Trefftz oracle no longer uses `Math.abs`. It asserts the sign.

**RA-14: Rules and constants duplicated across JS and Python.** **PARTIALLY ACCEPTED.**

Accepted:
- **The backend is authoritative.** It re-runs every rule. Browser validation is UX feedback only.
- Shared **negative fixtures name the expected rule id**, and both sides must produce it (EXP-T4).
- The manifest carries target sizes and a preset, not refinement levels. The backend computes levels and provides a cell estimate through a dry-run endpoint. UI-T8 moves to M4b.

Rejected: removing browser validation. Immediate feedback during tagging is a core requirement (R-5.2-h).

**RA-15: The React deferral and the tab split work against the workflow.** **ACCEPTED (modified).**

Objection: deferring to M7 lets three state sources coexist and maximises rewrite cost. The tab split shows dead tabs and separates BC editing from selection.

Changes made:
- **DEC-10 revised:** the framework is decided at **M1b entry**.
  - Recommended default: **Preact + htm**, vendored ESM, no build step. Its API is React-compatible, so it satisfies "React or equivalent".
  - React + Vite + TS only if the owner wants build tooling.
- The core and store stay framework-agnostic.
- Workspaces become a **guided sequence** with status chips and a persistent "blocking issues" panel:
  1. Geometry (generate or import)
  2. Surfaces & Boundaries (aircraft BCs edited where surfaces are selected)
  3. Domain & Flow
  4. Run
  5. Results (with a Quick Aero VLM sub-view)

**RA-16: The naming contract had gaps.** **ACCEPTED.**

Changes made:
- Domain face names are reserved.
- Names are unique case-insensitively, across surfaces, bodies and components.
- Imported `solid` names are sanitised deterministically:
  - invalid characters become `_`;
  - a leading digit gets an `s_` prefix;
  - duplicates get `_2`, `_3`, …;
  - an empty name becomes `solid_<n>`.
- Length cap: 40 characters for surfaces, 24 for bodies. Because of the RA-01 `regions` override, patch name = surface name.
- New test SURF-T4.

**RA-17: The backend data path was unspecified, and the binary format had an alignment hole.** **ACCEPTED.**

Changes made:
- Data path: OpenFOAM function objects write the surface data (`wallShearStress`, plus `surfaces` / `surfaceFieldValue` in a raw or VTK-legacy ASCII format [pin]). Python parses it with numpy.
- **No meshio, vtk or pyvista dependency.** Dependencies are numpy, jsonschema and the standard library; the reviewer verified these import on the host Python 3.14.6.
- Streamlines use the OpenFOAM `streamlines` function object [pin].
- The binary format now pads the JSON header to an 8-byte boundary, and array offsets are relative to the data start and 8-byte aligned.

### Medium-Low, Low

| ID | Objection | Disposition | Change |
|---|---|---|---|
| RA-18 | Performance budgets were unanchored: no machine, no "default aircraft", no measurement method | **ACCEPTED** | Node budgets are anchored to the audit host (16 cores, Node 24). Browser budgets are recorded on a named machine in the QA checklist. "Default aircraft" = preset `uav-default` in `schemas/aircraft-params`. Long tasks are measured with the `PerformanceObserver('longtask')` API. The typed-array weld is recommended (reviewer [V]: 32 ms vs 224 ms for string keys). |
| RA-19 | r160 `addUpdateRange` issues one `bufferSubData` per range [V `three.module.js:13611-13630`] | **ACCEPTED** | Coalesce ids into runs. Above 64 ranges, fall back to a full upload. |
| RA-20 | Import maps do not apply inside workers; Node cannot resolve bare `three` | **ACCEPTED** | Rule: `src/core/**` has **zero bare-specifier imports**, so it runs unchanged in workers and Node. Only `src/view/**` imports `three`, via the import map. Workers are deferred to M7 (RA-22). |
| RA-21 | Documentation drift: the "85" count, the schema id, too many documents marked "authoritative", handoff divergence | **ACCEPTED** | The count is corrected (1 implemented, 28 partial, 55 missing, 1 contradicted). The project schema keeps the existing id `airflow.browser-project` at version 2. START_HERE now states precedence: DATA_CONTRACTS (normative) > MASTER > PHASED > TEST MATRIX > HANDOFF (derived; any conflict is a bug in the handoff). Golden STL fixtures are generated at test time, not committed. |
| RA-22 | Over-engineering: a 100-step parameter undo and a worker before CFD works | **ACCEPTED** | The worker and parameter undo are deferred to M7. Surface-operation undo stays in M1b. CSR adjacency, exact weld and per-body export are kept. |
| RA-23 | "M0-M2 are valid under either Q-1 answer" is false for M1 | **PARTIALLY ACCEPTED** | M0 is valid under either answer. M1a is mostly valid under both, because surfaces also serve VLM recognition. **Q-1 must be answered before M1b, M2 and M3.** |

**Reviewer A's "checked and sound" items** (not objections):
- `faceIndex → triangleId` for non-indexed geometry;
- `addUpdateRange` exists in r160;
- rejecting three-bvh-csg;
- the c/4 → leading-edge sweep conversion;
- the M0-1 code locations;
- Node 24 `crypto.subtle` and `CompressionStream`;
- a single-instance three import via an import map.

---

## 2. Reviewer B: science, mathematics, solver, validation

Reviewer B raised 24 objections: 6 High, 14 Medium, 4 Low, and none Critical.

Reviewer B also verified the following as **correct**, by derivation and by scripts against the repository kernel; they are now settled:
- the moment-transfer formula (exact to 1e-17);
- the NP and SM formulas (planar wing NP 0.2515 c);
- the wind axes and the sign of `pitchAxis (0 1 0)`;
- the half-model A_ref = S/2;
- kinematic C_p;
- the ISA, Sutherland, Re and Mach numbers in the manifest example;
- ω = k/ν_t;
- the y⁺ factor of 2;
- the c/4 → leading-edge sweep conversion (the measured c/4 sweep equals the input exactly);
- twist about c/4 keeping the c/4 line straight;
- the choice of Trefftz drag as primary, with near-field including the self legs;
- the NACA formulas;
- the superellipse area formula and its corner/curvature statements.

**Coordinator note on sideslip.** In v0.9 the reviewer accepted the wind-axis formula, but the coordinator's own derivation showed that its β sign does not follow the Etkin convention. DATA_CONTRACTS v1.0 corrects it to U∞ = V(cos α cos β, **−sin β**, sin α cos β). This is a coordinator self-correction, not a reviewer finding.

### High

**RB-01: The Tier-0 stability verdict and the claim "Correct Tier-0 VLM" are overclaimed.** **ACCEPTED.**
- The VLM is a flat plate (no camber or twist) without a fuselage, which is destabilising and is estimated, from knowledge, to shift the NP forward by 0.03-0.15 c̄.
- The default CG comes from a uniform-density lump.
- With an H-tail assigned, the v0.9 rules could still print "Stable".

Changes:
- New verdict rule 2: the verdict is withheld while `mass.source = assumedUniform`. The `assumed mass` flag from audit B-MASS-02 is restored.
- Rule 4: the verdict text names the model and states the sign of the omission ("fuselage omission over-estimates SM").
- The tier wording becomes "Tier-0 flat-plate inviscid estimates".
- New task **M2-9** adds camber slope and twist from the generated sections to the VLM normals.
- Files changed: DATA_CONTRACTS §2.5, §2.7; MASTER §5; PHASED M0-8 and M2-9.

**RB-02: The CFD static-stability tests are algebraic identities, and Tier 2 claimed an unvalidated quantity.** **ACCEPTED.**
- STAB-C1 and STAB-C2 hold by construction: they apply the transfer formula to the same forces.
- No wing-body-tail reference data were planned, and "an independent cross-check for every coefficient" was unsatisfiable.

Changes:
- **CFD static margin leaves Tier 2.** It re-enters only through **VAL-E2**: a published wing-body-tail dataset with C_m-α or an NP, selected and cited before any runs. Selecting it is unresolved item U-1.
- STAB-C1 and STAB-C2 are relabelled as post-processor verification ("cannot prove: any CFD accuracy").
- New **STAB-C3**: a tail plausibility check. Compare tail-on minus tail-off ΔC_mα, and dε/dα at the tail, against VLM and lifting-line estimates. The gate is ~20 % agreement, stated as plausibility only.
- The M5 stop condition is rewritten: "every coefficient has an *extraction* cross-check; physical cross-checks exist only where listed".
- Until VAL-E2 passes, CFD SM is labelled "unvalidated".

**RB-03: The Trefftz drag definition was wrong for more than one surface.** **ACCEPTED.**

Evidence [V by reviewer, script t6]:
- A general transverse-plane formula matches the long-wake near-field drag to 0.00 % for wing + tail at α = 5° and 10°.
- The y-only form is wrong by −10 to −13 %, or −32 to −39 % if implemented literally.
- The coordinator's oracle and the handoff snippet used `Math.abs`.

Changes:
- DATA_CONTRACTS §2.7 now specifies D = ½ρ Σ_i Γ_i **v**_T(**m**_i⊥)·(**l**_i × ê_w). **v**_T is induced by **all** trailing legs of **all** surfaces, projected onto the Trefftz plane. No `abs`; assert D > 0.
- New test **VLM-V2c**: wing + H-tail, with the tail above the wing, at α = 5° and 10°. Near-field (wake ≥ 10 b) and Trefftz must agree within 1 %.
- The handoff oracle is rewritten.

**RB-04: The VLM-V3 premise is false, its gates fail, and the guards were inconsistent.** **PARTIALLY ACCEPTED.**

Accepted:
- No N-convergence plateau exists for single-row VLM. The reviewer's AR 4 sequence of e diverges past N ≈ 100.
- e > 1 occurs at practical N.
- The three guards were inconsistent.

The coordinator independently measured the same behaviour (§4).

Changes adopted:
- One guard: panel width/length **≥ 0.25 is hard**. Above 8 is a warning only, because elliptic tip strips legitimately reach about 4.5 (coordinator, §4).
- **Elliptic-wing oracle VLM-V2d**: e ∈ [0.99, 1.07]. Coordinator multi-row values are 1.015-1.062.
- A Munk sanity bound e ≤ 1.07.
- Tier-0 results carry the stated uncertainty C_Lα ±5 %, C_Di ±8 %.

Not adopted: the reviewer's single-row "admissible width/chord window" as the main fix. The coordinator chose the **multi-row VLM** (RA-03), whose C_Lα *does* converge, changing ≤ 0.6 % between R1 and R2 (§4). VLM-V3 is therefore restated on multi-row R1 → R2: C_Lα ≤ 1 %, C_Di ≤ 5 %, both measured to pass. The reviewer's data concerned single-row, so the two positions are consistent.

**RB-05: The CFD-T2 NACA 0012 baseline mixed unrelated effects.** **ACCEPTED.**

The reviewer showed:
- the plan's own Prandtl-Glauert step was 56 % of the C_L gate;
- the L_ref rule gave about 5 chords of far field, against about 500 for the TMR;
- the generator section differed from the TMR section;
- snappyHexMesh cannot do a true 2-D mesh;
- α = 15° is not guaranteed to be steady.

Changes:
- A **2-D domain exception** (DATA_CONTRACTS §6.2): the TMR grid family, or an extruded mesh with ≥ 100 c and a point-vortex correction.
- **TMR coordinates** are used, not the generator.
- A snappyHexMesh slab is used for quantification only.
- **No Prandtl-Glauert assumption.** The compressibility step is *measured* by running a compressible solver at M = 0.15 and simpleFoam on the same mesh. The compressible solver is `rhoPimpleFoam` or `rhoSimpleFoam` [pin].
- The α = 15° gate applies only if the solution is steady.
- Turbulence inflow conforms to the TMR guidance (RB-12).
- CFD-T2 is rewritten.

**RB-06: Regime gates were only warnings, wall functions are invalid at UAV scale, and the validation mode differed from production.** **ACCEPTED.**

Changes:
- `regime: invalid` for Re_c̄ < 5e5 is attached to **every coefficient**.
- **Wall-function applicability gate** δ ≥ 10 h₁, which fails closed (DATA_CONTRACTS §2.3, R8).
- The production wall treatment is **not fixed until VAL-Y1**. Validated claims cover only the wall treatment that was validated.
- DEC-08 is revised. MASTER §5 states that if Q-2 = UAV, Tier 2 needs a validated transition model, which moves into committed scope.

### Medium

| ID | Objection (evidence) | Disposition | Change |
|---|---|---|---|
| RB-07 | VLM-V2b "≤ 1 % on planar wings" fails for swept planar wings: −2.5 % at 10° up to −12 % at 40°, not closing with N. The default 20 c wake gives −2 % at AR 12. [V, t5, t12, t1] | **ACCEPTED** | V2b is gated only for unswept planar wings with wake ≥ 10 b, and reported only for swept wings. The default VLM wake is 10 b, which restores B-VLM-07. |
| RB-08 | Mesh gates do not measure boundary-layer resolution or y⁺. 80 % layer coverage is too loose. The manifest example contradicted `maxCells`. | **ACCEPTED** | DATA_CONTRACTS §7.2 adds: y⁺ area fraction ≥ 90 % within the mode's band; layer coverage ≥ 90 % on lifting surfaces; a last-layer-to-core ratio; internal and boundary skewness separated; non-orthogonality 70 as a hard limit and 65 reported. The manifest example becomes a GA-like case consistent with the host budget. |
| RB-09 | The relative C_L window is undefined at C_L ≈ 0. "4 orders from max" is unattainable on continuation runs. | **ACCEPTED** | §7.3: an absolute plus relative window, a drift (slope) test, and absolute residual floors, with the order-drop rule for cold starts only. |
| RB-10 | The vertical-offset criterion used C_D; the dominant term is C_L (about 15× larger). The NP height was undefined. forceCoeffs does not output C_X/C_Z. [V, t7] | **ACCEPTED** | The NP is defined at z_CG. SM uses only CG-referenced C_m. The criterion is withdrawn. C_X and C_Z are defined from C_L and C_D. The quarter-MAC reference gets a z. |
| RB-11 | M ≤ 0.3 allows a 2.3-4.6 % lift bias with no flag. | **PARTIALLY ACCEPTED** | A Mach flag carrying the bias is attached per coefficient; C_L,max is restricted to M ≤ 0.2. **Rejected:** applying a Prandtl-Glauert factor to VLM output. The VLM and simpleFoam are both incompressible, so XVAL already compares like with like. A correction would add an unvalidated model step (compare RB-05). |
| RB-12 | Default turbulence inflow was 4e3-4e4× above the TMR SST bounds, and the stated I is not what reaches the body. [opened + V] | **ACCEPTED** | TMR-bounded defaults: ω∞ = 5V/L_dom, ν_t/ν = 1e-3. Inlet values and **probed** values ahead of the nose are reported (§2.2). |
| RB-13 | C_L,max policy: no α-step rule; the half model suppresses asymmetric stall; hysteresis was undefined. | **ACCEPTED** | Full model only; Δα ≤ 1° near the peak; a local quadratic fit; defined ascending and descending continuation; per-α comparison; "not determined" is the expected common outcome (§2.6, R2). |
| RB-14 | One mesh for all α conflicts with a fixed wake box. Tail-in-wake resolution was unspecified. | **ACCEPTED** | The wake refinement region spans every α in the sweep; sweeps wider than 10° are split (§6.3). M8-2 gains a tail-wake resolution probe (STAB-C4). |
| RB-15 | Overlapping bodies: an exposed root cap only warned; there are T-tail and V-tail coincidence and trailing-edge wedge hazards. | **ACCEPTED** | R6b: buried surfaces must be strictly inside another body, by exact inside test, and an exposed cap is an error. A minimum junction penetration depth. The blunt trailing edge is the default for CFD export. Spike S-4 measures junction quality. |
| RB-16 | V-tail: a ±φ_V rigid rotation gives one up and one down half on the same side. The `semi` span convention contradicted the T-tail placement. [V by geometry] | **ACCEPTED** | Left halves are mirror images. `semi` surfaces use the semi-span s. T-tail placement uses s_v. GEO-T6 measures the dihedral and incidence sign of each half. |
| RB-17 | VAL-E1 (NASA TP-3151) is real, but its data are pressure and vortex measurements on an image-plane semispan wing, and the wall-correction size is comparable to the 5 % gate. [search-snippet] | **ACCEPTED** | TP-3151 is kept as a C_p-distribution and tip-vortex benchmark (VAL-E1a). C_Lα and C_D validation needs a **force-balance dataset** with documented corrections (VAL-E1b). Its selection is unresolved item U-2; gates are set after its uncertainty is read. |
| RB-18 | VAL-D1 bounded a difference, not the residual. GCI on non-nested snappyHexMesh meshes is noisy. | **ACCEPTED** | VAL-D1 uses a Richardson-estimated residual with the near-body mesh frozen and only the outer blocks extended. VAL-G1 uses the effective refinement ratio from cell counts, reports the observed order, and follows Celik et al. for non-monotone convergence. |
| RB-19 | GEO-T1 cannot pass with the default closed trailing edge (the tabulated values use a₄ = −0.1015). A zero-thickness trailing edge is hostile to layers. [V, t8] | **ACCEPTED** | The default becomes `trailingEdge: "blunt"` (a₄ = −0.1015) with a `te_base` surface. GEO-T1 compares blunt sections with the tabulated values and sharp sections with the closed form. The TMR section is a separate fixture. |
| RB-20 | The VLM-V1 7 % gate was ≥ 1.8× looser than the observed error. LLT is poor at AR 4. There was no swept or tapered oracle. | **ACCEPTED** | VLM-V1 is gated at 5 % for AR ≥ 6, with AR 4 reported only. New **VLM-V1b**: swept and tapered wings against the Helmbold-DATCOM form, C_Lα = 2πAR/(2 + √(4 + AR²(1 + tan²Λ_c/2))), within 5 %. The reviewer measured −1.2 to −1.8 %. |

### Low

| ID | Objection | Disposition | Change |
|---|---|---|---|
| RB-21 | R² ≥ 0.999 passes a 20 % slope variation. [V, t11] | **ACCEPTED** | Replaced by the adjacent-pair-slope rule (§2.5). |
| RB-22 | XVAL-T1 at 10 % is loose. CFD-T8 compares two different snappyHexMesh meshes. CFD-T7 and T9 use the same field. | **ACCEPTED** | XVAL-T1 starts at 10 % and is tightened to 5 % after one calibration run, with the rationale recorded. CFD-T8 uses `mirrorMesh` of the half mesh. CFD-T7 and T9 are relabelled extraction checks. |
| RB-23 | The y⁺ estimate varies over the surface. The C_f projection is undefined at stagnation. | **ACCEPTED** | The y⁺ area-fraction gate (RB-08). C_f is displayed as \|τ_w\|/q∞, with the streamwise component optional and labelled. |
| RB-24 | Lines drawn through hollow points; dimensional half-model forces; per-component normalisation. | **ACCEPTED** | Lines break at unconverged points. Dimensional forces = C·q∞·S. Per-group values are labelled "contribution to aircraft C". |

---

## 3. Unresolved items after review

These are genuinely open. None blocks M0, M1a or M4a. Each is tracked as an open question or spike in the master plan.

| ID | Item | Why it cannot be closed now | Blocks | Path to closure |
|---|---|---|---|---|
| U-1 | Wing-body-tail validation dataset with C_m-α or NP (VAL-E2) | Depends on the target regime (Q-2); must be read and cited before use | Any validated CFD stability claim (M8-2 Tier 2) | Owner answers Q-2; select a published tunnel configuration; record its citation, licence and uncertainty |
| U-2 | Force-balance 3-D wing dataset for C_Lα and C_D (VAL-E1b) | Same; TP-3151 is unsuitable for force gates (RB-17) | M6 validation gates | As U-1 |
| U-3 | Junction meshing: overlapping bodies with Boolean features vs a Manifold union | Needs OpenFOAM runs | M6 entry gate (MESH-T2) | Spike S-4 in M4b |
| U-4 | snappyHexMesh `regions` name-override behaviour, and the forceCoeffs/function-object syntax on the pinned version | OpenFOAM is not installed; behaviour is version-specific | M4b | CFD-T1 probe in M4-1 |
| U-5 | OpenFOAM availability for Ubuntu 26.04 (native, container or source) | Needs an owner decision and installation | M4a | Q-4 |
| U-6 | Transition modelling (for example kOmegaSSTLM) if the target is UAV-scale | Scope depends on Q-2; invalid physics otherwise (RB-06) | Tier 2 for Re < 2e6 | Q-2; if UAV, add a transition-model validation milestone |
| U-7 | three-mesh-bvh `faceIndex` semantics under `indirect` | Undocumented; needs execution | Adopting a BVH (optional) | Spike S-2 |

---

## 4. Coordinator measurements used to settle VLM gates (RA-03)

All measurements use a rectangular flat-plate wing at α = 4°, a wake length of 2000 c, and the repository Biot–Savart kernel. Scripts are in `/tmp/claude-1000/-home-tanvir-Coding-AirFLOW/76bf9998-d405-4391-a3a5-0698b59e1664/scratchpad/opus/` (`vlm_gate_calibration.mjs`, `vlm_convergence.mjs`, `vlm_multirow.mjs`). The lifting-line oracle is an independent Glauert solution with 60 odd terms.

### Single chordwise row, uniform spacing

The defect: accuracy degrades as the panel width-to-chord ratio falls.

| AR | N | width/chord | C_Lα | e (Trefftz) |
|---|---|---|---|---|
| 4 | 32 | 0.125 | 3.7319 | 1.0190 |
| 4 | 64 | 0.0625 | 3.7450 | 0.9903 |
| 4 | 128 | 0.031 | 3.7592 | 0.9371 |
| 4 | 256 | 0.016 | 3.7715 | **0.6073** |
| 8 | 32 | 0.25 | 4.6687 | 1.0008 |
| 8 | 256 | 0.031 | 4.6660 | 0.9229 |

### Multi-row VLM at panel aspect ratio 1

R1 = (8⌈AR/2⌉ spanwise × 4 chordwise); R2 = (16⌈AR/2⌉ × 8). The spanwise count has a minimum of 16.

| AR | R1 C_Lα | R2 C_Lα | Δ | LLT C_Lα | R2 vs LLT | R1 e | R2 e | Δe | LLT e |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 3.8263 | 3.8036 | 0.6 % | 4.0284 | −5.6 % | 1.0511 | 1.0121 | 3.7 % | ≈ 0.972 |
| 6 | 4.3680 | 4.3521 | 0.4 % | 4.5304 | −3.9 % | 1.0188 | 0.9898 | 2.8 % | ≈ 0.954 |
| 8 | 4.7045 | 4.6922 | 0.3 % | 4.8377 | −3.0 % | 0.9956 | 0.9717 | 2.4 % | ≈ 0.937 |
| 12 | 5.1020 | 5.0936 | 0.2 % | 5.1991 | −2.0 % | 0.9600 | 0.9412 | 2.0 % | ≈ 0.907 |

Notes:
- LLT e values are inferred as e_VLM × (C_Di,VLM/C_Di,LLT) from single-row runs at N = 32. They are approximate.
- At AR 8, refining to 96 × 12 continues the e trend (0.9603), approaching LLT. The slow drag convergence reflects the square-root loading singularity at a rectangular tip. It is a property of the problem, not a code defect.
- **LLT is not a valid oracle below AR ≈ 5**, so AR 4 is reported without a gate.

### Elliptic planform (straight c/4 line), multi-row, after review (RB-04)

The exact value is e = 1. The lifting-line C_Lα = 2π/(1 + 2/AR) is itself an over-estimate at moderate AR. Script: `vlm_elliptic.mjs`.

| AR | N × M | C_Lα | vs LLT | e | panel width/length (min-max) |
|---|---|---|---|---|---|
| 6 | 16 × 4 | 4.6113 | −2.2 % | 1.0622 | 1.18-3.39 |
| 6 | 32 × 4 | 4.5073 | −4.4 % | 1.0304 | 0.59-2.37 |
| 6 | 64 × 8 | 4.4830 | −4.9 % | 1.0150 | 0.59-3.35 |
| 8 | 16 × 4 | 5.0119 | −0.3 % | 1.0622 | 1.57-4.51 |
| 8 | 32 × 4 | 4.8937 | −2.6 % | 1.0307 | 0.79-3.17 |
| 8 | 64 × 8 | 4.8648 | −3.2 % | 1.0152 | 0.79-4.46 |

e approaches 1 from above as N increases, so values slightly above 1 at practical resolution are discretisation bias, not physics. The Trefftz drag is positive in every case. The tip-strip aspect ratio of about 4.5 is why the guard keeps only its lower bound (≥ 0.25) as a hard limit.

### Post-review verification of the revised Trefftz oracle (RB-03) and the wake choice

Before release, the coordinator ran the handoff's general Trefftz oracle exactly as specified: all legs of all surfaces, orientation inherited from the horseshoes, no `abs`. The comparison is against the long-wake near-field drag (wake 100 b) for a wing (AR 8, 32 × 4) alone and with an H-tail (span 3 c, 4 c aft, 0.6 c above). Scripts: `trefftz_general_check.mjs` and `trefftz_freestream_wake.mjs`.

| Wake model | Case | α = 5° near-field vs Trefftz | α = 10° |
|---|---|---|---|
| Planar along +x (proposed in a v1.0 draft) | wing; wing + tail | −0.381 %; −0.381 % | −1.520 %; −1.520 % |
| **Freestream-aligned (current code; adopted)** | wing; wing + tail | **−0.001 %; −0.001 %** | **−0.001 %; −0.001 %** |

The planar-wake difference equals 1 − cos α. It is an O(α²) linearisation inconsistency, so the planar-wake optimisation was withdrawn before release. D > 0 in every case. This is a coordinator self-correction made after the review.

