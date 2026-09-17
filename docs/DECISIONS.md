# FlowSync v2 — Decisions Log

## D-001: Redesign Cutover Strategy
**Decision:** Build flowsync-v2 alongside the old repo. Old repo stays untouched as reference until Phase 7 cutover gate.
**Rationale:** Avoids regression risk. Each phase has an explicit green gate before merge.

## D-002: Web Stack + Testing
**Decision:** React 18 + Vite + Tailwind CSS + Zustand + vitest. CI runs typecheck + build + test on every push.
**Rationale:** Modern, fast DX. vitest shares Vite config. CI catches broken module graphs.

## D-003: Commands-Layer Orchestration
**Decision:** All cross-store logic lives in `src/commands/registry.ts`. Stores remain isolated. UI, Toolbar, Palette, and AeroBot tools all call `runCommand()`.
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
