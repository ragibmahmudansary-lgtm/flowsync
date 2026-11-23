# FlowSync — Project Handoff Documentation

| Field | Value |
|---|---|
| Doc version | 1.0 |
| Applies to | FlowSync v1.0.0-beta (flowsync-v2 codebase) |
| Owner | Project Lead |
| Status | Living document (update per Master Plan §7.12) |
| Audience | Incoming engineers, reviewers, researchers |
| Supersedes | All ad-hoc phase notes and chat-derived specs |

**Contents:** 1 Identity · 2 History · 3 Environment · 4 Architecture · 5 UI/UX · 6 Visual style · 7 Methodology & logic · 8 Equations appendix · 9 Decisions · 10 Testing/CI · 11 Error doctrine · 12 Limitations · 13 Backlog · 14 Process · 15 Onboarding · 16 Doc map & maintenance

---

## 1. Project Identity & Current Status

FlowSync is a **preliminary aircraft aerodynamic analysis platform**: it transforms an imported aircraft CAD model into validated VLM results and a professional engineering report, automating every step where practical while keeping mandatory manual-override safety nets.

- **Is:** VLM-based preliminary design tool (XFLR5/AVL class), web-delivered (React + Three.js); Electron desktop planned post-beta.
- **Is not:** CFD solver, structural tool, optimizer, unsteady simulator (Master Plan §8.9 scope boundaries — deliberate).
- **Status:** redesign complete through Phase 6; all phase gates green; `acceptance.beta.test.ts` exercises the full pipeline in CI; v1 codebase retired under tag `legacy-v1-alpha`; v2 promoted to primary repository, tag `v1.0.0-beta`.
- **§9.7 DONE satisfied:** CAD imported → aircraft recognized → aerodynamics computed → results visualized → report generated, without manual intervention.

## 2. History & Rationale (condensed)

The Master Plan ("FlowSync Full Book") specified a C++/Qt/OpenCascade Windows desktop app. Prototyping pivoted to a web stack (React/TS/Vite/Tailwind/Zustand/React-Three-Fiber/occt-import-js/jspdf) for iteration speed and accessibility; Electron remains the post-beta desktop target (§8.9 constraints revisited at that time). v1 was built in 12 incremental feature drops and accumulated patchwork debt (cross-importing stores, environment-fragile WASM, blank-screen incidents). A from-scratch redesign (**flowsync-v2**) re-implemented every validated capability in a disciplined module architecture across gated Phases 0–6: shell → CAD pipeline → recognition → solver+stability+mass → visualization+report → AeroBot agent → project management + acceptance + cutover. Every decision is recorded in `docs/DECISIONS.md` (§4.7 process).

## 3. Repository & Environment

```bash
npm install        # postinstall → scripts/copy-wasm.mjs → public/wasm/occt-import-js.wasm
npm run dev        # Vite, host 0.0.0.0, port 5173 (strictPort=false; preview 4173)
npm run typecheck  # tsc --noEmit
npm test -- --run  # vitest (unit + integration + acceptance)
npm run build      # production bundle
```

Environment rules (learned the hard way — respect these):

- The OCCT WASM binary **must** exist in `public/wasm/`; the postinstall script copies it and tolerates absence pre-CAD-phase. Missing WASM fails at runtime, not build time.
- `vite.config.ts`: `optimizeDeps.exclude: ["occt-import-js"]`, host-exposed dev/preview servers, path alias `@/ → src/` (mirrored in the vitest config).
- **No silent failures ever:** `index.html` boot watchdog (on-screen error panel + 8 s mount timeout) → `ErrorBoundary` (render crashes) → Analysis Console (runtime stages) → structured error dialogs (§7.15).
- Node 20+, npm. CI = GitHub Actions: `npm ci → typecheck → build → test` on every push/PR.

## 4. Architecture

### 4.1 Folder map & responsibilities

