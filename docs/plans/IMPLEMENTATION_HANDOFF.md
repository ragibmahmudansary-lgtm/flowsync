# Implementation Handoff

Status: **v1.0**, derived from the plan (2026-10-23).

Precedence: [DATA_CONTRACTS](../architecture/DATA_CONTRACTS_AND_PIPELINE.md) > [MASTER](MASTER_REVISED_PROJECT_PLAN.md) > [PHASED](PHASED_IMPLEMENTATION_PLAN.md) > [TEST MATRIX](VALIDATION_AND_TEST_MATRIX.md) > this page. **If this page disagrees with those documents, this page is wrong.**

Read [START_HERE.md](../START_HERE.md) first. This page says what to do first and how to know it is done, without needing the audit conversation.

## 0. Ground rules

1. Work on a branch. Run `npm test` after every task. Write each task's tests together with the fix.
2. Check numerical changes against an **independent oracle** implemented in the test. The oracle must **never import the module under test**.
3. Update `CALCULATION_PIPELINE.md` and `MVP_METHODOLOGY.md` in the same change as the code they describe. Never edit `plan.md` or anything in `refs/`.
4. Add no dependencies in M0. Use `crypto.subtle` for SHA-256 (it works in Node 24 and in the browser).
5. Nothing under `src/core/` may import `three`, touch the DOM, or use a bare-specifier import (test LINT-T1).

## 1. First milestone: M0 (two parallel tracks; no owner input needed)

The app currently displays wrong numbers:
- drag with the wrong sign, 9-16× too large;
- a diverging single-row VLM;
- recognised wing area at −63 %;
- non-physical pitch dynamics;
- a wing-alone stability verdict;
- projects that can attach to the wrong mesh.

M0 makes every displayed number either correct within Tier-0 limits or explicitly unavailable.

### Track M0b: VLM numerics (start here; highest severity)

| Order | Task | Summary |
|---|---|---|
| 1 | **M0-1** | Include the panel's own trailing legs. Add the general transverse-plane Trefftz drag, signed. |
| 2 | **M0-2** | Multi-row lattice; guard width/length ≥ 0.25; freestream-aligned wake, length ≥ 10 b; R1/R2 badge; uncertainty label. |
| 3 | M0-3, M0-4, M0-5 | Sweep conversion; relative singularity cutoff; linear-window guard. |
| 4 | M0-16 (VLM part) | Update CALCULATION_PIPELINE §11 and the VLM text in MVP_METHODOLOGY. |

### Track M0a: quarantine and app correctness

| Order | Task | Summary |
|---|---|---|
| 1 | **M0-10** | Exact topology as the new module `src/core/topology.js`. Regression values 28 / 5 / 0 / 1. |
| 2 | M0-6, M0-7 | Planform by slicing; validity gate. |
| 3 | M0-8 | Stability verdict gating: H-tail, non-default mass, linearity, model text. Hide the pitch plot. |
| 4 | M0-9 | Minimal `src/core/hash.js`; restore applies units and axes; reject a `meshHash` mismatch. |
| 5 | M0-11, M0-12, M0-13, M0-14 | Staleness view model; degraded mode without WebGL; reject non-finite vertices; labels. |
| 6 | M0-15 | Hygiene. The gitlink removal needs owner approval. |
| 7 | M0-16 | Regenerate the demo report with `scripts/demo-report.mjs`, then update the method documents. |

## 2. Task recipes

### M0-1: induced drag (DR-01, RB-03)

1. In `src/vlmSolver.js:121-132`, remove `if (i === j) continue;`. Call `inducedVelocityHorseshoe(panels[i].boundMidpoint, panels[j], wakeDir, wakeLength, j !== i)`. The `includeBound` parameter already exists at `:76`.
2. In `src/vlmSolver.js:147`, delete `Math.abs`. The near-field drag is the signed value `dot(totalForce, wakeDirection)`.
3. Add `trefftzDrag(panels, circulation, rho, wakeDir)` in the general form (§3.1 below). Return `cdiTrefftz`, `cdiNearField` and their relative difference. Set `cdi = cdiTrefftz`. Assert `D > 0`; if it fails, raise a validity error, never take an absolute value.
4. Tests: VLM-V2, VLM-V2b (unswept, wake ≥ 10 b) and VLM-V2c (wing + H-tail).

