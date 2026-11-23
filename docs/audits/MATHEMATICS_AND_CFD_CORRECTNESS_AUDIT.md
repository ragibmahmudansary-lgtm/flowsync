Status: **Evidence record**. This is the Phase-1 audit by Subagent B (Sonnet 5.5).

The coordinator independently confirmed these findings on 2026-10-23:
- B-VLM-01, with an independent script giving identical near-field-with-self-legs and Trefftz values.
- B-VLM-02, now strengthened: even the corrected drag gives e = 0.21 at AR 4, N = 40, with cosine spacing.
- B-REC-01 (−63 % on a y ≥ 8 m selection).
- B-STAB-01 and B-STAB-03.

See [DISCREPANCY_REGISTER.md](DISCREPANCY_REGISTER.md) §1.

**Corrections:**
1. §6.5 and elsewhere quote the demo mesh as 8 boundary / 85 non-manifold / 80 degenerate / 4 duplicate. Those are the app's tolerance-weld artefacts. The exact topology is 28 boundary edges, 5 four-use edges and 0 degenerate triangles (register V-2). The mesh is still neither watertight nor 2-manifold.
2. The arXiv 2607.15905 CSG benchmark figures come from a search summary only and **must not be quoted**.

# AirFLOW Mathematics and CFD Correctness Audit

Author model: Sonnet 5.5 (claude-sonnet-5-5). Audit date: 2026-10-23. Repository `/home/tanvir/Coding/AirFLOW`, `main`, commit `25afe85`.
Companion: `docs/audits/REQUIREMENTS_GAP_ANALYSIS.md` (traceability matrix, document contradictions).

---

## 0. Scope, evidence index, honesty notes

**Question audited.** (a) Is the mathematics that the repository actually runs correct, and is it correctly described? (b) Is the *proposed* OpenFOAM-based CFD system in `refs/CFD_Aircraft_Design_and_Simulation_Requirements.md` scientifically feasible and well specified?

**Evidence rules.** Every number labelled "measured" below was produced in this session by a throwaway script that `import`s the repository's own modules (no repository file was modified). Scripts live in
`/tmp/claude-1000/-home-tanvir-Coding-AirFLOW/76bf9998-d405-4391-a3a5-0698b59e1664/scratchpad/auditB/`:

| Script | Purpose |
|---|---|
| `check1_rect_wing.mjs` | CL_alpha and CDi vs spanwise panel count N, wake length, aspect ratio |
| `check2_drag_methods.mjs` | repo drag vs near-field with self trailing legs vs Trefftz plane |
| `check3_gamma.mjs` | circulation distribution at the tips vs N |
| `check4_demo_pipeline.mjs` | headless replica of the app's default demo run; STL orientation facts |
| `check5_signs_np.mjs` | sign conventions, neutral-point invariance, wing+tail behaviour |
| `check6_pitch.mjs` | pitch-response model: alpha vs theta, divergence |
| `check7_explore.mjs`, `check8_recognition.mjs`, `check9_stations.mjs`, `check10_slice_vs_bins.mjs` | demo-mesh structure; manual-selection emulation; planform estimator vs true slice |
| `check11_llt.mjs` (+ `_lib`) | independent Glauert/Prandtl lifting-line reference |
| `check12_spacing.mjs` | cosine vs uniform spanwise spacing convergence |
| `check13_mass.mjs` | mass/inertia vs analytic cylinder, translation invariance, orientation |
| `check14_sweep_roundtrip.mjs` | extracted quarter-chord sweep -> VLM generated sweep |
| `check15_naca_re_misc.mjs` | NACA 4-digit closure, Re, y+, Mach, domain sizes, superellipse facts |
| `check16_scale.mjs` | scale invariance of the VLM |
| `check17_zplacement.mjs`, `check18_demo_corrected.mjs`, `check19_ar_sweep_corrected.mjs` | demo seed height sensitivity; corrected drag for the demo wing; corrected drag across AR |
| `check20_stl_ascii.mjs` | ASCII STL parser edge cases |

**Category vocabulary** (as requested): VERIFIED DEFECT, SUSPECTED DEFECT, MISSING, DESIGN RISK, UNVERIFIED CLAIM, ESTABLISHED FACT, MODELLING ASSUMPTION, ENGINEERING CHOICE.

**Reference verification status.** Sources I actually opened or searched this session are marked [V] (verified, URL given). Sources cited from standard knowledge without re-opening are marked [K] (textbooks); they should be re-checked before being quoted formally. Secondary summaries obtained only through search snippets are marked [S].

**What was not done.** No browser UI session was driven; no CFD was run (no OpenFOAM/Gmsh installed); no real-aircraft data was consulted for the A320; wall-clock/cell-count estimates for CFD are engineering estimates and are labelled as such.

---

## 1. Executive summary

| ID | Sev. | Category | One line |
|---|---|---|---|
| B-VLM-01 | Critical | VERIFIED DEFECT | Induced drag excludes the panel's own trailing legs (vlmSolver.js:124), so the raw drag is *negative* (thrust) and grows with panel count; `Math.abs` (vlmSolver.js:147) hides the sign. Demo CDi is ~9x too large (0.0087 vs Trefftz 0.0009 at alpha 0). Lift is unaffected. |
| B-STAB-01 | High | VERIFIED DEFECT | Pitch-response model: because alpha(0) = theta(0), `alpha == theta` for all t (max difference 0.0). Third ODE state is inert; damping is an ad-hoc 1/s constant; the unstable case is plotted growing to 1424 deg. Not a short-period model. |
| B-VLM-02 | High | VERIFIED DEFECT | Cosine spanwise spacing with one chordwise row gives tip-panel aspect ratios of 200:1; tip circulation becomes noise for N >= ~40 (Gamma_tip/Gamma_mid 0.35 at N=24, 0.63 at N=40, 2.2 at N=64, 18.7 at N=100). UI allows N up to 80. |
| B-REC-01 | High | VERIFIED DEFECT | Vertex-binned planform envelope returns 6.78 m2 vs true 21.98 m2 (-69%) for a clean outboard-wing selection on the demo STL; results vary 20.7 -> 6.2 m2 as bin count goes 12 -> 120. |
| B-CFD-01 | Critical | MISSING | None of the proposed CFD pipeline exists: no backend, mesher, solver, BC data model, domain, post-processor. OpenFOAM and Gmsh are not installed here. |
| B-CFD-04 | High | DESIGN RISK | "Binary STL + JSON manifest" cannot carry per-region patch names into snappyHexMesh; triangle indices do not survive meshing. |
| B-CFD-05 | High | DESIGN RISK | `three-bvh-csg` requires two-manifold inputs and warns outputs may not be; the repo's own demo mesh has 8 boundary + 85 non-manifold edges. |
| B-CFD-02/03 | High | DESIGN RISK | Domain extents (3 L_ref / 6 L_ref) have no lateral/vertical size and an undefined L_ref; the four BC tags cannot express a far-field that supports an alpha sweep. |
| B-CFD-09 | High | DESIGN RISK | Steady simpleFoam + k-omega SST is appropriate for attached-flow CL, CD, Cm at Re ~1e6-1e7 and M < 0.3 only; CL,max from steady RANS is unreliable (TMR restricts comparisons to alpha below force oscillations; HiLiftPW found large RANS spread near CL,max). |
| B-VLM-03 | Medium | VERIFIED DEFECT | "Quarter-chord sweep" input is applied as *leading-edge* sweep: 24.98 deg extracted -> 22.63 deg generated. |
| B-VLM-10 | Medium | VERIFIED DEFECT | Seed wing height is `bounds.center[2]` (5.604 m) not the wing; combined with B-VLM-01 it moves the demo static margin from -28.2% to -36.5% / -40.2%. |
| B-STAB-02 | Medium | VERIFIED | `computeStaticStability` (stability.js:4-36) is never called by the app; the test named "static stability follows neutral point" does not exercise the live path. |

**Things that are correct (ESTABLISHED / verified):** Biot-Savart finite-segment kernel; quarter-chord bound / three-quarter-chord collocation; boundary-condition RHS; Kutta-Joukowski *lift*; moment cross product and nose-up-positive sign; stability-derivative sign logic (Cm_alpha > 0 when CG is aft of NP); polyhedral volume/centroid/inertia and parallel-axis maths (matches analytic cylinder to 5 digits, translation-invariant on the demo mesh); RK4 integrator implementation; CL_alpha within -3% of an independent Glauert lifting-line (AR 8) and -4.4% of Helmbold.

---

## 2. Notation, units, axes, and sign conventions

### 2.1 Conventions in force

| Item | This repo (code) | Qwen handoff | OpenFOAM `forceCoeffs` defaults | Standard flight mechanics (Etkin/Nelson [K]) |
|---|---|---|---|---|
| Units | SI (m, kg, s, N, Pa); STL has no units, so a user dropdown scales (app.js `unitScaleSelect`, axisMapping.js:18-31) | SI | SI | SI |
| Longitudinal axis | x positive **downstream/aft** (CALCULATION_PIPELINE L36) | X forward | drag dir (1 0 0) = flow direction | x forward |
| Lateral | y = STL Z by default (axisMapping.js:10-14) | Y right | side dir (0 1 0) | y right |
| Vertical | z = STL Y (up) | Z up | lift dir (0 0 1) | z down |
| Handedness | x aft, y lateral, z up is right-handed iff y is starboard | X fwd, Y right, Z up is **left-handed** | right-handed | right-handed |
| Freestream (relative wind) | (cos a cos b, cos a sin b, sin a) times V (vlmSolver.js:92-97) | (-cos a, 0, sin a) | user | (-cos a, ., -sin a) in x-fwd, z-down body axes |
| Lift direction | (-sin a, 0, cos a) (vlmSolver.js:143) | derived | `liftDir` input | perpendicular to wind |
| Drag | `abs(F . e_inf)` (vlmSolver.js:147) | along wind | `dragDir` input | along wind |
| Pitching moment | M_y about the CG; Cm = +M_y/(q S MAC) (vlmSolver.js:136, 161); nose-up positive | Cm = -M_y/(q S MAC), nose-up positive | axis `pitchAxis` (0 1 0); **no sign convention given** in the ESI documentation [V] | nose-up positive |
| Moment reference | mass-model CG (app.js:335) | quarter-MAC, SM measured to CG afterwards | `CofR` input | CG |
| Reference area | `refAreaInput` (user / recognised planform integral) | wing | `Aref` | wing S |
| Reference chord | `refMacInput` | MAC | `lRef` | MAC |
| Static margin | (x_NP - x_CG)/MAC, positive stable (vlmSolver.js:208-209) | (x_cg - x_np)/MAC with X forward | n/a | (x_NP - x_CG)/c-bar with x aft |

**Sign derivation (ESTABLISHED FACT, verified numerically).** In the repo frame (x aft, z up, y starboard) a positive rotation about +y carries z toward x, so the nose, which sits at negative x, goes up. Hence M_y > 0 is nose-up and `Cm = +M_y/(qS c)` is the standard convention. Numerical confirmation (check5): a planar AR-8 rectangular wing gives Cm_alpha = -1.166 (reference at x = 0.0, ahead of the AC), 0.000 (x = 0.25), +0.699 (x = 0.4), +1.632 (x = 0.6); neutral point 0.2480-0.2527 for all four references (invariant to 0.005 chord, expected 0.25).

### 2.2 Handedness and the improper axis mapping (B-MASS-03)

