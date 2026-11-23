Status: **Evidence record**. This is the Phase-1 audit by Subagent A (Sonnet 5.5).

The coordinator verified the key selection and persistence findings: A-SEL-01, A-SEL-02, A-SEL-03 (62.3 % flood reproduced) and A-SEL-11. See [DISCREPANCY_REGISTER.md](DISCREPANCY_REGISTER.md) §1.

The library statements in §3 remain **unverified by execution**: they come from npm metadata and READMEs. Spike S-2 in the plan resolves them.

# AirFLOW UI and Geometry-Selection Audit

Auditor: Subagent A, running as Sonnet 5.5 (`claude-sonnet-5-5`). Date: 2026-10-23.
Companion: `docs/audits/REPOSITORY_IMPLEMENTATION_AUDIT.md` (architecture, data flow, lifecycle, tests, other findings). Evidence tags and the browser-harness limitation are defined in section 0 of that document and repeated briefly here:

- `[N]` executed in Node 24 against the real `src/` modules and real three.js r160 (scripts in `/tmp/claude-1000/-home-tanvir-Coding-AirFLOW/76bf9998-d405-4391-a3a5-0698b59e1664/scratchpad/auditA/`).
- `[B]` executed in the real browser pane against a scratchpad copy of the app whose only changes are (a) `WebGLRenderer` replaced by a no-GPU stub that updates matrices like the real one and (b) `window.__state = state` exposed. The pane has no WebGL, so no rendered pixels were ever seen; picking math, region growth, recognition, VLM, 2D canvases, localStorage are the real code paths.
- `[S]` static reading (file:line). `[W]` web/registry documentation.

Demo mesh used throughout: `assets/airbus-a320-cfd-1.snapshot.7/samolot.stl`, binary, 9,888,684 bytes, **197,772 triangles**, bounds (default mapping, internal frame x long / y lateral / z vertical) 37.438 x 33.977 x 11.208 m.

## 1. UI layout audit

### 1.1 Structure `[S]` (`index.html`, `src/styles.css`) and `[B]` (1500x900 emulated viewport, screenshot reviewed)

```
+--------------------------------------------------------------------------------------+
| topbar (68 px): "AirFLOW - Geometry recognition, mass properties, inviscid stability"  |
|   [Load demo] [Import STL] [Save project] [Open project] [Export results]              |
+----------------------+-------------------------------------+-------------------------+
| LEFT  controls panel | CENTRE viewport-panel               | RIGHT results panel     |
| 340-410 px, scrolls  | 420 px - 1fr                        | 360-430 px, scrolls     |
| 1 Geometry import    |  #viewer (WebGL canvas)             | Mass properties (tiles) |
|   units, 3 axis      |  status line + mesh-quality badge   | VLM stability result    |
|   selects, warnings  |                                     |   (8 tiles+diagnostics) |
| 2 Manual surface     |                                     | Aerodynamic sweep       |
|   recognition        |                                     |   (1 canvas, 2 stacked  |
| 3 Mass manifest      |                                     |    plots)               |
| 4 Flow               |                                     | Pitch response          |
| 5 Reference lifting  |                                     |   (1 canvas)            |
|   surface            |                                     |                         |
| 6 VLM setup + Run    |                                     |                         |
+----------------------+-------------------------------------+-------------------------+
```

- Layout: CSS grid `grid-template-columns: minmax(340px,410px) minmax(420px,1fr) minmax(360px,430px)` (`styles.css:112`), `body{overflow:hidden}`, `.app-shell{height:calc(100vh - 68px)}`. Below 1180 px the shell collapses to one column with a 560 px viewer; below 620 px a further compact variant (`styles.css:401-456`).
- **No tabs. No tab roles. No model tree. No properties inspector.** `grep -nEi "tablist|role=\"tab|tabindex|tree|inspector" index.html` matches only the unrelated `class="table-wrap"` (mass table); `grep -n shiftKey src/*.js` matches nothing. Navigation is one scrolling column on the left and one on the right.
- The six left-panel sections are the only "contexts": geometry import (units/axes/warnings), manual recognition (selection mode, region grow, label buttons), mass manifest table, flow, reference lifting surface, VLM setup. At 1500x900 the Assign buttons and the viewport are visible together, but Mass manifest/Flow/Reference/VLM require scrolling the left column.
- Viewport: one `<div id="viewer">` holding the renderer canvas, a status strip (`#statusLine`, `#meshQualityBadge`). No view cube, no fit-to-view button, no wireframe/edge toggle, no selection list, no legend for the component colours.
- Plot area: two `<canvas>` elements (`#polarCanvas`, `#pitchCanvas`), drawn by `graphs.js` as a 2D-canvas hand-rolled chart: panel 1 = CL, CD total, Cm vs alpha; panel 2 = Lift/Drag/Moment vs alpha; pitch canvas = theta/alpha/q vs time. No CL-vs-CD plot, no CL,max, no Cp or flow-field view.
- Toolbar actions: import (`file input accept ".stl,model/stl"`), demo, save project JSON (Blob download), open project JSON, export results CSV. Keyboard: `Esc` leaves selection mode; `F5` runs the VLM (reload is `preventDefault`ed); `Ctrl+S` downloads the project (`app.js:185-195`).

### 1.2 Separation of contexts (geometry / tagging / domain / solver / results)

| Context in refs 8.3/9 | Present? | Reality |
| --- | --- | --- |
| Geometry editing (parametric) | No | no generators; only import |
| Face selection / tagging | Partial | section 2 of the left column + the viewport; 4 enum labels |
| Fluid domain / boundary conditions | **No** | nothing |
| Solver setup | Partial | "Flow" + "VLM setup" + "Reference" sections (VLM only) |
| Results | Partial | right column; no separate view/tab; stale after edits (A-FLOW-01) |
| Model tree / inspector | No | no equivalent |

### 1.3 UI findings

