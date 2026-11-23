# AirFLOW Browser MVP: Calculation Pipeline

This note describes the mathematical work currently performed by the browser application, in execution order. It distinguishes values measured from the imported STL, values supplied by the user, values derived from manual surface recognition, and values produced by the aerodynamic and dynamic solvers.

The current system is an engineering MVP. It does not solve CFD on the STL surface and it is not yet equivalent to XFLR5, AVL, OpenVSP, ANSYS, or a flight-certification analysis.

## 1. Quantities and Data Sources

Every displayed value belongs to one of four categories.

| Category | Current source | Examples |
| --- | --- | --- |
| Measured from STL | Triangle coordinates after unit and axis conversion | Bounds, surface area, signed volume, geometric centroid, topology warnings |
| Supplied mass data | Editable mass manifest | Component mass, component position, total mass, aircraft CG, inertia tensor |
| Aerodynamic geometry | Manually recognized wing/tail, or flagged bounds seed | Span, area, MAC, root/tip chord, sweep, dihedral, incidence |
| Solver result | Horseshoe VLM and pitch-response integration | Circulation, lift, induced drag, pitching moment, CL, CD, Cm, slopes, static margin, trim, response history |

An STL file contains triangles only. It does not contain a unit declaration, component names, material density, fuel, payload, mass, CG, airfoil polar, Reynolds-number behavior, or aerodynamic boundary conditions. The application therefore requires those assumptions to be visible and editable.

## 2. Coordinate and Unit Normalization

All internal calculations use SI:

- position: m
- mass: kg
- time: s
- velocity: m/s
- force: N
- moment: N m
- pressure: Pa
- density: kg/m3
- inertia: kg m2

The internal aircraft coordinates are:

- `x`: longitudinal, positive downstream in the VLM convention
- `y`: lateral/spanwise
- `z`: vertical

For the demo STL, the default mapping is:

- STL `X -> internal x`
- STL `Z -> internal y`
- STL `Y -> internal z`

The selected source-unit scale multiplies every STL coordinate. The three internal axes must map to three different STL axes, although each axis may be sign-reversed.

## 3. STL Parsing

The importer detects binary versus ASCII STL. For each triangle it stores three vertices. Binary facet normals are read, but engineering geometry is recomputed from vertex positions so an incorrect stored STL normal does not control area or VLM geometry.

For the demo model, the regression requirement is:

- triangle count: `197,772`
- connected components: `1` (edge-connected)
- topology findings: `28` boundary edges, `5` non-manifold edges, and `0` degenerate triangles

Those topology findings (a small number of open boundary edges and a few non-manifold edges) mean volume, centroid, and volume-distributed inertia must be treated as conditional results rather than exact watertight-solid properties.

## 4. Triangle and Mesh Measurements

For triangle vertices `a`, `b`, and `c`, define:

$$
e_1=b-a, \qquad e_2=c-a
$$

The triangle area is:

$$
A_i=\frac{1}{2}\left\|e_1\times e_2\right\|
$$

Total STL surface area is:

$$
A_{surface}=\sum_i A_i
$$

The axis-aligned bounds are the minimum and maximum `x`, `y`, and `z` over every imported vertex.

### 4.1 Topology checks

Vertices are welded on exact float64 coordinates (no tolerance). STL shared corners are bit-identical after parsing, so exact welding recovers the intended vertex identification; signed zeros are normalized so `-0` and `+0` weld together. Undirected triangle edges are counted:

- one use: boundary edge
- two uses: manifold edge
- more than two uses: non-manifold edge

A triangle whose three welded vertex ids are not all distinct is degenerate, and its edges are skipped entirely. Triangle connectivity is edge-connected (two triangles share a component only when they share an edge) and is found with a union-find structure. The importer also reports duplicate triangles.

### 4.2 Signed volume

Each oriented triangle forms a signed tetrahedron with the origin. Its signed volume contribution is:

$$
V_i=\frac{a\cdot(b\times c)}{6}
$$

The mesh signed volume and reported absolute volume are:

$$
V_s=\sum_i V_i, \qquad V=|V_s|
$$

This formula assumes a closed, consistently oriented surface. Open or non-manifold geometry can bias the result.