```text
src/
├─ app/ErrorBoundary.tsx          # render-crash guard (red diagnostic panel)
├─ core/  types.ts (THE shared data contract) · math.ts (Vec3 ops + linreg)
├─ state/ useUIStore · useConsoleStore · useProjectStore · useGeometryStore
│         useRecognitionStore · useAeroStore · useSolverStore · useMassStore
├─ commands/ registry.ts + cad / recognition / solver / report / aerobot /
│            project commands  (single orchestration layer: UI, Ctrl+K
│            palette and AeroBot tools all call runCommand())
├─ modules/
│  ├─ cad/         faceProperties · meshSegmentation · orientation ·
│  │   importers/  faceAdjacency · occtImporter · stlImporter
│  ├─ recognition/ spanwiseAnalyzer · recognitionEngine
│  ├─ solver/      biotSavart · viscousDrag · panelGenerator · vlmSolver ·
│  │               stability · massProperties
│  ├─ report/      reportData · plotsCanvas · interpretation · pdfReport
│  ├─ aerobot/     knowledge · tools · llmClient · systemPrompt · localExpert
│  └─ project/     fsw (serialize/deserialize) · autosave (IndexedDB)
├─ ui/    AppShell · TopBar/Toolbar/TabBar/StatusBar · panels/ · dialogs/ ·
│         charts/ · viewport/ · aerobot/ · CommandPalette · ConsolePanel
├─ three/ FlowViewport · cameraRig · ImportedModelMesh · SelectionController ·
│         overlays: VlmLatticeOverlay · PanelColorMap · FlowPathlines ·
│         AxisTriad · AirflowIndicator · CgMarker · viewportCapture
└─ workers/ import.worker.ts · solver.worker.ts

tests/  cad.phase1 · recognition.phase2 · solver.phase3 · report.phase4 ·
        aerobot.phase5 · acceptance.beta · helpers/syntheticAircraft.ts
docs/   module READMEs · DECISIONS.md · BETA_ACCEPTANCE.md · HANDOFF.md
```

### 4.2 Hard architecture rules

| # | Rule | Why |
|---|---|---|
| R1 | Modules communicate **only** via `core/types.ts` contracts | §8.6 Rule 2; replaceable modules (§8.13) |
| R2 | Cross-store logic lives **only** in `commands/` | stores stay isolated; one deterministic API for UI/palette/agent |
| R3 | Heavy compute runs in **workers** (import, solver) | UI must never freeze (§6 performance targets) |
| R4 | Failures are **structured + visible**: `{code,message,hint}` → console → dialog | §7.15 no silent failures |
| R5 | No merge without a **green gate** (typecheck + tests + manual checklist) | §7.8 Definition of Done |

### 4.3 End-to-end data flow (§8.2/8.4)

```text
CAD file → [import.worker] parse → segment → orient → face DB + adjacency
         → useGeometryStore.model
         → [recognition] lumps/rules → component map → stations → reference geometry
         → [solver.worker] panels → AIC → solve → Γ, CL/CDi/CD0/Cm, spanwise, vizGamma
         → [stability/mass] neutral point, static margin, trim, CG
         → [visualization] charts · lattice · color map · pathlines · markers
         → [report] PDF + JSON (fixed template, hashed, timestamped)
         → [project] .fsw save / IndexedDB autosave / session restore
```

## 5. UI / UX Specification (FS-06)

**Layout:** TopBar (logo · File menu · project name · "Units: SI · X fwd, Y right, Z up") → Toolbar (New · Import CAD · Run Analysis · Report · view presets · ⌘K Commands) → TabBar (4 tabs) → 3-pane workspace (Project Tree | 3D Viewport | Properties Inspector) → Analysis Console (collapsible, mono, leveled) → StatusBar. Floating: AeroBot button/panel (bottom-right), Command Palette (Ctrl+K), Selection Toolbar + hint/legend chips in viewport. Dialogs: Import Summary, Session Restore, Project Settings, error panels.

**Tabs:**
1. **Geometry & Airfoils** — tree (model → faces → components → named selections), Geometry Inspector (selected-face properties, triangle/vertex statistics, orientation override buttons Rot Z90 / Flip X / Flip Z), named-selection creation.
2. **VLM Mesh & Setup** — Pipeline Health checklist (6 live rows), Recognition Inspector (run / assign / clear / confirm, wing reference table, warnings).
3. **Analysis & Flight Conditions** — Mass & CG box (compute CG, editable effective densities), Analysis Inspector (freestream, AoA sweep, panel counts, symmetry, wake-relaxation & viscous toggles, transport-equation theory card, Run + Validation with PASS/FAIL report).
4. **Results & Graphs** — Stability Verdict Box (badge + CG %MAC controls + parameter grid + ✓/✗ reason lines), chart grid (CL vs α, drag breakdown, Cm vs α, drag polar, spanwise Γ, sectional cl), summary card with visualization toggles + Generate Report.