- **A-UI-01 | MISSING | High (vs refs 8.1, 8.3, 9).** No three-pane Model Tree / Viewport / Inspector, no tabs/workspaces. The 3-column grid is superficially similar (controls | viewport | results) but the left column is a mixed bag of tagging + mass + flow + reference + solver controls and the right column is results; neither is context-sensitive to a selection. Reproduce: load the page; read `index.html:24-158`.
- **A-UI-02 | DESIGN RISK | Medium.** All state-changing controls for 5 different workflows live in one long scrolling column, and the assign/clear buttons are far from the status/plots. There is no per-selection property display: after selecting triangles the only feedback is "N selected" (`#selectedCount`) and, after assigning, per-class face counts with wing span/area (`app.js:543-555`).
- **A-UI-03 | VERIFIED DEFECT | Low. Accessibility/keyboard.** Face selection is pointer-only (no keyboard alternative, no list of selected items); component identity is colour-only (no legend); `F5` is hijacked (browser refresh disabled); `aria-pressed` is set on the selection toggle but there is no `role=tablist`/landmark structure. Source: `app.js:185-195`, `index.html:54`.
- **A-UI-04 | VERIFIED DEFECT | Medium.** Plots are not cleared when results are invalidated (A-FLOW-01, `[B]` identical canvas pixel hashes). Both canvases are forced to the same 17:7 aspect by CSS (`styles.css:391-397`, `aspect-ratio: 17 / 7`), measured `963 x 396.5` px each in the harness at 1500 px width although the HTML attributes say 680x340 and 680x260; `drawPlots` then resizes the bitmap to the CSS box (`graphs.js:5-10`), so the pitch plot (authored 680x260) is stretched to the polar plot's proportions.
- **A-UI-05 | VERIFIED DEFECT | Medium. Long blocking operations are invisible.** `setStatus("Building triangle adjacency...")` / `"Computing mesh properties..."` are set synchronously immediately before a ~0.5-0.9 s main-thread block, so the browser never paints them (`app.js:221,503`); `[B]` first pick took 942 ms with no visible progress. The status strip also doubles as the only error channel (all `catch` blocks print into it).
- **A-UI-06 | DESIGN RISK | Low.** Fixed-size helpers (`GridHelper(80)`, `AxesHelper(8)`) regardless of model scale (`app.js:399-401`); no cursor-centred zoom or pan (A-SEL-10).

## 2. Geometry -> selection -> persistence trace

```mermaid
sequenceDiagram
  participant U as User
  participant P as pointerup handler (app.js:435)
  participant R as THREE.Raycaster
  participant G as BufferGeometry (non-indexed)
  participant A as buildTriangleAdjacency
  participant S as growSelection
  participant X as state.recognition
  participant C as color attribute
  U->>P: click (selection mode)
  P->>R: setFromCamera(ndc) ; intersectObject(mesh,false)
  R->>G: loop ALL triangles i=0..N-1 step 3 (no BVH)
  G-->>R: hits sorted by distance; faceIndex = floor(i/3)
  R-->>P: hit[0].faceIndex  (== STL triangle id)
  alt Region grow checked (default)
    P->>A: first time only: weld + edge map (0.5-0.9 s)
    P->>S: BFS(seed, angle=18, cap=15000)
    S-->>P: Set of triangle ids
  else single triangle
    P-->>P: Set{faceIndex}
  end
  P->>X: selected = (ctrl? XOR : replace)
  P->>C: rewrite colour of ALL N triangles ; needsUpdate (7.1 MB upload)
  U->>X: Assign wing/htail/vtail/fuselage -> assignments[tri]=label ; selected.clear()
```

### 2.1 STL bytes -> triangle ids (`stlParser.js`)

- `parseBinarySTL` (`stlParser.js:19-43`) writes triangle `t` to `positions[9t..9t+8]` in file order; the 2-byte attribute word is ignored; no triangle is dropped or reordered; degenerates are kept. ASCII (`stlParser.js:45-62`) collects every `vertex` regex match in order into `positions`; triple `solid` boundaries and names are discarded. **Triangle id = zero-based order of appearance in the file.** There is no other identity.
- Stored STL normals are not used downstream (`rawStl.normals` is never read; ASCII normals are all zero).

### 2.2 Unit / axis remapping (`axisMapping.js`, `app.js:215-251`)

- `mapPositions` iterates vertices in the same order (`axisMapping.js:24-30`): permutation + sign + uniform scale per vertex, **no reordering of triangles or vertices**. `positionsToSceneFloat32` (`axisMapping.js:55-63`) swaps y/z for three.js. With the default mapping (`long=x, lateral=z, vertical=y`) the composition of the two swaps is the identity: `[N]` "default mapping: scene vs raw float32 max diff 0".
- Therefore the triangle-id invariant survives unit/axis changes: ids are unchanged, only coordinates and the derived report change. `remapCurrentGeometry` keeps `state.recognition.assignments` (and `selected`) intact on a remap (`app.js:231-233`) and sets `state.adjacency = null` (`app.js:234`), so the next pick rebuilds adjacency from scratch (0.5-0.9 s).
- Chirality: the internal frame is a reflection of the raw STL for the default mapping (odd permutation); `[N]` signed volume internal = -460.69 m3, raw +460.69. Region growth is unaffected (all normals flip consistently, neighbour dot products unchanged); mass code compensates with `sign` (`geometry.js:89-91`). An axis sign flip changes whether the 3D view is a mirror image of the file, with no UI indication (A-SEL-14).

### 2.3 Render geometry and `faceIndex` (`app.js:452-468`, three.js r160)

- The geometry is **non-indexed**: `position` (593,316 vertices = 3 x 197,772), `color` (zero-initialised), `normal` from `computeVertexNormals()`; `geometry.index === null` (`[N]` and `[B]`). `faceIndex` for a non-indexed mesh is `Math.floor(i/3)` where `i` is the vertex offset in the position buffer (`vendor/three/three.module.js:11873`, comment "triangle number in non-indexed buffer semantics"). Since `positions` is written in STL order, **`faceIndex` == STL triangle id**. `[N]` proof on the demo: pick at NDC (0,0) hit `faceIndex 32779`; scene triangle 32779 equals raw STL triangle 32779 (float32) `true`.
- The material is `DoubleSide`, so a ray returns front and back faces; `[N]` 30 warm rays across the screen returned 0 or 2 intersections each, and the ray through the screen centre returned 14 (`hits: 14`, many layers of skin); the app takes `[0]` (nearest). Back-faces can therefore be picked if the camera is inside or when the nearest surface is a back face (sheet-like parts).
- Survival: axis/unit remap yes (ids unchanged); re-import of the same file yes; re-import of another file with the same triangle count keeps the OLD labelling (A-FLOW-04); project reload yes only if the file is byte-compatible in order (A-SEL-01/02).

### 2.4 Vertex welding for adjacency (`recognition.js:26-60`)

