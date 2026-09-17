# FlowSync v2

**Preliminary Aircraft Aerodynamic Analysis** — v1.0.0-beta

A web-based tool for importing aircraft CAD geometry, performing VLM (Vortex Lattice Method) aerodynamic analysis, and generating comprehensive stability and performance reports.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Current Phase: Phase 1 — CAD Pipeline ✅

### What works now:
- **Import**: STL (binary + ASCII), STEP, IGES, BREP via OCCT WASM
- **Worker-based**: All heavy processing off UI thread with progress reporting
- **Segmentation**: Position-welded dihedral BFS (adaptive 28°/35°/45° thresholds)
- **Orientation**: Auto-normalize to FlowSync convention (X fwd, Y right, Z up) + manual override
- **Face DB**: Area, centroid, normal, bbox per face
- **Adjacency**: Welded-vertex graph filtered by ≤30° dihedral
- **Selection**: Click / Ctrl+Click toggle / Ctrl+Shift+Click flood / Box marquee
- **Named Selections**: Create, assign faces, delete
- **Import Summary**: Dialog with full model stats
- **Command Palette**: Ctrl+K to search 20+ commands

### Gate checklist:
- ✅ Toolbar Import CAD opens file picker
- ✅ Worker processes STL without freezing UI
- ✅ Console shows staged progress
- ✅ Summary dialog shows faces/tris/orientation
- ✅ Tree lists faces, clickable
- ✅ Click/Ctrl+Click/Ctrl+Shift+Click/Box all select
- ✅ Orange highlight on selected faces
- ✅ Named Selections create + assign
- ✅ Orientation override buttons re-orient
- ✅ Build passes

## Architecture

```
flowsync-v2/
├─ src/
│  ├─ app/                   # ErrorBoundary, boot contract
│  ├─ core/                  # types.ts (THE data contract)
│  ├─ state/                 # Zustand stores (ui, console, project, geometry)
│  ├─ commands/              # registry.ts + cadCommands.ts = orchestration layer
│  ├─ modules/cad/           # Phase 1: faceProperties, segmentation, orientation, adjacency, importers
│  ├─ ui/                    # shell, panels, palette, dialogs
│  ├─ three/                 # FlowViewport (R3F canvas + selection + camera)
│  └─ workers/               # import.worker.ts (heavy compute off UI thread)
├─ tests/                   # vitest per module
└─ docs/                    # DECISIONS.md, modules/cad.md
```

### Rules
- **R1:** Modules communicate only via `core/types.ts`
- **R2:** Cross-store logic lives only in `commands/`
- **R3:** Heavy compute in workers
- **R4:** Every failure is structured + logged + visible
- **R5:** No phase merges without its green gate

## Phase Plan

| Phase | Content | Status |
|-------|---------|--------|
| **0** | Shell, theme, stores, command registry+palette, console, watchdog | ✅ Complete |
| **1** | CAD: import worker, segmentation, orientation, face DB, selection, named selections | ✅ Complete |
| **2** | Recognition + reference geometry + overrides + Pipeline Health | Next |
| **3** | Solver worker, sweep, charts, lattice, stability verdict, mass/CG | Pending |
| **4** | Views, display modes, triad, airflow, viewport capture, Report PDF/JSON | Pending |
| **5** | AeroBot v4 agent | Pending |
| **6** | FS-01 save/load/autosave + docs + acceptance run → cutover | Pending |

## Key Features (Planned)

- Automatic geometry segmentation and orientation
- Component recognition (wing, htail, vtail, fuselage)
- VLM solver with wake relaxation
- Stability analysis and CG estimation
- PDF/JSON report generation
- AeroBot AI agent (opt-in, local-first)

## Documentation

- [Architecture & Modules](docs/README.md)
- [Design Decisions](docs/DECISIONS.md)
- [CAD Pipeline](docs/modules/cad.md)

## Tech Stack

- React 18 + TypeScript
- Vite 6
- Tailwind CSS v4
- Zustand (state management)
- Three.js + React Three Fiber (3D viewport)
- OCCT WASM (CAD kernel)
- vitest (testing)
