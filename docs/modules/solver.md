# FS-05 — VLM Solver + Stability + Mass/CG

## Purpose

Solve the Vortex Lattice Method (VLM) for lifting surfaces, compute aerodynamic coefficients (CL, CDi, CD0, Cm), analyze static longitudinal stability, and estimate mass properties (CG) via divergence theorem.

## Pipeline

```
Stations → Panels → AIC Matrix → BC (no-penetration) → Solve (Γ) → Forces → Stability → CG
```

### Stages

1. **Panel Generation**: Discretize lifting surfaces into chordwise × spanwise panels
2. **AIC Assembly**: Compute influence coefficients (Biot-Savart law for horseshoe vortices)
3. **Boundary Condition**: No-penetration at ¾-chord control points
4. **Linear Solve**: Gaussian elimination with partial pivoting
5. **Force Integration**: Kutta-Joukowski theorem for lift, induced drag from downwash
6. **Viscous Drag**: CD0 via momentum integral closure (Schlichting + Blasius)
7. **Stability Analysis**: Cm vs CL slope → neutral point → static margin
8. **Mass Properties**: Divergence theorem for closed-surface volume → CG

## Conventions

- **Body axes**: X forward, Y right (starboard), Z up
- **Freestream**: ŵ = (−cos α, 0, sin α) at angle of attack α
- **Moment coefficient**: Cm = −M_y / (q·S·c̄)
- **Reference point**: ¼-chord of MAC for moment computation
- **Bound vortex**: ¼-chord of each panel
- **Control point**: ¾-chord of each panel

## Wake Relaxation

**Decision D-009**: Wake relaxation default ON.

**Theory**: Reduced form of vorticity transport equation. Trailing vortices convect downstream with freestream, inducing additional velocities that modify the effective angle of attack. Iterative procedure converges to self-consistent wake geometry.

**Implementation**: In Beta, simplified to fixed straight trailing vortices aligned with freestream. Full nonlinear wake roll-up deferred to post-Beta.

## CD0 Closure

**Decision D-010**: CD0 via von Kármán momentum integral in Beta.

**Theory**: Flat-plate turbulent boundary layer correlation (Schlichting) with laminar-turbulent transition at Re_transition = 5×10⁵.

**Implementation**:
```typescript
CD0 = Cf * (wetted_area / reference_area) * form_factor
```

Where:
- `Cf` = skin friction coefficient (laminar + turbulent portions)
- `wetted_area` ≈ 2 × planform for wings (top + bottom)
- `form_factor` = 1.0 (no form drag in VLM for lifting surfaces)

**Limitations**: Full FVM/CFD deferred to §8.9. This is a closure model, not a first-principles solution.

## Validation Plan

### Test Case: Rectangular Wing AR=6

- **Geometry**: Span = 6 m, chord = 1 m, AR = 6
- **Panels**: 24 spanwise × 6 chordwise = 144 panels
- **Conditions**: V∞ = 30 m/s, ρ = 1.225 kg/m³, μ = 1.81×10⁻⁵ Pa·s

**Expected Results** (vs lifting-line theory):

| Metric | VLM | Lifting-Line | Deviation |
|--------|-----|--------------|-----------|
| CL_α | ~0.085 /deg | 2π/(AR+2) ≈ 0.087 /deg | < 12% |
| e (span efficiency) | ~0.95 | ~0.95 (elliptic) | < 15% |
| CL(α=0) | ~0 | 0 (symmetric) | < 0.02 |
| Cm(¼-chord, α=4°) | ~0 | 0 (symmetric) | < 0.06 |

**Pass Criteria**: All deviations within tolerance.

## Stability Analysis

### Static Longitudinal Stability

**Neutral Point**: X location where dCm/dCL = 0 (pitch moment independent of lift).

**Static Margin**: (NP_x - CG_x) / MAC (fraction of mean aerodynamic chord).

**Verdict**:
- **STABLE**: SM > 2% (CG ahead of NP)
- **NEUTRAL**: |SM| < 2%
- **UNSTABLE**: SM < -2% (CG behind NP)

**Additional Checks**:
- Cm_α < 0 (pitch-down tendency with increasing α)
- CL_α > 0 (normal lift curve)
- Trim α in reasonable range (-10° to 20°)

## Mass Properties

### Divergence Theorem

For a closed surface S enclosing volume V:

```
V = (1/3) ∮_S r·n dA
CG = (1/4V) ∮_S r (r·n) dA
```

Where:
- `r` = position vector from origin
- `n` = outward unit normal
- `dA` = differential area element

**Implementation**: Sum over triangulated faces. Each triangle contributes:
- Volume: `(1/3) * (r_centroid · n) * area`
- CG: `(1/4) * r_centroid * (r_centroid · n) * area`

**Fallback**: If volume < 1e-6 (open surface or degenerate geometry), use bounding box estimate with 0.5 fill factor.

**Component Densities** (default, editable):
- Wing: 50 kg/m³
- Horizontal tail: 35 kg/m³
- Vertical tail: 35 kg/m³
- Fuselage: 80 kg/m³

## Limitations

Per §FS-05 / §8.9:

1. **Linear theory**: Small disturbance, thin airfoil, small α
2. **Incompressible**: M < 0.3
3. **Inviscid** (except CD0 closure): No boundary layer interaction
4. **No stall**: Linear lift curve extrapolated beyond stall
5. **No control surfaces**: Fixed geometry only
6. **No dynamic effects**: Quasi-steady, no flutter or gust response
7. **No interference**: Components treated independently (except via superposition)
8. **No ground effect**: Free-air only
9. **CD0 is closure model**: Not first-principles CFD

## Usage

```typescript
import { runCommand } from "@/commands/registry";

// Run VLM analysis
runCommand("solver.run");

// Run validation case (AR=6 rect wing)
runCommand("solver.validate");

// Compute CG
useMassStore.getState().compute();
```

## Files

- `src/modules/solver/biotSavart.ts` — Biot-Savart law for horseshoe vortices
- `src/modules/solver/viscousDrag.ts` — CD0 estimation via momentum integral
- `src/modules/solver/panelGenerator.ts` — Generate VLM panels from stations
- `src/modules/solver/vlmSolver.ts` — Main VLM solver (AIC, BC, forces)
- `src/modules/solver/stability.ts` — Static stability analysis
- `src/modules/solver/massProperties.ts` — CG via divergence theorem
- `src/workers/solver.worker.ts` — Worker-based solver execution
- `src/state/useAeroStore.ts` — Flight conditions & panel settings
- `src/state/useSolverStore.ts` — Solver state & results
- `src/state/useMassStore.ts` — Mass properties & CG
- `src/ui/panels/AnalysisInspector.tsx` — Flight conditions UI
- `src/ui/panels/CgBox.tsx` — CG computation UI
- `src/ui/panels/StabilityBox.tsx` — Stability verdict display
- `src/ui/workspace/ResultsWorkspace.tsx` — Results charts
- `src/ui/charts/LineChart.tsx` — SVG chart component
- `src/three/VlmLatticeOverlay.tsx` — 3D lattice visualization
- `src/three/CgMarker.tsx` — CG & NP markers
