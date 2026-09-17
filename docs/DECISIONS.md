# FlowSync v2 — Decisions Log

## D-001: Redesign Cutover Strategy
**Decision:** Build flowsync-v2 alongside the old repo. Old repo stays untouched as reference until Phase 7 cutover gate.
**Rationale:** Avoids regression risk. Each phase has an explicit green gate before merge.

## D-002: Web Stack + Testing
**Decision:** React 18 + Vite + Tailwind CSS + Zustand + vitest. CI runs typecheck + build + test on every push.
**Rationale:** Modern, fast DX. vitest shares Vite config. CI catches broken module graphs.

## D-003: Commands-Layer Orchestration
**Decision:** All cross-store logic lives in `src/commands/`. Stores remain isolated. UI, Toolbar, Palette, and AeroBot tools all call `runCommand()`.
**Rationale:** Single orchestration layer prevents store coupling. Every action is traceable and testable.

## D-004: AeroBot Opt-In Agent
**Decision:** Local knowledge compendium (GLOSSARY + PLAYBOOK + THEORY) shipped with app. Opt-in LLM mode requires user API key. All tools execute locally and deterministically.
**Rationale:** Beta-compliant (no bundled AI service). Local retrieval works offline. LLM mode is transparent and user-controlled.

## D-005: CG Estimation Method
**Decision:** CG computed via divergence-theorem volumes × effective densities. Documented as estimate.
**Rationale:** Physically grounded. Transparent assumptions. Suitable for preliminary analysis.

## D-006: Dev Config + WASM Copy
**Decision:** postinstall script copies OCCT wasm to public/wasm. Preview-safe dev config.
**Rationale:** Never manual WASM management. Build always has what it needs.

## D-007: Conventions
**Decision:** Sweep at ¼-chord. X-forward body axes. SI units throughout.
**Rationale:** Standard aerospace convention. Consistent with VLM formulation.

## D-008: Failure Doctrine
**Decision:** Every failure is structured `{code, message, hint}` + logged + visible. Boot watchdog → ErrorBoundary → console store → dialogs.
**Rationale:** Never a blank page. Every error has context and recovery path.

## D-009: Worker-Based CAD Pipeline (Phase 1)
**Decision:** All heavy CAD processing (parse, segment, orient, face DB, adjacency) runs in a Web Worker. UI thread remains responsive. Progress reported via postMessage.
**Rationale:** Rule R3 (heavy compute in workers). Large STL files (280k+ tris) would freeze the UI otherwise.

## D-010: Segmentation Strategy (Phase 1)
**Decision:** Position-welded dihedral-angle BFS with adaptive thresholds [28°, 35°, 45°]. Hard cap 2000 regions.
**Rationale:** Validated against Cessna 152 STL. Adaptive thresholds handle varying mesh quality. Cap prevents pathological cases.

## D-011: Orientation Heuristic (Phase 1)
**Decision:** BBox-rank axes → span/length/vertical. Tail-fin nose heuristic. Manual override buttons.
**Rationale:** Works for typical aircraft geometries. Manual override for edge cases.

## D-012: Worker Format (Phase 1)
**Decision:** Vite worker format set to "es" (ES modules) to support code-splitting with OCCT WASM.
**Rationale:** Default IIFE format doesn't support code-splitting. ES modules required for dynamic imports in workers.

## D-013: Fuselage-Width-Aware Outboard Threshold (Phase 2)
**Decision:** Recognition outboard threshold = `max(0.06·yLen, 1.25·fuselageHalfWidth)`. Replaces v1's fixed `0.18·yLen`.
**Rationale:** v1's fixed threshold could swallow small horizontal tails into the fuselage class on wide-span models. The fuselage-width-aware threshold adapts to actual geometry.

## D-014: Two-Path Recognition (Phase 2)
**Decision:** Multi-lump models use lump-level classification (higher confidence). Single fused solid uses per-face heuristic (lower confidence, warning issued).
**Rationale:** Connected components provide stronger classification signal. Per-face fallback handles degenerate cases.

## D-015: Spanwise Binning (Phase 2)
**Decision:** 48 spanwise bins for planform property computation. Upper skin only (projecting both skins would double-count area).
**Rationale:** 48 bins balances resolution vs noise. Upper-skin filter avoids planform area doubling on closed sections.