### M0-2: multi-row VLM (DR-02, RA-03, RB-04, RB-07)

- **Lattice.**
  - M chordwise rows (default 4) and N spanwise strips, uniform in both directions.
  - Each strip's chord is interpolated at its edges.
  - Bound vortex at the 1/4 point of each sub-panel; control point at the 3/4 point.
  - Choose N per surface so that width/length ≈ 1 at the mean chord.
- **Guard.** Refuse any panel with width/length < 0.25. Warn above 8. Elliptic tip strips legitimately reach about 4.5.
- **Wake.** Keep the existing freestream-aligned legs (`wakeDirection` from α) and set the length ≥ 10 b.
  - Do **not** switch to a planar x-wake. The coordinator measured near-field = Trefftz × cos α with it (−1.5 % at 10°), against 0.001 % agreement with the freestream-aligned wake.
  - Rebuilding the matrix per α is acceptable.
- **Resolution badge.** Run R1 and R2 (R2 doubles N and M). Amber if ΔC_Lα > 1 % or ΔC_Di > 5 %.
- **Label.** "flat-plate inviscid estimate: C_Lα ±5 %, C_Di ±8 %".

Coordinator measurements, from the review record §4 (rectangular wing, α = 4°):

| AR | R1 C_Lα | R2 C_Lα | LLT C_Lα | R2 e | LLT e (approx.) |
|---|---|---|---|---|---|
| 6 | 4.3680 | 4.3521 | 4.5304 | 0.9898 | 0.954 |
| 8 | 4.7045 | 4.6922 | 4.8377 | 0.9717 | 0.937 |
| 12 | 5.1020 | 5.0936 | 5.1991 | 0.9412 | 0.907 |

On an elliptic wing with AR 8 at 64 × 8, e = 1.0152; the exact value is 1.

### M0-10: exact topology (DR-12)

- Create `src/core/topology.js` and weld on exact float64 coordinates. A typed-array hash is recommended: Reviewer A measured 32 ms, against 224 ms for string keys.
- When a triangle's welded vertex ids are not distinct, count it as degenerate and **skip its edges**.
- Compute edge-connected components.
- Switch `geometry.js:130-200` to the new module.
- Update `tests/demoRegression.test.mjs:18-19` to: boundary 28, non-manifold 5, degenerate 0, components 1.

### M0-6: planform by slicing (DR-03)

1. Take K = max(48, 4√n) stations across the selection's span.
2. At each station y_k, intersect every assigned-triangle edge whose endpoints straddle y_k.
3. Chord = max x − min x of the intersections. Leading-edge x = min x. Midline z = the mean z of the min-x and max-x points.
4. Integrate S = ∫c dy and c̄ = ∫c² dy / S with the trapezoid rule.

Oracle (REC-V2): an independent slicer **written in the test**. The coordinator measured 22.66 m² for the demo's triangles with centroid y ≥ 8 m. The repository currently returns 8.30 m².

### M0-8: verdict gating (DR-05, DR-06, RB-01)

Show a stability verdict only if **all** of these hold:
- a valid H-tail is assigned;
- `mass.source !== "assumedUniform"`. Add a `source` field to the manifest; it is `assumedUniform` until the user edits the mass table.
- the linearity rule passes: ≥ 3 points, and adjacent-pair slopes within 5 %.

The verdict text must include: "wing + H-tail flat-plate VLM; fuselage, camber and twist omitted; fuselage omission over-estimates SM".

## 3. Oracles for `tests/oracles/`

### 3.1 General Trefftz-plane drag (RB-03)