**Interaction model:**
- Camera (ANSYS-style): MMB orbit · Shift+MMB pan · RMB pan · wheel zoom · LMB reserved for selection. Presets Iso/Top/Front/Side/Reset.
- Selection: LMB select · Ctrl+LMB toggle · Ctrl+Shift+LMB flood (BFS over face adjacency, dihedral ≤ 30°) · **Box marquee** (drag; Ctrl add, Alt remove; screen-space projection of sampled vertices + centroid) · **Component/ancestor select** (whole recognized component). Selected faces = ANSYS orange; tree ↔ viewport synchronized.
- Display modes: shaded / wireframe / shaded+edges.
- Command palette Ctrl+K (fuzzy filter over the command registry).
- Shortcuts (FS-06-014): Ctrl+N new · Ctrl+O open · Ctrl+S save · F5 run analysis.
- Visualization features: labeled axis triad (X red / Y green / Z blue), airflow arrows with live AoA slider, vortex-lattice overlay, panel color map (|Γ| blue→red + legend), steady flow pathlines (cyan particles), CG (green) and neutral-point (red) 3D markers.

## 6. Visual Style

| Token | Value | Use |
|---|---|---|
| `flowsync.bg` / `.panel` / `.border` | `#EEF2F6` / `#FFFFFF` / `#C3CDD8` | light professional theme |
| `flowsync.accent` / `.accentDark` | `#FF6600` / `#C2410C` | selection, primary actions, active tab |
| `flowsync.text` / `.muted` | `#0F172A` / `#52606D` | body / secondary text |
| Fonts | Roboto (UI) · JetBrains Mono (all numerics, console, tables) | readability + column alignment |
| Component colors | wing `#4F86C6` · htail `#5FA777` · vtail `#8E7CC3` · fuselage `#9AAAB9` · unassigned `#B7C1CC` | recognition coloring |
| Markers | CG `#16A34A` · NP `#E11D48` · wind/pathlines `#06B6D4` | 3D scene semantics |

Doctrine: calm, dense engineering workspace (ANSYS Workbench-light / XFLR5 lineage); accordions fight clutter; color carries meaning only; monospace font for every number.

## 7. Engineering Methodology & Logic

### 7.1 Conventions (immutable; D-007)
Body axes **X forward (nose +X), Y right, Z up** · SI units only · relative wind **ŵ = (−cos α, 0, sin α)** (single source `freestreamDirection()` used by solver, airflow arrows and pathlines — visualization can never disagree with the math) · **Cm = −M_y/(q·S·MAC)**, nose-up positive, reference = quarter-MAC · sweep documented at **quarter-chord** (FS-04-013) · %MAC measured **aft of MAC LE** · static margin positive = stable.

### 7.2 CAD pipeline (FS-02/03) — `modules/cad/`
Parse (OCCT WASM for STEP/IGES/BREP with unit + up-vector handling and submesh flattening; dependency-free binary/ASCII STL parser) → **segment** fused shells: position-**welded** vertex adjacency + BFS with dihedral limit, adaptive angles 28°→35°→45°, hard cap 2000 regions with remainder folding (STL is non-indexed — index-based adjacency degenerates to one region per triangle and historically froze the UI) → **orient**: bbox rank (smallest dim = vertical, largest remaining = span) + tail-fin nose heuristic + handedness fix; manual Flip/Rot override retained → **face DB**: area, centroid, area-weighted normal, bbox, palette color, triangle/vertex statistics (FS-03-014) → **adjacency**: welded-vertex face graph filtered at ≤30° (feeds flood select).

