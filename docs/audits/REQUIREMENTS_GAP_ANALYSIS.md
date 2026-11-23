Status: **Evidence record**. This is the Phase-1 audit by Subagent B (Sonnet 5.5), verified by the coordinator on 2026-10-23.

The traceability matrix (§3) is the reference for requirement IDs used in [MASTER_REVISED_PROJECT_PLAN.md](../plans/MASTER_REVISED_PROJECT_PLAN.md) §3, where every requirement receives a disposition.

**Correction.** Where this file cites the demo mesh as having 8 boundary edges, 85 non-manifold edges and 80 degenerate triangles, those are artefacts of the app's tolerance weld. The exact topology is 28 boundary edges, 5 four-use edges and 0 degenerate triangles ([DISCREPANCY_REGISTER.md](DISCREPANCY_REGISTER.md) V-2). The conclusions drawn from those figures are unaffected.

# AirFLOW Requirements Gap Analysis

Author model: Sonnet 5.5 (claude-sonnet-5-5). Audit date: 2026-10-23. Repository: `/home/tanvir/Coding/AirFLOW`, branch `main`, single commit `25afe85` (author date Sat Jul 18 2026), untracked `refs/`.

Companion document (mathematics, numerical checks, CFD feasibility): `docs/audits/MATHEMATICS_AND_CFD_CORRECTNESS_AUDIT.md`. Finding IDs `B-xxx-nn` below refer to that file.

---

## 0. Method, evidence conventions, and what was actually verified

Verified by execution in this session (not assumed):

- `npm test` passes: 23 tests, 0 failures (Node v24.21.0).
- `which gmsh blockMesh snappyHexMesh simpleFoam` returns nothing; only `/home/tanvir/anaconda3/bin/python3` exists. No CFD tooling is installed.
- `grep` over `src/` and `index.html` for `reynolds|clmax|stall|naca|openfoam|gmsh|snappy|bvh|csg|streamline|inlet|outlet|symmetry|shiftKey|FF6600` finds no implementation of any CFD-requirement keyword (the only hits are unrelated: `boundaryEdges`, "symmetric" in comments, dynamic pressure, etc.).
- `git tag` returns nothing; `git log` shows one commit. The Qwen handoff's tags (`legacy-v1-alpha`, `v1.0.0-beta`) do not exist here.
- The numerical claims in `CALCULATION_PIPELINE.md` section 16 (surface area 842.81, volume 460.691, CG [17.282, 0.005, 3.097], Iyy 3.148e6, CL(0) 0.168, CDi(0) 0.0087, CLalpha 4.798, Cm_alpha +1.354, SM -28.2%) were reproduced exactly by re-running the application pipeline headlessly (`check4_demo_pipeline.mjs`). The documents describe the code faithfully; the defects found are in the specified method, not in transcription.

Not verified: the YouTube reference in the requirements doc (L20), the running browser UI (no browser session was driven), real A320 data, and any claim in the Qwen handoff about a codebase that is not present.

Status vocabulary used in the matrices: **Implemented** (works as specified, evidence cited), **Partial** (some of the requirement exists, gap stated), **Missing** (no implementation; planned or aspirational only), **Contradicted** (code or another document does the opposite), **Not applicable** (research/process item, or belongs to a stack this repo deliberately does not use). "Planned" is never counted as implemented.

Severity vocabulary for findings: Critical / High / Medium / Low. Category vocabulary: VERIFIED DEFECT, SUSPECTED DEFECT, MISSING, DESIGN RISK, UNVERIFIED CLAIM, ESTABLISHED FACT, MODELLING ASSUMPTION, ENGINEERING CHOICE.

---

## 1. Document authority assessment

| Document | Size | What it actually describes | Authority / reliability | Evidence |
|---|---|---|---|---|
| `refs/CFD_Aircraft_Design_and_Simulation_Requirements.md` | 226 lines | Future intent: an OpenFOAM-based aircraft CFD platform with parametric geometry, BC tagging, backend, results. | Target specification (stated by coordinator as CURRENT). It is a restatement of "Bengali-English messages" (L3-4), contains no equations, no acceptance criteria, no validation targets, and several under-specified items (see section 2). Dated 2026-07-31, i.e. 13 days after the repo's only commit (2026-07-18): the code predates this spec. | File header L1-4; `git log -1` |
| `refs/Qwen_markdown_20260918_2za7s34sd.md` | 171 lines, 16,472 bytes | A *different* codebase ("flowsync-v2", React/TypeScript/Vite/Zustand/R3F, `occt-import-js`, `jspdf`), explicitly "VLM-based preliminary design tool ... Is not: CFD solver" (L20-21). | Foreign / unverified. No such files, tags, or dependencies exist in this repo. The document is also **truncated**: it ends with a lone `V` at L171 inside section 8; sections 9-16 listed in its own contents (L12) are absent. The filename timestamp 20260918 (2026-09-18) is later than the requirements doc (2026-07-31), so it is not an obviously older/stale artefact; which one governs cannot be settled from the files and must be asked of the owner. Useful as a source of conventions and equations, not as evidence of what exists. | `wc -c`; `tail -c`; `git tag`; no `tsx`/`ts` files; `package.json` has no dependencies |
| `plan.md` | 813 lines | FlowSync v1.0Beta module methodology FS-01..FS-08 for a C++17/Qt6/OpenCascade Windows desktop app, revised to *manual* recognition (L1-3, L194-285). | Historical design intent and the origin of the FS-xx numbering. Superseded for implementation by `MVP_METHODOLOGY.md` (which says so, L3-5, L9-18). Contains verifiable technical errors (B-DOC-01, B-DOC-02, B-DOC-04). | Content; `MVP_METHODOLOGY.md` L9-18 |
| `MVP_METHODOLOGY.md` | 78 lines | The browser MVP in this repo: scope mapping, coordinate/unit contract, VLM model, validity limits. | Accurate description of the repo, including honest scope limits ("not an XFLR5, AVL, CFD, or flight-certification substitute", L3). Two statements are contradicted by measurement (planform-envelope robustness, L47; see C-03). | Cross-checked vs code (sections 3.3-3.4) |
| `CALCULATION_PIPELINE.md` | 594 lines | Chronological formulas of the code. | Faithful to the code (all demo numbers reproduce). It *specifies* the defective induced-drag evaluation (section 11: "recomputed from the other horseshoes") and the inert alpha-state in the pitch model (section 15). | `check4_demo_pipeline.mjs` |
| `reference/xflr5/` | empty dir | Placeholder for XFLR5/AVL benchmark fixtures. | No content; the plan's AVL benchmark (plan.md L453-459) has no fixture. | `ls -la reference/xflr5` |

