# AirFLOW Browser MVP Methodology

This document records the feasible browser implementation of the FlowSync v1.0Beta methodology in `plan.md`. It is an engineering MVP, not an XFLR5, AVL, CFD, or flight-certification substitute.

The chronological formulas and exact current calculation path are documented in `CALCULATION_PIPELINE.md`.

## Scope Mapping

| Plan module | Browser MVP implementation | Deferred |
| --- | --- | --- |
| FS-01 Project Management | Versioned JSON project, mass model, recognition assignments, controls, reduced analysis result, autosave | Directory projects, binary sidecars, crash-recovery dialog, MRU |
| FS-02 CAD Import | Binary/ASCII STL detection, parsing, units, axis mapping, import errors | STEP/IGES and OpenCascade entity preservation |
| FS-03 Geometry Engine | Triangle IDs by index, bounds, area, signed volume, centroid, inertia, edge topology, component count, duplicate/degenerate detection | B-rep faces, sewing/healing, self-intersection repair |
| FS-04 Recognition | Ray-picked triangle selection, normal-angle region growth, manual component assignment, component colors, wing reference extraction | Box/lasso selection, undo stack, automatic recognition, robust symmetry pairing |
| FS-05 VLM Solver | Multi-row lattice (M chordwise rows x N uniform spanwise strips, sub-panel quarter-chord horseshoes, 3/4-point collocation), freestream-aligned wake >= 10 b, Biot-Savart AIC, pivoted direct solve, circulation, lift, signed Trefftz induced drag, moment, alpha sweep, R1/R2 resolution check | Control surfaces, compressibility, viscous/stall model, AVL benchmark fixture |
| FS-06 UI | Three.js shaded viewport, orbit/zoom, CG/flow/load markers, assignment colors, VLM lattice, plots and diagnostics | Box/lasso tools, scalar surface color map, full analysis console |
| FS-07 Reporting | Project JSON and versioned result JSON | Engineering PDF and 300-DPI figure pipeline |
| FS-08 Integration | Static JavaScript modules and Node tests | C++/Qt/OpenCascade stack, CI and installers |

## Coordinate and Unit Contract

- Internal units are SI: m, kg, s, N, Pa, kg/m3, kg m2.
- Internal axes are `x = longitudinal`, `y = lateral/span`, `z = vertical`.
- The default demo mapping is STL `X -> x`, STL `Z -> y`, STL `Y -> z`.
- Axis mappings must use each STL axis exactly once. Sign reversal is allowed.
- Point/component mass coordinates are transformed when the source axis or unit mapping changes.
- STL has no unit or mass metadata. Both remain explicit user assumptions.

## Geometry and Mass Criteria

- Triangle area uses `0.5 * |(b-a) x (c-a)|`.
- Signed tetrahedral integration supplies volume, centroid, and the inertia tensor for a closed consistently oriented mesh.
- Boundary edges, non-manifold edges, disconnected components, duplicate triangles, and degenerate triangles are reported.
- Volume-derived mass properties are conditional when the mesh is not watertight or consistently oriented.
- Total CG is `sum(m_i r_i) / sum(m_i)`.
- Total inertia uses each local inertia plus the parallel-axis term about total CG.
- The demo 42,600 kg airframe value is only an editable seed. STL cannot retain real component weights.

## Recognition and Reference Geometry

Manual component assignment follows FS-04. Ray picking returns an STL triangle ID. Region growth traverses shared-edge adjacency while both local and seed-normal angles remain below a user limit. A user-visible face cap bounds each patch because a welded STL can connect large portions of the airframe without component boundaries.

For assigned horizontal lifting surfaces:

- Span is `max(y) - min(y)`.
- A spanwise envelope estimates local leading and trailing `x`, so selecting both skins does not double planform area.
- Area is numerically integrated from local chord: `S = integral c(y) dy`.
- MAC is `integral c(y)^2 dy / S` over the full span.
- Aspect ratio is `b^2 / S`.
- Sweep is the regression angle of the quarter-chord line against span.
- Dihedral is the regression angle of mid-surface height against semi-span.

The plan text names projection onto XZ for wing area, but its own axis contract defines Y as span and Z as vertical. The browser implementation uses the physically consistent XY planform and a chord envelope.

## VLM Mathematical Model

The MVP uses a multi-row horseshoe lattice (default 4 chordwise rows x N spanwise strips, uniform spacing; M0-2):