### 4.3 Volume centroid

The centroid of each origin-based tetrahedron is `(a+b+c)/4`. The mesh volume centroid is:

$$
r_c=\frac{1}{V_s}\sum_i V_i\frac{a+b+c}{4}
$$

This is the geometric centroid of the enclosed mesh volume. It is not automatically the aircraft CG.

### 4.4 Volume inertia

The code analytically integrates the second-order monomials `x^2`, `y^2`, `z^2`, `xy`, `xz`, and `yz` over every signed tetrahedron. Those integrals form the inertia tensor about the origin:

$$
I_O=\int_V \rho_m
\begin{bmatrix}
y^2+z^2 & -xy & -xz\\
-xy & x^2+z^2 & -yz\\
-xz & -yz & x^2+y^2
\end{bmatrix}dV
$$

For mesh-property calculation, the geometric inertia is first computed at unit mass. It is translated from the origin to the mesh centroid using the parallel-axis theorem.

## 5. Mass Manifest, Aircraft CG, and Total Inertia

The STL does not provide mass. The mass manifest supplies entries with:

- name
- type
- mass in kg
- position `[x,y,z]` in m
- notes

The current entry types behave as follows:

- `mesh-volume`: mass is distributed uniformly over the imported STL volume and uses the mesh local inertia shape.
- `point-mass`: local inertia is zero; only its position and parallel-axis contribution are included.
- `component`: currently also behaves as a point mass unless a future component-local inertia model is added.

The total mass is:

$$
M=\sum_i m_i
$$

The aircraft center of gravity is the mass-weighted position:

$$
r_{CG}=\frac{\sum_i m_i r_i}{M}
$$

For displacement `d_i=r_i-r_CG`, each component contributes:

$$
I_{i,CG}=I_{i,local}+m_i\left[(d_i\cdot d_i)I_3-d_i d_i^T\right]
$$

The total aircraft inertia tensor is:

$$
I_{CG}=\sum_i I_{i,CG}
$$

The pitch-response model uses `Iyy` from this tensor.

The demo starts with a `42,600 kg` mesh-volume mass. This is only an editable seed and is not read from the STL. Therefore the displayed demo CG and inertia are not validated A320 mass properties until the manifest is replaced with actual component, payload, fuel, and equipment data.

## 6. Manual Recognition and Aerodynamic Reference Geometry

The user can select STL triangles and assign them as main wing, horizontal tail, vertical tail, or fuselage. Region growth traverses shared triangle edges while checking local and seed-normal angular limits. A user-visible triangle cap prevents a welded STL from selecting an uncontrolled portion of the aircraft.

### 6.1 Wing planform extraction

For an assigned horizontal lifting surface, the code bins selected vertices across the `y` span. Each bin stores:

- minimum `x`: local leading-edge estimate
- maximum `x`: local trailing-edge estimate
- minimum and maximum `z`: local thickness envelope

Missing bins are linearly interpolated. Local chord is:

$$
c(y)=x_{trailing}(y)-x_{leading}(y)
$$

This envelope method avoids counting upper and lower wing skins twice.

Span is:

$$
b=y_{max}-y_{min}
$$

Planform area is integrated numerically with the trapezoidal rule:

$$
S=\int_{y_{min}}^{y_{max}}c(y)\,dy
$$

Mean aerodynamic chord is:

$$
MAC=\frac{1}{S}\int_{y_{min}}^{y_{max}}c(y)^2\,dy
$$

Aspect ratio is:

$$
AR=\frac{b^2}{S}
$$

Root chord is averaged from stations nearest the aircraft centerline. Tip chord is averaged from stations nearest the two span limits.

Quarter-chord position is:

$$
x_{c/4}(y)=x_{leading}(y)+0.25c(y)
$$

Quarter-chord sweep is obtained from a least-squares slope of `x_c/4` against semi-span. Dihedral is obtained from a least-squares slope of the local mid-surface `z` against semi-span:

$$
\Lambda_{c/4}=\tan^{-1}\left(\frac{dx_{c/4}}{dy}\right), \qquad
\Gamma=\tan^{-1}\left(\frac{dz_{mid}}{dy}\right)
$$

### 6.2 Important current behavior