Conclusion on authority: two documents describe this repo (MVP_METHODOLOGY, CALCULATION_PIPELINE); one describes a historical desktop plan (plan.md); one describes a foreign React codebase and is truncated (Qwen); one describes the future target (requirements). The target and the repo share only the idea of Three.js-based triangle selection. There is **no code path** from the repo to the target's central scientific object (an OpenFOAM RANS solution).

---

## 2. Contradictions between documents

| ID | Topic | Statement A | Statement B | Impact | Suggested resolution |
|---|---|---|---|---|---|
| D-01 | Product scope | Requirements L8, L13, L155-158: *CFD platform*, snappyHexMesh + simpleFoam + k-omega SST. | Qwen L20-21: "VLM-based ... Is not: CFD solver". MVP_METHODOLOGY L3 and CALCULATION_PIPELINE L5: "not CFD". plan.md L291-292: VLM. | Fundamental. The repo, the plan, and the only handoff doc are all VLM; only the newest requirements are CFD. Estimated reuse of VLM code in a CFD pipeline: geometry/selection/mass only; solver none. | Owner must state whether VLM remains as a fast preliminary tier (recommended: keep it as a cross-check) and CFD is added, or VLM is dropped. |
| D-02 | Stack | Requirements L171, L183: React + Tailwind + Zustand/Redux (later priority). | Qwen L18, L31-44: React/TS/Vite/Tailwind/Zustand/R3F claimed *already built*. plan.md L641-651: C++/Qt/OpenCascade. Repo: vanilla ES modules, no dependencies (package.json). | Qwen's "existing" stack does not exist here; the requirements treat React as future. | Treat Qwen's stack claims as UNVERIFIED CLAIM. Decide stack once, in the requirements doc. |
| D-03 | Coordinate frame / Cm sign | Qwen L137: body axes X forward (nose +X), Y right, Z up; relative wind (-cos a, 0, sin a); Cm = -M_y/(qS MAC). | Repo (CALCULATION_PIPELINE L34-38, vlmSolver.js:92-97, 161): x positive downstream (aft), y lateral, z up; wind (+cos a, 0, +sin a); Cm = +M_y/(q S MAC). plan.md L176: X longitudinal, Z vertical, Y spanwise. | Same physics, mirrored x and opposite moment sign. Qwen's frame (X fwd, Y right, Z up) is **left-handed** (x cross y = -z); harmless for symmetric configurations only. Any port of formulas between the two frames flips sign of SM, Cm, NP. | Adopt one frame in writing. OpenFOAM default forceCoeffs axes (drag (1 0 0), lift (0 0 1), pitch (0 1 0), see math audit B-CFD-10) match the repo's internal frame (flow toward +x, lift +z) if y is starboard. |
| D-04 | Sweep reference line | plan.md L245, Qwen L137, MVP_METHODOLOGY L50: quarter-chord sweep. | vlmSolver.js:270-276 applies `sweepDeg` to the *leading edge*; index.html label "Quarter-chord sweep deg". | 2.35 deg error on a 25 deg wing (B-VLM-03). | Convert reference line explicitly in `sectionAt`. |
| D-05 | Wing area definition | plan.md L244: "Sum of projected areas onto XZ plane". | MVP_METHODOLOGY L53: XY planform envelope (physically correct; plan's own axes make XZ the side view). Qwen L143: upper skin only (n_z>0.15) in 48 bins. | plan.md is wrong (B-DOC-02). Qwen's method is not comparable. | Keep MVP's definition; fix the extractor (B-REC-01). |
| D-06 | Selection interaction | Requirements L44-47: Ctrl+Click triangle, Ctrl+Shift+Click BFS flood (dihedral <= 30 deg), `#FF6600`. | Qwen L115: LMB select, Ctrl toggle, Ctrl+Shift flood, box marquee, component select. plan.md L224: click/box/lasso. Repo: mode toggle button, "Region grow" checkbox (default 18 deg), Ctrl toggles, no Shift handling, highlight (1,0.78,0.08) = #FFC714 (app.js:476). | Interaction contract differs in all four documents. | Pick the requirements doc as authority; see R-3.1-* rows. |
| D-07 | Accuracy / benchmark criteria | plan.md L459: CL within 5% of reference. | MVP_METHODOLOGY L78: current self-test tolerance 16% (tests/vlmSolver.test.mjs:38); Qwen L146: "four PASS gates" for AR-6 vs lifting-line (gates not specified). Requirements doc: none. | Acceptance for the VLM is a moving target; for the CFD there is none. | Define numeric acceptance gates (math audit section 7). |
| D-08 | Drag content | plan.md L409: only CDi computed; "must be clearly labeled in all outputs". | Repo plots "CD total" = CDi + user constant CD0 (default 0.025) under the title "VLM coefficients" (app.js:775-781, vlmSolver.js:191). Qwen L146: CD0 computed from Schlichting Cf * 1.35 * 2.05 per strip. | Labelling rule from the plan is only partly honoured; Qwen computes what the repo asks the user to type. | Rename series "CDi + assumed CD0"; or implement a documented skin-friction estimate. |
| D-09 | Moment reference point | plan.md L412: typically quarter-MAC. Qwen L137: reference = quarter-MAC, SM measured to CG afterwards. | Repo: moment taken about the mass-model CG (app.js:335) so Cm_alpha already contains the CG offset. | Different Cm values for the same geometry; both are valid if the reference is stated next to each number. | Report Cm reference point in every output and CSV header. |
| D-10 | Mass model | Qwen L149: per-component effective densities (wing 50, tails 35, fuselage 80 kg/m3). | Repo: single `mesh-volume` entry, 42,600 kg uniform (massModel.js:3-19) plus point masses. | CG/inertia not comparable. Qwen's densities are UNVERIFIED CLAIM. | Define a mass-manifest schema in the requirements. |
| D-11 | Persistence | plan.md L15-25: `.flowsync` directory. Qwen L152: `.fsw` JSON with base64 face buffers. | Repo: one JSON (`airflow.browser-project`) + localStorage autosave (projectState.js). | Format incompatibility. | Not blocking. |
| D-12 | Product name | plan.md, Qwen: FlowSync. | Repo, MVP docs: AirFLOW. | Cosmetic but confusing for traceability. | Settle name. |
| D-13 | Export vs patch naming | Requirements L128: export *binary* STL. L120: JSON manifest of tagged face sets. | OpenFOAM snappyHexMesh carries multiple regions only in formats such as multi-`solid` ASCII STL (doc.openfoam.com snappyHexMesh geometry: "Some formats support multiple regions, e.g. 'SOLID' in the stl format"). Binary STL has no per-region names. | Per-component force breakdown and per-region BCs cannot ride on a single binary STL (B-CFD-04). | Export one STL per component, or multi-solid ASCII STL, or define the mapping via the manifest and createPatch. |
| D-14 | Boundary vocabulary vs angle-of-attack | Requirements L114-117: four tags, single inlet/outlet. | An alpha sweep with a fixed box needs either geometry rotation per alpha (re-mesh) or a freestream-type far field on all outer faces and rotated inlet velocity. | The four-tag vocabulary cannot express far-field top/bottom/side faces (B-CFD-03). | Add `FARFIELD_FREESTREAM` (and optionally `SLIP`). |
| D-15 | Recognition mode | plan.md L195-196, L257-260: manual only; "No automatic detection". | Qwen L143: automatic recognition engine (lumps, per-face rules) with manual override and "Confirm & Lock". Requirements L38: manual "rather than depending entirely on automatic classification". | Qwen and requirements are compatible; plan.md is stricter. | Fine, but document the intended default. |
| D-16 | Release/provenance | Qwen L22: v1 retired under tag `legacy-v1-alpha`; v2 tagged `v1.0.0-beta`; CI green; `acceptance.beta.test.ts`. | Repo: no tags, no CI config, no TS, 23 tests in `tests/*.test.mjs`. | Qwen provenance claims are unsupported here. | Treat as UNVERIFIED CLAIM. |
| D-17 | Backend | Requirements L149: Node.js or Python backend accepting STL + JSON. | `server.mjs` is a static-file server only (no POST handlers, no process spawning). | The requirement is wholly unimplemented. | Planned work item. |

---

## 3. Traceability matrix

Evidence column cites `file:line` in the repo. "none" means nothing implements it (checked by reading and `grep`).

### 3.1 Requirements document (`refs/CFD_Aircraft_Design_and_Simulation_Requirements.md`)

| ID | Source | Requirement | Implementation evidence | Status | Notes |
|---|---|---|---|---|---|
| R-1-a | L10 | Parametric construction/assembly of wings, fuselage, tail | none | Missing | No geometry generator exists; app only imports STL (stlParser.js:3-6). |
| R-1-b | L11 | Identify and manually select surfaces and mesh faces, ANSYS-like | app.js:489-523 (ray pick + region grow), recognition.js:62-102 | Partial | Four fixed labels; triangle granularity; no face-group objects; no tree. |
| R-1-c | L12 | Define/visualise fluid domain and BCs | none | Missing | |
| R-1-d | L13 | CFD mesh generation, solver integration, analysis | none (VLM only: vlmSolver.js) | Missing | Substitute is a flat-plate horseshoe VLM; not CFD. |
| R-1-e | L14 | Separate visualisations of coefficients, stability, flow fields, results | app.js:769-804 (two canvases), app.js:753-767 (tiles) | Partial | Coefficients and stability shown in one right-hand panel; no flow fields. |
| R-1-f | L16 | Validate geometry id / face selection / boundary definition / CFD workflow before UI polish | tests/recognition.test.mjs (3-triangle fixtures) | Not applicable | Process priority. Note for coordinator: effort in the repo went to VLM, mass model and pitch demonstrator, which the spec ranks 5-6. |
| R-2-a | L20-22 | Study referenced video | not verifiable | Not applicable | URL not accessed. |
| R-2-b | L24 | Learn ANSYS-style selection | n/a | Not applicable | Research task. |
| R-2-c | L25 | Learn CFD setup sequence | n/a | Not applicable | Research task. |
| R-2-d | L26 | Learn how faces/boundaries are assigned | n/a | Not applicable | Research task. |
| R-2-e | L27 | Establish inputs and equations for CL, CD, CM, CL,max, static stability | CALCULATION_PIPELINE.md sections 9-14 (VLM); math audit section 6 (CFD) | Partial | VLM equations exist and are code-faithful (CDi flawed, B-VLM-01). No CL,max procedure. |
| R-3-a | L31-36 | Reliably identify wings, fuselage, tails, individual faces, connected groups | recognition.js:97-110, app.js:525-530 | Partial | Identification is purely user-driven; no automatic suggestion, no list of faces/groups, no validation of completeness (B-REC-02). |
| R-3-b | L38 | Manual select and label components/face sets | app.js:149-165, index.html:60-63 | Partial | Labels limited to {unassigned, wing, htail, vtail, fuselage}; no custom/named sets. |
| R-3.1-a | L42 | Use `three-mesh-bvh` | none | Missing | `grep` finds no BVH; picking uses plain `THREE.Raycaster` (app.js:496-498) on 197,772 triangles. |
| R-3.1-b | L43 | `computeBoundsTree()` on generated geometry | none | Missing | Adoption hazard: BVH build creates/reorders the index buffer (B-CFD-15). |
| R-3.1-c | L44 | Ctrl+Click selects one triangle via `faceIndex` | app.js:498-499 (faceIndex), :514-518 (Ctrl toggles) | Partial | Plain click in "Select faces" mode selects; Ctrl toggles add/remove; "Region grow" checkbox (default ON, index.html:55) means a plain click selects a patch, not one triangle. |
| R-3.1-d | L45 | Ctrl+Shift+Click BFS flood fill | recognition.js:62-95 (BFS) | Partial | Algorithm exists; trigger is the checkbox, Shift is never read (`grep shiftKey` empty). |
| R-3.1-e | L46 | Flood includes neighbours with dihedral <= 30 deg | recognition.js:87-88 | Partial | Default 18 deg (index.html:56), adjustable 0-90; adds a second criterion vs the seed normal (not in spec). Adjacency by welded vertices at 1e-5 m (recognition.js:26-60). |
| R-3.1-f | L47 | Highlight `#FF6600` by updating the vertex-colour attribute without rebuilding the mesh | app.js:470-487 (in-place colour write) | Partial | In-place update: yes. Colour: (1, 0.78, 0.08) = #FFC714, not #FF6600 (app.js:476). Loop visits all 197,772 triangles per selection change. |
| R-3.2-a | L53 | Locate wing/tail/fuselage/face in 3D | app.js:489-523 | Partial | Picking only; no isolate/hide/search. |
| R-3.2-b | L54 | Select individually or as connected groups | app.js:501-518 | Implemented | Single triangle (checkbox off) or region grow; region cap 15,000. |
| R-3.2-c | L55 | Assign/edit identity of surfaces manually | app.js:525-530, :156-161 | Partial | Fixed enumeration (recognition.js:3-9); re-assign and clear only; no rename. |
| R-3.2-d | L56 | Assign boundary tags to selected face sets | none | Missing | |
| R-3.2-e | L57 | Inspect selections and properties before export/run | app.js:543-555 | Partial | Per-component triangle counts; wing span/area text only. No area/normal/bounds of the selection, no tag list. |
| R-4.1-a | L63 | NACA 4-digit airfoil equations | none | Missing | Airfoil equations absent; VLM wing is a flat plate (vlmSolver.js:21-61). |
| R-4.1-b | L64 | Loft sections along span | none | Missing | |
| R-4.1-c | L66 | Geometric twist | none | Missing | Constant `incidenceDeg` only (vlmSolver.js:15, 25). |
| R-4.1-d | L67 | Dihedral parameter | vlmSolver.js:274 | Partial | Lattice parameter only; no mesh generation. |
| R-4.1-e | L68 | Sweep parameter | vlmSolver.js:273 | Partial | Lattice parameter, leading-edge semantic (B-VLM-03); no mesh. |
| R-4.1-f | L69 | Taper ratio | vlmSolver.js:271-272 (root/tip chord) | Partial | Lattice only. |
| R-4.1-g | L70 | Apply geometric transformations in wing mesh | none | Missing | Order of transformations unspecified in the requirement (B-CFD-06). |
| R-4.2-a | L74-79 | Sweep superellipse cross-sections along fuselage | none | Missing | |
| R-4.2-b | L81 | Exponent n variation incl. n<2 | none | Missing | |
| R-4.3-a | L87 | Conventional tail | none | Missing | H-tail *triangles* can be assigned on an imported mesh (recognition.js:6); no generator. |
| R-4.3-b | L88 | T-tail | none | Missing | |
| R-4.3-c | L89 | V-tail | none | Missing | "V-tail" label is a conventional vertical fin, "visual assignment only" (app.js:552). |
| R-4.3-d | L90 | H-tail | none | Missing | Imported H-tail enters the VLM if assigned (app.js:321-323). |
| R-4.3-e | L91 | Inverted-U tail | none | Missing | |
| R-4.3-f | L93 | Each configuration identifiable/selectable | recognition.js:3-9 | Partial | Imported mesh only, two tail labels. |
| R-5.1-a | L99 | Compute `L_ref` | none | Missing | `L_ref` is undefined in the requirement (fuselage length? span? MAC?). |
| R-5.1-b | L100 | Auto-generate enclosure | none | Missing | |
| R-5.1-c | L102 | Upstream 3 x L_ref | none | Missing | Adequacy discussed in B-CFD-02. |
| R-5.1-d | L103 | Downstream 6 x L_ref | none | Missing | |
| R-5.1-e | L104 | Domain faces individually locatable/labelable | none | Missing | |
| R-5.2-a | L108 | Identify role of every domain face | none | Missing | |
| R-5.2-b | L114 | `VELOCITY_INLET` | none | Missing | |
| R-5.2-c | L115 | `PRESSURE_OUTLET` | none | Missing | |
| R-5.2-d | L116 | `WALL_NOSLIP` | none | Missing | |
| R-5.2-e | L117 | `SYMMETRY` | none | Missing | |
| R-5.2-f | L119 | Keep face sets/tags in app state | projectState.js:6-24 (assignments RLE) | Partial | Component assignments only; no BC tags. |
| R-5.2-g | L120 | Export JSON BC manifest | none | Missing | Existing JSON exports are the project file and a mass manifest (unrelated). |
| R-5.2-h | L121 | Review full domain setup before solver run | none | Missing | |
| R-5.3-a | L125 | CSG union of wings/fuselage/tail | none | Missing | |
| R-5.3-b | L126 | `three-bvh-csg` | none | Missing | Library requires two-manifold inputs and warns outputs may not be (B-CFD-05). |
| R-5.3-c | L127 | Single watertight shell | geometry.js:122-204 (diagnostics only) | Missing | Diagnostics exist; the demo mesh is not watertight: 8 boundary edges, 85 non-manifold edges, 4 duplicate and 80 degenerate triangles (verified). |
| R-5.3-d | L128 | Export binary STL | stlParser.js:64-84 (`serializeBinarySTL`) | Partial | Function exists and is unit-tested (tests/stlParser.test.mjs:8) but is not imported by app.js; no export button. |
| R-6-a | L136 | CL and its nondimensionalisation | vlmSolver.js:159; CALCULATION_PIPELINE section 12 | Partial | VLM CL = L/(q S); correct; flat plate only; not from CFD. |
| R-6-b | L137 | CD and its nondimensionalisation | vlmSolver.js:147, 160, 191 | Partial | CDi is wrong in magnitude and sign (B-VLM-01); CD0 is a user constant. |
| R-6-c | L138 | CM, reference point and dimensions | vlmSolver.js:136, 161; app.js:335 | Partial | About CG, reference chord = MAC, nose-up positive; verified sign. |
| R-6-d | L139 | CL,max | none | Missing | No stall/viscous model; linear sweep only. |
| R-6-e | L140 | Static stability quantities | vlmSolver.js:204-213 | Partial | Cm_alpha, CL_alpha, SM, NP, trim from VLM; wing(+htail) only (B-STAB-03). |
| R-6-f | L141 | Reynolds number calculation | none | Missing | Not computed anywhere; no viscosity in the code base. |
| R-6-g | L143 | Relate coefficients to CFD setup / extracted forces | none | Missing | |
| R-7.1-a | L149 | Node.js or Python backend | server.mjs (static files only) | Missing | |
| R-7.1-b | L150 | Accept STL + JSON manifest | none | Missing | |
| R-7.2-a | L154 | Gmsh or OpenFOAM meshing | none | Missing | Neither tool installed in this environment. |
| R-7.2-b | L156 | snappyHexMesh | none | Missing | |
| R-7.2-c | L157 | simpleFoam | none | Missing | |
| R-7.2-d | L158 | k-omega SST | none | Missing | |
| R-7.2-e | L159 | Reynolds-related solver parameters | none | Missing | |
| R-7.3-a | L163 | Read VTK/JSON solver outputs | none | Missing | |
| R-7.3-b | L164 | Display in Three.js | app.js:387-411 (viewer exists) | Missing | Viewer exists but nothing field-valued is displayed; the VLM overlay (app.js:564-579) is geometry. |
| R-7.3-c | L166 | Cp pressure contours | none | Missing | |
| R-7.3-d | L167 | Velocity streamlines | none | Missing | |
| R-8-a | L171 | React + Tailwind (or equivalent modern framework) | package.json (no dependencies), src/styles.css | Contradicted | Vanilla ES modules with module-level mutable `state` (app.js:55-82). Spec marks this "Later Priority"; "equivalent modern framework" is ambiguous for vanilla JS. |
| R-8.1-a | L177 | Left model tree | none | Missing | Left panel is a controls column. |
| R-8.1-b | L178 | Centre 3D viewport (aircraft and fluid domain) | app.js:387-411 | Partial | Aircraft only. |
| R-8.1-c | L179 | Right properties inspector for the current selection | index.html:139-156 | Partial | Right panel shows mass/VLM results, not selection properties. |
| R-8.2-a | L183 | Zustand/Redux state | app.js:55-82 | Missing | Hand-rolled global object. |
| R-8.2-b | L190 | Sliders update geometry in real time | none | Missing | No parametric geometry. |
| R-8.3-a | L194 | Multiple tabs/workspaces | none | Missing | Single page, three columns. |
| R-9-a | L202 | CL view | app.js:777-781 | Partial | One of three curves in a combined plot. |
| R-9-b | L203 | CD view | app.js:777-781 | Partial | "CD total" includes assumed CD0 and a defective CDi. |
| R-9-c | L204 | CM view | app.js:777-781 | Partial | |
| R-9-d | L205 | CL,max view | none | Missing | |
| R-9-e | L206 | Static stability view | app.js:753-767, 793-803 | Partial | Metric tiles and a pitch demonstrator that is not physically valid (B-STAB-01). |
| R-9-f | L207 | CL vs CD | none | Missing | CSV contains both columns (app.js:844-846) but no polar plot. |
| R-9-g | L208 | Cp contours | none | Missing | |
| R-9-h | L209 | Streamlines / flow-field views | none | Missing | |
| R-9-i | L198 | Separate result views/tabs | none | Missing | Two canvases in the right sidebar. |
| R-10 | L211-222 | Implementation order 1-6 | n/a | Not applicable | Process guidance. Workstreams 1-2 partial, 3-5 missing, 6 partial. |

Counts for section 3.1 (91 rows): **Implemented 1**, **Partial 28**, **Missing 55**, **Contradicted 1**, **Not applicable 6**. Of the 85 functional rows: 1.2% Implemented, 32.9% Partial, 64.7% Missing, 1.2% Contradicted. Not one of the CFD-core requirements (sections 5, 7, 4 generators, CL,max, Re) has any implementation.

### 3.2 `plan.md` FS items

| ID | Source | Item | Implementation evidence | Status | Notes |
|---|---|---|---|---|---|
| P-FS01-001..004 | plan.md L15-28 | New/Open/Save/Save As project directory | projectState.js:6-41; app.js:834-837 | Partial | One JSON file download/upload instead of a directory; no Save As/UUID. |
| P-FS01-005 | L29-33 | Project settings (units, panel resolution, tolerances) | app.js:34-39, 864-874 | Partial | Controls persisted; SI only plus source-unit scale. |
| P-FS01-006 | L34 | MRU list | none | Missing | |
| P-FS01-007 | L35 | Auto save | app.js:858-862 (800 ms debounce to localStorage) | Implemented | Different mechanism than plan. |
| P-FS08-012 | L40, L753 | Crash recovery every 5 min, detect unclean shutdown, dialog | app.js:92-93 | Partial | Autosave is reloaded silently, only when the source name is `samolot.stl`; no dialog; no unclean-shutdown detection. |
| P-FS02-STL | L61 | STL import ASCII/binary | stlParser.js:3-62 | Implemented | Binary/ASCII detection (looksBinary L9-17). ASCII `solid` names are discarded (all solids merge). |
| P-FS02-STEP/IGES | L59-60 | STEP/IGES via OpenCascade | none | Missing | MVP lists as deferred (MVP_METHODOLOGY L12). |
| P-FS02-004 | L63-86 | Import validation pipeline incl. unit detection | geometry.js:32-52; app.js:215-251 | Partial | Topology/bounds only; unit is a user dropdown (STL carries none); no bbox-non-zero check as error. |
| P-FS02-005 | L88-95 | Error categories | app.js:114-124 | Partial | Free-text status messages only. |
| P-FS02-006 | L97-103 | Import summary | app.js:722-767 | Partial | Warnings list; no summary dialog. |
| P-FS03-001/002 | L169-170 | Validation and B-rep topology extraction | geometry.js:122-204 | Partial | Triangle-mesh topology only. |
| P-FS03-003/004 | L171 | Face/edge IDs | triangle index | Partial | No face database. |
| P-FS03-005 | L172 | Bounding box | geometry.js:3-19 | Implemented | |
| P-FS03-006 | L173 | Surface area | geometry.js:21-30 | Implemented | Total only. |
| P-FS03-007/008 | L174-175 | Per-face centroid/normal | recognition.js:316-321 (normals ad hoc) | Missing | No per-face property store. |
| P-FS03-009 | L176 | Reference axes from bbox | axisMapping.js:10-14 | Contradicted | Axes are chosen by the user (default mapping fixed to the demo), not derived from the bounding box. |
| P-FS03-010 | L177 | Geometry tree | none | Missing | |
| P-FS03-011 | L178 | Duplicate detection | geometry.js:158-167 | Implemented | Duplicate triangles counted (4 in demo). |
| P-FS03-012 | L179 | Small-face detection | none | Missing | |
| P-FS03-013 | L180 | Component surface colouring | app.js:470-487 | Implemented | |
| P-FS03-014 | L181 | Geometry statistics | app.js:741-751 | Partial | |
| P-FS03-015 | L182 | Basic repair | none | Missing | Demo mesh needs repair before any CFD (B-CFD-05). |
| P-FS04-001 | L201-226 | Manual component assignment (4 classes) | app.js:525-530 | Implemented | |
| P-FS04-006 | L213-215 | Symmetry detection (mirror pairing) | none | Missing | MVP lists as deferred. |
| P-FS04-007 | L237 | Span = max Y - min Y of face centroids | recognition.js:136 | Partial | Uses vertex extents, not centroids. |
| P-FS04-008/009 | L239-240 | Root and tip chord | recognition.js:175-181 | Partial | Average of nearest 3 / 4 bins, not the chord at y=0 / tip; unreliable on sparse tessellation (B-REC-01). |
| P-FS04-010 | L241-242 | MAC and MAC position | recognition.js:173 | Partial | MAC formula correct; MAC y-position and LE x not output; extraction fragile. |
| P-FS04-011 | L244 | Wing area (XZ projection) | recognition.js:172 | Contradicted | Plan's XZ projection is wrong; code uses XY planform envelope (correct) but vertex-binned (B-REC-01). |
| P-FS04-012 | L245 | AR = b^2/S | recognition.js:189 | Implemented | |
| P-FS04-013 | L246 | Quarter-chord sweep | recognition.js:187, 207 | Partial | Extracted at c/4; consumed as LE sweep by the VLM (B-VLM-03). |
| P-FS04-014 | L247 | Dihedral at quarter-chord | recognition.js:188, 208 | Partial | Regression of mid-thickness z, not at c/4. |
| P-FS04-015 | L248-250 | Component naming | recognition.js:11-17 | Missing | Fixed names. |
| P-FS04-016 | L222-229 | Manual override UI: box/lasso, context menu, validation colours, undo | app.js:489-530 | Partial | Click/Ctrl-click only; no box/lasso, no context menu, no undo, no green/yellow/red validation. |
| P-FS04-017 | L252-255 | Recognition report | app.js:543-555 | Partial | Summary rows, no warnings table. |
| P-FS05-001 | L327-332 | Geometry conversion: mean camber surface from skins | none | Missing | VLM surface is a flat trapezoid from reference numbers (vlmSolver.js:4-19, 270-276). |
| P-FS05-002 | L334-340 | Panels N_s x N_c, cosine clustering optional | vlmSolver.js:21-61 | Partial | One chordwise row; cosine spanwise always on; numerically unstable above ~40 panels (B-VLM-02). |
| P-FS05-003 | L342-346 | 3/4-chord control points | vlmSolver.js:41 | Implemented | Verified by test and by derivation. |
| P-FS05-004 | L348-352 | Horseshoe bound at 1/4 chord | vlmSolver.js:39-40, 76-83 | Implemented | |
| P-FS05-005 | L354-358 | Straight wake aligned with freestream, 20 MAC | vlmSolver.js:92-97, 100 | Implemented | Wake length scales with chord, not span (B-VLM-07). |
| P-FS05-006 | L360-366 | AIC via Biot-Savart | vlmSolver.js:63-74, 104-112 | Implemented | Formula matches Katz & Plotkin; absolute epsilon (B-VLM-08). |
| P-FS05-007 | L368-382 | No-penetration BC | vlmSolver.js:105 | Implemented | |
| P-FS05-008 | L384-392 | LU / iterative solver, condition number, regularisation | vlmSolver.js:229-268 | Partial | Gaussian elimination with partial pivoting; pivot ratio shown as a "conditioning" gauge but is not a condition number (B-VLM-04); no regularisation. |
| P-FS05-009 | L394-397 | Circulation distribution, normalised gamma(y) | vlmSolver.js:114-115 | Partial | Per-panel Gamma stored; no per-station sum or plot. |
| P-FS05-010 | L399-402 | Kutta-Joukowski lift | vlmSolver.js:121-144 | Implemented | Lift correct (lift is insensitive to B-VLM-01). |
| P-FS05-011 | L404-409 | Induced drag via Trefftz or local induced velocity | vlmSolver.js:121-135, 147 | Contradicted | Wrong magnitude and sign, masked by `abs` (B-VLM-01). |
| P-FS05-012 | L411-414 | Moment about reference point (typ. 1/4 MAC) | vlmSolver.js:136, 161 | Partial | About CG, not 1/4 MAC (D-09). |
| P-FS05-013 | L416-422 | Alpha sweep | vlmSolver.js:173-227 | Implemented | Default -6..10 deg vs plan's -4..12. |
| P-FS05-014 | L424-429 | Freestream inputs V, rho, alpha | index.html:86-91 | Implemented | Plus yaw input (beyond plan). |
| P-FS05-015 | L431-436 | Solver progress | app.js:319 | Partial | Status string set before a synchronous solve; no progress events. |
| P-FS05-016 | L438-444 | Error handling: invalid geometry, singularity, NaN | vlmSolver.js:244, 296-299; app.js:346-352 | Partial | Singularity throws; no NaN/Inf screening of results. |
| P-FS05-VAL-1 | L455 | Validate vs elliptic loading | tests/vlmSolver.test.mjs:38-42 | Partial | Rectangular AR 8 vs 2 pi AR/(AR+2) at 16% tolerance. The plan's formula `CL = pi AR alpha` is itself wrong (B-DOC-01). |
| P-FS05-VAL-2..4 | L456-458 | Validate vs AVL, VSPAERO, published data | `reference/xflr5/` empty | Missing | |
| P-FS05-VAL-5 | L459 | Acceptance: CL within 5% | tests tolerance 0.16 | Missing | MVP_METHODOLOGY L78 acknowledges. Measured here (AR 8 rectangular, N 24-40): -4.4% vs Helmbold, -2.7% to -3.0% vs an independent Glauert lifting-line. |
| P-FS06-002 | L500 | Project explorer tree | none | Missing | |
| P-FS06-003 | L501 | 3D viewport | app.js:387-411 | Implemented | |
| P-FS06-004 | L502 | Selection tools (click, box) | app.js:489-523 | Partial | Click only. |
| P-FS06-005 | L503 | Shaded/wireframe/edges | none | Missing | Shaded only (`grep wireframe` empty). |
| P-FS06-006 | L504 | Orbit/pan/zoom, preset views | app.js:413-450 | Partial | Orbit + zoom; no pan, no presets. |
| P-FS06-007 | L505 | Geometry info panel | app.js:741-751 | Partial | |
| P-FS06-008 | L506 | Colour-mapped results on surface | none | Missing | |
| P-FS06-009 | L507 | Analysis console | none | Missing | Single status line (app.js:945). |
| P-FS06-010 | L508 | Status bar | index.html:134 | Partial | |
| P-FS06-012 | L510 | Context menus | none | Missing | |
| P-FS06-013 | L511 | Light/dark theme | none | Missing | |
| P-FS06-014 | L512 | Shortcuts Ctrl+N/O/S/Z, F5 | app.js:185-195 | Partial | F5, Ctrl+S, Esc only. |
| P-FS06-015 | L513 | Error dialogs | none | Missing | Status line only. |
| P-FS07-001..007 | L601-609 | Report data model, plots, PNG export, PDF, template, rule-based summary, tables | app.js:839-847 (CSV) | Partial | CSV only; no PDF/figures/narrative. |
| P-FS07-008 | L610 | Report versioning with config hash | projectState.js:3-4 | Missing | Schema/version stamp only; no hash. |
| P-FS08-006 | L747 | Testing framework | tests/*.test.mjs | Partial | Node test runner; 23 tests; no end-to-end VLM-to-stability test of the live path (B-STAB-02). |
| P-FS08-005 | L746 | CI | none | Missing | No workflow files. |
| P-FS08-008 | L749 | Logging | none | Missing | |
| P-FS08-001..004,007,010 | L742-751 | CMake/vcpkg/GitFlow/installer for C++ | n/a | Not applicable | Stack replaced by the browser MVP. |

Counts for section 3.2 (72 grouped rows, machine-counted): **Implemented 17, Partial 30, Missing 21, Contradicted 3** (P-FS03-009, P-FS04-011, P-FS05-011), **Not applicable 1** (the C++/CMake/installer group). Items that the MVP document lists as deferred (STEP/IGES, PDF report, directory projects, box/lasso) are counted Missing, not Not applicable, because plan.md still names them as FS requirements.

### 3.3 MVP_METHODOLOGY.md and CALCULATION_PIPELINE.md claims

| ID | Source | Claim | Evidence / check | Status | Notes |
|---|---|---|---|---|---|
| M-01 | MVP L3; CALC L5 | Not CFD / not XFLR5 / not certification | whole repo | Implemented | Honest disclaimer; consistent with code. |
| M-02 | MVP L21-27; CALC L20-46 | SI units, x longitudinal / y lateral / z vertical, default mapping STL X->x, Z->y, Y->z | axisMapping.js:10-14, 18-31 | Implemented | The default map is a transposition, det = -1: signed volume flips sign (+460.69 raw vs -460.69 mapped) and normals invert (B-MASS-03). |
| M-03 | MVP L28 | Axis mapping must use each STL axis once | axisMapping.js:33-43 | Implemented | |
| M-04 | MVP L29; app.js:883-896 | Mass point coordinates transformed on remap | app.js:883-896 | Implemented | Inverse mapping checked algebraically. |
| M-05 | MVP L31-36 | Area, signed volume, centroid, inertia, parallel axis | geometry.js:54-120, 206-226 | Implemented | Verified vs analytic cylinder (Ixx 1124.99 vs 1125.00; Iyy 8895.83 exact) and translation invariance. |
| M-06 | MVP L35; CALC L82-90 | Boundary/non-manifold/duplicate/degenerate/components reported | geometry.js:122-204 | Implemented | Demo: 8 / 85 / 4 / 80 / 1. |
| M-07 | CALC L52-58 | Demo STL: 197,772 triangles, 1 component, 8 boundary, 85 non-manifold edges | tests/demoRegression.test.mjs; check4 | Implemented | Verified. |
| M-08 | MVP L41; CALC L179 | Region growth with local and seed normal limits and a face cap | recognition.js:62-95 | Implemented | |
| M-09 | MVP L47; CALC L195 | Envelope method means "selecting both skins does not double planform area" | recognition.js:140-172 | Contradicted | True only if every spanwise bin contains both LE and TE vertices. On the demo wing the vertex-binned area is 6.78 m2 vs 21.98 m2 true (-69%), depending on bin count (B-REC-01). |
| M-10 | MVP L53 | XY planform used because plan's XZ projection is inconsistent | recognition.js:172 | Implemented | Correct call. |
| M-11 | MVP L59-61; CALC L272-276 | Bound at c/4, control at 3c/4, wake straight along freestream, 20 MAC | vlmSolver.js:39-41, 92-100 | Implemented | |
| M-12 | MVP L65; CALC L360-371 | KJ force with V_eff from "other horseshoes" | vlmSolver.js:121-135 | Contradicted | The specification itself excludes the panel's own trailing legs, which makes induced drag wrong (B-VLM-01). Lift unaffected. |
| M-13 | MVP L66; CALC L401-405 | `D_i = abs(F . e_inf)` | vlmSolver.js:147 | Contradicted | The raw value is negative (thrust); `abs` hides it (B-VLM-01). |
| M-14 | MVP L66; CALC L443-447 | `Cm = M_y/(q S MAC) + Cm0` about CG, nose-up positive | vlmSolver.js:161, 192 | Implemented | Sign verified: Cm_alpha > 0 when reference is aft of NP (check5). |
| M-15 | MVP L67-68; CALC L477-513 | CL_alpha, Cm_alpha OLS within +/-5 deg; SM = -Cm_alpha/CL_alpha; NP = x_CG + SM*MAC | vlmSolver.js:204-209 | Implemented | NP is invariant to the reference point to within 0.005 MAC (0.2480-0.2527 for a planar AR 8 wing, CG 0..0.6). |
| M-16 | CALC L511-517 | Trim from Cm at the case nearest alpha=0 | vlmSolver.js:210-213 | Implemented | Approximation acknowledged. |
| M-17 | CALC L531-545 | Pitch ODE with relaxation of alpha toward theta, RK4 | stability.js:55-63, 90-100 | Contradicted (in effect) | RK4 correct; the third equation is inert because alpha(0) = theta(0), so alpha == theta exactly for all t (max difference 0.0 over 12 s, check6; B-STAB-01). |
| M-18 | CALC L555-571 | Demo values CL(0) 0.168, CDi(0) 0.0087, CL_alpha 4.798, Cm_alpha +1.354, SM -28.2% | check4 | Implemented | Reproduced: 0.1675, 0.00867, 4.798, +1.353, -28.2%. CDi value is the defective one (about 9x too large, B-VLM-01). |
| M-19 | CALC L577-588 | Test coverage list | tests/*.test.mjs | Partial | "Approximately quadratic induced-drag trend" is tested by the ratio CDi/CL^2 (scale-free), which cannot detect the 9x magnitude error or the sign error. |
| M-20 | MVP L78; CALC L588 | 5% benchmark unmet; 16% tolerance | tests/vlmSolver.test.mjs:38 | Implemented | Honest. |
| M-21 | CALC L240 (sec. 6.2) | Seed values flagged "Bounds seed - verify" | app.js:253-272 | Implemented | Seed heuristics are A320-tuned (0.112, 0.875, taper 0.35, sweep 25, dihedral 4) and the seed wing height is `bounds.center[2]` (app.js:365), undisclosed in the docs (B-VLM-10). |

### 3.4 Qwen handoff claims (foreign codebase; for contradiction checking only)

| ID | Source | Claim | Check against repo / requirements | Status | Notes |
|---|---|---|---|---|---|
| Q-01 | L16-22 | Complete React/TS app, phases 0-6 done, tags, CI, `acceptance.beta.test.ts` | No such files/tags (git tag empty; only `*.mjs` tests) | Not applicable | UNVERIFIED CLAIM; not this repo. |
| Q-02 | L20-21 | "Is not: CFD solver" | Contradicts requirements L8, L155-158 | Contradicted | D-01. |
| Q-03 | L137 | X forward, Y right, Z up (left-handed); wind (-cos a, 0, sin a); Cm = -M_y | Contradicts repo frame | Contradicted | D-03; formula set is internally consistent for a symmetric wing because M_y depends only on x,z. |
| Q-04 | L115 | LMB select, Ctrl toggle, Ctrl+Shift flood 30 deg, box marquee | Matches requirements L44-47 (not the repo) | Not applicable | Suggests the requirements and Qwen share lineage. |
| Q-05 | L140 | Weld-based segmentation, adaptive 28/35/45 deg, 2000-region cap | No such code | Missing | |
| Q-06 | L143 | Automatic recognition rules | Not in repo (manual only) | Missing | |
| Q-07 | L146 | Cosine-spanwise x uniform-chordwise panels; singularity pivot < 1e-12 | Repo: single chordwise row; throws at 1e-10 | Contradicted | |
| Q-08 | L146 | "Wake relaxation ... inviscid vorticity-transport (convection) reduced form of the General Transport Equation" | Not in repo | Not applicable | UNVERIFIED CLAIM: one-pass re-alignment of straight legs along V_inf + w at the wing is not a vorticity-transport solution (B-DOC-03). |
| Q-09 | L146 | CD0 = Cf*1.35*2.05, "von Karman momentum-integral closure" | Not in repo | Not applicable | Cf = 0.455/(log10 Re)^2.58 is the Prandtl-Schlichting empirical fit, not a momentum-integral closure (B-DOC-03). |
| Q-10 | L149 | Effective densities wing 50, tails 35, fuselage 80 kg/m3 | Not in repo | Not applicable | UNVERIFIED CLAIM. |
| Q-11 | L169-171 (and L1-12 contents) | Sections 9-16 (decisions, testing, error doctrine, limitations, backlog, process, onboarding, doc map) | File ends at L171 mid-equation | Missing | Document truncated; contents list promises 8 absent sections. |

---

## 4. Headline tallies (machine-counted from the Status column of each table above)

| Table | Rows | Implemented | Partial | Missing | Contradicted | Not applicable |
|---|---|---|---|---|---|---|
| 3.1 Requirements document (target spec) | 91 | 1 | 28 | 55 | 1 | 6 |
| 3.2 plan.md FS items (grouped) | 72 | 17 | 30 | 21 | 3 | 1 |
| 3.3 MVP_METHODOLOGY / CALCULATION_PIPELINE claims | 21 | 16 | 1 | 0 | 4 | 0 |
| 3.4 Qwen handoff claims | 11 | 0 | 0 | 3 | 3 | 5 |

Reading the numbers:

- Against the **current target spec** (3.1), excluding the 6 process/research rows: 1 of 85 functional requirements is Implemented (1.2%), 28 Partial (32.9%), 55 Missing (64.7%), 1 Contradicted (1.2%). Every requirement in sections 4 (generators), 5 (domain, BCs, CSG), 7 (backend, meshing, solver, post-processing), `C_L,max`, Reynolds number, `C_L` vs `C_D`, `C_p` and streamlines is Missing.
- Against the **repo's own documents** (3.3), 16 of 21 claims are Implemented and verified; the four Contradicted claims are all specification-level numerical defects (drag evaluation, planform envelope, pitch model) rather than documentation drift.
- Against **plan.md** (3.2), the manual-recognition and VLM-core items are largely present; project/report/UI-polish items are largely absent or reduced.

Commands used (reproducible): a Python 3 script that parses every `|`-delimited row after each `### 3.x` heading and counts the first word of column 5. Table cells must not contain a literal pipe character (one such defect in row M-13 was found and fixed while counting).

## 5. Document-versus-code contradictions (all verified by execution)

| ID | Document statement | Code / measurement | Severity | Finding |
|---|---|---|---|---|
| C-01 | CALCULATION_PIPELINE L361-365: V_eff,i excludes panel i's own horseshoe | Induced drag signed negative, grows with N (N=24: -3.87e-2; Trefftz/near-field-with-self-legs: +4.4e-3; independent LLT +4.6e-3) | Critical | B-VLM-01 |
| C-02 | index.html:106 "Quarter-chord sweep deg" | `sectionAt` uses it as leading-edge sweep (vlmSolver.js:273) | Medium | B-VLM-03 |
| C-03 | MVP L47 envelope avoids double-counting | Vertex-binned envelope returns 6.78 vs true 21.98 m2 on the demo outboard wing | High | B-REC-01 |
| C-04 | CALC L541-545 alpha relaxation term | Term is inert; alpha == theta | High | B-STAB-01 |
| C-05 | CALC L240 "Bounds seed ... heuristic root-leading-edge position" | Seed also sets wing height to `bounds.center[2]` = 5.604 m, 2.5 m above the CG (3.097 m); SM changes from -28.2% to -36.5% (z = CG) or -40.2% (z = 2.0) | Medium | B-VLM-10 |
| C-06 | plan.md L409 label all outputs as induced-only | UI plots "CD total" with default CD0 = 0.025 | Low | B-GRAPH-01 |
| C-07 | tests/massStability.test.mjs "static stability follows neutral point relative to CG" | Tests `computeStaticStability`, which the application never calls (only tests import it, `grep` verified) | Medium | B-STAB-02 |
| C-08 | `renderStabilityMetrics` prints "Pitch stability: Stable/Unstable" (app.js:756) | Verdict is wing (+ assigned H-tail) only; no fuselage or power; CALC L571 warns but the UI does not | Medium | B-STAB-03 |

---

## 6. Unsupported scientific claims and infeasible or unjustified proposed features

(Detailed reasoning and references are in the mathematics audit.)

1. plan.md L455: "Elliptic loading -> CL = pi*AR*alpha". Incorrect for lift slope; correct finite-wing theory gives CL_alpha = a0/(1 + a0/(pi AR)) = 2 pi AR/(AR + 2) per rad for a0 = 2 pi (elliptic). pi*AR*alpha_induced would be the relation between CL and the *induced* angle. (B-DOC-01.)
2. plan.md L244: "projected areas onto XZ" is the side-view plane for the plan's own axes. (B-DOC-02.)
3. plan.md L608 and L621: rule thresholds `CL_slope > 5.0` (units unspecified; a rectangular AR 8 wing is 4.7-4.9 per rad) and "CM at alpha=0 < 0 and dCM/dalpha < 0 means stable" (only dCm/dalpha < 0 is the static-stability criterion; Cm0 sign governs trimmability). (B-DOC-04.)
4. Qwen L146: vorticity-transport and momentum-integral labels (Q-08, Q-09); Qwen L149 densities (Q-10).
5. Requirements L81: "n < 2 for chined or stealth-oriented profiles": a superellipse with 1 < n < 2 is C^1 but has infinite curvature at the axis points; n <= 1 gives true corners; n > 2 gives the flat-sided "boxy" family. The statement is only loosely true (B-CFD-07).
6. Requirements L102-103: 3 x L_ref upstream, 6 x L_ref downstream with no lateral/vertical extent and no definition of L_ref. If L_ref were the MAC (the usual coefficient reference length) the upstream distance would be 0.37 spans for the demo aircraft (B-CFD-02).
7. Requirements L114-117: four BC tags cannot describe a far-field that supports an angle-of-attack sweep; `SYMMETRY` is a geometric property (planar patch, symmetric flow), not a free tag (B-CFD-03).
8. Requirements L126-128: single watertight shell from `three-bvh-csg` and "binary STL" export. The library requires two-manifold inputs and warns about non-manifold output; the demo mesh itself is not watertight; binary STL cannot carry region names (B-CFD-04, B-CFD-05).
9. Requirements L139: C_L,max from steady `simpleFoam`: steady RANS is known to be unreliable near stall (B-CFD-09).
10. Requirements L43-44: `computeBoundsTree()` + `faceIndex`: the BVH build creates/reorders the index buffer, so `faceIndex` is not the STL triangle number unless mapped back (B-CFD-15).

---

## 7. Recommended closure order (for the coordinator; not a plan of record)

1. Decide D-01 (CFD vs VLM scope) and D-03 (single frame/sign convention) in writing.
2. Fix B-VLM-01 and B-STAB-01 before any further result is shown to anyone (they are specification-level, small, and invalidate every drag and pitch-response plot).
3. Fix B-REC-01/02 before relying on any recognised wing reference.
4. Only then build the geometry/BC data model (R-3.2-d, R-5.*) with per-component STL export and a far-field tag, since those decide whether the CFD tier can be driven at all.
5. Defer React/Zustand (R-8) until the data model is stable, as the requirements themselves prescribe.
