# FlowSync v2 — Module Documentation

## Architecture

```
flowsync-v2/
├─ public/wasm/               # OCCT wasm (npm postinstall copies)
├─ src/
│  ├─ app/                   # ErrorBoundary, boot contract
│  ├─ core/                  # types.ts (THE data contract), math, hash, units
│  ├─ state/                 # isolated Zustand stores (ui, console, project)
│  ├─ commands/              # registry.ts = single orchestration layer
│  ├─ modules/               # cad / recognition / solver / report / aerobot / project
│  ├─ ui/                    # shell, tabs, panels, palette, console
│  ├─ three/                 # viewport, controls, markers, overlays
│  └─ workers/               # import.worker, solver.worker
├─ tests/                   # vitest per module + validation harness
└─ docs/                    # README per module + DECISIONS.md
```

## Rules (enforced from commit #1)
- **R1:** Modules communicate only via `core/types.ts`
- **R2:** Cross-store logic lives only in `commands/`
- **R3:** Heavy compute in workers
- **R4:** Every failure is structured + logged + visible
- **R5:** No phase merges without its green gate

## Phase Plan

| Phase | Content | Green Gate |
|-------|---------|------------|
| **0** | Shell, theme, stores, command registry+palette, console, watchdog, CI, smoke test | boots, Ctrl+K works, CI green |
| **1** | CAD: import worker, segmentation, orientation, face DB, selection | Cessna STL imports segmented+oriented, selectable |
| **2** | Recognition + reference geometry + overrides + Pipeline Health | C152 wing span/AR/MAC physical |
| **3** | Solver worker, sweep, charts, lattice, stability verdict, mass/CG | validation PASS, stability box sane |
| **4** | Views, display modes, triad, airflow, viewport capture, Report PDF/JSON | report regenerates identically |
| **5** | AeroBot v4 agent | agent executes multi-tool tasks |
| **6** | FS-01 save/load/autosave + docs + acceptance run → cutover | full pipeline end-to-end |

## Setup

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run typecheck    # TypeScript check
```

## Module Map (FS-01…FS-08 → src/modules)
- FS-01: Project → `src/state/useProjectStore.ts`
- FS-02: CAD Import → `src/modules/cad/` ✅ Phase 1
- FS-03: Recognition → `src/modules/recognition/` ✅ Phase 2
- FS-04: Solver → `src/modules/solver/` (Phase 3)
- FS-05: Report → `src/modules/report/` (Phase 4)
- FS-06: UI/UX → `src/ui/` + `src/three/` ✅ Phase 0-2
- FS-07: AeroBot → `src/modules/aerobot/` (Phase 5)
- FS-08: Constraints → `docs/DECISIONS.md`

## Module Docs
- [CAD Pipeline](modules/cad.md) — Import, segmentation, orientation, face DB
- [Recognition Engine](modules/recognition.md) — Component classification, reference geometry