The VLM does not place vortices directly on all imported STL triangles. It creates an idealized symmetric trapezoidal lifting surface from the extracted or edited reference dimensions.

If no main wing has been manually assigned, the application uses a visibly flagged `Bounds seed - verify` model. Its current defaults include heuristic MAC, area, taper ratio, sweep, dihedral, and root-leading-edge position. Results generated from this seed are useful for workflow testing only.

## 7. Vortex Lattice Geometry

The numerical aerodynamic method is a steady, incompressible horseshoe Vortex Lattice Method with a multi-row lattice: `M` chordwise rows (default `4`) times `N` spanwise strips per lifting surface, uniform in both directions (M0-2, DR-02).

For a surface with span `b`, root chord `c_r`, tip chord `c_t`, quarter-chord sweep `Lambda`, and dihedral `Gamma`, section properties vary linearly with normalized semi-span:

$$
\eta=\frac{|y|}{b/2}
$$

$$
c(y)=c_r+\eta(c_t-c_r)
$$

$$
x_{LE}(y)=x_{LE,root}+\frac{c_r}{4}+|y|\tan\Lambda-\frac{c(y)}{4}
$$

$$
z(y)=z_{root}+|y|\tan\Gamma
$$

The sweep input is the c/4 sweep (DATA_CONTRACTS §2.7): the quarter-chord line is straight at `x_LE,root + c_r/4 + |y| tan Lambda`, equivalently `tan Lambda_LE = tan Lambda_c/4 + (c_r - c_t)/(2b)`. The elliptic planform (verification fixture, `planform: "elliptic"`) uses `c(y) = c_0 sqrt(1 - (2y/b)^2)` with the same straight quarter-chord line.

Spanwise panel edges use uniform spacing:

$$
y_i=-\frac{b}{2}+\frac{i b}{N}, \qquad i=0,\ldots,N
$$

Each span strip is subdivided into `M` uniform chordwise sub-panels. For sub-panel `(i, k)` (strip `i`, row `k`):

- the bound vortex runs between the quarter points of the sub-panel's left and right edges;
- the collocation point is at strip mid-span and the 3/4 point of the sub-panel;
- the surface normal is the normalized cross product of chord and span tangents;
- two straight wake legs extend downstream parallel to the freestream;
- the nominal wake length is `max(wakeLengthFactor * MAC, 10 * b_largest)`, with a default factor of 20. Each surface span comes from its bound-endpoint y extent (DATA_CONTRACTS §2.7, B-VLM-07).

**Panel aspect guard (single guard):** every panel carries `width/length`, where `width` is the strip width and `length` is the sub-panel chordwise extent at the strip's mean chord (`c/M`). Any panel with `width/length < 0.25` **refuses** the lattice (a thrown validity error); values above `8` produce a coarse-spanwise validity warning. Elliptic tip strips legitimately reach about `4.5`.

**Spanwise count:** a blank/unspecified `N` selects the prescribed count per surface, `N = max(16, 2 M ceil(AR/2))`, which keeps `width/length` at about 1 at the mean chord and reproduces the validation-matrix resolutions R1 = (8 ceil(AR/2) x 4) and R2 = (16 ceil(AR/2) x 8). The solver identifies each run as `R1`, `R2` or `custom`, and the UI shows an R1 vs R2 resolution badge (amber if the C_Lalpha change exceeds 1 % or the C_Di change exceeds 5 %).

DATA_CONTRACTS §2.7 specifies a fixed Tier-0 label; its application is withheld pending a reviewed geometry, flow, angle and resolution envelope. See docs/verification/rem-3a-2026-11-06/BENCHMARK_SIDECAR.md.

The default is a blank spanwise count (auto) with `4` chordwise rows for the main wing. If a horizontal tail has been recognized, it is added as a second lifting surface with its own prescribed spanwise count.

## 8. Freestream and Boundary Condition

Inputs are air density `rho`, velocity magnitude `V`, angle of attack `alpha`, and yaw/sideslip-like angle `beta`.

The freestream direction is (DATA_CONTRACTS §1; the v1.0Beta sign/form was corrected in M0-1, partial B-VLM-09):