`DEFAULT_AXIS_MAPPING` maps STL (X, Y, Z) to internal (x, y, z) = (X, Z, Y): a transposition, determinant -1. From a right-handed STL frame this produces a **mirrored** copy of the aircraft in the internal frame. Measured consequences: signed volume of the raw STL +460.691 m3, of the mapped mesh -460.691 m3; the normal of a triangle on the upper surface of the wing has n_z = -0.99 (inward). The code tolerates this (volume uses `abs` and a `sign` factor, geometry.js:89-100; selection and VLM do not use triangle orientation). `internalToScene` (axisMapping.js:51-53) is a second transposition, so the viewer shows the original STL handedness again. For a laterally symmetric aircraft the mirror is physically harmless. It becomes a hazard for any CFD export: the mapped mesh has inward-pointing facet normals and reversed handedness, which matters for `snappyHexMesh`/`surfaceCheck` and for any asymmetric BC or mass distribution.

### 2.3 Wind axes and reference quantities

- Wind direction e_inf = (cos a cos b, cos a sin b, sin a); the VLM trailing legs are aligned with e_inf (not with body x) (vlmSolver.js:92-100).
- Lift unit vector e_L = (-sin a, 0, cos a). For b != 0, e_L . e_inf = sin a cos a (1 - cos b), i.e. not exactly perpendicular; at a = 10 deg, b = 10 deg this is 0.0026 (B-VLM-09, Low).
- Nondimensionalisation: q = 0.5 rho V^2; CL = L/(qS); CDi = abs(D)/(qS); Cm = M_y/(q S MAC) (vlmSolver.js:142-161). S and MAC are *inputs* (index.html:98-100 `refAreaInput`, `refMacInput`), not recomputed from the panel geometry (B-VLM-05).

---

## 3. Audit of the implemented mathematics

### 3.1 STL ingest and axis mapping

- Binary vs ASCII detection by `84 + 50 N` length match, else by absence of the `solid` header (stlParser.js:9-17). Standard.
- Facet normals in binary files are read but never used for geometry (CALCULATION_PIPELINE L50). Correct practice.
- ASCII: `solid` names are discarded; two named solids parse as 2 triangles with no region information; numbers of the form `1.` (trailing dot) or `nan` make the parser throw "no complete triangles" (check20). B-STL-01 (Low for the VLM, relevant for any CFD region export).
- Axis mapping validity (three distinct STL axes) is enforced (axisMapping.js:33-43). Manifest point masses are transformed on remap; the inverse algebra (raw = internal / scale * sign) is correct (app.js:883-896).

### 3.2 Volume, centroid, inertia (geometry.js:54-120, 206-260) — VERIFIED CORRECT

- Signed tetrahedron volume V_i = a . (b x c)/6; centroid sum V_i (a+b+c)/4; second moments of a tetrahedron with one vertex at the origin: `int x^2 dV = (V/10)(a^2+b^2+c^2+ab+ac+bc)` and `int xy dV = (V/20)(2 sum x_i y_i + sum_{i!=j} x_i y_j)` — both are the standard exact tetrahedron integrals.
- Parallel-axis: `I_cg = I_O - m[(d.d)I - d d^T]` (direction -1 at geometry.js:110) and the reverse for aggregation (massModel.js:79). Algebra checked, including the sign of off-diagonal terms.
- Measured (check13): solid prism-cylinder (R = 1.5, L = 10, m = 1000, 720 sides): V = 70.6849 (exact prism 70.6849), centroid x = 5.0000, Ixx = 1124.99 (m R^2/2 = 1125.00), Iyy = Izz = 8895.83 (m(3R^2+L^2)/12 = 8895.83). Translating the cylinder by (100, -50, 30) leaves V and I_cg unchanged.
- Demo mesh translation test: signed volume changes by < 1e-4 m3 for translations up to (100, 100, 100) m, i.e. the oriented surface is effectively a closed cycle despite 8 boundary and 85 non-manifold edges (counts reproduce tests/demoRegression.test.mjs). The remaining uncertainty is interpenetrating/overlapping solids (nacelles into wing), which a signed sum double counts (cannot be tested without ground truth) — MODELLING ASSUMPTION, see B-MASS-02.

### 3.3 Mass model (massModel.js)

- Total CG = sum m_i r_i / M; inertia = sum I_local + m[(d.d)I - d d^T] (massModel.js:67-81). Correct.
- Default manifest: one `mesh-volume` entry of 42,600 kg uniformly distributed over the enclosed STL volume, positioned at the volume centroid (massModel.js:3-19, 113-122). Implied density 92.47 kg/m3 over 460.69 m3. Measured: CG = [17.282, 0.005, 3.097] m, i.e. 46.2% of the 37.44 m length from the nose; Iyy = 3.148e6 kg m2, radius of gyration 8.60 m = 0.230 L. These are consequences of the *assumption* (uniform density over the envelope), not aircraft data; the repo says so (CALCULATION_PIPELINE L175, L571). I did not verify any published A320 inertia, so no claim is made about their realism.

### 3.4 Planform extraction (recognition.js:112-215)

Algorithm: collect all vertices of assigned triangles; bin by y into `clamp(round(sqrt(nTri)), 12, 120)` bins (recognition.js:140-141); per bin, chord = max x - min x over the vertices **inside that bin**; empty bins are linearly interpolated (recognition.js:162, 262-278); S = trapezoidal integral of chord; MAC = integral c^2 / S; root = mean of 3 bins nearest the centre; tip = mean of 4 bins nearest the two ends; sweep and dihedral = least-squares slopes of quarter-chord x and mid-thickness z against y on the right half.

Formulas for S, MAC, AR are correct for an exact chord function. The defect is the *chord estimator*: it only sees vertices, not the triangles that span bins. Findings B-REC-01..04 below. Also: the regression uses all right-half stations, including the fuselage-blended inboard region and any Yehudi kink, and returns a single sweep and dihedral.

### 3.5 VLM geometry and kernel (vlmSolver.js:21-83)

Verified correct:
- Bound vortex from `LE + 0.25 c` at the two panel edges; control point at mid-span `LE + 0.75 c` (vlmSolver.js:39-41); unit test confirms x = 0.25 and 0.75 for chord 1.
- Panel normal = normalise(chordDirection x boundTangent), flipped to +z (vlmSolver.js:44-45). The chord direction is `(cos i, 0, -sin i)` so incidence rotates the panel plane; dihedral enters through the bound tangent; sweep drops out of the cross product (it is parallel to the chord). Camber and twist do not exist.
- Finite-segment Biot-Savart: `factor = r0 . (r1/|r1| - r2/|r2|) / (4 pi |r1 x r2|^2)`, `v = factor (r1 x r2)` with `r1 = P - A`, `r2 = P - B`, `r0 = B - A`. This is Katz & Plotkin 2nd ed. Eq. (2.72) [K]. The horseshoe is wake-in leg + bound + wake-out leg with the circulation direction consistent with positive lift (checked by the sign test: Gamma > 0, lift +z).
- RHS = -V_inf . n; direct Gaussian elimination with partial pivoting; residuals at 1e-15 .. 1e-13 for N = 8..120 (a trivially small number for any nonsingular direct solve; see B-VLM-04).
- Wake legs are straight, aligned with the freestream (so they rotate with alpha and beta) and have finite length `max(wakeFactor * refChord, 5 refChord)` (vlmSolver.js:100), 20 chords by default. This is a stated simplification (plan.md FS-05-005). Measured effect of wake length on lift is small (B-VLM-07).

Not implemented (MODELLING ASSUMPTION, documented): camber, twist, thickness, multiple chordwise rows, control surfaces, fuselage, ground effect, wake roll-up, compressibility (target M < 0.3), viscous effects.

### 3.6 Force, moment, drag evaluation (vlmSolver.js:121-171) — contains the critical defect

For each panel i the code evaluates the velocity at the bound-vortex midpoint induced by all panels j **except i** (`if (i === j) continue;`, vlmSolver.js:124), adds the freestream, and applies Kutta-Joukowski `F_i = rho Gamma_i (V_eff x dl_i)`.

Two things are correct: using the *full* effective velocity in the cross product gives the standard KJ lift, and total lift is insensitive to the omission (CL agrees to 5 digits with and without the self legs, check2). Moment = (bound midpoint - reference) x F is the right lever arm for a force acting at the quarter-chord bound midpoint.

The error: the panel's own two trailing legs lie a distance Delta y_i/2 from the bound midpoint on either side and induce a downwash (through the panel) of magnitude about Gamma_i/(pi Delta y_i) (two semi-infinite legs). In the sum over *all* horseshoes the leg shared by neighbouring panels carries the difference Gamma_i - Gamma_{i-1} and is small; removing panel i's own contribution leaves the neighbours' half, Gamma_{i-1} and Gamma_{i+1}, as an unbalanced **upwash** of order Gamma/(pi Delta y). Because Delta y -> 0 as N grows, the spurious term grows with N. Substituting w' = (spurious upwash) in `D = rho Gamma l (-w' cos a + u' sin a)` yields negative drag (thrust) whose magnitude increases with N. `inducedDragN = Math.abs(...)` (vlmSolver.js:147) turns the thrust into a positive "drag".

The existing helper already supports the fix: `inducedVelocityHorseshoe(point, panel, wake, length, includeBound = true)` (vlmSolver.js:76) — pass `includeBound = (i !== j)` and include `j = i`.

Moment consequence: M_y is computed about the full 3D CG, so any vertical offset between the wing plane and the CG multiplies the spurious x-force; B-VLM-10 quantifies this on the demo.

### 3.7 Sweep post-processing, CL_alpha, Cm_alpha, SM, NP, trim (vlmSolver.js:173-227)

- `slope()` is ordinary least squares; the fit window is |alpha| <= 5 deg; slopes are converted per-degree to per-radian (vlmSolver.js:204-206). Correct.
- SM = -Cm_alpha/CL_alpha and x_NP = x_CG + SM * MAC (vlmSolver.js:208-209) are right for x aft (verified numerically in 2.1, and by NP invariance). The static-margin definition uses wind-axis CL and body-axis moment; the difference is second order in CD and negligible when CD is physical, but it is what makes the measured NP drift by 0.005 chord with the spurious thrust present.
- Trim: `alpha_trim = -Cm(case nearest alpha=0) / Cm_alpha` (vlmSolver.js:210-213). Approximation (documented); an intercept from the OLS fit would be more consistent (B-STAB-04, Low).
- `stable = Cm_alpha < 0 && SM > 0` (vlmSolver.js:224): redundant conditions; fine.
- For a wing alone (no tail assigned) the NP is the wing's AC; for the demo seed this puts the NP at x = 16.10 m versus the volume-centroid CG at 17.28 m: "unstable, -28.2%" is an artefact of omitting the tail and fuselage, as CALCULATION_PIPELINE L571 itself states (B-STAB-03).

### 3.8 Pitch-response model (stability.js:38-75, 90-116) — B-STAB-01

ODE actually integrated: `theta' = q`, `q' = qbar S MAC (Cm(0) + Cm_alpha alpha)/Iyy - d_q q`, `alpha' = q - 1.25 (alpha - theta)`, `d_q` = user "pitch damping 1/s" (index.html:123), 12 s at dt = 0.025 s, RK4 (RK4 implementation is correct).

Defects:
1. Initial condition is `theta = alpha = trim + 2 deg` (stability.js:47-52). Then `d(alpha - theta)/dt = -1.25 (alpha - theta)` keeps the difference at exactly zero. Measured: max |theta - alpha| over 12 s = 0.00e+0 for both a stable and an unstable case (check6). The graph (app.js:795-801) therefore draws two identical curves labelled "theta deg" and "alpha deg".
2. The model is a one-degree-of-freedom pitching pendulum with aerodynamic spring `omega^2 = -qbar S MAC Cm_alpha/Iyy`. There is no lift/Z_alpha coupling (the term that makes alpha lag theta in the real short-period mode), no Cm_q, no Cm_alpha-dot, no speed or flight-path state. Textbook short-period dynamics (Etkin & Reid; Nelson [K]) need at least (alpha, q) with Z_alpha = -q S CL_alpha/(m V), M_q, M_alpha-dot.
3. `d_q` has units 1/s and is not related to Cm_q (which would be `q S MAC^2 Cm_q/(2 V Iyy)` in 1/s). A default of 0.65 1/s is an unreferenced number.
4. For Cm_alpha > 0 (the demo!) the linear model diverges exponentially. Measured: theta = alpha = 1424 deg and q = 827 deg/s at t = 12 s (check6), plotted as a "pitch response".
5. The pitch spring uses Cm(0) from the nearest-alpha case and Iyy from the uniform-density mass model, so even the single surviving natural frequency inherits B-VLM-01/10 and B-MASS-02.