### 7.3 Recognition (FS-04) — `modules/recognition/`
Union-find lumps on welded vertices; multi-lump aggregate classification, single fused solid → per-face rules (+ confidence warning). Rules: horizontal+outboard+forward → wing; +aft → htail; vertical+aft+elevated → vtail; else fuselage; regions < 1.5% total area → fuselage (struts/gear guard); multiple wing-lumps → largest wins, rest htail. **D-008:** outboard threshold = `max(0.06·yLen, 1.25·fuselageHalfWidth)` (v1's 0.18·yLen swallowed small horizontal tails). Spanwise analyzer projects **upper skin only** (n_z > 0.15) into 48 bins → span, left/right areas, root/tip chords, MAC (+ position), AR, ¼-chord sweep, dihedral, symmetry; emits `stations[]` for paneling. Manual override (assign/clear per component) + Confirm & Lock (FS-04-016); warnings = recognition report (FS-04-017).

### 7.4 Solver (FS-05) — `modules/solver/`
Cosine-spanwise × uniform-chordwise panels from stations; bound vortex at panel ¼-chord, control point at ¾-chord; AIC via Biot–Savart (finite segment + semi-infinite wake legs); no-penetration BC; Gaussian elimination with partial pivoting, pivot < 1e-12 → structured singularity error (FS-05-016); **wake relaxation** (D-009, default ON): pass 2 re-aligns trailing legs with `normalize(V∞ + w)` — the inviscid vorticity-transport (convection) reduced form of the General Transport Equation; forces `F_i = ρ Γ_i ((V∞ + w_i) × l_i)`; **CD0** (D-010): Schlichting Cf × form factor 1.35 × wetted ratio 2.05 per strip (von Kármán momentum-integral closure); CD = CDi + CD0; AoA sweep executed in worker with progress events; in-app validation harness = AR-6 rectangular wing vs lifting-line (four PASS gates required before trusting sweeps).

### 7.5 Stability & mass
Linear regression over sweep → CL_α, Cm_α; `x_np = x_ref + (dCm/dCL)|ref · MAC`; `SM = (x_cg − x_np)/MAC` (X-forward); verdict bands ±2% MAC (STABLE / NEUTRAL / UNSTABLE); trim α where Cm(cg) = 0; plain-language ✓/✗ reason lines. Mass: divergence-theorem volumes and centroids per recognized component (open-shell fallback area × 0.08 m, flagged ⚠); **effective densities** (D-005: wing 50, tails 35, fuselage 80 kg/m³, editable) lump structure + contents; CG = mass-weighted centroid → feeds stability box and 3D CG/NP markers.

### 7.6 Report (FS-07) & project persistence (FS-01)
Fixed 10-section template (D-012, reproducible: same inputs ⇒ identical report); canvas-2D figure engine; viewport PNG snapshot; **rule-based interpretation only** (no AI generation, §3.6); jsPDF with page numbering and footer `version · configHash · page x/y`; JSON structured report as secondary output; FNV-1a config hash + timestamp for traceability (FS-07-008). `.fsw` workspace = single JSON schema 1 with base64-encoded face buffers (D-014); face adjacency rebuilt on load (geometry is the single source of truth); autosave = debounced IndexedDB session record + restore prompt on boot (D-015, FS-08-012 crash recovery); recent projects in localStorage.

### 7.7 AeroBot v4 (assistant / agent)
Knowledge compendium = GLOSSARY (~40 terms, each with definition + where-in-FlowSync) + PLAYBOOKS (8 operational recipes) + THEORY (VLM math, wake transport, stability, transport-equation mapping, CFD fundamentals, conventions). System prompt carries the **index**; full content fetched via tools (`explain_term`, `how_do_i`) — RAG-style without a vector DB. Deterministic local tool executors shared with UI and palette (R2): get_project/recognition/solver/stability, run_recognition/solver/validation, set_flight_conditions/panel_settings, select_component, navigate_tab, set_view/display_mode, open_console, generate_report. Offline local expert by default; **opt-in** user-keyed OpenAI-compatible LLM loop (≤6 tool turns; key stored in localStorage only) — D-004/D-013, compliant with §3.6/§8.9 "no runtime AI services". Guided 7-step beginner tour with tab navigation; curated research links + Scholar search.

## 8. Equations Appendix (the logic, in one place)

```text
ŵ = (−cos α, 0, sin α)                            relative wind (body axes)
BC:  (V∞ + Σ_j Γ_j v_j)·n̂ = 0                    at ¾-chord control points
Biot–Savart finite segment:
  v = (Γ/4π)(r1×r2)/|r1×r2|² · [ (l·r1)/|r1| − (l·r2)/|r2| ]
Biot–Savart semi-infinite leg:
  v = (Γ/4π)(d×r0)/|d×r0|² · (1 + d·r0/|r0|)
F_i = ρ Γ_i ((V∞ + w_i) × l_i)                    panel force (Kutta–Joukowski)
CL = L/(qS) · CDi = D_i/(qS) · Cm = −M_y/(qS·MAC) · q = ½ρV²
Cf = 0.455/(log₁₀Re)^2.58 ;  CD0_strip = Cf·1.35·2.05 ;  CD = CDi + CD0
MAC = ∫c²dy/S_half ;  x_MAC = ∫x_le·c·dy/S_half ;  AR = b²/S ;  e = CL²/(π·AR·CDi)
sweep = atan2(x_q,root − x_q,tip, Δy) ;  dihedral = atan2(z_tip − z_root, Δy)
x_np = x_ref + (dCm/dCL)|ref·MAC ;  SM = (x_cg − x_np)/MAC ;  trim: Cm(cg) = 0
V