- Each span strip is subdivided into M chordwise sub-panels; bound vortex endpoints lie on the sub-panel quarter-chord line, collocation points at strip mid-span and the sub-panel 3/4 point.
- N per surface defaults to the prescribed count `max(16, 2 M ceil(AR/2))` (panel width/length about 1 at the mean chord), identifying runs as R1 or R2; a single guard refuses any panel with width/length < 0.25 and warns above 8.
- Wake legs are straight and freestream aligned. Their nominal length is the larger of the configured MAC multiple (default 20) and ten times the largest per-surface bound-endpoint span.
- Unit induced velocity is computed with the finite-segment Biot-Savart law.
- The no-penetration system is `A Gamma = -V_infinity dot n`.
- A partial-pivot Gaussian solve reports maximum residual and pivot ratio.
- Panel forces use Kutta-Joukowski: `dF = rho Gamma (V_effective x dl)` (the panel's own trailing legs included; only its own bound segment excluded).
- Integrated coefficients use `q = 0.5 rho V^2`, `CL = L/(qS)`, `CDi = Di_Trefftz/(qS)`, and `Cm = My/(q S MAC)`. The near-field drag is reported as a signed diagnostic alongside the primary Trefftz value.
- The resolution badge applies the 1 % lift-slope and 5 % induced-drag gates to the applicable 0°/4° comparison. The fixed uncertainty claim remains withheld.
- `CL_alpha` and `Cm_alpha` are linear regressions over sweep cases within +/-5 degrees.
- Static margin is `-Cm_alpha/CL_alpha`; neutral point is `xCG + staticMargin * MAC`.

`CD0` and `Cm0` are explicit non-VLM corrections. They are not inferred from STL.

## Validity Limits

- Incompressible, steady, inviscid lifting-surface flow; target Mach below 0.3.
- No stall, separation, Reynolds-number model, fuselage interference, propulsive effects, or aeroelasticity.
- Flat-plate sections only: camber, twist and thickness effects are not modelled (camber/twist arrive in M2-9).
- Static stability is longitudinal only. The pitch response is a linearized demonstrator driven by VLM `Cm_alpha` and manifest `Iyy`, not a complete six-degree-of-freedom flight dynamics model.
- Numerical self-tests compare a rectangular wing against finite-wing lift-slope theory with 16% tolerance and require a quadratic induced-drag trend. The plan's 5% AVL/benchmark criterion remains unmet until controlled AVL fixtures are added.

**AUD-1 comparison qualification.** The badge uses a two-point 0°/4° diagnostic. Each grid needs two usable cases and a finite slope per radian. If the degree-based conversion overflows, the diagnostic divides the lift difference directly by the radian interval. A grid with a nonfinite final slope is invalid for the comparison and its prescribed summary metrics are null. The relative lift-slope delta uses the magnitude of the coarse slope, with a denominator minimum of 1e-300. If subtracting two finite lift slopes overflows, the solver divides both slopes by that same denominator before taking their absolute difference. A nonfinite final delta withholds both comparison metrics while preserving each grid’s own validity. Failed prescribed comparisons have null deltas. Failed custom comparisons omit the custom deltas and withhold plotted-grid coverage. The effective bounds-seed flag is part of the comparison identity and survives both downloads with the exact comparison coverage. Omitting the flag is equivalent to false.

### AUD-2 result export

Result export uses `airflow.vlm-results` JSON version 1, replacing the prior CSV (consumers must migrate). It carries method, limitations, sweep and point validity, inputs and references, resolution coverage, and assumed CD0/CM0 labels. Invalid or missing-validity sweeps withhold all coefficient and load values as null, consistent with plots; individual invalid or missing-validity points are also withheld. Nonfinite values are null. This does not validate the model or complete the remaining display safeguards.

**REM-3a claim scope:** The fixed numerical uncertainty claim is withheld for all cases until a reviewed application envelope exists. R1/R2 comparison is self-comparison, not external validation or a confidence interval. Benchmark extraction provenance and remaining questions are recorded in `docs/verification/rem-3a-2026-11-06/BENCHMARK_SIDECAR.md`.

### REM-3b solver inputs and failure display

Case, sweep and resolution calls validate scientific inputs before reporting a result. Generated lattices require distinct surface names. Supplied case panels must agree with their bound geometry on span edges and midpoint. The actual bound endpoints determine the wake floor. Generated cases construct the lattice and compute moment arms in a frame relative to the first surface's root x and z. Finite legs use their prescribed displacement directly, and Trefftz projects local displacements between the midpoint and leg origins. Published panel positions are rounded world coordinates. A supplied panel or reference coordinate can already have lost local detail at input precision. Degenerate geometry, nonfinite wake displacement, collapsed wake endpoints in supplied case geometry, invalid pressure references, malformed circulation or drag options and nonfinite derived outputs are refused. Raw aspect-rejected supplied lattices carry invalid status. See the calculation pipeline for the metadata checks and their arithmetic tolerance.

A sweep uses the shortest decimal spellings of its numeric inputs, rounds each exact decimal sample once and refuses duplicate representable samples. The separate limits are 201 samples, 4,096 panels for generation and 2,048 for a dense solve or standalone Trefftz call. A combined synchronous work budget also covers all planned dense solves. The browser budgets the plotted sweep and both-angle resolution checks together, including a custom refinement when applicable. It rejects an over-budget Run and clears stale results. Accepted Run time varies by host.

Run refuses malformed numeric controls, with intentional blank span count selecting automatic sizing. Editing solver inputs or failing a Run discards the old result and clears both canvases. A successful solve without a pitch series shows an unavailable pitch plot. See the implementation handoff for the remaining display validity work and independent re-verification.