### 3.9 Provenance of every plotted or displayed value

| Item (app.js) | Source numbers | Class |
|---|---|---|
| "CL" curve (777) | VLM `result.cl` per alpha; flat plate, KJ lift | Computed (flat-plate VLM; valid linear range only) |
| "CD total" curve (778) and "Drag kN" (788) | `cdi` (defective, B-VLM-01) + `cd0` input (default 0.025) (vlmSolver.js:191, 195) | Computed-but-wrong + **user-assumed constant** |
| "Cm" curve (779) and "Moment kN m" (789) | VLM M_y about CG plus `cm0` input (default 0) (vlmSolver.js:192, 196) | Computed + user-assumed constant |
| "Lift kN" (787) | q S CL | Computed |
| Pitch plot (795-801) | ODE of 3.8 | Derived with ad-hoc parameters; physically invalid (B-STAB-01) |
| Tiles: static margin, NP, CL_alpha, Cm_alpha, trim (754-766) | OLS on the series | Computed (wing(+H-tail) only) |
| "CDi at 0 deg" tile (763) | `cdi` at the nearest alpha to 0 | Computed-but-wrong |
| "Aero center x m" input (index.html:112) | recognised: area-weighted quarter-chord x (recognition.js:182-184); **seed**: `bounds.min[0] + 0.4 length` (stability.js:85) | Placeholder for the seed |
| Lift arrow in the viewport (app.js:602) | length `maxSize * 0.22 * sign(lift)`, direction +y scene | Placeholder glyph: not scaled to the load |
| VLM wake lines (app.js:564-579) | alpha of the case nearest 0, length `max(2 MAC, 1)` | Illustrative; actual solver wake is 20 MAC |
| Flow arrow (app.js:594-603) | yaw only, ignores alpha | Illustrative |

There is **no** pressure contour, velocity field, streamline, Cp distribution, CL-CD polar, spanwise loading plot, or CL,max in the repository. The "VLM lattice" overlay is geometry, not a solution field.

---

## 4. Numerical checks and their real outputs

### 4.1 Lift-curve slope vs theory (check1, check11, check12, check19)

Independent reference: a Glauert/Prandtl lifting-line implementation written for this audit (Fourier series, 40 odd terms, section lift slope 2 pi), cross-checked against Helmbold's formula `2 pi AR/(2 + sqrt(4 + AR^2))` and `2 pi AR/(AR+2)`.

| AR (rect.) | LLT CL_alpha | LLT e | VLM N=40 cosine, 20c wake | VLM vs LLT | Helmbold | VLM vs Helmbold |
|---|---|---|---|---|---|---|
| 4 | 4.0284 | 0.972 | 3.7846 | -6.1% | 3.8832 | -2.5% |
| 6 | 4.5304 | 0.954 | 4.3415 | -4.2% | 4.5287 | -4.1% |
| 8 | 4.8377 | 0.937 | 4.6909 | -3.0% | 4.9058 | -4.4% |
| 12 | 5.1991 | 0.907 | 5.1069 | -1.8% | 5.3227 | -4.1% |
| 20 | 5.5443 | 0.861 | 5.5055 | -0.7% | 5.6862 | -3.2% |