$$
e_\infty=
\begin{bmatrix}
\cos\alpha\cos\beta\\
-\sin\beta\\
\sin\alpha\cos\beta
\end{bmatrix}
$$

and:

$$
V_\infty=V e_\infty
$$

The current UI reports longitudinal stability only. Although `beta` changes the freestream vector, lateral-directional derivatives are not yet extracted.

## 9. Biot-Savart Influence Calculation

For a finite vortex segment from `A` to `B`, evaluated at point `P`, define:

$$
r_1=P-A, \qquad r_2=P-B, \qquad r_0=B-A
$$

For unit circulation, the induced velocity is:

$$
v(P)=\frac{r_1\times r_2}{4\pi\|r_1\times r_2\|^2}
\left[r_0\cdot\left(\frac{r_1}{\|r_1\|}-\frac{r_2}{\|r_2\|}\right)\right]
$$

The horseshoe influence is the sum of its upstream wake leg, quarter-chord bound segment, and downstream wake leg. The leg kernel uses the prescribed freestream displacement and the evaluation point relative to the bound endpoint. It therefore avoids rounding a far downstream endpoint in world coordinates. The existing relative singularity cutoff and validity diagnostics apply to these segment vectors.

For control point `j` and unit horseshoe `i`, the aerodynamic influence coefficient is:

$$
A_{ji}=v_{ij}\cdot n_j
$$

The no-penetration condition is:

$$
\left(V_\infty+\sum_i \Gamma_i v_{ij}\right)\cdot n_j=0
$$

Therefore the dense linear system is:

$$
A\Gamma=b, \qquad b_j=-V_\infty\cdot n_j
$$

The unknown vector `Gamma` contains one circulation strength per horseshoe panel.

## 10. Numerical Linear Solver

The VLM matrix is solved with direct Gaussian elimination and partial pivoting:

1. For each matrix column, choose the remaining row with the largest absolute pivot.
2. Swap it into the diagonal position.
3. Eliminate entries below the diagonal.
4. Recover circulation with back substitution.

For `N` panels, the dense solve has approximately `O(N^3)` time and `O(N^2)` memory complexity. This is appropriate for the current small MVP panel counts but not for high-resolution production lattices.

The application reports:

- maximum absolute equation residual, `max|A Gamma - b|`;
- minimum and maximum elimination pivots;
- `minPivot/maxPivot` as a basic conditioning warning.

The pivot ratio is not a formal matrix condition number.

## 11. Panel Forces and Moments

After solving circulation, induced velocity at each bound-vortex midpoint is
recomputed from every horseshoe and multiplied by its solved circulation. The
panel's own trailing legs are included; only its own bound segment is excluded
(`includeBound = j !== i`, DR-01):

$$
V_{eff,i}=V_\infty+\sum_j\Gamma_j v_{ji}
$$

For bound-vector `dl_i`, panel force follows Kutta-Joukowski in vector form:

$$
dF_i=\rho\Gamma_i\left(V_{eff,i}\times dl_i\right)
$$

Total aerodynamic force is:

$$
F=\sum_i dF_i
$$

Moment is calculated about the manifest-derived aircraft CG:

$$
dM_i=(r_i-r_{CG})\times dF_i
$$

$$
M=\sum_i dM_i
$$

The displayed pitching moment is the internal `y` component, `M_y`.

Lift direction in the longitudinal plane is perpendicular to freestream:

$$
e_L=\begin{bmatrix}-\sin\alpha & 0 & \cos\alpha\end{bmatrix}^T
$$

Lift is the force projection on the lift direction:

$$
L=F\cdot e_L
$$

The near-field induced drag is the **signed** projection on the wake (freestream)
direction — never an absolute value (DR-01). It is positive at any lift and zero
at zero lift; a negative value is a validity error, not a magnitude:

$$
D_{i,NF}=F\cdot e_\infty
$$

The primary induced drag is the signed general transverse-plane (Trefftz) value
(DATA_CONTRACTS §2.7, RB-03). With $\hat e_w$ the unit wake direction,
$m_{i\perp}$ the bound midpoint projected onto the plane perpendicular to
$\hat e_w$, $l_i = boundB_i - boundA_i$, and $v_T$ the 2-D crossflow induced at
$m_{i\perp}$ by the infinite trailing legs of **all** panels of **all** surfaces
(a trailing leg of panel $j$ is a line vortex of strength $s\Gamma_j$ with
$s=-1$ at `boundA`, traversed upstream, and $s=+1$ at `boundB`):

