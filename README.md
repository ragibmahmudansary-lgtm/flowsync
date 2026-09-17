# FlowSync v2

**Preliminary Aircraft Aerodynamic Analysis** — v1.0.0-beta

A web-based tool for importing aircraft CAD geometry, performing VLM (Vortex Lattice Method) aerodynamic analysis, and generating comprehensive stability and performance reports.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Architecture

FlowSync v2 follows a strict modular architecture:

- **Core types** (`src/core/types.ts`) — single data contract shared by all modules
- **Isolated stores** (`src/state/`) — Zustand stores for UI, console, project state
- **Command registry** (`src/commands/`) — single orchestration layer; all actions flow through `runCommand()`
- **3D viewport** (`src/three/`) — React Three Fiber scene with camera controls
- **UI shell** (`src/ui/`) — tabs, panels, command palette, console

## Phase Gates

Each phase has an explicit green gate before merge. See `docs/README.md` for the full phase plan.

**Current: Phase 0** — Shell, theme, stores, command registry + palette, console, watchdog.

## Key Features (Planned)

- STEP/IGES/BREP/STL import with OCCT WASM
- Automatic geometry segmentation and orientation
- Component recognition (wing, htail, vtail, fuselage)
- VLM solver with wake relaxation
- Stability analysis and CG estimation
- PDF/JSON report generation
- AeroBot AI agent (opt-in, local-first)

## Documentation

- [Architecture & Modules](docs/README.md)
- [Design Decisions](docs/DECISIONS.md)

## Tech Stack

- React 18 + TypeScript
- Vite 6
- Tailwind CSS v4
- Zustand (state management)
- Three.js + React Three Fiber (3D viewport)
- vitest (testing)