(AR 2: VLM 2.7626 vs Helmbold 2.6026, +6.1%.) Verdict: lift slope is reasonable for AR >= 4 (plan.md's 5% criterion is met vs LLT for AR >= 6, borderline vs Helmbold); this validates the kernel, the BCs and KJ *lift*. It says nothing about drag, moment, camber, or complex geometries.

Convergence of CL_alpha with N (AR 8, cosine, 20c wake): N=8 4.844, 16 4.737, 24 4.708, 32 4.697, 48 4.689, 64 4.690, 80 4.692, 120 4.698. The slope converges to about 4.69 (the small upturn at N >= 80 is the tip-panel noise of B-VLM-02).

### 4.2 Induced drag: repo vs corrected near-field vs Trefftz (check1, check2, check12, check19, check18)

AR 8 rectangular, alpha = 4 deg, CL ~ 0.328. Theory: Glauert e = 0.9367 gives CDi = 4.59e-3.

| N (cosine, repo spacing) | CL | CDi repo (signed `F . e_inf/qS`) | near-field with self legs | Trefftz (far field) |
|---|---|---|---|---|
| 8 | 0.33820 | -1.158e-2 | 4.107e-3 | 4.150e-3 |
| 16 | 0.33072 | -2.496e-2 | 4.218e-3 | 4.260e-3 |
| 24 | 0.32871 | -3.873e-2 | 4.389e-3 | 4.430e-3 |
| 32 | 0.32790 | -5.267e-2 | 4.777e-3 | 4.817e-3 |
| 48 | 0.32737 | -8.077e-2 | 8.283e-3 | 8.324e-3 |
| 64 | 0.32743 | -1.071e-1 | 3.290e-2 | 3.294e-2 |
| 80 | 0.32756 | -1.091e-1 | n/a | n/a |
| 120 | 0.32795 | +7.712 | n/a | n/a |

Interpretation: (i) the repo's raw drag is negative at every N from 8 to 100 and its magnitude grows roughly proportionally with N (the +7.7 at N = 120 is meaningless; I did not isolate its cause, and the tip-panel blow-up of B-VLM-02 and the absolute cut-off at vlmSolver.js:71 are the candidates); the UI displays `abs()` of it. (ii) Near-field-with-self-legs and the independent far-field Trefftz computation agree within 1% of each other and with LLT within about 4-11% for N <= 32 (near-field-with-self-legs is -10.5%, -8.1%, -4.4% and +4.1% vs the 4.59e-3 Glauert value at N = 8, 16, 24, 32); both diverge at N >= 48 because of B-VLM-02, not because of the drag method.

Uniform spanwise spacing removes the second problem (check12, "CDi corrected"): N = 8 4.166e-3, 16 4.185e-3, 24 4.190e-3, 40 4.211e-3, 64 4.254e-3, 100 4.316e-3 (variation 3.6% over a 12x change in N), implied e 1.11 -> 0.98 (converging), while the repo's raw value drifts from -1.454e-2 to -2.139e-1.

Across aspect ratio (check19, uniform N = 32, wake 10 spans) corrected CDi / LLT CDi = 0.954 (AR 4), 0.943 (6), 0.935 (8), 0.927 (12); repo raw drag: -8.48e-2, -7.49e-2, -6.56e-2, -5.16e-2, i.e. 15x to 16x the correct magnitude with the wrong sign.

**Demo wing** (seed reference, 24 panels, check4 + check18):

| alpha | CL | CDi repo (signed) | UI value (abs) | near-field corrected | Trefftz | repo/Trefftz |
|---|---|---|---|---|---|---|
| 0 | 0.1675 | -0.00867 | 0.00867 | 0.00076 | 0.00092 | 9.4x |
| 5 | 0.5881 | -0.10674 | 0.10674 | 0.00942 | 0.01152 | 9.3x |
| 10 | 1.0018 | -0.31361 | 0.31361 | 0.02900 | 0.03538 | 8.9x |

At alpha = 10 deg the UI would report CDi = 0.314 and a "total CD" of 0.339; the corrected CDi is 0.03 (e ~ 1). Note that the documented headline `CDi(0) ~ 0.0087` (CALCULATION_PIPELINE L566) is thus ~9.4x too large.

### 4.3 Tip-panel behaviour and spacing (check3, check12)

Circulation near the right tip (AR 8, alpha = 4 deg):
- N = 24: Gamma = 2.607 (outermost), 3.001, 3.985 ... 7.472 at the root; pivot ratio 2.74e-1; tip panel width 3.4e-2 m (chord 1 m).
- N = 48: outermost 7.030, next 1.576, 2.716, ...; pivot ratio 1.70e-1; tip width 8.6e-3 m.
- N = 64: outermost 16.648, next **-0.964**, then 2.895, ...; pivot ratio 4.06e-2; tip width 4.8e-3 m (aspect ratio 208:1).

Max |Gamma_tip/Gamma_mid| (check12): cosine 0.52 (N=8), 0.35 (16), 0.35 (24), 0.63 (40), 2.23 (64), 18.68 (100); uniform 0.75, 0.58, 0.50, 0.41, 0.35, 0.32 (smooth, monotone). The solver's own quality gate (app.js:765: pivot ratio > 1e-7 and residual < 1e-7) says "numerically resolved" in all of these cases.

### 4.4 Wake length (check1 B, C)

AR 8, N = 40, alpha = 4 deg: CL_alpha = 4.7816 (5c), 4.7144 (10c), 4.6909 (20c, default), 4.6836 (50c), 4.6826 (100c), 4.6822 (1000c) — 0.19% difference between 20c and 1000c. AR 30: 5.7361 (20c) vs 5.7049 (2000c), 0.55%. Lift is insensitive; drag would be (induced drag is a far-field quantity), but that is moot until B-VLM-01 is fixed.

### 4.5 Scale invariance (check16)

CL (AR 8, N = 24, alpha 4 deg) is 0.32871 for chord 10, 1, 0.1 and 0.03 m; 0.33337 at 0.01 m; 1.90764 at 0.003 m; 26.26177 at 0.001 m. The absolute cut-off `EPSILON = 1e-10` on `|r1 x r2|^2` (vlmSolver.js:71, units m^4) is not scale-invariant (B-VLM-08).

### 4.6 Planform estimator vs true slice (check8, check9, check10, check14)

Demo mesh facts (check7): wing/engine/tail layout in 1 m bins of |y|; HTail occupies |y| <= 6.2 m near x = 32-36.6 m; engines near |y| = 5-7 m; outboard of |y| = 8 m the surface is wing only (slice chord 2.67 m at y = 8.5 m falling to 1.69 m at y = 16.5 m, from the plane-slice reference of check10).

- Manual selection emulation by the app's own tools (`growSelection` from one upper-skin seed and one lower-skin seed at |y| ~ 10 m, cap 15,000, check8): angle 10 deg -> 886 triangles; 18 deg (the UI default) -> 1,437; 30 deg -> 2,308. The "reference" extracted from the 1,437-triangle patch: span 14.94 m, area 30.39 m2, root chord 1.72 m, tip chord 3.16 m, `valid = true` and only the both-skins warning. The wing is composed of many patches; one seed does not give a usable wing.
- Clean outboard-wing selection (all 8,132 triangles with every vertex at y >= 8 m, check10): repo area 6.78 m2 (span 8.88 m), MAC 1.910 m; **true area by slicing every triangle at 400 y-planes: 21.98 m2** (integration range 8.0-16.99 m vs the estimator's 8.11-16.99 m; the 1.2% range difference is far below the error). Chord at sample stations: true vs repo = 2.67/0.00 (8.5 m), 3.11/0.25 (9.5), 2.91/0.04 (10.5), 2.71/0.07 (11.5), 2.52/0.02 (12.5), 2.32/2.33 (13.5), 2.12/0.03 (14.5), 1.92/0.00 (15.5), 1.69/1.13 (16.5).
- Bin-count sensitivity of the same selection (`binCount` option): 12 -> 20.70 m2; 30 -> 13.75; 60 -> 9.19; 120 -> 6.24 (default `sqrt(8132)` = 90 -> 6.78).
- Round-trip on a **clean, dense synthetic wing** (200 spanwise strips, known 25 deg quarter-chord sweep, 5 deg dihedral, cr 5.4, ct 1.9, b 34): S = 126.56 (true 124.10, +2.0%), MAC 3.994 (3.930), sweep 24.98 (25), dihedral 5.00 (5). Fed to `createLiftingSurface`/`generateVlmPanels`, the generated bound-vortex line has quarter-chord sweep **22.63 deg**.

Reading: the estimator is accurate when vertices are dense in every bin (the synthetic wing; the unit test with 4 triangles works because empty bins are interpolated between extreme vertices), and fails on real CAD tessellation where long thin triangles span many bins.

### 4.7 Seed wing height (check17)

Same seed wing, CG at [17.282, 0.005, 3.097]: wing root z = 5.604 m (the code, app.js:365): Cm_alpha +1.354, SM -28.2%, NP x 16.099 m; z = 3.097 m: +1.753, -36.5%, 15.750 m; z = 2.0 m: +1.928, -40.2%, 15.597 m. A physically correct drag would change Cm_alpha by roughly CD_alpha * Delta z/MAC = 0.062 * 0.6 = 0.037 per rad for the 2.5 m shift; the observed shift is 0.40 per rad, i.e. about ten times larger and caused by the spurious x-force (B-VLM-01).

### 4.8 Mass/inertia (check13)

See 3.2. Additional: raw signed volume +460.691 m3, mapped -460.691 m3. Implied uniform density of the 42,600 kg seed: 92.47 kg/m3.

### 4.9 NACA, Re, y+, Mach, domain (check15)

- NACA 4-digit thickness `y_t = 5 t (0.2969 sqrt(x) - 0.1260 x - 0.3516 x^2 + 0.2843 x^3 - 0.1015 x^4)`: with a4 = -0.1015, y_t(1)/c = 1.260e-3 for t = 0.12 (open trailing edge, total TE thickness 0.25% c); with a4 = -0.1036, the coefficient sum is -2.8e-17 and y_t(1) = -1.7e-17 (closed). Leading-edge radius `1.1019 t^2` = 0.01587 c for t = 0.12 (formula [K]).
- Reynolds numbers (ISA, Sutherland viscosity; chord = demo MAC 4.193 m; first-cell estimates from the Schlichting flat-plate Cf, flat-plate y1 = y+ nu/u_tau): A320 demo default (72 m/s, sea level): Re = 2.07e7, M = 0.212, y1(y+=1) = 5.5 um, y1(y+=30) = 0.17 mm. A320 cruise (M 0.78, 11 km): Re = 2.47e7, nu = 3.906e-5 m2/s, y1(y+=1) = 4.7 um. Small UAV (15 m/s, c = 0.25 m): Re = 2.57e5, y1(y+=1) = 18 um. Wind-tunnel-like (40 m/s, c = 0.3 m): Re = 8.2e5.
- Compressibility: isentropic stagnation density rise 0.50% (M 0.1), 2.01% (0.2), 2.22% (0.212), 4.56% (0.3), 33.3% (0.78); Prandtl-Glauert factor 1.0228 at M 0.212, 1.0483 at 0.3, 1.598 at 0.78.
- Domain extents for the demo (span 33.98 m, MAC 4.19 m, length 37.44 m): L_ref = fuselage length: 3L = 112.3 m upstream (3.31 spans, 26.8 MAC), 6L = 224.6 m downstream (6.61 spans, 53.6 MAC); L_ref = span: 3.0 / 6.0 spans; L_ref = MAC: 12.6 m upstream (0.37 span) and 25.1 m downstream (0.74 span).
- Superellipse: area ratio to the ellipse 0.492 (n 0.8), 0.637 (1), 0.871 (1.5), 1.000 (2), 1.076 (2.5), 1.180 (4); C^1 at the axis points only for n > 1; infinite curvature there for 1 < n < 2.

---

## 5. Findings register for the implemented system

Format: category, severity, evidence, consequence, proposed correction, verification/acceptance test.

### B-VLM-01 — Induced drag evaluation (Critical, VERIFIED DEFECT)

- **Evidence.** vlmSolver.js:124 (`if (i === j) continue;`), 133-135 (V_eff and KJ force), 147 (`Math.abs`). CALCULATION_PIPELINE L361-365 and L401-405 and MVP_METHODOLOGY L65-66 specify the same flawed scheme. Measured (4.2): signed CDi negative for N = 8..100; magnitude grows with N; at the default N = 24, AR 8, repo -3.873e-2 vs Trefftz 4.430e-3, near-field-with-self-legs 4.389e-3, Glauert 4.59e-3. Demo: CDi(0) 0.00867 vs Trefftz 0.00092 (9.4x).
- **Consequence.** Every number derived from drag is wrong: CDi, "CD total", Drag kN, the drag curves, L/D, any e estimate, and (through the lever arm) Cm, Cm_alpha, SM, NP and trim whenever the wing plane is vertically offset from the CG (B-VLM-10). The MVP test "cdi/CL^2 within 1.35" cannot detect it because the ratio is scale-free. The documented demo headline CDi(0) = 0.0087 is wrong.
- **Proposed correction.** (1) In the force loop evaluate `inducedVelocityHorseshoe(P[i].boundMidpoint, P[j], wake, L, i !== j)` for **all** j including i (bound self-term excluded, trailing legs included). (2) Return the signed drag `dot(totalForce, e_inf)`; remove `Math.abs`; if it is negative beyond a tolerance, raise a visible diagnostic. (3) Optionally add a Trefftz-plane drag as an independent check (Katz & Plotkin, Ch. 12 [K]; implemented in check2.mjs). (4) Make the wake long compared with the span (e.g. 10 spans), not 20 chords.
- **Acceptance.** For rectangular AR in {4, 6, 8, 12}, uniform spacing N in {16, 32, 64}, alpha = 4 deg: signed CDi > 0; CDi within 10% of the Glauert value `CL^2/(pi AR e_LLT)` (measured corrected/LLT = 0.927-0.954); CDi variation over N below 5%; near-field vs Trefftz within 3%. Unit test must assert `D_i > 0` at positive CL and `D_i` insensitive to N within tolerance.

### B-VLM-02 — Tip-panel instability from cosine spacing (High, VERIFIED DEFECT)

- **Evidence.** vlmSolver.js:30-32 (always cosine). Measured 4.3: Gamma_tip/Gamma_mid = 0.35 (N=24), 0.63 (40), 2.23 (64), 18.68 (100); outermost Gamma = 16.6 and neighbour -0.96 at N=64; tip panel width 4.8e-3 m vs chord 1 m. UI cap is 80 (app.js:380), solver cap 120 (vlmSolver.js:22). Uniform spacing is smooth for all N tested.
- **Consequence.** Users who raise "Spanwise panels" above ~32-40 see growing noise in loading and drag (even after B-VLM-01 is fixed), while the solver badge says "numerically resolved".
- **Correction.** Use uniform (or a mild, aspect-ratio-limited) spacing for a single chordwise row; cap panel aspect ratio chord/width at about 5-10 (a common VLM guideline; K&P discuss panel layout [K]); warn or refuse otherwise. If tip resolution is wanted, add chordwise rows first.
- **Acceptance.** Gamma(y) monotone from root to tip for rectangular and tapered wings at N = 16..80; CL_alpha change between N = 40 and N = 80 below 1%; CDi (corrected) change below 5%.

### B-VLM-03 — Sweep reference line (Medium, VERIFIED DEFECT)

- **Evidence.** index.html:106 labels the input "Quarter-chord sweep deg"; recognition.js:187, 207 extracts quarter-chord sweep; vlmSolver.js:270-276 sets `x_LE(y) = x_root + |y| tan(sweep)`. Measured: 24.98 deg in, 22.63 deg generated quarter-chord sweep (for cr 5.4, ct 1.9, b 34: the difference is `0.25 (cr - ct)/(b/2)` in tan).
- **Consequence.** Wrong NP/AC location and Cm_alpha for tapered swept wings; 2-3 deg sweep error on the A320-class wing.
- **Correction.** Convert: `x_LE(y) = x_q,root + |y| tan(Lambda_c/4) - 0.25 c(y)` (and place the root accordingly), or relabel the input as leading-edge sweep and extract that.
- **Acceptance.** Round trip: for synthetic trapezoids with known quarter-chord sweep, the generated bound-vortex line sweep equals the input within 0.05 deg.

### B-VLM-04 — Quality diagnostics give false assurance (Medium, VERIFIED DEFECT)

- **Evidence.** vlmSolver.js:229-268 (residual and pivot ratio), app.js:765 (`quality = pivotRatio > 1e-7 && residual < 1e-7`). Measured: residuals 1e-15..1e-13 and pivot ratios 4e-2..3e-1 for the N = 24-64 cases whose Gamma distributions are wrong. The pivot ratio is not a condition number (CALCULATION_PIPELINE L357 admits this).
- **Consequence.** A direct solve always yields tiny residuals; the badge conveys no information about discretisation quality.
- **Correction.** Replace with checks that detect problems: panel aspect ratio, smoothness of Gamma(y), N-independence of CL (re-solve at N/2), sign of induced drag, symmetry of Gamma for symmetric cases, and a true condition estimate (e.g. 1-norm estimator or SVD for N <= 200).
- **Acceptance.** Badge turns to warning for the N = 64 cosine case and for any negative induced drag; remains good for uniform N = 24.

### B-VLM-05 — Reference area/chord independent of panel geometry (Medium, DESIGN RISK)

- **Evidence.** Panels come from span/root/tip/sweep (app.js:355-367); `refAreaM2`, `refChordM` come from separate inputs (app.js:373-379, 331-333). The seed makes them consistent by construction (root chord derived from S, app.js:257); the recognised path takes S as the envelope integral but root/tip chords from nearest-station averages (recognition.js:175-181), so `b (cr + ct)/2` differs from S for any non-trapezoidal wing (measured +0.5% on the clean synthetic wing; larger for kinked wings).
- **Consequence.** CL and Cm are normalised by an area the lattice does not have; users can also edit S independently, rescaling CL arbitrarily.
- **Correction.** Compute S, MAC and span from the actual lattice geometry (or lock the inputs and show the mismatch).
- **Acceptance.** `abs(S_ref - b (cr+ct)/2)/S_ref` shown and warned above 2%.

### B-VLM-06 — Flat plate, no camber/twist/tail incidence (Medium, MODELLING ASSUMPTION)

- **Evidence.** vlmSolver.js:21-61 has only constant incidence; the tail is created with `incidenceDeg: 0` (app.js:323) while the wing defaults to 2 deg (index.html:108); `cm0` default 0 (index.html:123).
- **Consequence.** CL(0), trim alpha and Cm(0) depend on arbitrary inputs, not on the aircraft (CL(0) = 0.1675 is just `CL_alpha * 2 deg`). Trim is not meaningful without camber, tail incidence and fuselage moment.
- **Correction.** Document the limitation next to the trim tile; add camber/twist from airfoil data when airfoils exist.
- **Acceptance.** Trim shown only when the model contains a tail, or labelled "wing-only, flat-plate".

### B-VLM-07 — Finite wake legs tied to chord (Low, DESIGN RISK)

- **Evidence.** vlmSolver.js:100. Measured 4.4: 0.19% (AR 8) to 0.55% (AR 30) change in CL_alpha between 20c and 1000c.
- **Consequence.** Negligible for lift; matters for induced drag and for large AR.
- **Correction.** Define wake length relative to span (>= 10 b) or use true semi-infinite legs.
- **Acceptance.** Corrected CDi changes <2% between 10 b and 100 b.

### B-VLM-08 — Absolute epsilon breaks scale invariance (Low, VERIFIED DEFECT)

- **Evidence.** vlmSolver.js:1-2, 71. Measured 4.5: CL = 0.32871 for chord >= 0.03 m; 1.908 at 0.003 m; 26.26 at 0.001 m.
- **Consequence.** An STL in metres read with the wrong unit scale (e.g. as millimetres, shrinking a 37 m aircraft to 37 mm) gives plausible-looking but wrong numbers instead of an error.
- **Correction.** Use a relative cut-off (fraction of segment length squared) and/or a vortex-core model (Lamb-Oseen or Vatistas) and reject models with characteristic length below a sanity bound.
- **Acceptance.** CL identical to 1e-6 for scale factors 1e-3..1e3.

### B-VLM-09 — Sideslip handling (Low, DESIGN RISK)

- **Evidence.** vlmSolver.js:92-97 (beta enters freestream), 143 (lift direction ignores beta), 147 (drag magnitude only). No side force, rolling or yawing moment, and "lateral-directional derivatives are not extracted" (CALCULATION_PIPELINE L301).
- **Consequence.** A non-zero "Flow yaw" changes the numbers without a defined meaning in the outputs.
- **Correction.** Either disable beta or compute full wind-axis components.
- **Acceptance.** For beta != 0, e_L . e_inf = 0 to 1e-12.

### B-VLM-10 — Seed wing height and A320-tuned seed (Medium, VERIFIED DEFECT / placeholder)

- **Evidence.** app.js:365 (`zRootM: ... : state.meshProperties.bounds.center[2]`), app.js:253-272 (seed taper 0.35, sweep 25, dihedral 4, root x at 0.3 L), stability.js:77-88 (0.112 L MAC, 0.875 S factor, AC at 0.4 L, NP at 0.5 L). Measured 4.7.
- **Consequence.** Results shown by default are driven by magic numbers tuned to the demo aircraft; static margin moves by 8-12 points with the (arbitrary) seed height.
- **Correction.** Do not run the solver on a seed; require a recognised wing, or clearly mark every output "SEED - not a measurement". Place the seed wing at a user-picked height.
- **Acceptance.** No solver result tile is displayed without the seed badge when `referenceSource === "bounds"`.

### B-STAB-01 — Pitch response is not a physical model (High, VERIFIED DEFECT)

- **Evidence.** stability.js:47-63; measured 3.8 and check6: `alpha == theta` exactly; unstable case reaches 1424 deg.
- **Consequence.** The "Pitch response" graph shows duplicated curves and meaningless magnitudes; its title ("Linearized pitch response from VLM Cm slope", app.js:795) overstates its content.
- **Correction.** Either remove it, or implement the short-period approximation with (alpha, q) states: `alpha' = q + Z_alpha alpha`, `q' = M_alpha alpha + M_q q + M_alphadot alpha'`, with `Z_alpha = -q S CL_alpha/(m V)`, `M_alpha = q S MAC Cm_alpha/Iyy`, and M_q, M_alphadot from tail geometry (Etkin & Reid, Nelson [K]); clip/flag the unstable case (report the time-to-double instead of plotting divergence).
- **Acceptance.** For a stable case, alpha and theta differ; natural frequency and damping agree with the closed-form short-period roots for given derivatives within 2%; unstable case reports doubling time.

### B-STAB-02 — Dead code and misdirected test (Medium, VERIFIED)

- **Evidence.** `computeStaticStability` (stability.js:4-36) is imported only by tests/massStability.test.mjs:5; app.js:12 imports only `defaultReferenceFromBounds` and `simulatePitchResponse`.
- **Consequence.** The test titled "static stability follows neutral point relative to CG" passes on code the product never runs; the live path (`runVlmSweep` SM/NP/trim) has no test of its sign/NP logic.
- **Correction.** Delete or wire the function; add a test on `runVlmSweep` with a known planar wing (NP = 0.25 chord within 2%, SM sign flips when the reference crosses the NP: check5 numbers can be used).
- **Acceptance.** Mutation test: flipping the sign of SM in `runVlmSweep` fails at least one test.

### B-STAB-03 — Stability verdict from an incomplete configuration (Medium, DESIGN RISK)

- **Evidence.** app.js:756 prints "Stable"/"Unstable"; the configuration is wing (+ H-tail if assigned); no fuselage moment, no propulsion, no power effects; CG from uniform density.
- **Consequence.** The demo reports "Unstable, -28.2%" for an A320; the repo documents that this is an artefact, the UI does not.
- **Correction.** Show the verdict only with the configuration list ("wing-only", "wing+H-tail") and the seed/assumed-mass flags.
- **Acceptance.** The verdict text includes configuration and assumptions in the same tile.

### B-STAB-04 — Trim from the nearest-alpha case (Low, ENGINEERING CHOICE)

- **Evidence.** vlmSolver.js:210-213. Documented as approximate (CALCULATION_PIPELINE L517).
- **Correction.** Use the OLS intercept. **Acceptance.** Trim identical for sweeps with and without a 0 deg case.

### B-MASS-01 — Mass-property mathematics (verification record, ESTABLISHED FACT: correct)

- **Evidence.** 3.2 and 4.8. No defect found. **Acceptance already met** by the cylinder and translation tests; recommended to add those two as regression tests (the existing tests cover cube/box/tetrahedron).

### B-MASS-02 — Uniform-density lump (Medium, MODELLING ASSUMPTION)

- **Evidence.** massModel.js:3-19. Measured CG at 46.2% of length; k_y = 0.230 L. 
- **Consequence.** Static margin, trim and pitch dynamics inherit an unrealistic CG/inertia; wing fuel, engines and payload are not modelled. The signed-volume sum would double-count overlapping solids (not testable here).
- **Correction.** Require a component mass table for any stability claim; provide named defaults only as clearly flagged templates.
- **Acceptance.** Stability tiles flagged "assumed mass" until a user-edited manifest is present.

### B-MASS-03 — Improper default axis mapping (Medium, DESIGN RISK)

- **Evidence.** axisMapping.js:10-14 (transposition, det -1); measured sign flip of volume and inward normals (2.2).
- **Consequence.** Harmless for current VLM and mass maths; a latent defect for any mesh export (winding), asymmetric BCs, or any new code that uses facet orientation.
- **Correction.** Make the default a proper rotation (e.g. longitudinal x, lateral -z or z with matching vertical sign chosen so that det = +1), or detect det < 0 and flip triangle winding on mapping.
- **Acceptance.** Signed volume of the mapped demo mesh is positive; a test asserts `det(mapping) = +1` or winding repair.

### B-STL-01 — STL region names and number format (Low now, Medium for CFD, VERIFIED)

- **Evidence.** stlParser.js:45-62; check20: two named `solid` blocks merge to 2 triangles with no names; `1.` and `nan` rejected.
- **Consequence.** Multi-solid STL exports (the OpenFOAM way to carry regions, 6.5) cannot be imported with their names.
- **Correction.** Capture `solid <name>` boundaries and per-facet region ids; accept `1.`/`.5`; reject non-finite values with a precise message.
- **Acceptance.** Round-trip of a two-solid ASCII STL preserves names and counts.

### B-REC-01 — Vertex-binned planform envelope fails on real tessellations (High, VERIFIED DEFECT)

- **Evidence.** recognition.js:140-172; measured 4.6: area 6.78 vs 21.98 m2; chord 0.00-0.25 at 7 of 9 sample stations (true 1.9-3.1 m); area 20.7/13.75/9.19/6.24 m2 for 12/30/60/120 bins. The only unit test (4 triangles) passes because empty bins are interpolated between the four extreme vertices.
- **Consequence.** Any recognised S, MAC, AR, root/tip chord and sweep from a real CAD mesh can be off by a large factor with `valid = true`; every downstream coefficient is normalised by those.
- **Correction.** Compute chord by slicing: for each y-station intersect all assigned triangles with the plane and take min/max x (or project triangles onto the xy-plane and compute the union area by rasterisation / polygon clipping); require a minimum sample count per bin and flag bins with fewer than 2 intersection points; make bin count independent of triangle count.
- **Acceptance.** Synthetic wings meshed with long thin triangles and random vertex placement: S, MAC, sweep within 2% for any bin count 12..120; demo outboard wing: area within 2% of the slice reference (21.98 m2).

### B-REC-02 — `valid` gate is vacuous; partial patches pass silently (Medium, VERIFIED DEFECT)

- **Evidence.** recognition.js:196 (`valid: warnings.length === 0 || areaM2 > EPSILON`), 190-193 (warnings). Measured 4.6: a 1,437-triangle patch gives span 14.9 m and `valid = true`.
- **Consequence.** The VLM runs on a fragment of a wing and the badge says "Recognized wing".
- **Correction.** Completeness checks: span coverage vs bounding extent, root station at the symmetry plane, left/right symmetry of area, taper plausibility; report them in the recognition summary.
- **Acceptance.** The 1,437-triangle patch is rejected; a full wing passes.

### B-REC-03 — No outlier rejection in the min/max envelope (Medium, SUSPECTED DEFECT)

- **Evidence.** recognition.js:155-158 (min/max per bin). Emulated (check8) by assigning everything with |y| >= 1.8 m and x < 25.5 m (nacelles, pylons, inboard fairing): MAC 14.7 m and root chord 23 m.
- **Consequence.** One stray triangle (or an engine pylon assigned with the wing) inflates chord; the estimator has no robust statistic.
- **Correction.** Use median/percentile of slice intersections, or require the selection to be a single connected wing patch group with an explicit exclusion tool.
- **Acceptance.** Adding 1% stray triangles changes S by < 2%.

### B-REC-04 — A320-tuned magic numbers in the seed (Low, DESIGN RISK)

- **Evidence.** stability.js:77-88; app.js:253-272. Seed S = 124.66 m2, MAC 4.193 m for the demo.
- **Consequence.** Applied to any other STL the seed is arbitrary but looks like a measurement.
- **Correction.** As B-VLM-10.

### B-GRAPH-01 — Placeholders and assumptions presented as results (Medium, DESIGN RISK)

- **Evidence.** 3.9 table. CD0 default 0.025 (index.html:122), Cm0 0, the lift arrow, "Aero center x" seed, wake overlay length.
- **Correction.** Label every assumed series ("assumed CD0") and show the solver-computed and assumed parts separately.
- **Acceptance.** Legend text distinguishes CDi from CD0 in plots and CSV header.

---

## 6. The proposed CFD system: feasibility and correctness

### 6.0 Verdict

The OpenFOAM route (blockMesh/snappyHexMesh -> simpleFoam -> k-omega SST -> forceCoeffs -> VTK -> Three.js) is a conventional, feasible pipeline for **attached-flow** external aerodynamics at low Mach and Reynolds numbers 1e6-1e7, and is within what engineers actually do. As written, the requirements are **under-specified at exactly the places where correctness is decided**: reference length and domain size, far-field boundary treatment (hence angle-of-attack handling), per-component force output, symmetry/half-model handling, STL region transport, transition and Reynolds-number regime, convergence/acceptance criteria, and CL,max. The browser repo supplies none of the machinery. Order-of-magnitude feasibility estimates (engineering judgement, not verified here): a wall-resolved full-scale transport half-model at Re ~2e7 is a workstation-to-cluster job of 10^7-10^8 cells and hours-to-days per alpha; a wall-function mesh (y+ 30-100) is several times cheaper but weaker in separation and for moments; a small-UAV Re ~ 2.6e5 case is cheap but needs transition modelling.

### B-CFD-01 — Pipeline absent (Critical, MISSING)

- **Evidence.** Gap analysis 3.1 rows R-7.*, R-5.*, R-4.*: all Missing. `server.mjs` serves static files only. `which gmsh blockMesh snappyHexMesh simpleFoam` returns nothing.
- **Consequence.** Nothing in the repo can produce a CFD number; any quantity labelled CFD today would be fabricated.
- **Correction.** Stand up a containerised OpenFOAM service (Docker image of OpenFOAM v10 or ESI v2xxx) with a job queue; keep the VLM as a preliminary tier.
- **Acceptance.** A scripted 2D NACA 0012 case (6.11) runs end-to-end from the web API and reproduces published CL within the agreed band.

### 6.1 NACA 4-digit and lofting (B-CFD-06, Medium, DESIGN RISK)

Equations (Abbott & von Doenhoff [K]; coefficient arithmetic verified in 4.9):
- Thickness `y_t = 5 t (0.2969 sqrt(x) - 0.1260 x - 0.3516 x^2 + 0.2843 x^3 - 0.1015 x^4)`. With a4 = -0.1015 the trailing edge is open: `y_t(1) = 5 t (0.0021) = 0.0105 t`, i.e. a half-thickness of 1.26e-3 c (total 0.25% c) for t = 0.12. With a4 = -0.1036 the coefficient sum is zero and the trailing edge closes (both verified numerically, 4.9).
- Camber `y_c = (m/p^2)(2 p x - x^2)` for x < p and `(m/(1-p)^2)((1 - 2p) + 2 p x - x^2)` for x >= p; slope `dy_c/dx`; `theta = atan(dy_c/dx)`.
- Surfaces with thickness **perpendicular to the camber line**: `x_U = x - y_t sin theta`, `y_U = y_c + y_t cos theta`, `x_L = x + y_t sin theta`, `y_L = y_c - y_t cos theta`.
- Spacing: cosine in x, `x = (1 - cos beta)/2`, to resolve the `sqrt(x)` leading edge (infinite slope, radius `1.1019 t^2`) and trailing edge.

Gaps in the requirement (L63-70): (i) the open vs closed trailing edge choice is not stated — an open TE of 0.25% c on a 4 m chord is 1 cm, which the snappy level must resolve (6.5), while a closed TE yields a zero-thickness edge that snappy cannot represent and produces sliver cells; the TMR NACA 0012 case closes the TE by extending the profile to x = 1.008930 and rescaling [V]; (ii) the **order and nature of transformations** is not specified. A defensible order: scale by local chord -> twist (rotation about a stated pitch axis, e.g. quarter-chord, about the spanwise-local axis) -> translate by sweep as a *shear* in x (`x += y tan(Lambda)`, with Lambda defined at LE or c/4 — must be stated) -> dihedral as shear in z (`z += y tan(Gamma)`) or a rigid rotation about the x axis of the whole semi-wing. Shear preserves streamwise sections; rotating by sweep would shrink streamwise thickness by cos(Lambda). (iii) tip cap and root closure are not mentioned; without them the wing is not watertight and snappy/CSG fail (B-CFD-05). (iv) mirrored semi-wings must share the root section exactly.

- **Correction.** Specify a closed, finite-thickness TE option, the transformation order above, a tip cap, and a unit test of the section generator against tabulated NACA 0012 coordinates [K, Abbott & von Doenhoff / NASA TM-4741 as in the PDAS listing, S].
- **Acceptance.** Section area and t/c reproduce the NACA 0012 ordinates within 1e-4 c; lofted wing is watertight (`surfaceCheck`: closed, no illegal triangles); sweep/dihedral/twist of a lofted test wing measured back within 0.05 deg.


### 6.2 Superellipse fuselage (B-CFD-07, Medium, DESIGN RISK)

- `|x/a|^n + |y/b|^n = 1`: normal continuity: for n > 1 the curve is C^1 (tangent continuous) at the axis points; for 1 < n < 2 curvature is infinite there; n = 1 is a diamond with four corners (true chines at the extremes of width and height); n < 1 gives cusps; n > 2 gives flat-sided "boxy" sections (squircle-like), not chined ones. So "n < 2 for chined or stealth-oriented profiles" (L81) is accurate only for n <= 1 and misses that n > 2 is the flat-side family. The area ratio to an ellipse of the same a, b is 0.637 (n = 1), 1.0 (n = 2), 1.18 (n = 4).
- Parametrisation `x = a sgn(cos t)|cos t|^{2/n}`, `y = b sgn(sin t)|sin t|^{2/n}` clusters points badly for large and small n; use arc-length or curvature-adaptive sampling.
- A fuselage needs nose/tail closure (cross-section shrinking to a point or cap), longitudinal blending of (a, b, n), and wing-fuselage junction fillets; none specified.
- Meshing: true corners (n <= 1) require feature-edge extraction (`surfaceFeatures`) and snappy feature snapping; the smooth family relies on resolution only.
- **Acceptance.** Cross-section area error < 0.5% against the closed-form Gamma-function area `4 a b Gamma(1+1/n)^2/Gamma(1+2/n)`; closed nose/tail; feature edges detected for n <= 1.

### 6.3 Fluid domain (B-CFD-02, High, DESIGN RISK)

- `L_ref` is undefined (L99). With the aircraft numbers in 4.9: if L_ref = MAC the domain is 0.37 spans upstream and 0.74 spans downstream — physically too small; if L_ref = fuselage length it is 3.3 spans / 6.6 spans — in the usual range of the minimum recommendations.
- Lateral and vertical extents are not given at all. A lifting aircraft is a source of far-field circulation decaying like 1/r; reflected disturbances from lateral/vertical boundaries modify CL and drag.
- Literature is a spread, not a standard: CFD-Online/CADFEM-type guidance of 5-20 chord lengths upstream and further downstream; a vendor study cited a 0.9% drag error at 40 chords inlet distance; the NASA TMR 2D NACA 0012 grids place the far field at almost 500 chords [V]; a 2024 arXiv paper (2411.13077) notes typical 2D domains of order 30 chords while the accurate ones need ~500 [S]. Lift converges with domain size earlier than drag [S]. Treat these as ranges to be confirmed by a domain-size study, not as rules.
- Recommendation (engineering judgement): define `L_ref` as the span (or max of span and length); put inlet/lateral/top/bottom at least 5-10 spans (>= 20-40 MAC) and the outlet at 10-15 spans for coefficient work, with a freestream-type far field; run a domain-size study at 2 sizes; for a half-model use a symmetry plane only for symmetric flow (beta = 0).
- **Blockage.** For a velocity-inlet/pressure-outlet box with slip or symmetry walls, blockage ratio = frontal area/cross-section; the requirement gives no section size to check it.
- **Acceptance.** Domain-size study: CL and Cm change < 0.5% and CD < 1% between the production domain and one 1.5x larger in every direction.

### 6.4 Boundary conditions (B-CFD-03, High, DESIGN RISK)

Mapping of the four tags to OpenFOAM for `simpleFoam` + `kOmegaSST` (kinematic pressure). Rows marked [V] were checked against the OpenFOAM-10 `motorBike` tutorial fetched this session (`omega`: outlet `inletOutlet`, walls `omegaWallFunction`; `p`: outlet `fixedValue`, inlet `zeroGradient`); the rest is standard practice [K] to be confirmed on the installed version.

| Requirement tag | Patch type | U | p (kinematic) | k | omega | nut |
|---|---|---|---|---|---|---|
| `VELOCITY_INLET` | patch | `fixedValue` (V cos a, 0, V sin a) | `zeroGradient` [V] | `fixedValue` k_inf = 1.5 (I V)^2; TMR range `1e-5 U^2/Re_L < k < 0.1 U^2/Re_L` [V] | `fixedValue`; TMR: `U/L < omega_inf < 10 U/L` [V]; or from k and a length scale | `calculated` |
| `PRESSURE_OUTLET` | patch | `inletOutlet` (inletValue 0) or `zeroGradient` | `fixedValue 0` [V] | `inletOutlet` (inletValue = k_inf) | `inletOutlet` [V] | `calculated` |
| `WALL_NOSLIP` | wall | `noSlip` | `zeroGradient` [V] | `kqRWallFunction` (high y+) or `fixedValue` ~0 for y+ ~ 1 | `omegaWallFunction` [V] (blends viscous and log-law values) | `nutkWallFunction` (y+ 30-300) or `nutUSpaldingWallFunction`/low-Re |
| `SYMMETRY` | **`symmetryPlane`** (must be planar; must be declared in `constant/polyMesh/boundary` and every field) | `symmetryPlane` | `symmetryPlane` | `symmetryPlane` | `symmetryPlane` | `symmetryPlane` |
| (missing) far-field top/bottom/sides | patch | `freestream`/`inletOutlet` style | `freestreamPressure` or `zeroGradient` | `freestream`-type | `freestream`-type | `calculated` |

Issues:
1. **Alpha handling.** Either (a) rotate the freestream vector, which requires a freestream-capable far field on *all* outer faces (top, bottom, sides); a single inlet face plus slip/symmetry sides would block the cross-flow component and corrupt the lift; one mesh serves all alpha; or (b) rotate the geometry and re-run snappyHexMesh for every alpha (consistent with the four tags but costly and mesh-noise-contaminated). The requirement states neither; the four-tag vocabulary only supports (b).
2. **SYMMETRY is a geometric property.** `symmetryPlane` requires a flat patch; an arbitrary user-selected face set cannot be a symmetry boundary. The aircraft must also be cut at y = 0 and the flow must be symmetric.
3. Turbulence inflow: the NASA TMR states that the farfield values are "somewhat open to interpretation" and recommends reporting them [V]; the app must expose I (or mu_t/mu), not hard-code.
4. y+ strategy: wall functions (y+ 30-100) vs low-Re (y+ ~ 1) change the first cell height by ~30x (4.9: 5.5 um vs 0.17 mm at the demo MAC) and the required layers. `omegaWallFunction` accepts both, but accuracy near separation differs.
5. The JSON manifest must carry: `L_ref`, V, alpha, rho, nu, I, y+ target, symmetry flag, CofR, Aref, lRef, per-patch tag. The requirement lists none of these.

### 6.5 Meshing: STL regions, snappyHexMesh, CSG, Gmsh (B-CFD-04, B-CFD-05, B-CFD-08)

**STL region transport (B-CFD-04, High, DESIGN RISK).** The OpenFOAM snappyHexMesh documentation lists `stl` (ASCII) and `stlb` (binary) among supported surface formats and states "Some formats support multiple regions, e.g. 'SOLID' in the stl format" and "Each surface and region in a surface becomes a separate patch in the final mesh" [V]. A binary STL has no per-solid names except the 80-byte header, so a single binary file maps to one patch. Triangle indices are not preserved by snappy (castellation/snapping/layer addition create new faces), so a JSON manifest of triangle indices cannot be used after meshing; the mapping must be done by region name. Forum reports of binary files producing one patch per triangle exist [S, CFD-Online]; I did not reproduce them.
- **Correction.** Export one STL per component (`wing.stl`, `fuselage.stl`, `htail.stl`, ...) and list each in `geometry {}`/`refinementSurfaces {}`; or export a multi-`solid` ASCII STL with names matching the manifest. The manifest should reference names, not indices. Also make the app's importer read region names (B-STL-01).
- **Acceptance.** `surfaceCheck` lists the expected regions with the expected triangle counts; after meshing `boundary` contains one patch per component.

**CSG union and watertightness (B-CFD-05, High, DESIGN RISK).** The `three-bvh-csg` README requires that "All brush geometry must be two-manifold - or water tight with no triangle interpenetration" and warns "Due to numerical precision and corner cases resulting geometry may not be correctly completely two-manifold"; it lists open work "Fix triangle splitting / missing triangle issues" and points to Manifold CAD for robustness [V]. A 2026 arXiv benchmark reportedly found three-bvh-csg produced valid watertight results on a small fraction of pairs (22 of 1000) versus 1000 of 1000 for Manifold [S, arXiv 2607.15905; figures from a search summary, not verified]. Lofted wings with independently triangulated roots meeting a superellipse fuselage are exactly the self-intersecting, slivered case. The repo's own demo STL is not watertight (8 boundary edges, 85 non-manifold edges, 4 duplicate and 80 degenerate triangles; verified). snappyHexMesh needs a closed surface to define the interior of the aircraft relative to `locationInMesh`; a leaky surface lets the fluid region flood the aircraft.
- **Correction.** Use a robust kernel (Manifold, or OpenCascade/CadQuery on the backend) for the union, run `surfaceCheck` and `surfaceClean`/repair on the backend, and fail closed (refuse to run) on non-closed shells.
- **Acceptance.** Union of wing+fuselage+tail passes `surfaceCheck` with zero open edges, zero non-manifold edges and consistent orientation for a randomised parameter suite (e.g. 200 combinations of sweep/taper/n).

**snappyHexMesh specifics (B-CFD-08, High, DESIGN RISK).**
- Stages: `blockMesh` background hex mesh (domain, level-0 size) -> `surfaceFeatureExtract`/`surfaceFeatures` (eMesh for LE/TE and chines) -> castellated (`refinementSurfaces`, `refinementRegions`, `locationInMesh` strictly inside the fluid and not on a face) -> snap -> layers. The motorBike tutorial uses one surface layer with relative sizes and `finalLayerThickness 0.3` [V]: it is a demonstration, not a boundary-layer-resolving template.
- Known difficulty areas: layer addition collapses at sharp/thin trailing edges and at wing-fuselage junctions (acute angles); refinement levels double the resolution each step (2:1), so resolving a 1 cm TE on a 4 m chord needs about nine levels from a 5 m cell unless TE regions are blunted; `featureAngle`/`maxFaceThicknessRatio` tuning is case-specific. These are engineering experience [K], not measured here.
- Mesh-quality control and layer coverage must be a gating criterion (report % layer coverage, `checkMesh` failures).
- **Gmsh alternative** [K, unverified]: Gmsh can create a volume mesh from a classified STL surface and gives control over size fields, but robust prism-layer extrusion over complex 3D aircraft surfaces is a known weak point relative to snappyHexMesh; conversion is via `gmshToFoam`. Not a drop-in replacement.
- **Acceptance.** Mesh report per run: cells, max non-orthogonality, max skewness, layer coverage >= 90% on wing/fuselage, first-cell y+ range from a preliminary run.

### 6.6 Solver and turbulence-model appropriateness (B-CFD-09, High, DESIGN RISK)

- `simpleFoam` is incompressible, steady, RANS: valid for M below about 0.3 (density change 4.6% in the stagnation sense at M 0.3, measured in 4.9). The demo default (72 m/s) is M 0.21; A320 cruise (M 0.78) is not incompressible and needs a compressible solver (`rhoSimpleFoam`/`rhoPimpleFoam` or equivalent). Therefore "run the A320 demo" is a low-speed/approach case only.
- k-omega SST (Menter 1994, AIAA J. 32(8):1598-1605, doi 10.2514/3.12149; 2003 revision by Menter, Kuntz, Langtry; NASA TMR describes versions and freestream guidance [V]) is the standard industrial choice for attached and mildly separated external flows; it is **fully turbulent by default**: no laminar-turbulent transition. At Re ~2.6e5 (small UAV) laminar separation bubbles dominate airfoil performance and a fully turbulent solution is not representative; a transition model (e.g. OpenFOAM `kOmegaSSTLM`, gamma-Re_theta) is needed. At A320-scale Re ~2e7 the fully-turbulent assumption is acceptable for CL and Cm trends.
- **Linear range CL, CD, Cm.** Reasonable. Expected accuracy is a modelling-validation question (6.11), not guaranteed: published workshops show spread even for well-posed cases; Cm is the most sensitive.
- **CL,max.** Steady RANS is known to be unreliable near stall: the NASA TMR NACA 0012 page restricts force comparisons to alpha below the point where steady results show force oscillations [V]; HiLiftPW summaries report large RANS spread and incorrect separation physics near CL,max, with multiple solution branches (secondary, from search summaries of NTRS 20140011405 and the HLPW-4/5 retrospectives) [S]. Hysteresis and initialisation dependence mean that a monotone alpha sweep with a continued initial field and an alpha-descending sweep give different answers.
- **Correction.** Do not label a steady RANS number "C_L,max". Report "RANS-predicted stall onset (unvalidated)" with the alpha at which residuals/forces stop converging, sweep up and down, and mark the quantity as low confidence; consider URANS/DDES only for specific validation cases.
- **Acceptance.** For the NACA 0012 benchmark the app reproduces the TMR/Ladson lift slope and reports where steady convergence is lost; the label for stall estimates carries an uncertainty note.

### 6.7 Force and moment extraction (B-CFD-10, High, SPECIFICATION GAP)

From the ESI OpenFOAM `forceCoeffs` documentation [V: https://doc.openfoam.com/2606/tools/post-processing/function-objects/forces/forceCoeffs]: entries `CofR` ("Centre of rotation for moment calculations"), `liftDir`, `dragDir`, `pitchAxis`, `magUInf`, `lRef`, `Aref`, `porosity`, `rho`/`rhoInf`; for incompressible cases solved with kinematic pressure set `rho rhoInf;` and give `rhoInf`. The page gives **no sign convention for `pitchAxis`** and does not define the sign of Cm [V].

Specification the requirements must add:
1. `CofR` = the CG from the mass manifest (same point for static margin and trim); also report Cm about 0.25 MAC for comparison with VLM.
2. If the freestream is rotated: `dragDir = (cos a, 0, sin a)`, `liftDir = (-sin a, 0, cos a)` (repo frame: flow toward +x, lift +z), `pitchAxis = (0 1 0)`; if the geometry is rotated, directions stay fixed.
3. `magUInf = V`, `lRef = MAC` (or other agreed reference length), `Aref = S`; for a **half-model** with a `symmetryPlane`, forces and moments are for the half-aircraft, so `Aref = S/2` (or double the integrated forces); `lRef` unchanged.
4. `rhoInf = 1.225` (or the ISA value) so forces are in newtons.
5. Pressure/viscous split and per-component breakdown: use `forces`/`forceCoeffs` once per patch group (`patches (wing fuselage htail vtail)`), which requires the per-component patches of 6.5. The exact content of the coefficient output file (e.g. whether pressure/viscous parts are tabulated) varies by version [unverified: check the installed version].
6. Cp: with kinematic pressure, `Cp = (p - p_inf)/(0.5 U_inf^2)` (no density); with the outlet fixed at 0 the reference is `p_inf = 0`.
7. Sign check: because the documentation is silent on the pitch sign, validate Cm on a case with a known sign (a cambered airfoil or a flat plate with CofR aft of the AC gives positive Cm_alpha in the repo convention) before trusting any stability derivative.
- **Acceptance.** A test case with CofR moved from 0.25c to 0.40c changes Cm by `-Delta x_c * CL` (nose-up positive convention) to within 1%.

### 6.8 Reynolds number and regime (B-CFD-11, Medium, MISSING + DESIGN RISK)

`Re = V * c_ref / nu` with `nu = mu(T)/rho` (Sutherland or table); `c_ref` should be the same MAC used for Cm. From 4.9: A320 demo default Re = 2.07e7 (M 0.21); A320 cruise 2.47e7 (M 0.78, outside simpleFoam); small UAV 2.57e5. The `Re` number sets: y+ -> first cell height; whether transition matters; turbulence inflow (`k`, `omega` scale with U/L); and which benchmark applies (TMR NACA 0012 is Re 6e6 [V]). The repo computes no viscosity or Reynolds number anywhere (grep), and treats CD0 as a typed constant.
- **Correction.** Compute and display Re, M, nu from altitude (ISA) or from user nu; warn when M > 0.3 or Re < ~5e5.
- **Acceptance.** `Re` matches hand calculation within 0.1% for three conditions; a warning appears for M = 0.78.

### 6.9 Static longitudinal stability from CFD (B-CFD-12, Medium, DESIGN RISK)

Needs, beyond the requirement list: the CG (from the mass manifest) and the moment reference; at least 3 converged alphas in the linear range (the TMR guidance on force oscillation applies); a complete configuration (tail and fuselage: the VLM-demo result "unstable, -28%" is an artefact of omitting them); `Cm_alpha = dCm/dalpha` and `CL_alpha` from fits, `x_NP = x_CG - (dCm/dCL) * c_ref` (sign per the x-aft convention above); trim needs an elevator/stabilizer incidence degree of freedom and a tail with sufficient mesh resolution in the wing wake. SM resolution is limited by Cm accuracy; acceptable Cm scatter must be set in advance.
- **Acceptance.** For a known configuration (e.g. a wing-body-tail test case with published Cm_alpha) the NP is reproduced within an agreed bound (e.g. 0.05 MAC) and the sign of the margin is correct for CG shifts of +/-0.1 MAC.

### 6.10 Mesh convergence and V&V (B-CFD-13, Medium, MISSING)

- Grid convergence: Roache GCI (J. Fluids Eng. 116:405-413, 1994 [K]) and Celik et al. (J. Fluids Eng. 130(7):078001, 2008 [K]); ASME V&V 20-2009 [K]. Practice per secondary sources [S]: >= 3 systematically refined grids, representative refinement ratio r, safety factor 1.25 for three grids, observed order p from the three solutions, GCI on the finest pair.
- snappyHexMesh refines in octree levels (factor 2 per level, 8x cells in 3D), so three grids of the full A320 are very expensive and r = 2 is large; use a varied background cell size/levels to get r ~ 1.3-1.5 where possible [engineering judgement], or perform the study on a 2D airfoil and a reduced 3D wing and extrapolate conclusions only qualitatively.
- Iterative convergence: residuals drop at least 4 orders for p, U, k, omega **and** force coefficients flat to < 0.1% of CL/CD (tighter for Cm) over the last N iterations; steady-state criteria alone are insufficient near separation (oscillating forces).
- **Benchmarks, with what they can/cannot prove.** (i) NASA TMR 2D NACA 0012 (Re 6e6, M 0.15; compares Ladson tripped data and Gregory & O'Reilly pressure data; far field ~500 chords or point-vortex correction) [V] validates the solver/BC/turbulence setup and mesh practice in 2D only; it does not test snappyHexMesh in 3D, wing-body junctions, or stability derivatives. (ii) Rectangular/elliptic wing vs lifting-line: only validates *inviscid trends* (CL_alpha, induced-drag proportionality); real RANS includes viscous effects, so compare CL_alpha with Helmbold/LLT within a few percent and CDi via CL^2/(pi AR e) after subtracting profile drag. Useful as a sanity bound, not a validation of absolute CD. (iii) NASA CRM / DLR-F6 (AIAA DPW) are transonic wing-body cases (Mach ~0.75): they cannot validate an incompressible solver; DPW also shows the Reynolds and gridding rules for workshop-grade grids [S: aiaa-dpw.larc.nasa.gov]. (iv) The AIAA High-Lift Prediction Workshop (HiLiftPW, hiliftpw.larc.nasa.gov) provides low-speed high-lift configurations, the closest community benchmark for a low-speed full configuration with flaps, with the warnings on CL,max in 6.6 [S].
- **Acceptance (proposed).** (1) NACA 0012: CL within 2% and CD within 5% of the TMR reference results at alpha 0, 10, 15 on the finest grid. (2) A rectangular AR-6 NACA 0012 wing: CL_alpha within 5% of an experimental/LLT-corrected value to be chosen and cited. (3) GCI < 2% for CL and < 5% for CD at the production grid. (4) A negative control: the pipeline must fail loudly on a non-watertight STL.

### 6.11 Post-processing: Cp, velocity, streamlines (B-CFD-14, Medium, DESIGN RISK)

- Surface Cp from `p` on the aircraft patches exported as VTK polydata (`foamToVTK -patch`) is feasible in Three.js via VTK loaders or a converted JSON of vertices/colours; Cp uses 6.7 item 6.
- Streamlines need integration of the volume velocity field: do it server-side (ParaView `StreamTracer`/OpenFOAM `streamLine` function object [K, unverified]) and ship polylines; in-browser tracing requires a point-in-cell search on an unstructured mesh with 10^6-10^8 cells and is impractical. Ship slices and surface data, not volume fields: the payload should be bounded (tens of MB).
- Colour scales must be symmetric around Cp = 0 and show the reference; units and the kinematic-pressure caveat must be on screen.
- **Acceptance.** Cp integrated over the surface reproduces the forceCoeffs pressure force within 1%; streamline seeds start on a stated rake and remain inside the domain.

### 6.12 Selection engine with `three-mesh-bvh` (B-CFD-15, Medium, DESIGN RISK)

- Claim (R-3.1-a/b): `computeBoundsTree()` + accelerated raycasting. The README shows the pattern (`BufferGeometry.prototype.computeBoundsTree`, `Mesh.prototype.raycast = acceleratedRaycast`) and states it works for indexed and non-indexed geometry, but also that "Building the tree also creates an index as a side effect, which is kept unless you use the 'indirect' option" [V: https://github.com/gkjohnson/three-mesh-bvh].
- Risk (derived from that statement; faceIndex semantics not verified here): after a non-indirect build, the raycast `faceIndex` refers to the BVH-sorted index buffer, not to the STL triangle order. The repo keys assignments, the saved project (RLE of `assignments` in STL order, projectState.js:6-24, recognition.js:227-256) and the vertex-colour writes (`triangle * 9 + vertex * 3`, app.js:477-484) by STL triangle order. Adopting the library without mapping `faceIndex` back (`orig = geometry.index.getX(3*faceIndex)/3`) or using the indirect mode would silently corrupt selections and saved projects.
- **Correction.** Use the indirect option or carry an explicit per-triangle id attribute; add a test that picks 1,000 random triangles by ray and asserts the returned STL id.
- **Acceptance.** Round-trip: select by ray, save, reload, same triangles highlighted; picking 197,772-triangle mesh median time < 5 ms.

### 6.13 Features that are unjustified or infeasible as written

| Item | Why |
|---|---|
| Binary-STL-only export with per-face BC tags (L128, L120) | Cannot carry region names (6.5). |
| Single watertight shell via `three-bvh-csg` (L125-127) | Library limits (6.5). |
| `C_L,max` from `simpleFoam` (L139) | Steady RANS unreliable near stall (6.6). |
| 4 BC tags only (L114-117) | Insufficient far-field vocabulary; symmetry needs geometry (6.4). |
| 3 L_ref upstream / 6 L_ref downstream without lateral extents (L102-103) | Under-specified (6.3). |
| Running the A320 demo at flight conditions with simpleFoam | M 0.78 is not incompressible (6.6). |
| `n < 2` described as chined (L81) | Only n <= 1 is chined (6.2). |
| Real-time slider updates of a CSG-unioned watertight mesh (L190) | CSG on every slider tick of a 10^5-triangle surface is slow and fragile; defer the union to an explicit "build" step. [engineering judgement] |

---

## 7. Validation gaps and a proposed acceptance suite

Current state (verified): 23 tests pass; coverage of the VLM is (a) panel placement, (b) solver residual, (c) positive-incidence lift sign, (d) zero lift at zero incidence, (e) CL_alpha within 16% of 2 pi AR/(AR+2) and a scale-free CDi/CL^2 ratio spread. Absent: any absolute drag check, convergence-in-N check, moment/NP sign check on the live path, planform estimator on a realistic tessellation, pitch-response physics, unit-scale invariance, export/import consistency, any CFD artefact.

Proposed minimal acceptance suite for the existing VLM tier (numeric gates derived from measurements above):

| Test | Gate |
|---|---|
| VLM-V1: rectangular AR in {4, 6, 8, 12}, uniform N = 32 | CL_alpha within 7% of Glauert LLT (measured -6.1% .. -1.8% cosine N = 40); |
| VLM-V2: same | Signed CDi > 0; corrected/LLT in [0.90, 1.05] (measured 0.927-0.954) |
| VLM-V3: N in {16, 32, 64} | CL_alpha variation < 1%; CDi variation < 5% |
| VLM-V4: planar rectangular wing, reference sweep 0..0.6 chord | NP = 0.25 chord +/- 0.01; Cm_alpha sign flips at NP |
| VLM-V5: scale 1e-3..1e3 | CL identical to 1e-6 |
| REC-V1: synthetic wing with random long thin triangles, bins 12..120 | S, MAC within 2%; sweep within 0.5 deg |
| REC-V2: demo outboard wing y >= 8 m | S within 2% of 21.98 m2 |
| STAB-V1: stable case | alpha != theta; frequency/damping within 2% of closed-form roots |
| MASS-V1: cylinder, box, translation, rotation | I_cg within 1e-6 relative (measured to 5 digits) |

External validation for VLM: AVL/OpenVSP/XFLR5 comparison on at least one swept tapered wing and one wing+tail case (the plan's own validation plan; `reference/xflr5/` is empty).

---

## 8. Unsupported claims across documents (cross-reference)

See gap analysis section 6 for the list; additionally here:
- plan.md L455 `CL = pi*AR*alpha` (B-DOC-01, Medium, VERIFIED): compare the LLT numbers in 4.1: for AR = 8, pi AR alpha would be a lift slope of 25.1 per rad against 4.84. The correct finite-wing relation for an elliptic wing is `a = a0/(1 + a0/(pi AR))` (Anderson, Fundamentals of Aerodynamics, Ch. 5 [K]); `CL = pi AR alpha_i` relates CL to the induced angle only. **Correction:** replace with the finite-wing formula. **Acceptance:** the validation plan's "analytical" case reproduces 4.84 (AR 8 rectangular, LLT) or 5.03 (elliptic) within 5%.
- plan.md L244 XZ projection (B-DOC-02, Low, ESTABLISHED FACT): with Y spanwise (plan L176) the XZ plane is the side view. MVP_METHODOLOGY L53 already corrects it.
- plan.md L608, L621 interpretation rules (B-DOC-04, Low, DESIGN RISK): `CL_slope > 5.0` has no unit and would reject real wings of AR < 10 (4.6-4.8 per rad measured); `CM(0) < 0 and dCM/dalpha < 0 => stable` conflates stability (only the slope matters) with trimmability.
- Qwen L146 "wake relaxation = vorticity-transport reduced form" and "von Karman momentum-integral closure" for `Cf = 0.455/(log10 Re)^2.58` (B-DOC-03, Medium, UNVERIFIED CLAIM): the cited formula is an empirical turbulent flat-plate skin-friction fit (Schlichting, valid roughly 1e6 < Re < 1e9 [K]); one-pass realignment of straight legs along V_inf + w at the wing is a crude free-wake approximation, not a solution of a vorticity-transport equation. **Correction:** relabel as "empirical" and "approximate wake alignment".
- Qwen L137: the frame X forward, Y right, Z up is left-handed (D-03).
- Qwen L149: effective densities (50/35/80 kg/m3): UNVERIFIED; no source or derivation.
- Qwen file is truncated at L171 (B-DOC-05, Medium, ESTABLISHED FACT): sections 9-16 listed in its contents are absent; it cannot serve as a handoff for risks, limitations, backlog or process.

---

## 9. References and verification status

Verified this session [V] (URLs opened or searched):
- OpenFOAM (ESI) `forceCoeffs` documentation: https://doc.openfoam.com/2606/tools/post-processing/function-objects/forces/forceCoeffs [V: CofR, liftDir, dragDir, pitchAxis, magUInf, lRef, Aref, rho/rhoInf for kinematic pressure; no pitch sign convention].
- OpenFOAM (ESI) snappyHexMesh geometry documentation: https://doc.openfoam.com/2606/tools/pre-processing/mesh/generation/snappyhexmesh/geometry [V: stl/stlb formats; multi-region support; each region becomes a patch].
- OpenFOAM-10 `motorBike` tutorial: `https://raw.githubusercontent.com/OpenFOAM/OpenFOAM-10/master/tutorials/incompressible/simpleFoam/motorBike/{0/omega,0/p,system/snappyHexMeshDict}` [V: BC patterns; one-layer meshing example].
- NASA Turbulence Modeling Resource, 2D NACA 0012 validation: https://tmbwg.github.io/turbmodels/naca0012_val.html [V: Re 6e6, M 0.15, alpha 0/10/15 for Cp/Cf, far field ~500 chords, Ladson and Gregory & O'Reilly data, TE closure].
- NASA TMR, Menter SST: https://tmbwg.github.io/turbmodels/sst.html [V: versions 1994/SST-V/2003; freestream guidance; Menter, AIAA J. 32(8):1598-1605, doi 10.2514/3.12149; Menter-Kuntz-Langtry 2003].
- three-bvh-csg: https://github.com/gkjohnson/three-bvh-csg [V: two-manifold requirement; numerical-precision warning; roadmap items].
- three-mesh-bvh: https://github.com/gkjohnson/three-mesh-bvh [V: `computeBoundsTree`, accelerated raycast, index side effect, indirect option].

Secondary (search summaries only, not opened in full) [S]:
- HiLiftPW/HLPW results on RANS near CL,max: NTRS 20140011405 (https://ntrs.nasa.gov/api/citations/20140011405/downloads/20140011405.pdf), arXiv 2406.09840, Rumsey HLPW retrospective (https://hiliftpw.larc.nasa.gov/Workshop5/Publications/ICAS-2024-1217-rumsey-hilift_finalpresentation.pdf).
- Domain-size guidance: arXiv 2411.13077, CADFEM blog "How Small is Too Small? Optimal CFD Domain", CFD-Online threads; Goetten et al., "A review of guidelines and best practices for subsonic aerodynamic simulations using RANS CFD" (domain table not read).
- GCI practice: secondary web sources; primary papers cited from memory (Roache 1994; Celik et al. 2008).
- AIAA Drag Prediction Workshop: https://aiaa-dpw.larc.nasa.gov/ (home only).
- Binary-STL/snappy anecdote: CFD-Online forum threads (not reproduced).
- arXiv 2607.15905 (CSG benchmark): figures from a search summary.

Textbook / standard references cited from knowledge, not re-opened [K]: J. D. Anderson, *Fundamentals of Aerodynamics* (Ch. 4-5, lifting-line, finite-wing lift slope); J. Katz and A. Plotkin, *Low-Speed Aerodynamics*, 2nd ed. (Eq. 2.72 finite-segment Biot-Savart; Ch. 12 vortex lattice, panel layout, Trefftz-plane drag); B. Etkin and L. D. Reid, *Dynamics of Flight: Stability and Control* and R. C. Nelson, *Flight Stability and Automatic Control* (static margin, neutral point, short-period approximation); I. H. Abbott and A. E. von Doenhoff, *Theory of Wing Sections* (NACA 4-digit); Helmbold's lift-slope formula (as in Raymer/Diederich forms); Schlichting, *Boundary-Layer Theory* (turbulent flat plate Cf); P. J. Roache, J. Fluids Eng. 116 (1994); I. Celik et al., J. Fluids Eng. 130 (2008); ASME V&V 20-2009.

---

## 10. What the coordinator should check first

1. Re-run `check2_drag_methods.mjs` and `check12_spacing.mjs` (seconds) to confirm B-VLM-01/02 independently of my reading of the code.
2. Re-run `check10_slice_vs_bins.mjs` to confirm B-REC-01.
3. Ask the owner which of the two spec documents (requirements 2026-07-31, Qwen 2026-09-18 by filename) governs, and whether the VLM tier stays.
4. Confirm the K&P equation number and the Helmbold/Glauert numbers against the textbooks before they are quoted in formal documents.