```js
// ew = wake direction (unit) = freestream direction (cos a cos b, -sin b, sin a cos b); at beta = 0: (cos a, 0, sin a).
// Each horseshoe j has two trailing legs: at boundA (oriented upstream, i.e. -ew) and at boundB (+ew).
// Project points onto the Trefftz plane (perpendicular to ew).
// A leg is an infinite 2-D vortex of strength s * G[j], with s = -1 at A and +1 at B.
// The 2-D induced velocity at point p from a vortex at p0 with axis s * ew:
//   v = (s * G / (2 * pi)) * cross(ew, r) / |r|^2,   where r = proj(p) - proj(p0)
// Then D = 0.5 * rho * sum_i G[i] * dot(vT(midpoint_i), cross(l_i, ew)),  with l_i = boundB_i - boundA_i.
// Sum vT over ALL legs of ALL surfaces (not y-only, not per surface).
// Assert D > 0. Never use Math.abs.
```

Validate the oracle against the long-wake near-field drag (with self legs, wake ≥ 10 b):
- an unswept planar wing must agree within 1 % (VLM-V2b);
- wing + tail must agree within 1 % (VLM-V2c).

Reviewer B measured 0.00 % for both. A y-only implementation must **fail** VLM-V2c; that failure is how the test proves it can detect the defect.

### 3.2 Glauert lifting line (rectangular, a₀ = 2π, symmetric)

- Unknowns: A_n for n = 1, 3, …, 2M−1.
- Collocation: θ_i = (i + ½)π/(2M).
- Equations: Σ A_n sin(nθ)(1 + μn/sin θ) = μ(α − α_L0), with μ = 2π/(4 AR).
- Results: C_L = π AR A₁; C_Di = π AR Σ n A_n².

With M = 60:

| AR | C_Lα (per rad) |
|---|---|
| 6 | 4.5304 |
| 8 | 4.8377 |
| 12 | 5.1991 |

Do not gate at AR < 5.

### 3.3 Elliptic wing (VLM-V2d)

- Planform: c(y) = c₀√(1 − (2y/b)²), straight c/4 line, b = π AR c₀ / 4.
- Expect e ∈ [0.99, 1.07].

### 3.4 Helmbold-DATCOM swept-wing slope (VLM-V1b)

C_Lα = 2πAR / (2 + √(4 + AR²(1 + tan²Λ_c/2)))

Gate: within 5 %.

## 4. Commands

```bash
npm test
```

```bash
node --test tests/vlmOracles.test.mjs
```

```bash
npm start
```

`npm start` serves the app at http://127.0.0.1:4173/ and needs WebGL. After M0-12, the analysis must still work in a browser without WebGL.

## 5. M0 definition of done (G0)

- Every M0 test passes under `npm test`.
- `scripts/demo-report.mjs` output equals CALCULATION_PIPELINE §16 (DOC-T1).
- Every displayed number carries a validity status.
- No displayed output contradicts DR-01 to DR-08.
- `git diff` touches only `src/`, `tests/`, `scripts/`, `index.html`, `server.mjs`, `CALCULATION_PIPELINE.md`, `MVP_METHODOLOGY.md` and `docs/`.

## 6. Next steps and their prerequisites

| Next | Owner input | Earliest start |
|---|---|---|
| M1a: core contracts (topology, hash, surfaces/bodies/components, spatial index, selection core, import, schemas) | None | After G0 |
| M4a: OpenFOAM pin, `regions` probe, 2-D NACA 0012, `surfaceCheck` | **Q-4**: install method | Any time; independent of M0 |
| M1b, M2, M3 | **Q-1**: confirm CFD scope | After G1a |
| M6 datasets (VAL-E1b, VAL-E2) | **Q-2**: regime | Before M6 |

## 7. Do not

- Do not adopt three-mesh-bvh or three-bvh-csg outside spikes S-2 and S-3.
- Do not key anything by raw `faceIndex`.
- Do not show a CFD number before the M5 gates pass, or without its regime flags.
- Do not label a steady-RANS maximum as "C_L,max" except as DEC-12 allows.
- Do not show a static-margin verdict on an assumed mass, or a CFD static margin without "unvalidated" before VAL-E2.