$$
D_{i,T}=\frac{1}{2}\rho\sum_i \Gamma_i\, v_T(m_{i\perp})\cdot(l_i\times\hat e_w)
$$

No absolute value: $D_i \ge 0$ is asserted, with equality only at zero lift. The
near-field value is reported alongside as a diagnostic; for unswept planar wings
the two agree within 1 % at wake length ≥ 10 spans.

## 12. CL, CD, and Cm

Dynamic pressure is:

$$
q_\infty=\frac{1}{2}\rho V^2
$$

The reference quantities are wing area `S` and mean aerodynamic chord `MAC`.

Lift coefficient:

$$
C_L=\frac{L}{q_\infty S}
$$

Induced drag coefficient from VLM (the Trefftz value is primary,
DATA_CONTRACTS §2.7; the near-field coefficient is reported as a diagnostic):

$$
C_{D_i}=\frac{D_{i,T}}{q_\infty S}
$$

The displayed total drag coefficient adds a user-entered constant profile/parasitic offset:

$$
C_D=C_{D_i}+C_{D0}
$$

Corresponding displayed drag force is:

$$
D=D_{i,T}+q_\infty S C_{D0}
$$

The current VLM does not calculate `CD0` from STL, Reynolds number, surface roughness, or airfoil polars.

Pitching-moment coefficient about aircraft CG is:

$$
C_m=\frac{M_y}{q_\infty S\,MAC}+C_{m0}
$$

`Cm0` is a user-entered constant correction for non-lifting or airfoil pitching moments that the flat-plate VLM does not model.

## 13. Angle-of-Attack Sweep and Graphs

For every requested angle from `alpha_min` to `alpha_max`:

1. Rebuild the freestream and straight-wake direction.
2. Assemble the influence matrix.
3. Solve panel circulation.
4. Integrate panel forces and moments.
5. Calculate `CL`, `CDi`, displayed `CD`, `Cm`, lift, drag, and pitching moment.

The coefficient graph plots:

- `CL(alpha)`
- `CD(alpha) = CDi(alpha) + CD0`
- `Cm(alpha)`

The load graph plots:

- lift in kN
- drag in kN
- pitching moment in kN m

The graphs are sampled solver outputs connected by plotting lines. They are not separate curve-fit models.

## 14. Stability Derivatives, Static Margin, and Trim

Cases within `-5 deg <= alpha <= 5 deg` are fitted with ordinary least-squares straight lines. The slopes are converted from per-degree to per-radian:

$$
C_{L_\alpha}=\frac{dC_L}{d\alpha}
$$

$$
C_{m_\alpha}=\frac{dC_m}{d\alpha}
$$

Using the longitudinal static-stability relation:

$$
C_{m_\alpha}=-C_{L_\alpha}SM
$$

the reported static margin is:

$$
SM=-\frac{C_{m_\alpha}}{C_{L_\alpha}}
$$

The neutral-point position is reconstructed as:

$$
x_{NP}=x_{CG}+SM\,MAC
$$

The current stability flag is `stable` only when:

$$
C_{m_\alpha}<0 \quad\text{and}\quad SM>0
$$

Using the solved `Cm` value nearest zero angle, the linearized trim angle is:

$$
\alpha_{trim}=-\frac{C_m(0)}{C_{m_\alpha}}
$$

The default sweep includes zero degrees. If a custom sweep does not include zero, using the nearest case is an approximation that should be replaced by fitted-intercept evaluation in a later version.

## 15. Pitch-Response Model and RK4 Solver

The time graph is not a six-degree-of-freedom flight simulation. It is a small longitudinal demonstrator using:

- pitch attitude `theta` in rad;
- pitch rate `q_pitch` in rad/s;
- angle of attack `alpha` in rad;
- manifest-derived `Iyy`;
- VLM-derived `Cm_alpha`;
- solved `Cm(0)`;
- a user-entered pitch damping coefficient.

The current differential equations are:

$$
\dot{\theta}=q_{pitch}
$$