- Key = `[round(x/1e-5), round(y/1e-5), round(z/1e-5)].join(",")` on the **post-scale, post-axis metre** coordinates; `tolerance = 1e-5` default (`recognition.js:26`), never passed otherwise. Edges are keyed `min|max` of welded vertex ids; `firstEdgeUse` stores only the FIRST triangle that used an edge; later triangles that use the same edge are linked to that first one only (`recognition.js:47-56`). Neighbour lists are de-duplicated into `Int32Array`s.
- Findings `[N]`:
  - **A-SEL-05 | VERIFIED DEFECT | Medium. It is a rounding-bucket hash, not a distance tolerance, and the tolerance is absolute (not relative to model size).** `a13_bucket_straddle.mjs`: two vertices 2e-9 m apart that straddle a rounding boundary (x = 0.5e-5 -/+ 1e-9) are NOT welded: `adjacency: [[],[]]`; two vertices 8e-6 m apart in the same bucket ARE welded `[[1],[0]]`. Scale: the same demo at unit scale 0.001 (a 37 mm model) welds 53,946 unique vertices instead of 98,850 and yields 84,436 "degenerate" triangles (`a14_scale_topology.mjs`, and `[B]` mesh warnings panel 27,545 / 57,598 / 84,436). Exact float32 equality gives 98,895 unique vertices; the 1e-5 bucket merges 45 distinct vertices. Consequence: adjacency (hence region growth) and every topology number depend on unit scale and on where vertices fall relative to a grid. For the demo at unit scale 1 only the first effect is visible (80 collapsed triangles); for small models the graph becomes wrong.
  - **A-SEL-06 | VERIFIED DEFECT | Medium. Adjacency is fragile (synthetic `[N]` `a12_synthetic_adjacency.mjs`):**
    ```
    3 T-junction (vertex on the interior of a neighbour's edge)   adjacency: [[],[2],[1]] -> grown from 0 : [0]
    4 coplanar neighbour with opposite winding (flipped normal)   adjacency: [[1],[0]]    -> grown from 0 : [0]
    5 three triangles on one edge: seed=1 (does 1 reach 2?)       adjacency: [[1,2],[0],[0]] -> grown from 1 : [1]
    ```
    A T-junction leaves the big triangle with no neighbours at all; a neighbour with flipped winding is adjacent but fails the `dot(normals) >= cos` test (`recognition.js:87`: no `abs`), so a single flipped face punches a hole in a region; on a 3-way (non-manifold) edge the 2nd and 3rd triangles are not linked to each other (only to the first user of the edge). Demo adjacency degree histogram `[N]` (index = #neighbours): `0,5,66,197641,56,4` -> 197,641 of 197,772 triangles have exactly 3 neighbours; 5 have 1, 66 have 2 (boundary/degenerate), 56 have 4 and 4 have 5 (non-manifold areas). So the demo is almost entirely a clean 3-neighbour manifold; the failure modes are rare here but invisible when they occur.
  - Orientation: winding normals agree with the stored STL normals for all 197,772 triangles (`agree 197772 disagree 0`), so growth is not hampered by flipped faces on the demo.
  - **A-SEL-13 | VERIFIED | Info/Medium. The whole aircraft is one edge-connected shell.** `[N]` `a15_components.mjs`: exact-weld vertex-connected 1 component (197,772), exact-weld EDGE-connected 1 component, app-weld edge-connected 1 component. `computeTopology`'s component count is vertex-connectivity (`geometry.js:168-171` unions triangles through shared vertices), which is weaker than edge-connectivity and merges bodies touching at a point. Consequence: "connected region" gives no help in separating wing/fuselage/tail/nacelles on a fused tessellation; part identity can only come from the user or from dihedral/curvature segmentation.

### 2.5 Region-growth algorithm (`recognition.js:62-95`)

- Algorithm: BFS with an array queue; visited = the `selected` `Set`; per-triangle normals computed lazily and cached in a `Map` (`recognition.js:67-76`). A neighbour joins if **both** `dot(n_current, n_neighbour) >= cos(angle)` (local dihedral) **and** `dot(n_seed, n_neighbour) >= cos(angle)` (distance from the seed normal); stops when `selected.size >= limit` (default 15,000). Complexity O(R x deg) with Map/Set overhead; `[N]` 0.1 ms (123 tris), 5.6 ms (15,000, cap), 40 ms (77,591 tris).
- Because of the cap and BFS order, a capped region is a spatial blob around the seed, not a surface patch.
- **A-SEL-03 | VERIFIED DEFECT | Medium (DESIGN RISK for the requirement). Regions are seed-dependent, not a partition.** `[N]` `a6_wing_regions.mjs`: seven seeds on the right-wing upper skin gave **7 of 7 distinct regions** (sizes 315, 343, 433, 303, 389, **1**, 367); union of all seven = 452 triangles. A seed that lands on a sliver gives a 1-triangle selection (face 103997). The refs rule (BFS, adjacent-face dihedral <= 30 deg, no seed criterion) is far worse on this tessellation: `[N]` `a16_local_only.mjs`:

  | Seed | local-only BFS @30 deg | local-only @18 deg | app (local+seed) @30 | app @18 |
  | --- | --- | --- | --- | --- |
  | wing upper skin (6299) | **123,273** | 120,949 | 675 | 433 |
  | h-tail upper (95878) | **123,273** | 120,949 | 389 | 227 |
  | v-tail side (13754) | **123,273** | 120,949 | 751 | 567 |
  | fuselage crown (22319) | **123,273** | 120,949 | 3,221 | 1,758 |
  | fuselage side (29577) | **123,273** | 120,949 | 37,982 | 32,476 |

  All five seeds sit in the same smooth-connected component of 123,273 triangles (62.3 % of the mesh). The literal requirement algorithm ("flood fill neighbours with dihedral <= 30 deg") would select 62 % of the aircraft from one click on this STL; the seed-normal criterion is the only thing preventing it. Segmentation by local dihedral alone (`a5_wing_scan.mjs`): 5 deg -> 11,254 regions (largest 91,391), 10 deg -> 2,100, 18 deg -> 1,133 (largest 120,949; 848 regions have <=10 triangles), 30 deg -> 739 (largest 123,273), 45 deg -> 494 (largest 123,579).
- Angle sweep on one wing seed (6299, cap 100,000), `[N]` `a7_wing_angles.mjs`: 10 deg 198 tris; 18 deg 433; 25 deg 567; 30 deg 675; 35 deg 780; 40 deg 919; 45 deg 1,055; 50 deg 1,171; 60 deg 2,877. At 18 deg one click on the right-wing upper skin covers lateral 2.1-17.0 m, x 13.3-22.1 m: a strip of one skin of one half-wing. Larger angles on other seeds leak (`a4_region.mjs`: at 90 deg every seed selects 64,435-77,591 triangles; the h-tail seed at 90 deg selects 77,380 spanning x 0-37.4 m, i.e. the whole aircraft).
- Default 18 deg and 15,000 cap vs refs 30 deg: parameters are user-editable (`growAngleInput` 0-90, `maxRegionFacesInput` up to 100,000), not a ctrl-modifier distinction.

### 2.6 Selection state and Ctrl semantics (`app.js:489-523`)

- `selected` is a `Set<number>` of triangle ids. A click without Ctrl replaces the selection; with Ctrl/Meta every triangle in the grown region is toggled individually (`app.js:514-518`): `if ctrl && selected.has(t) delete else add`.
- **A-SEL-04 | VERIFIED DEFECT | Medium. Ctrl+click is a per-triangle XOR, not "add".** `[B]` harness, picks at the right-wing upper skin: selection size after each click (first click plain, rest Ctrl): **343, 108, 393, 100, 371, 2047**. The second Ctrl+click made the selection SHRINK from 343 to 108 because it overlapped the first region (|A|=343, |B|=433, overlap 334 => 343+433-2x334 = 108). Consequence: when region seeds overlap (which they do, A-SEL-03) the user removes what they meant to add, and the status line only says "Selected 108 triangles".
- **A-SEL-12 | MISSING | Medium (vs refs 3.1).** There is no `Shift` handling anywhere (`grep -n shiftKey src/app.js` empty). Mapping to the requirement: single triangle = click with "Region grow" unchecked (not Ctrl+Click); flood fill = click with it checked (not Ctrl+Shift+Click); the 30 deg limit is a user input defaulting to 18.
- `selected` is not persisted and not cleared on re-import of an equal-count mesh (A-FLOW-04, A-SEL-14).

### 2.7 Highlighting (`app.js:470-487`)

- Mechanism: a single `color` `BufferAttribute` (Float32, 3 per vertex) on the non-indexed geometry; `updateMeshColors()` loops over all triangles and writes the same RGB to each of the triangle's 3 vertices, selection colour `(1, 0.78, 0.08)` over component palette `[grey-blue, blue, green, orange, grey]`; then `color.needsUpdate = true` (whole 7,119,792-byte buffer re-uploaded; no `addUpdateRange`).
- **Because the geometry is non-indexed, colour cannot bleed into neighbouring triangles.** `[B]` after assigning 2,047 wing triangles: painted-wing-blue triangles 2,047, non-wing triangles painted wing-blue 0, triangles with mixed vertex colours **0**. Had the geometry been indexed (shared vertices), per-vertex colouring would have bled across face boundaries; this is the specific trap in the refs design ("directly update the vertex-colour BufferAttribute") if BVH/indexed geometry is introduced (see A-LIB-02).
- **A-SEL-09 | VERIFIED | Low.** Differences from the requirement: selected colour is yellow `(1,0.78,0.08)` not `#FF6600`; on-screen colour is additionally multiplied by `MeshStandardMaterial` lighting; the update is O(N) (5.5 ms CPU + 7.1 MB GPU upload per click) instead of touching only changed triangles; selected and assigned colours share one attribute with no overlay/outline.

### 2.8 Assignment, reference geometry, VLM coupling

- `assignSelected` writes the label into `assignments[tri]` for every selected id (`recognition.js:97-102`); overwriting earlier labels without undo; then `buildRecognitionReport` recomputes `computeSurfaceReference` for each of the 4 labels (`recognition.js:217-225`) and, if the wing is `valid`, overwrites the reference inputs (A-FLOW-02) and re-runs the VLM.
- `computeSurfaceReference` bins the assigned triangles' vertices by lateral coordinate into `clamp(sqrt(n),12,120)` bins, takes min/max x per bin as leading/trailing edge, integrates chord for S and MAC, and takes "root" = the stations closest to `centerY`, where `centerY = 0` only if the selection straddles `y=0` else the mid-span of the selection (`recognition.js:174-176`).
- **A-SEL-11 | VERIFIED DEFECT | High. Bad selections become "Recognized wing" and drive the VLM with no plausibility gate.** `valid` is `warnings.length===0 || areaM2>EPS` (`recognition.js:196`), true whenever any area exists; the only warnings are aspect ratio outside 0.5-30 and a double-skin note. Evidence:
  - `[N]` the single largest wing click (433 triangles, one skin, one half-wing): `span 14.88, area 32.69, MAC 3.26, valid true` (the aircraft's true span is 33.98 m, and "span" is used as the full span by the VLM, `readMainSurface`, `app.js:358`).
  - `[B]` five wing-area clicks plus one more click that pulled in a big region, assigned as "wing" (2,047 triangles; bounds x 3.0-37.39, lateral -0.19-16.96, vertical 2.1-5.25): reference S 74.361 m2, span 17.154 m, **MAC 21.722 m, root chord 32.419 m, tip chord 17.638 m** (the aircraft is 37.4 m long); badge "Recognized wing", no warning (`wing.warnings` = `[]`); VLM ran: "Static margin -57.1 % Unstable, NP 4.877 m, CL alpha 8.768 /rad".
  - Consequence: the quantity users will trust most (stability verdict) is computed from whatever was selected; there is no check for symmetry, span vs bounds, chord vs fuselage length, or triangle coverage.

### 2.9 Persistence (`projectState.js`, `app.js:806-862`)

- Stored: `schema`, `version 1`, `savedAt`, `workflowStage`, `source {name, triangleCount, unitScale, axisMapping}`, mass manifest, `recognition {assignmentsRle: [[value,count],...], report}`, `controls` (the 22 `CONTROL_IDS` values), stripped VLM. `[B]` snapshot 12,536 bytes (RLE 509 runs = 3,322 bytes; report 8,554 bytes); autosave 13,033 bytes. The 2,047-triangle selection compresses to 509 runs because triangle ids of one region are not contiguous in the file.
- **Mesh fingerprint = `source.triangleCount` (integer) only.** `restoreAssignments` throws only if counts differ (`projectState.js:35-41`). No hash of coordinates/order, no file size, no name check except the demo special-case (`openProject`, `app.js:807`).
- **A-SEL-01 | VERIFIED DEFECT | High. Triangle-index persistence with a count-only fingerprint.** Any STL with the same triangle count but different geometry or order (re-exported file, mesh repair that preserves count, re-sorted triangles, a different aircraft) loads the old labelling silently onto unrelated triangles. `[B]` I opened a project JSON whose `source.name` was `some_other_aircraft.stl` against the loaded `samolot.stl`: accepted (`sourceNameInState: "samolot.stl"`, `pendingProject:false`), 2,047 assignments applied, VLM run. By construction the same would happen for a genuinely different file of equal triangle count. Conversely a repaired/decimated mesh (count changed) simply cannot reuse its labelling, with only a thrown error. The RLE order dependence means even a pure re-ordering destroys the labels.
- **A-SEL-02 | VERIFIED DEFECT | High. Project open ignores the project's unit/axis for every path except "demo by name".** `openProject` (`app.js:806-817`): demo name -> `loadDemo(project)` -> `setAxisControls(project.source...)` (correct); same triangle count already loaded -> `restoreProjectState(project)` which restores manifest, assignments, `controls` but NOT `source.unitScale`/`axisMapping` (those are not in `CONTROL_IDS`); other -> `pendingProject` and `loadStlBuffer(..., project)` applies them. `[B]`: UI unit select set to 0.001, then opening a project that declares `unitScale: 1` with a matching triangle count: afterwards `unitSelectValue "0.001"`, reference span **0.017 m**, area 0.000, VLM "CL at 0 deg 18.522", "CL alpha 665.028 /rad", status "VLM solved 17 cases with 24 panels". Nothing flags the contradiction.
- **A-FLOW-03** (companion doc): autosave restores silently for the demo name only and overwrites a single slot.
- What happens when the mesh changes: different count -> `restoreAssignments` throws "Project expects N triangles; loaded STL has M." For the demo name at boot (`bootstrap`) the throw is caught as "Startup failed: ..." (`app.js:94-97`) after geometry is already rebuilt and an autosave timer has been armed with an empty labelling (by code reading `[S]`: `remapCurrentGeometry` -> `updateMassAnalysis` -> `scheduleAutosave` before `restoreProjectState` throws), so the prior labelling is then overwritten after 800 ms without notice (not separately executed).

### 2.10 What identities the app actually has

| Level | Exists? | Where / how |
| --- | --- | --- |
| Triangle index (== STL order == `faceIndex`) | **Yes**, the only stable id | non-indexed geometry; `Uint8Array(N)` of labels |
| Connected mesh regions | Partial, transient | BFS result `Set` from one click; never named/persisted; `computeTopology.componentCount` is vertex-connected and is 1 on the demo |
| Smooth patches / dihedral segments | No | no segmentation pass (only my diagnostic `a5`) |
| Logical CAD surfaces (B-rep faces) | **No** | STL has none; MVP doc defers B-rep (FS-02/03) |
| Named components | 4 fixed labels (wing, H-tail, V-tail, fuselage); no names, no instances (left/right wing, multiple nacelles, flaps), no hierarchy | `COMPONENT_TYPES`, `recognition.js:3-9` |
| CFD boundary patches (`VELOCITY_INLET`, `PRESSURE_OUTLET`, `WALL_NOSLIP`, `SYMMETRY`) | **No** | grep finds none; no domain geometry either |
| Export of patches (multi-solid STL / per-patch STL / JSON manifest) | **No** | `serializeBinarySTL` (`stlParser.js:64`) writes ONE binary solid, is only used by tests, and has no UI; ASCII import discards `solid` names |

- **A-SEL-07 | MISSING | High (vs refs 3.2, 5.2).** There is no persistent surface/patch object (id, name, type, triangle ids, tags), no boundary tag, no fluid domain, and no exporter that could turn the 4-label array into solver patches. The labels also lose information needed for CFD: wing and H-tail are lumped into "component types", not into patches for `WALL_NOSLIP`/`SYMMETRY`; there is no left/right distinction; fuselage vs nacelles vs pylons cannot be separated; a triangle can have only one label. snappyHexMesh/Gmsh pipelines need per-patch geometry (general knowledge, not verified in this repo): a binary STL cannot carry patch names at all; named patches need multi-solid ASCII STL or one file per patch.

### 2.11 Picking performance (see also companion doc 7.3)

- **A-SEL-08 | DESIGN RISK | Low (now) / Medium (scaling). Brute-force raycast, no acceleration.** `Raycaster.intersectObject(mesh,false)` runs stock `Mesh.raycast` (bounding-sphere early-out, then every triangle; `geometry.boundingBox` is `null` so no box test): `[N]` 6.4-7.9 ms per ray (median 6.5) for 197,772 triangles, 0.01 ms for a miss; `[B]` full warm pick 18.7-32.2 ms (raycast + growth + colour pass + DOM); first pick 942 ms because adjacency is built lazily in the click handler. A new `Raycaster` and `Vector2` are allocated per pick (`app.js:492-496`, minor). At 2 M triangles the ray alone would be ~65 ms (extrapolation).

### 2.12 Camera and interaction constraints

- **A-SEL-10 | DESIGN RISK | Medium.** The orbit controller (`app.js:413-450`) rotates about a fixed target (bounds centre), has wheel zoom toward that target only, **no pan**, no zoom-to-cursor, no touch, no focus-on-selection, no clipping control. Selection mode disables orbiting (`app.js:420`), so a user must toggle modes to rotate. Fine selection of a small feature (winglet, control-surface edge) is only possible to the extent it is visible at the orbit radius (min radius 0.5 m about the aircraft centre, i.e. inside the fuselage). The camera matrix used for picking is refreshed only inside `render()` (A-LIFE-06). Reproduce: read `app.js:413-450`.
- **A-SEL-14 | DESIGN RISK | Low.** Axis/unit/scale changes keep `selected` and re-colour; re-import of an equal-count mesh keeps old `assignments` and `selected` (A-FLOW-04); mirror/axis choices can show the model mirrored without indication.

## 3. Feasibility of the refs-proposed libraries in THIS stack (three-mesh-bvh, three-bvh-csg)

I did not install or download either package (instruction), so everything here is from the npm registry metadata and project README text fetched on 2026-10-23 plus my background knowledge; it is NOT an executed test. Treat every "would" as unverified.

### 3.1 Versions and peer ranges `[W]` (registry.npmjs.org JSON)

| Package@version | `peerDependencies` | Notes |
| --- | --- | --- |
| three-mesh-bvh@0.6.8 | `three >= 0.151.0` | ES module, `module: src/index.js`, `main: build/index.umd.cjs` |
| three-mesh-bvh@0.7.8 | `three >= 0.151.0` | same; **72 source files (274,380 bytes) under `src/`, plus a pre-bundled `build/index.module.js` of 192,180 bytes** |
| three-mesh-bvh@0.9.16 (npm `latest`) | `three >= 0.159.0` | has an `exports` map (`.`, `./src/*`, `./webgpu`, `./worker`) |
| three-bvh-csg@0.0.16 (2024-01-07) | `three >= 0.151.0`, `three-mesh-bvh >= 0.6.6` | |
| three-bvh-csg@0.0.17 (2025-04-04) | `three >= 0.151.0`, `three-mesh-bvh >= 0.6.6` | **33 source files, 91,818 bytes** under `src/` |
| three-bvh-csg@0.0.18 (npm `latest`, 2026-02-17) | **`three >= 0.179.0`**, `three-mesh-bvh >= 0.9.7` | **peer range excludes the vendored r160** |

- **A-LIB-01 | UNVERIFIED CLAIM | Medium.** three-mesh-bvh: nominally compatible with r160 across 0.6.x-0.9.x by peer range (0.9.16 requires >= r159, so r160 is at the edge). Not runtime-tested. three-bvh-csg: **only <= 0.0.17 is compatible with r160; the current `latest` (0.0.18) requires three >= r179** and would force upgrading the vendored three by ~19 revisions. A pairing consistent with r160 and the peer ranges: `three-mesh-bvh@0.7.x` + `three-bvh-csg@0.0.16/0.0.17` (peers are minimums, so the combination should resolve, but three-bvh-csg 0.0.17 postdates r160 and may rely on newer three-mesh-bvh APIs than 0.7.x; unknown without a test).
- Loading without a bundler: neither README documents a no-bundler/CDN recipe (README text fetched; examples use `import ... from 'three'`). The code is plain ES modules; both import the bare specifier `'three'` (three-bvh-csg also `'three-mesh-bvh'`; `Evaluator.js` imports `{ BufferAttribute } from 'three'` and sibling files with relative paths). In a browser without a bundler that requires an **import map** and vendored copies, e.g. (not tested):

```html
<script type="importmap">
{ "imports": {
  "three": "/vendor/three/three.module.js",
  "three-mesh-bvh": "/vendor/three-mesh-bvh/build/index.module.js",
  "three-bvh-csg": "/vendor/three-bvh-csg/src/index.js"
} }
</script>
<!-- must appear before any <script type=module>; index.html currently has none -->
```

  Single-instance hazards specific to THIS repo: (1) the map target for `three` must resolve to the same absolute URL as app.js's existing dynamic import (`../vendor/three/three.module.js` from `/src/app.js` -> `/vendor/three/three.module.js`); any `?v=` suffix on either would create a second three.js instance and break `instanceof`/prototype patching (A-ARCH-03/04 show the repo already creates duplicate instances for `recognition.js`); (2) three-mesh-bvh patches `BufferGeometry.prototype`/`Mesh.prototype.raycast` on the instance it was imported against, so the `Mesh` used by the app must come from the same module instance; (3) to my knowledge newer three releases (>= r171) split into `three.module.js` + `three.core.js`, so upgrading three for three-bvh-csg 0.0.18 would require vendoring both files (verify). Vendoring cost: 0.7.8 is 72 files unbundled or 1 bundled file (192 KB, `three` kept external) + three-bvh-csg 33 files (92 KB).
- **A-LIB-02 | UNVERIFIED (documented side effect) | High HAZARD.** The three-mesh-bvh README states: "A bounds tree can be generated for either an indexed or non-indexed BufferGeometry, but an index will be produced and retained as a side effect of the construction unless the 'indirect' option is used." The app's invariant is `faceIndex == STL triangle id` on a **non-indexed** geometry. Building a default BVH (`computeBoundsTree()`) would give the geometry an index buffer built (and, I expect but have not verified, reordered) for BVH leaf order; the raycast `faceIndex` would then be a position in that new index order, not the file order, so all stored labels (`Uint8Array` by triangle id, RLE in projects) would silently map to the wrong triangles while the code keeps working. Mitigations to test: use the `indirect: true` build option (leaves the geometry index untouched; availability by version not verified; README fetched does not say how `faceIndex` is reported in that mode), or recover the original id as `index.getX(3*faceIndex)/3` for a default build, or store an explicit per-triangle id attribute. The README fetched does not mention `faceIndex` at all, so the mapping is undocumented there. Also: the BVH build for ~200 k triangles is a main-thread cost unless the `GenerateMeshBVHWorker` (`three-mesh-bvh/worker`, README: bundler support for worker syntax "inconsistently supported") is used; `raycaster.firstHitOnly = true` is the documented way to return the first hit.
- **A-LIB-03 | UNVERIFIED CLAIM | High (vs refs 5.3). three-bvh-csg and face identity.** From the 0.0.17 source/README fetched:
  - Inputs: "Brush geometry must be two-manifold, or watertight with no triangle interpenetration"; results "may not be fully two-manifold" (README). **The demo STL does not satisfy this** (`[N]`: exact-weld 28 boundary edges, 5 four-use edges, 4 coincident reverse-wound triangle pairs, 10 directed edges used more than once). So the A320 mesh cannot be used as a CSG brush without repair; only generated, constructed-watertight parametric parts could.
  - Output geometry: `Evaluator.js` builds per-group typed arrays and writes `BufferAttribute`s with `geometry.drawRange` set from the vertex count; it "never writes a new index" (an existing target index is overwritten with an identity sequence or set to null), so the result is **non-indexed with a `drawRange`** unless the target brush already had an index. README "Gotchas": results use `Geometry.drawRange`, "which can break three.js exporters". Implication for the refs' "union -> binary STL export": any STL writer must honour `drawRange` (vendor/three has no `STLExporter`; the repo's `serializeBinarySTL` takes a JS triangle array, not a geometry).
  - Attributes: default `attributes = ['position','uv','normal']`; `prepareAttributesData` "deletes other keys from the target" (code reading of `Evaluator.js`), so a custom per-triangle id attribute and the vertex `color` attribute are dropped unless added to `evaluator.attributes`; how custom attributes are interpolated across split triangles lives in `operations.js`/`TriangleSplitter.js`, which I did not read. A per-triangle-constant attribute would interpolate to the same constant in any linear scheme, but that is an inference, not verified.
  - Groups: `useGroups` defaults true; groups correspond to brush materials (brush b's material indices are offset by the length of brush a's list), `consolidateGroups` merges groups sharing a material. So identity survives only at **brush/material granularity** (one material index per tagged piece), not per original triangle. Intersecting triangles are split, so triangle counts and ids change; no source-triangle provenance is documented or retained ("HalfEdgeMap ... TODO", README).
  - Consequence for the face-tag model: tags assigned to triangle ids BEFORE a union cannot be carried through the union by triangle id; tags must be encoded as materials/groups per component (e.g. one `Brush` per wing/fuselage/tail with its own material index) or re-derived after the union by spatial selection. Fluid-domain faces (6 box faces) never need CSG and can be generated pre-tagged.
- **A-LIB-04 | UNVERIFIED | Medium.** three-mesh-bvh `MeshBVH` also needs the same geometry object not to be mutated after build (README for three-bvh-csg: "Brush geometry should not be modified after it is set"); the current app mutates the colour attribute in place (fine for the BVH, which only reads positions) but replaces the whole geometry on every import/remap, so BVH dispose/rebuild (`disposeBoundsTree`) must be added to the re-import path in `renderMesh` (`app.js:453-457`).

Feasibility verdict: **technically feasible without a bundler via import maps and vendored files, with pinned versions (three-mesh-bvh 0.7.x/0.8.x/0.9.x; three-bvh-csg <= 0.0.17 while three stays r160), but both introduce identity hazards (A-LIB-02, A-LIB-03) that the current persistence model cannot survive unchanged**, and CSG on the existing demo STL is not supported by the library's own input requirements. All compatibility statements remain to be confirmed by an install-and-run test (not done here).

## 4. Implications for the next phase (inference, not implemented)

These follow from the evidence above and are only suggestions for the coordinator; none were implemented.
1. Decouple face identity from GPU/array order: keep an explicit `triId` per triangle and fingerprint the mesh with a content hash (e.g. over quantised welded vertices + connectivity), not a count (A-SEL-01/02).
2. One shared exact-bit (or relative-tolerance) weld that produces an indexed topology, used by topology stats and adjacency; exclude degenerate triangles from edge counts (A-GEO-01, A-SEL-05/06).
3. Treat the refs flood-fill rule as insufficient on fused tessellations (A-SEL-03: 62 % of the demo from any seed); keep the seed criterion or segment into smooth patches first and select patches.
4. Introduce a patch/surface object model (id, name, class, tags, triangle ids) and exporters (per-patch STL / multi-solid ASCII STL / JSON manifest) before any boundary-condition UI (A-SEL-07).
5. Make picking acceleration identity-preserving (A-LIB-02) and add a plausibility gate on derived reference geometry (A-SEL-11).

## 5. Appendix A: selection diagnostics, exact commands and real output

Run from any directory: `node /tmp/claude-1000/-home-tanvir-Coding-AirFLOW/76bf9998-d405-4391-a3a5-0698b59e1664/scratchpad/auditA/<script>`.

`a4_region.mjs` (seeds by raycast; the downward ray at x=20, lateral 8 m missed the wing, which is a narrow-chord region at that station)
```
wing upper skin (x=20, span z=+8, ray from above) -> MISS

== fuselage crown (x=15, z=0, from above): faceIndex 22319, hits along ray 2
  angle 18 cap  15000 ->   1758 tris  2.0 ms  x[3.0,33.0] lat[-0.8,0.6] vert[4.8,5.3]
  angle  5 cap  15000 ->    123 tris  0.1 ms
  angle 30 cap  15000 ->   3221 tris  1.7 ms
  angle 60 cap 100000 ->  12891 tris 15.0 ms  x[0.1,37.4] lat[-1.7,1.7] vert[2.7,11.2]
  angle 90 cap 100000 ->  77591 tris 40.1 ms
== h-tail upper (x=34, z=+3.5, from above): faceIndex 95878
  angle 18 -> 227 tris x[32.3,36.7] lat[0.8,6.2] vert[4.0,4.7] ; 5 -> 33 ; 30 -> 389 ; 60 -> 849 ; 90 -> 77,380 (x[-0.0,37.4])
== v-tail side (x=34, y=7, from +z side): faceIndex 13754
  angle 18 -> 567 tris x[30.0,36.6] lat[0.0,0.3] vert[5.1,11.2] ; 5 -> 299 ; 30 -> 751 ; 60 -> 1,407 ; 90 -> 64,435
== fuselage side (x=10, y=3.5, from +z): faceIndex 29577
  angle 18 cap 15000 -> 15000 tris [CAP HIT] ; 5 -> 12,036 ; 30 -> 15,000 [CAP HIT] ; 60 (cap 100k) -> 43,052 ; 90 -> 71,534
```

`a5_wing_scan.mjs`
```
downward scan at lateral=+8 m: x=16 top y=3.14 face 6660 ; x=18 top y=3.15 face 6646 ; other x: miss (wing chord at that station)
local-dihedral-only segmentation @5 deg: 11254 regions; top 8 sizes 91391,4870,4255,2240,1646,1551,1365,1334; regions with <=10 tris: 10458
@10 deg: 2100 regions; top 117546,5436,5205,...
@18 deg: 1133 regions; top 120949,5503,5382,4104,4088,1763,1753,871; regions with <=10 tris: 848
@30 deg: 739 regions; top 123273,5544,5448,4106,4091,1785,1785,314; <=10 tris: 462
@45 deg: 494 regions; top 123579,9667,5682,4538,4091,3603,314,314; <=10 tris: 242
```

`a6_wing_regions.mjs`
```
wing-ish upper-surface seeds found: 7
seed face 5744 (x=17, lat=3): 315 tris | 6629 (17,6): 343 | 6299 (17,9): 433 | 5774 (19,9): 303 | 5788 (19,12): 389 | 103997 (21,12): 1 | 6740 (21,15): 367
union of all grown wing regions (18 deg, cap 15000): 452 triangles
distinct regions among seeds: 7 of 7
reference from union: span 14.89 area 37.98 MAC 3.29 root chord 2.32 tip chord 3.13 sweep 22.3 warnings []
reference from the single largest click: tris 433 span 14.88 area 32.69 MAC 3.26 valid true
```

`a7_wing_angles.mjs` (seed 6299): `10: 198 ; 18: 433 ; 25: 567 ; 30: 675 ; 35: 780 ; 40: 919 ; 45: 1055 ; 50: 1171 ; 60: 2877` triangles (lateral extent 2.1-17.0 m up to 50 deg; 1.9-17.0 at 60).

`a12_synthetic_adjacency.mjs` and `a13_bucket_straddle.mjs`: outputs quoted in 2.4.

`a16_local_only.mjs`: table in 2.5.

Browser (harness) JavaScript executed, verbatim (each in the `javascript_tool`, page `http://127.0.0.1:4190/`):

1. Pick timing (after `s.camera.updateMatrixWorld(true)`; `s = window.__state`):
```js
document.getElementById('selectionModeButton').click();   // earlier call; mode on
const target = clientFor(17, 3.3, 9);                        // Vector3.project(camera) -> client px
function pick(cx,cy,ctrl=false){ const t0=performance.now();
  canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:cx,clientY:cy,pointerId:1,bubbles:true}));
  canvas.dispatchEvent(new PointerEvent('pointerup',{clientX:cx,clientY:cy,pointerId:1,ctrlKey:ctrl,bubbles:true}));
  return performance.now()-t0; }
// result: firstPickMs 942.4, selected 433, status "Selected 433 triangles", adjacencyBuilt true
//         warmPickMs [32.2,22.5,19.2,18.7,24], selectedAfter 373
```
2. Ctrl-click XOR and wing assignment: plain click at (17,3.0,6) then Ctrl+click at (17,3.3,9), (19,3.17,9), (19,3.57,12), (21,3.7,15), (17,2.6,3.5), then `document.querySelector('[data-assign="wing"]').click()`.
   Result: `sizesAfterEachClick [343,108,393,100,371,2047]`; summary "Wing | 2,047 faces | 17.15 m span, 74.36 m2"; reference S 74.361, span 17.154, MAC 21.722, root 32.419, tip 17.638, sweep 22.90, dihedral 2.01, root LE x 3.391; badge "Recognized wing"; VLM "Static margin -57.1 % | Unstable | NP 4.877 | trim -0.72 | CL alpha 8.768 | Cm alpha 5.007"; `wing.warnings []`; wing bounds x[3.00,37.39] lateral[-0.19,16.96] vertical[2.10,5.25]; projectedAreaSum 74.75, triangleArea 76.95.
3. Stale plot test: hash `getImageData` of both canvases, set `densityInput` to 1.0 and dispatch `input`: before/after hashes identical (polar 1609633315, pitch 1391751342), badge "VLM current" -> "Inputs changed", `neutralPointInput` stays 4.877.
4. Project open mismatch: built `proj = JSON.parse(JSON.stringify(createProjectSnapshot({...s, controls:{}})))` with `proj.source.name='some_other_aircraft.stl'; proj.source.unitScale=1`; set `unitScaleSelect.value='0.001'` + `change`; then set `projectFileInput.files` via `DataTransfer` and dispatch `change`. Result: `sourceNameInState "samolot.stl"`, `unitSelectValue "0.001"`, span 0.017, area 0.000, status "VLM solved 17 cases with 24 panels", stability panel "Static margin -64.6 % ... CL alpha 665.028 /rad ... CL at 0 deg 18.522 | CDi at 0 deg 3.4373".
5. Re-import: click `#loadDemoButton` => total 793 ms; afterwards wing faces still 2,047, `selected` 0, unit select `0.001`, span 0.017 (A-FLOW-04).
6. Reference overwrite: set `refMacInput` 9.99 + `input`; dispatch `change` on `axisLongitudinal` => MAC 21.722, badge "Recognized wing", VLM auto-ran; set 9.99 again + click `#clearAssignmentsButton` => MAC 4.193, badge "Bounds seed - verify", solver badge "Inputs changed".
7. Reload with autosave: unit select `0.001`, wing faces 2,047, span 0.017, same absurd stability panel; `localStorage.removeItem('airflow.browser-project.autosave')` executed afterwards to leave the browser clean.
8. Colour check: for each triangle compare the 3 vertex colours; `trianglesWithMixedVertexColours: 0`, `paintedBlue_forWing: 2047`, `paintedBlue_forNonWing: 0`.

Harness files (scratchpad copy only): `harness/src/three_stub.js`
```js
export * from "../vendor/three/three.module.js";
export class WebGLRenderer {
  constructor() { this.domElement = document.createElement("canvas"); this.frames = 0; window.__renderer = this; }
  setPixelRatio() {}
  setSize(w, h) { this.domElement.width = w; this.domElement.height = h; }
  render(scene, camera) {
    if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();
    if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
    this.frames += 1;
  }
}
```
and in `harness/src/app.js`: `const THREE_LOCAL = "./three_stub.js";` and, before `initAxisControls();`, `window.__state = state; window.__nav = {growSelection, buildTriangleAdjacency};`.

## 6. Finding index (this document)

A-UI-01..06, A-SEL-01..14, A-LIB-01..04 as defined above. Severity roll-up: High - A-SEL-01, A-SEL-02, A-SEL-07, A-SEL-11, A-UI-01, A-LIB-02 (hazard), A-LIB-03; Medium - A-SEL-03, A-SEL-04, A-SEL-05, A-SEL-06, A-SEL-10, A-SEL-12, A-SEL-13, A-UI-02, A-UI-04, A-UI-05, A-LIB-01, A-LIB-04; Low - A-SEL-08, A-SEL-09, A-SEL-14, A-UI-03, A-UI-06.

Unresolved questions for the coordinator:
1. Does the requirement's "Ctrl+Shift+Click BFS <= 30 deg" intend adjacent-face dihedral only? On this STL that rule selects 62 % of the aircraft from any seed (A-SEL-03).
2. Is the demo A320 STL expected to be the CSG/export source? It fails three-bvh-csg's input requirements (A-LIB-03).
3. Confirm by an install-and-run experiment (outside this audit's allowed actions): BVH `faceIndex` semantics with default vs `indirect`, three-bvh-csg 0.0.17 with three-mesh-bvh 0.7.x on r160, and custom attribute survival through `Evaluator`.
4. WebGL rendering, GPU timings and visual correctness of the viewport were never observed (browser pane has no WebGL); a run on a GPU machine is needed to confirm A-SEL-09/10 visually.