$$
\dot{q}_{pitch}=\frac{q_\infty S\,MAC\left[C_m(0)+C_{m_\alpha}\alpha\right]}{I_{yy}}-d_q q_{pitch}
$$

$$
\dot{\alpha}=q_{pitch}-1.25(\alpha-\theta)
$$

The initial angle is normally `alpha_trim + 2 deg`. The equations are integrated for `12 s` with fixed step `dt=0.025 s` using classical fourth-order Runge-Kutta:

$$
x_{n+1}=x_n+\frac{dt}{6}(k_1+2k_2+2k_3+k_4)
$$

The graph displays `theta`, `alpha`, and `q_pitch` versus time.

This response omits translational dynamics, speed variation, gravity coupling, lift and drag derivatives, tail downwash lag, elevator input, control-system dynamics, and lateral-directional states. It should be described as a linearized pitch-response demonstrator, not a complete dynamic-stability or flight simulation result.

## 16. Current Demo Interpretation

In the tested default run, the UI reports approximately:

- mesh surface area: `842.81 m2`
- conditional mesh volume: `460.691 m3`
- assumed total mass: `42,600 kg`
- assumed-model CG: `[17.282, 0.005, 3.097] m`
- `Iyy`: approximately `3.148e6 kg m2`
- VLM panels: `24`
- `CL(0)`: approximately `0.168`
- `CDi(0)`: approximately `0.0087`
- `CL_alpha`: approximately `4.798 /rad`
- `Cm_alpha`: approximately `+1.354 /rad`
- static margin: approximately `-28.2%`

The positive `Cm_alpha` and negative static margin make this particular configured model appear longitudinally unstable. That is not a conclusion about the real Airbus A320. It is a result of the current bounds-seeded lifting surface, uniform mesh mass assumption, resulting CG, and simplified aerodynamic model. Actual component masses and manually recognized lifting surfaces are required before interpreting the sign or magnitude as aircraft engineering data.

## 17. Accuracy Boundary

Current numerical tests cover:

- STL binary and ASCII parsing;
- cube, box, and tetrahedron volume, centroid, and inertia;
- mass aggregation and the parallel-axis theorem;
- topology, duplicate, and degenerate detection;
- recognition integration and region-growth constraints;
- VLM panel placement and direct linear solve residual;
- positive-incidence lift sign;
- finite-wing lift-slope agreement within the current `16%` test tolerance;
- approximately quadratic induced-drag trend with lift;
- demo STL regression properties.

The current solver has not met the FlowSync plan's `5%` AVL benchmark criterion. It also does not include viscous drag prediction, compressibility, stall, airfoil polars, fuselage interference, propulsion, aeroelasticity, or six-degree-of-freedom flight dynamics.

Therefore results should currently be labeled:

> Geometry-conditioned, manifest-dependent, incompressible VLM MVP estimates.

They should not be labeled CFD results, ANSYS-derived aerodynamics, or validated real-aircraft stability data.

### AUD-1 comparison validity and identity (2026-11-06)

The 0°/4° R1/R2 diagnostic measures relative grid sensitivity. A missing, quarantined or nonfinite required point withholds the comparison. If the degree-based slope calculation overflows, the solver divides the lift difference directly by the radian interval. A nonfinite final slope invalidates its grid summary and leaves that grid's slope and 4° induced-drag summary null. The relative lift-slope delta is `|fine - coarse| / max(|coarse|, 1e-300)`. Swapping grids changes the denominator. The floor applies to the denominator only. When two finite slopes overflow on subtraction, the solver divides each slope by that denominator before taking their absolute difference. A nonfinite final delta withholds both aggregate metrics while retaining the separate per-grid validity. A failed prescribed comparison carries null deltas. A failed custom comparison omits its metrics and receives no plotted-grid coverage, even when the prescribed comparison passes. The applicable failed comparison yields an amber badge and a reason. The gates remain 1% for lift slope and 5% for induced drag. Identity includes the effective bounds-seed flag, where omission equals false, together with normalized surface placement, flow, reference values, actual lattices, the angle protocol and effective wake. Both the project snapshot and result download retain the identity and coverage.

### AUD-2 result export (2026-11-06)

The results download is versioned JSON (`airflow.vlm-results`, version 1), replacing the CSV. It retains the sweep and point validity, method and limitations, input geometry and flow, reference values and source, assumed mass source, lattice and resolution comparison/coverage, diagnostics, and CD0/CM0 interpretation. An invalid or missing-validity sweep withholds every coefficient and load as null, even for individually valid points, matching the existing plot rule. Missing/invalid point validity also withholds that point; nonfinite values serialize as null. Project analysis snapshots retain the export provenance and resolution. This is not scientific validation or a fix for the remaining application display defects.

**REM-3a:** Fixed uncertainty claims are withheld at case, sweep and resolution boundaries; scope travels in snapshots and JSON exports. R1/R2 is self-comparison, not an accuracy bound. Scientific acceptance and independent review remain open.

### REM-3b input integrity and Run recovery (2026-11-06)

The case, sweep and resolution APIs require an options object. Generated lattices require a nonempty list of uniquely named surfaces, matched case-insensitively after trimming for identity. Omitted names retain the single-surface default. Legacy numeric generator counts and omitted or automatic spanwise counts remain supported. The generator rejects invalid settings, nonfinite or degenerate derived geometry and panels below the existing aspect guard.

Supplied case panels use ordered bound endpoints. The duplicate span coordinates must match the endpoint y coordinates exactly, and supplied width and width/length metadata must agree with the derived width when their corresponding fields are present. The bound midpoint is checked against the endpoint mean with a binary64 arithmetic allowance of `max(Number.MIN_VALUE, Number.EPSILON * abs(mean))` per coordinate. Panels sharing an exact name declare one surface, and omitted panel names group together when no surface definitions are supplied. A supplied lattice below the existing aspect guard can be computed for raw measurements with invalid status. Full chord geometry and lattice completeness cannot be verified from horseshoe records alone.

The wake floor is ten times the largest surface's endpoint y extent. Generated solves subtract the first surface's root x and z from the surface placements before constructing the lattice. Moment reference coordinates move to the same frame. The returned panel points retain world coordinates for display and round at world-coordinate precision. Surface-driven callers should supply the surface definitions to retain local chord detail in calculations. Supplied panels are evaluated from their represented points, which cannot recover previously rounded geometry. Their original-frame collapsed wake guard still applies. The solver rejects nonfinite or non-advancing wake displacement. Trefftz projects the difference between the evaluation point and each bound leg origin in the working frame. At extreme offsets, the published absolute panel and neutral-point coordinates can still round. Resolution identity uses the plotted lattice's endpoint span and keeps the VLM-V3 thresholds and 0°/4° protocol.

Pressure references must produce finite positive force and moment normalizers. Nonfinite coefficients, moments, assembled sweep loads and fit outputs raise errors. Standalone Trefftz accepts finite numeric circulation, including zero, and rejects malformed supplied wake, pressure and near-field options. An omitted pressure normalizer still permits a dimensional drag calculation with unavailable coefficients.

Sweep endpoints and the positive increment use their shortest round-tripping decimal spellings. Exact decimal arithmetic counts the inclusive grid and each sample is rounded once to binary64. Rounded samples must advance strictly. The historical non-advancing check for a single-point sweep remains. A multi-point grid is checked on the samples it actually emits. The limits are 201 sweep samples, 4,096 generated panels and 2,048 panels per dense solve or standalone Trefftz call. Negative assumed CD0 is refused.

A synchronous job must also fit a combined work budget. Each dense case with `P` panels costs `P²(4096 + P)` units. A job may use up to four 2,048-panel equivalents. The sweep counts every sample, and the resolution comparison counts both angles on R1, R2 and any custom and refined lattices it will solve. The browser counts the sweep and resolution check together before starting either. Exceeding the budget refuses the job with a named error and clears prior Run results in the browser. This policy bounds estimated work. Accepted runs can still block the browser, and duration depends on the host.

The Run button reads browser numeric controls, distinguishing an intentionally blank automatic span count from malformed text. Input invalidation and Run failures clear the prior result, result diagnostics, neutral point, lattice and both plots. A successful run without a pitch series renders the pitch canvas as unavailable. The remaining display validity work and independent re-verification are tracked in the implementation handoff.
