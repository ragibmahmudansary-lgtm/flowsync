const FOUR_PI = 4 * Math.PI;
// Operational safeguards for the synchronous dense solver, not scientific limits.
export const MAX_VLM_PANELS = 2048;
export const MAX_GENERATED_PANELS = 4096;
export const MAX_SWEEP_POINTS = 201;
// One synchronous job can spend the work of at most four largest dense cases.
// Pair loops dominate the measured cost, with elimination adding a cubic term.
const MAX_SYNC_WORK = 4 * denseCaseWork(MAX_VLM_PANELS);

function denseCaseWork(panelCount) {
  return panelCount ** 2 * (4096 + panelCount);
}

function requireWorkBudget(work) {
  if (work > MAX_SYNC_WORK) {
    throw new Error("VLM synchronous work limit exceeded. Reduce the number of sweep points or panels.");
  }
}

// M0-4 / SOL-01 — dimensionally consistent RELATIVE singularity handling.
// DATA_CONTRACTS 2.7: "Singularity cutoff | Relative: 1e-6 x segment length".
// The absolute 1e-10 (compared against length^4 kernel products, length
// endpoints, length^2 projections and matrix pivots alike) destroyed scale
// invariance. Each comparison below is now a ratio of quantities with the SAME
// dimension, per quantity — not one constant:
//   - kernel distance  : h = |r1 x r2|/|r0| (distance to the segment's line)
//                        and the endpoint distances, each vs 1e-6 x |r0|;
//   - projection       : |projected bound| vs 1e-6 x |bound| (Trefftz legs);
//   - leg coincidence  : |r| vs 1e-6 x |bound| of the leg's own panel;
//   - pivot            : |pivot| vs 1e-10 x max|A| (dimensionless ratio);
//   - elimination skip : none — a nonzero elimination factor is never
//                        suppressed (a factor is already a dimensionless
//                        ratio; dropping it is an unquantified approximation).
// Nothing is floored, clipped or abs-ed to conceal a value: residual cutoff
// engagements are counted in diagnostics.kernelTruncations and quarantine the
// case (the REM-1 guard, unchanged).
export const RELATIVE_SINGULARITY_CUTOFF = 1e-6;
const SOLVER_PIVOT_RELATIVE_TOLERANCE = 1e-10;
// Dimensionless degeneracy checks of the linear-fit/trim arithmetic only
// (slopes in deg^2 / per-rad). Not a dimensional cutoff. M0-5 / SOL-09 kept
// this check in its documented role — detecting an ARITHMETICALLY degenerate
// slope/x-spread — and reworked the fit/trim CONTRACT itself separately
// (below); the two must not be conflated.
const FIT_EPSILON = 1e-10;

// M0-5 / SOL-09 — fit and trim contract (DATA_CONTRACTS 2.5, RB-21;
// VALIDATION_AND_TEST_MATRIX VLM-V7). A slope (C_Lalpha, C_malpha) is reported
// ONLY when the fit window (|alpha| <= 5 deg by default) holds >= 3 converged
// points and every adjacent-pair slope is within 5 % of the window's
// least-squares slope. Otherwise the derivative is "insufficient linear data"
// or "non-linear: not determined" — never a zero slope and never a stability
// verdict. The two-point R1/R2 resolution protocol is a deliberately defined
// DIAGNOSTIC (see twoPointSlopePerRad below), never a certified derivative.
export const FIT_WINDOW_MAX_ABS_ALPHA_DEG = 5;
export const FIT_MIN_CONVERGED_POINTS = 3;
export const FIT_ADJACENT_SLOPE_TOLERANCE = 0.05;
export const FIT_STATUS_DETERMINED = "determined";
export const FIT_STATUS_INSUFFICIENT = "insufficient linear data";
export const FIT_STATUS_NONLINEAR = "non-linear: not determined";
// Rounding robustness for the fit window only. The sweep has its own exact
// decimal endpoint policy.
const FIT_WINDOW_EPSILON_DEG = 1e-9;

// M0-2 lattice contract (DATA_CONTRACTS 2.7, IMPLEMENTATION_HANDOFF 2 "M0-2"):
// M chordwise rows x N spanwise strips, uniform in both directions. The single
// guard refuses any panel with width/length < 0.25; values above 8 trigger a
// coarse-spanwise warning (elliptic tip strips legitimately reach about 4.5).
export const PANEL_ASPECT_MIN = 0.25;
export const PANEL_ASPECT_WARN = 8;
export const DEFAULT_CHORDWISE_ROWS = 4;
export const MIN_SPANWISE_PANELS = 16;
export const UNCERTAINTY_LABEL = "flat-plate inviscid estimate: C_Lα ±5 %, C_Di ±8 %";

// The contract label is retained above as provenance, not applied to results:
// the reviewed evidence does not establish a complete application envelope.
export const UNCERTAINTY_SCOPE =
  "Fixed numerical claim withheld pending a reviewed geometry, flow, angle and resolution envelope. " +
  "Published benchmark comparisons are limited cases, not a confidence interval or validated aircraft error bound; " +
  "R1/R2 agreement is self-comparison and does not validate moment or neutral point.";
export const UNCERTAINTY_UNVERIFIED_LABEL =
  "unverified: fixed Tier-0 uncertainty claim unavailable";

// SOL-03 quarantine (REM-1): the VLM-V2b near-field/Trefftz gate (1 %) is
// enforced as an internal-consistency validity gate on planar (unswept, no
// dihedral) configurations. Swept/dihedral configurations are reported only —
// the matrix itself expects -2.5..-12 % there from the RB-07 midpoint rule.
export const NEAR_FIELD_TREFFTZ_GATE = 0.01;
// Elliptic lattices beyond the validated envelope (VLM-V2d evidence covers
// M = 4/8; M = 12/16 demonstrated corrupt, SOL-03) are quarantined.
export const VALIDATED_ELLIPTIC_ROWS_MAX = 8;

export function createLiftingSurface(reference, options = {}) {
  if (!isOptionsObject(reference) || !isOptionsObject(options)) throw new Error("A lifting surface and options object are required.");
  const name = options.name === undefined ? reference.name : options.name;
  if (name !== undefined && (typeof name !== "string" || !name.trim())) throw new Error("A lifting surface name must be a nonempty string.");
  if (reference.planform !== undefined && !["linear", "elliptic"].includes(reference.planform)) throw new Error("Unknown planform.");
  const spanM = positive(reference.spanM, "span");
  const planform = reference.planform === "elliptic" ? "elliptic" : "linear";
  const rootChordM = positive(reference.rootChordM === undefined ? reference.macM : reference.rootChordM, "root chord");
  // The elliptic planform c(y) = c0 sqrt(1 - (2y/b)^2) tapers to zero tip chord
  // (IMPLEMENTATION_HANDOFF 3.3).
  const tipChordM = planform === "elliptic" ? 0 : positive(reference.tipChordM === undefined ? reference.macM : reference.tipChordM, "tip chord");
  if (planform === "elliptic" && reference.tipChordM !== undefined && reference.tipChordM !== 0) throw new Error("Elliptic tip chord must be zero.");
  return {
    name: name ?? "Main wing",
    planform,
    spanM,
    rootChordM,
    tipChordM,
    sweepDeg: optionalFinite(reference.sweepDeg, 0, "sweepDeg"),
    dihedralDeg: optionalFinite(reference.dihedralDeg, 0, "dihedralDeg"),
    incidenceDeg: optionalFinite(options.incidenceDeg === undefined ? reference.incidenceDeg : options.incidenceDeg, 0, "incidenceDeg"),
    xLeadingRootM: optionalFinite(reference.xLeadingRootM, 0, "xLeadingRootM"),
    zRootM: optionalFinite(reference.zRootM, 0, "zRootM")
  };
}

/**
 * Multi-row VLM lattice (M0-2, DR-02).
 *
 * - M chordwise rows (default 4) x N spanwise strips, uniform in both directions.
 * - N per surface defaults to the prescription "panel width/length ~ 1 at the
 *   mean chord", i.e. the VALIDATION_AND_TEST_MATRIX resolutions
 *   R1 = (8 ceil(AR/2) spanwise x 4 chordwise) and R2 = (16 ceil(AR/2) x 8),
 *   with at least 16 spanwise strips.
 * - Each strip's chord is interpolated at its edges (linear planform) or taken
 *   from the analytic section (elliptic planform).
 * - The bound vortex sits at the 1/4 point of each sub-panel, the control point
 *   at the 3/4 point.
 * - Guard: any panel with width/length < 0.25 REFUSES the lattice (throws).
 *   Ratios above 8 are reported as a coarse-spanwise validity warning by
 *   panelAspectDiagnostics().
 *
 * `options` may be a number (legacy spanwise count for every surface) or
 * { spanwisePanels, chordwiseRows }. `spanwisePanels: "auto"` or an omitted
 * count selects the prescribed per-surface N.
 */
export function generateVlmPanels(surfaces, options = {}) {
  if (typeof options !== "number" && (!options || typeof options !== "object" || Array.isArray(options)))
    throw new Error("Lattice options must be an object or a numeric spanwise count.");
  const config = typeof options === "number" ? { spanwisePanels: options } : options;
  const definitions = normalizeSurfaces(surfaces);
  return generateLattice(latticePlan(definitions, config.spanwisePanels, clampRows(config.chordwiseRows))).panels;
}

function latticePlan(surfaces, spanwisePanels, chordwiseRows) {
  const sizes = surfaces.map(surface => spanwisePanelsFor(surface, spanwisePanels, chordwiseRows));
  const panelCount = sizes.reduce((sum, count) => sum + count * chordwiseRows, 0);
  if (sizes.some(count => !Number.isSafeInteger(count)) || panelCount > MAX_GENERATED_PANELS)
    throw new Error(`VLM panel generation resource limit is ${MAX_GENERATED_PANELS}.`);
  const counts = new Map(surfaces.map((surface, index) => [surface.name, sizes[index]]));
  return { surfaces, chordwiseRows, sizes, panelCount, counts };
}

function requireDenseLattice(panelCount) {
  if (panelCount > MAX_VLM_PANELS) throw new Error(`VLM panel resource limit is ${MAX_VLM_PANELS}.`);
}

function generateLattice({ surfaces, chordwiseRows, sizes }) {
  // Remove the common origin before adding chord, sweep, or dihedral offsets.
  // The published panel positions are rounded world coordinates for display.
  const origin = [surfaces[0].xLeadingRootM, 0, surfaces[0].zRootM];
  const localPanels = [];
  for (const [index, definition] of surfaces.entries()) {
    const surface = { ...definition,
      xLeadingRootM: definition.xLeadingRootM - origin[0],
      zRootM: definition.zRootM - origin[2] };
    const count = sizes[index];
    const incidence = surface.incidenceDeg * Math.PI / 180;
    // Positive incidence raises the leading edge relative to the trailing edge
    // in the internal downstream-positive x convention.
    const chordDirection = normalize([Math.cos(incidence), 0, -Math.sin(incidence)]);
    // DEC-M0-3-1: incidence rotates each section about its local quarter-chord
    // point — the DATA_CONTRACTS §3.2 rotation convention ("a rotation about +y
    // through the local c/4 point"). With q = LE + (c/4, 0, 0) the unrotated
    // local c/4 point and d = (cos i, 0, -sin i), a chordwise point at chord
    // fraction f is P(f) = q + (f - 1/4) c d, i.e. the pre-M0-3 leading-edge
    // pivot expression plus the rigid-body shift (c/4)(1 - cos i, 0, sin i).
    // The shift is exactly zero at i = 0, so zero-incidence lattices are
    // identical to the pre-M0-3 geometry to the last bit (a component that is
    // exactly -0 is normalized to +0 by the extra add; JSON serialization
    // renders both as 0), while the projected c/4 line of the generated panels
    // stays exactly the input sweep at any incidence (VLM-V6, review §7.2).
    const incidenceShift = [1 - Math.cos(incidence), 0, Math.sin(incidence)];
    const chordPoint = (section, fraction) => add(
      add(section.leading, scale(chordDirection, fraction * section.chord)),
      scale(incidenceShift, 0.25 * section.chord)
    );
    const edges = [];
    for (let i = 0; i <= count; i += 1) {
      // Uniform spanwise spacing (the single-row cosine spacing is retired with
      // DR-02; uniform spacing is the approved lattice).
      edges.push(-0.5 * surface.spanM + surface.spanM * i / count);
    }
    for (let i = 0; i < count; i += 1) {
      const y0 = edges[i];
      const y1 = edges[i + 1];
      const ym = (y0 + y1) / 2;
      const left = sectionAt(surface, y0);
      const right = sectionAt(surface, y1);
      const middle = sectionAt(surface, ym);
      const widthM = y1 - y0;
      // Panel length = the chordwise extent of the sub-panel at the strip's
      // mean chord (DATA_CONTRACTS §2.7: "width/length ≈ 1 at the mean chord").
      // This convention reproduces the review record §4 panel-ratio tables
      // (elliptic tip strips reach about 4.5 with it).
      const lengthM = middle.chord / chordwiseRows;
      for (let k = 0; k < chordwiseRows; k += 1) {
        const boundFraction = (k + 0.25) / chordwiseRows;
        const controlFraction = (k + 0.75) / chordwiseRows;
        const boundA = chordPoint(left, boundFraction);
        const boundB = chordPoint(right, boundFraction);
        const controlPoint = chordPoint(middle, controlFraction);
        const spanTangent = subtract(boundB, boundA);
        let normal = normalize(cross(chordDirection, spanTangent));
        if (normal[2] < 0) normal = scale(normal, -1);
        localPanels.push({
          surfaceName: surface.name,
          planform: surface.planform,
          spanIndex: i,
          chordIndex: k,
          y0,
          y1,
          widthM,
          lengthM,
          widthLengthRatio: widthM / lengthM,
          chordM: middle.chord,
          boundA,
          boundB,
          boundMidpoint: scale(add(boundA, boundB), 0.5),
          controlPoint,
          normal
        });
      }
    }
  }
  for (const panel of localPanels) {
    if (![panel.y0, panel.y1, panel.widthM, panel.lengthM, panel.widthLengthRatio, panel.chordM].every(Number.isFinite) ||
        !(panel.y1 > panel.y0) || !(panel.widthM > 0) || !(panel.lengthM > 0) || !(panel.widthLengthRatio > 0) ||
        ![panel.boundA, panel.boundB, panel.boundMidpoint, panel.controlPoint, panel.normal].every(isFinitePoint) ||
        !(Math.hypot(...panel.normal) > 0)) {
      throw new Error("Generated panel has nonfinite or degenerate geometry.");
    }
    if (panel.widthLengthRatio < PANEL_ASPECT_MIN) {
      throw new Error(
        `VLM lattice refused: panel ${panel.surfaceName} #${panel.spanIndex}/${panel.chordIndex} has ` +
        `width/length = ${panel.widthLengthRatio.toFixed(3)} < ${PANEL_ASPECT_MIN} ` +
        `(width ${panel.widthM.toFixed(4)} m, length ${panel.lengthM.toFixed(4)} m). ` +
        `Add chordwise rows or reduce the spanwise count.`
      );
    }
  }
  const panels = offsetPanels(localPanels, origin, add);
  return { origin, localPanels, panels };
}

function offsetPanels(panels, origin, translate, includeControl = true) {
  if (origin.every(value => value === 0)) return panels;
  return panels.map(panel => {
    const boundA = translate(panel.boundA, origin);
    const boundB = translate(panel.boundB, origin);
    const boundMidpoint = translate(panel.boundMidpoint, origin);
    const controlPoint = includeControl ? translate(panel.controlPoint, origin) : undefined;
    if (![boundA, boundB, boundMidpoint].every(isFinitePoint) || (includeControl && !isFinitePoint(controlPoint))) {
      throw new Error("VLM panel coordinates cannot be represented in the requested frame.");
    }
    return { ...panel, boundA, boundB, boundMidpoint, controlPoint };
  });
}

/**
 * Validity indicators for a generated lattice (M0-2): the min/max width/length
 * ratio and the coarse-spanwise warning above 8. The hard lower guard (0.25) is
 * enforced by generateVlmPanels itself (it refuses the lattice).
 */
export function panelAspectDiagnostics(panels) {
  let minRatio = Infinity;
  let maxRatio = 0;
  for (const panel of panels) {
    minRatio = Math.min(minRatio, panel.widthLengthRatio);
    maxRatio = Math.max(maxRatio, panel.widthLengthRatio);
  }
  const messages = [];
  if (maxRatio > PANEL_ASPECT_WARN) {
    messages.push(
      `Coarse spanwise spacing: panel width/length up to ${maxRatio.toFixed(2)} (warning above ${PANEL_ASPECT_WARN}).`
    );
  }
  return {
    status: messages.length ? "warning" : "ok",
    messages,
    minRatio,
    maxRatio
  };
}

/**
 * Prescribed spanwise count for one surface at M chordwise rows:
 * N = max(16, 2 M ceil(AR/2)) — exactly R1 = 8 ceil(AR/2) at M = 4 and
 * R2 = 16 ceil(AR/2) at M = 8 (VALIDATION_AND_TEST_MATRIX), which keeps the
 * panel width/length at about 1 at the mean chord.
 */
export function autoSpanwisePanels(surface, chordwiseRows = DEFAULT_CHORDWISE_ROWS) {
  const rows = clampRows(chordwiseRows);
  return Math.max(MIN_SPANWISE_PANELS, 2 * rows * ceilPrescribedRatio(surfaceAspectRatio(createLiftingSurface(surface)) / 2));
}

// M0-4 (SOL-01, second root cause of scale dependence): the integer-valued
// prescription ceil(AR/2) is DISCONTINUOUS while the computed aspect ratio
// carries ~1 ulp of rounding whose direction varies with geometry scale.
// Measured on the auto-N prescription: at 0.1x the tail of a wing+tail case
// computed AR = 6.000000000000001 and jumped 24 -> 32 strips (coefficients
// moved 3e-4); at 1e-3x a tapered/swept case computed AR = 10.000000000000002
// and jumped 40 -> 48. Snap the ratio to its nearest integer when it lies
// within a few ulps of it, so the chosen lattice is a function of the exact
// geometry ratio (whose ceil is well defined) and not of the scale's rounding
// direction. Genuinely fractional ratios are untouched (the window is ~12 ulps
// wide); no physics value is adjusted anywhere.
function ceilPrescribedRatio(ratio) {
  const nearest = Math.round(ratio);
  const snapped = Math.abs(ratio - nearest) <= 8 * Number.EPSILON * Math.max(1, Math.abs(ratio))
    ? nearest
    : ratio;
  return Math.ceil(snapped);
}

/**
 * Resolution identification (M0-2): "R1", "R2" or "custom" for a lattice built
 * from `surfaces` with the given row count and per-surface spanwise counts.
 */
export function resolutionLabel(surfaces, chordwiseRows, spanwiseCountsByName) {
  const rows = clampRows(chordwiseRows);
  const matches = (targetRows) => rows === targetRows && surfaces.every((surface) => {
    const expected = autoSpanwisePanels(surface, targetRows);
    const actual = spanwiseCountsByName instanceof Map
      ? spanwiseCountsByName.get(surface.name)
      : spanwiseCountsByName?.[surface.name];
    return actual === expected;
  });
  if (matches(DEFAULT_CHORDWISE_ROWS)) return "R1";
  if (matches(2 * DEFAULT_CHORDWISE_ROWS)) return "R2";
  return "custom";
}

function spanwisePanelsFor(surface, requested, chordwiseRows) {
  if (requested === undefined || requested === "auto") return autoSpanwisePanels(surface, chordwiseRows);
  if (!Number.isInteger(requested) || requested < 4 || requested > 240) throw new Error("spanwisePanels must be auto or an integer from 4 to 240.");
  return requested;
}

function clampRows(chordwiseRows) {
  if (chordwiseRows === undefined) return DEFAULT_CHORDWISE_ROWS;
  if (!Number.isInteger(chordwiseRows) || chordwiseRows < 1 || chordwiseRows > 16) throw new Error("chordwiseRows must be an integer from 1 to 16.");
  return chordwiseRows;
}

function surfaceAspectRatio(surface) {
  const span = surface.spanM;
  if (surface.planform === "elliptic") return 4 * span / (Math.PI * surface.rootChordM);
  return 2 * span / (surface.rootChordM + surface.tipChordM);
}

export function inducedVelocityFiniteSegment(point, start, end, stats = null) {
  return finiteSegmentFromVectors(subtract(point, start), subtract(point, end), subtract(end, start), stats);
}

function finiteSegmentFromVectors(r1, r2, r0, stats) {
  const segmentLength = magnitude(r0);
  // A zero-length segment is a point vortex and induces no velocity (exact at
  // any scale — not a truncation).
  if (segmentLength === 0) return [0, 0, 0];
  const crossValue = cross(r1, r2);
  const crossSquared = dot(crossValue, crossValue);
  const r1Length = magnitude(r1);
  const r2Length = magnitude(r2);
  // M0-4 / SOL-01 (DATA_CONTRACTS 2.7: relative, 1e-6 x segment length).
  // |r1 x r2| = |r0| * h with h the distance from the point to the segment's
  // line, so crossSquared < (1e-6 * |r0|)^2 * |r0|^2 is exactly the relative
  // kernel-distance cutoff h < 1e-6 x |r0| (dimensionless at any scale); the
  // endpoint cutoffs r1, r2 < 1e-6 x |r0| cover the segment's endpoints. The
  // h-based cutoff also bounds the cancellation noise of the closed-form
  // kernel for near-collinear evaluations (measured: per-evaluation noise
  // <= ~3e-10 of 1/(4 pi |r0|) for h >= 1e-6 |r0| — negligible against
  // retained terms ~ 1/(4 pi |r0|)), which is why the singular set is treated
  // as the line-segment neighbourhood rather than the filament alone. The
  // endpoint tests are a roundoff backstop: h <= min(r1, r2) always holds, so
  // they can only fire together with the kernel-distance test.
  const cutoffLength = RELATIVE_SINGULARITY_CUTOFF * segmentLength;
  const kernelCutoffSquared = cutoffLength * cutoffLength * segmentLength * segmentLength;
  if (crossSquared < kernelCutoffSquared || r1Length < cutoffLength || r2Length < cutoffLength) {
    // REM-1 discrimination (dimensionless; unchanged except that a point whose
    // foot falls exactly ON a segment endpoint is now counted, not excluded):
    // count every suppression that deletes a REAL term so callers can quarantine affected results.
    // Two classes of engagement do NOT suppress a meaningful term and are
    // excluded:
    //   (a) exact geometric zero — the point lies on the segment's line
    //       strictly outside the segment (sin^2 theta = 0 to roundoff): the
    //       exact induced velocity is zero at any scale (the same-row
    //       bound-midpoint vs same-row bound-segment evaluations of the force
    //       loop land here);
    //   (b) far-field collinear suppression — the point is more than one
    //       segment length away AND nearly on the line (sin theta < 1e-5):
    //       the exact velocity there is bounded by h/(4 pi d^2) and is
    //       negligible against the retained terms.
    // Everything else — a near-field or near-endpoint term deleted by the
    // cutoff — is counted as a truncation. The counter only ever ADDS
    // invalidity; it never adjusts a value.
    if (stats) {
      const tRaw = dot(r1, r0) / (segmentLength * segmentLength);
      const tClamped = Math.min(1, Math.max(0, tRaw));
      const distanceToSegment = magnitude(subtract(r1, scale(r0, tClamped)));
      const sinSquared = r1Length > 0 && r2Length > 0
        ? crossSquared / (r1Length * r1Length * r2Length * r2Length)
        : 1;
      const exactGeometricZero = sinSquared < 1e-24 && (tRaw < 0 || tRaw > 1);
      const farFieldCollinear = distanceToSegment > segmentLength && sinSquared < 1e-10;
      if (!exactGeometricZero && !farFieldCollinear) stats.truncations += 1;
    }
    return [0, 0, 0];
  }
  const factor = dot(r0, subtract(scale(r1, 1 / r1Length), scale(r2, 1 / r2Length))) / (FOUR_PI * crossSquared);
  return scale(crossValue, factor);
}

export function inducedVelocityHorseshoe(point, panel, wakeDirection, wakeLengthM, includeBound = true, stats = null) {
  const wakeOffset = scale(wakeDirection, wakeLengthM);
  const fromA = subtract(point, panel.boundA);
  const fromB = subtract(point, panel.boundB);
  // Each leg uses its prescribed displacement directly. Forming an absolute
  // wake endpoint first can shorten or turn a finite leg after rounding.
  let velocity = finiteSegmentFromVectors(subtract(fromA, wakeOffset), fromA, scale(wakeOffset, -1), stats);
  if (includeBound) velocity = add(velocity, finiteSegmentFromVectors(fromA, fromB, subtract(panel.boundB, panel.boundA), stats));
  velocity = add(velocity, finiteSegmentFromVectors(fromB, subtract(fromB, wakeOffset), wakeOffset, stats));
  return velocity;
}

/**
 * General transverse-plane (Trefftz) induced drag, signed (DATA_CONTRACTS §2.7, RB-03).
 *
 *   D = 0.5 * rho * sum_i G_i * dot(vT(proj(m_i)), cross(l_i, ew))
 *
 * ew is the unit wake (= freestream) direction; proj(p) is p projected onto the
 * plane perpendicular to ew. Each horseshoe j contributes two infinite trailing
 * legs to vT: a 2-D vortex of strength s * G_j with s = -1 at boundA (the leg is
 * traversed upstream, matching the 3-D horseshoe) and s = +1 at boundB. vT sums
 * over ALL legs of ALL panels of ALL surfaces and is evaluated at the projected
 * bound midpoint. The factor 0.5 accounts for the 2-D transverse velocity being
 * twice the 3-D trailing-leg velocity at the bound line.
 *
 * No absolute value anywhere: D >= 0 is asserted (D = 0 only at zero lift,
 * D > 0 otherwise). A genuinely negative value — below the floating-point
 * cancellation tolerance of the evaluated sum — raises a validity error.
 *
 * options:
 *   nearFieldDragN        — signed RAW near-field drag (N) for comparison (e.g.
 *                           the Kutta-Joukowski projection computed by
 *                           solveVlmCase).
 *   nearFieldErrorBudgetN — forward-error bound (N) of the supplied value's own
 *                           computation. Without it the companion Trefftz
 *                           budget is the declared fallback basis.
 *   wakeLengthM           — if nearFieldDragN is not supplied, the near-field
 *                           drag is recomputed here from the same horseshoes
 *                           with this wake length (budget computed here).
 *   qS                    — dynamic pressure x reference area; COEFFICIENTS
 *                           only (cdi*). It never touches a dimensional value,
 *                           a tolerance or sign detection (SOL-06).
 *
 * Returns dragNTrefftz, dragNNearField (reported: the raw value, or exactly 0
 * when numerically unresolved — always flagged), dragNTrefftzRaw,
 * dragNNearFieldRaw (raw signed values, always preserved), cdiTrefftz,
 * cdiNearField, relativeDifference, trefftzSuppression and nearFieldSuppression
 * ({ suppressedToZero, reason, toleranceN } — SOL-06).
 *
 * SOL-10 (REM-1): inputs are validated before evaluation — array lengths, finite
 * circulation (error names the panel index), positive finite density and finite
 * panel coordinates. Missing or malformed scientific data is never coerced into
 * a plausible zero.
 */
export function trefftzDrag(panels, circulation, rho, wakeDirection, options = {}) {
  return evaluateTrefftzDrag(panels, circulation, rho, wakeDirection, options, false);
}

function evaluateTrefftzDrag(panels, circulation, rho, wakeDirection, options, local) {
  requireSolverOptions(options);
  validateTrefftzInputs(panels, circulation, rho, wakeDirection);
  const ew = normalize(wakeDirection);
  const qS = options.qS === undefined ? undefined : positive(options.qS, "qS");
  const wakeLengthM = options.wakeLengthM === undefined ? undefined : positive(options.wakeLengthM, "wakeLengthM");
  const nearFieldInput = options.nearFieldDragN;
  if (nearFieldInput !== undefined && !Number.isFinite(nearFieldInput)) throw new Error("Near-field drag input is not finite.");
  const nearFieldBudget = options.nearFieldErrorBudgetN;
  if (nearFieldBudget !== undefined && !(Number.isFinite(nearFieldBudget) && nearFieldBudget >= 0)) {
    throw new Error("Near-field forward-error budget must be a non-negative finite number.");
  }
  if (!local && panels.length) panels = offsetPanels(panels, panels[0].boundA, subtract, false);
  if (wakeLengthM !== undefined && nearFieldInput === undefined) validateWakeOffset(ew, wakeLengthM);
  const stats = options.stats || null;
  const legs = [];
  for (let j = 0; j < panels.length; j += 1) {
    const gamma = circulation[j];
    const boundVector = subtract(panels[j].boundB, panels[j].boundA);
    const boundLength = magnitude(boundVector);
    const projectedBound = project(boundVector, ew);
    // M0-4 / SOL-01 (DATA_CONTRACTS 2.7): a panel whose bound projects to a
    // point (degenerate, or bound parallel to the wake) has two coincident
    // opposite-strength legs: net zero. Skip both. The degeneracy is the
    // RELATIVE ratio |projected bound| / |bound| < 1e-6 (dimensionless at any
    // scale; the exact-zero bound projects to exactly zero and is skipped —
    // the comparison is inclusive so exact-degenerate coincidences are always
    // suppressed).
    if (dot(projectedBound, projectedBound) <= (RELATIVE_SINGULARITY_CUTOFF * boundLength) ** 2) continue;
    if (gamma === 0) continue;
    legs.push({ origin: panels[j].boundA, strength: -gamma, boundLength, sourceMagnitude: magnitude(panels[j].boundA) });
    legs.push({ origin: panels[j].boundB, strength: gamma, boundLength, sourceMagnitude: magnitude(panels[j].boundB) });
  }
  let dragNTrefftz = 0;
  let magnitudeN = 0;
  let trefftzOpsMagnitudeN = 0;
  let trefftzTerms = 0;
  for (let i = 0; i < panels.length; i += 1) {
    const gamma = circulation[i];
    const arm = cross(subtract(panels[i].boundB, panels[i].boundA), ew);
    const midpoint = panels[i].boundMidpoint;
    let vT = [0, 0, 0];
    let legMagnitude = 0;
    // DEC-SOL-06-4 (tightened per independent re-verification): the term chain
    // counts its straight operations plus the coordinate-translation
    // amplification of the projected midpoint, the leg origin (both
    // pre-projection magnitudes) and the bound-vector difference. Each leg's
    // amplification weights ITS OWN contribution magnitude — never the sum of
    // all legs (that would over-count by ~leg count and open a false dead band
    // at large coordinate offsets).
    const boundLength = magnitude(subtract(panels[i].boundB, panels[i].boundA));
    const midpointMagnitude = magnitude(panels[i].boundMidpoint);
    const armErrorOps = boundLength > 0
      ? OPS_PER_PROJECTION * ((magnitude(panels[i].boundA) + magnitude(panels[i].boundB)) / boundLength)
      : 0;
    let legErrorOpsMagnitude = 0;
    for (const leg of legs) {
      const r = project(subtract(midpoint, leg.origin), ew);
      const rSquared = dot(r, r);
      // Coincident singularity in the transverse plane: only degenerate
      // geometries reach this guard. M0-4 / SOL-01: relative to the leg's own
      // panel bound length (1e-6 x segment length, DATA_CONTRACTS 2.7), never
      // an absolute length^2 constant. The comparison is inclusive so a
      // coincident evaluation point (r = 0) is always suppressed. Engagements
      // are counted so callers can quarantine degenerate configurations.
      const legCutoff = RELATIVE_SINGULARITY_CUTOFF * leg.boundLength;
      if (rSquared <= legCutoff * legCutoff) {
        if (stats) stats.truncations += 1;
        continue;
      }
      const contribution = scale(cross(ew, r), leg.strength / (2 * Math.PI * rSquared));
      vT = add(vT, contribution);
      // SOL-06 forward-error bookkeeping: sum|contribution| bounds |vT| and is
      // the magnitude the term's floating-point chain acts on. The |p|/|r|
      // factor is the DEC-SOL-06-4 coordinate amplification (r > legCutoff
      // here, so it is finite). Division before multiplication keeps the
      // factor finite where 36 * |p| would overflow.
      const contributionMagnitude = magnitude(contribution);
      legMagnitude += contributionMagnitude;
      legErrorOpsMagnitude += (OPS_PER_TRANSVERSE_LEG
        + DISTANCE_ERROR_SENSITIVITY * OPS_PER_PROJECTION
          * ((midpointMagnitude + leg.sourceMagnitude) / Math.sqrt(rSquared)))
        * contributionMagnitude;
    }
    const term = 0.5 * rho * gamma * dot(vT, arm);
    dragNTrefftz += term;
    magnitudeN += Math.abs(term);
    trefftzTerms += 1;
    // |dot(vT, arm)| <= |vT| * |arm| <= legMagnitude * |arm|, so this basis
    // dominates |term| and carries the term's error in newtons: the leg chains
    // weighted above act through 0.5 rho |Gamma| |arm|; the arm difference and
    // the dot/scaling chain act on the same dominating basis.
    trefftzOpsMagnitudeN += (0.5 * rho * Math.abs(gamma) * magnitude(arm)) * legErrorOpsMagnitude
      + (OPS_PER_TREFFTZ_TERM + armErrorOps) * (0.5 * rho * Math.abs(gamma) * magnitude(arm) * legMagnitude);
  }
  const dragNTrefftzRaw = dragNTrefftz;
  const trefftzToleranceN = accumulationGamma(trefftzTerms) * magnitudeN
    + DBL_UNIT_ROUNDOFF * trefftzOpsMagnitudeN;
  const trefftzReport = reportSignedDrag(
    "Trefftz-plane", dragNTrefftzRaw, trefftzToleranceN, "dragNTrefftzRaw", "Trefftz sum forward error"
  );
  dragNTrefftz = trefftzReport.reportedN;

  let dragNNearField = null;
  let dragNNearFieldRaw = null;
  let nearFieldSuppression = null;
  // SOL-10 consistency (DEC-SOL-06-4): a SUPPLIED near-field drag or error
  // budget must be finite when present — malformed scientific data is never
  // silently treated as "not supplied".
  if (nearFieldInput !== undefined) {
    dragNNearFieldRaw = nearFieldInput;
    // SOL-06: a supplied raw value's own operations are unknown here. A
    // caller-supplied forward-error budget is used when present (solveVlmCase
    // passes the budget of its force projection); otherwise the companion
    // Trefftz budget is the declared fallback basis. With no basis at all
    // (empty sum, budget 0) nothing is ever suppressed: the raw value is
    // reported as-is and a resolved negative one raises.
    const suppliedToleranceN = nearFieldBudget ?? trefftzToleranceN;
    const suppliedBasis = nearFieldBudget !== undefined
      ? "caller-supplied forward-error budget"
      : "companion Trefftz sum forward error (no caller-supplied budget)";
    const report = reportSignedDrag(
      "Near-field", dragNNearFieldRaw, suppliedToleranceN, "dragNNearFieldRaw", suppliedBasis
    );
    dragNNearField = report.reportedN;
    nearFieldSuppression = report.suppression;
  } else if (wakeLengthM !== undefined) {
    dragNNearField = 0;
    dragNNearFieldRaw = 0;
    let nearFieldMagnitude = 0;
    let nearFieldOpsMagnitudeN = 0;
    let nearFieldTerms = 0;
    for (let i = 0; i < panels.length; i += 1) {
      const gamma = circulation[i];
      const arm = cross(subtract(panels[i].boundB, panels[i].boundA), ew);
      let induced = [0, 0, 0];
      let inducedMagnitude = 0;
      let inducedOpsMagnitude = 0;
      for (let j = 0; j < panels.length; j += 1) {
        const contribution = scale(
          inducedVelocityHorseshoe(panels[i].boundMidpoint, panels[j], ew, wakeLengthM, j !== i, stats),
          circulation[j]
        );
        induced = add(induced, contribution);
        const contributionMagnitude = magnitude(contribution);
        inducedMagnitude += contributionMagnitude;
        // DEC-SOL-06-4 (c): pair ops include the coordinate-translation
        // amplification of this induction's kernel evaluations.
        inducedOpsMagnitude += (OPS_PER_HORSESHOE_PAIR
          + inductionDistanceErrorOps(panels[i].boundMidpoint, panels[j], ew, wakeLengthM))
          * contributionMagnitude;
      }
      const term = rho * gamma * dot(induced, arm);
      dragNNearFieldRaw += term;
      nearFieldMagnitude += Math.abs(term);
      nearFieldTerms += 1;
      nearFieldOpsMagnitudeN += rho * Math.abs(gamma) * magnitude(arm)
        * (inducedOpsMagnitude + OPS_PER_NEAR_FIELD_TERM * inducedMagnitude);
    }
    const nearFieldToleranceN = accumulationGamma(nearFieldTerms) * nearFieldMagnitude
      + DBL_UNIT_ROUNDOFF * nearFieldOpsMagnitudeN;
    const report = reportSignedDrag(
      "Near-field", dragNNearFieldRaw, nearFieldToleranceN, "dragNNearFieldRaw", "near-field sum forward error"
    );
    dragNNearField = report.reportedN;
    nearFieldSuppression = report.suppression;
  }

  // SOL-06: the ratio of the two extractions is only comparable when both are
  // numerically resolved. If either is unresolved (suppressed to 0) the ratio
  // is a ratio of noise and is reported as NaN ("not comparable") — never as a
  // spurious 0 or -1.
  let relativeDifference;
  if (dragNNearFieldRaw === null) {
    relativeDifference = NaN;
  } else if (dragNTrefftzRaw === 0) {
    relativeDifference = dragNNearFieldRaw === 0 ? 0 : NaN;
  } else if (trefftzReport.suppression.suppressedToZero || nearFieldSuppression.suppressedToZero) {
    relativeDifference = NaN;
  } else {
    relativeDifference = (dragNNearFieldRaw - dragNTrefftzRaw) / dragNTrefftzRaw;
  }
  const cdiTrefftz = qS === undefined ? NaN : dragNTrefftz / qS;
  const cdiNearField = qS === undefined || dragNNearField === null ? NaN : dragNNearField / qS;
  if (qS !== undefined && (!Number.isFinite(cdiTrefftz) || (dragNNearField !== null && !Number.isFinite(cdiNearField)))) {
    throw new Error("Nonfinite induced drag coefficient produced by the reference normalization.");
  }
  return {
    dragNTrefftz,
    dragNTrefftzRaw,
    dragNNearField,
    dragNNearFieldRaw,
    cdiTrefftz,
    cdiNearField,
    relativeDifference,
    trefftzSuppression: trefftzReport.suppression,
    nearFieldSuppression
  };
}

// SOL-10 (REM-1): malformed scientific input fails loudly, naming the offending
// index. The previous `Number(x) || 0` coercion mapped NaN/missing circulation to
// zero, silently converting an upstream failure into plausible physics.
function validateTrefftzInputs(panels, circulation, rho, wakeDirection) {
  if (!Array.isArray(panels) || panels.length === 0) {
    throw new Error("Trefftz drag requires a non-empty panel array.");
  }
  if (panels.length > MAX_VLM_PANELS) throw new Error(`VLM panel resource limit is ${MAX_VLM_PANELS}.`);
  if (!circulation || typeof circulation.length !== "number" || circulation.length !== panels.length) {
    throw new Error(
      `Trefftz drag requires exactly one circulation value per panel ` +
      `(${panels.length} panels, ${circulation && typeof circulation.length === "number" ? circulation.length : "no"} values).`
    );
  }
  if (!Number.isFinite(rho) || rho <= 0) {
    throw new Error(`Trefftz drag requires a positive finite density (rho = ${rho}).`);
  }
  if (!wakeDirection || wakeDirection.length !== 3
    || !Number.isFinite(wakeDirection[0]) || !Number.isFinite(wakeDirection[1]) || !Number.isFinite(wakeDirection[2])) {
    throw new Error("Trefftz drag requires a finite wake direction.");
  }
  const ew = normalize(wakeDirection);
  if (!(dot(ew, ew) >= 0.5)) throw new Error("Trefftz drag requires a non-zero wake direction representable by the solver.");
  for (let j = 0; j < panels.length; j += 1) {
    const panel = panels[j];
    if (!panel || !isFinitePoint(panel.boundA) || !isFinitePoint(panel.boundB) || !isFinitePoint(panel.boundMidpoint)) {
      throw new Error(`Trefftz drag: panel ${j} has non-finite coordinates.`);
    }
    if (!Number.isFinite(circulation[j])) {
      throw new Error(
        `Trefftz drag: circulation[${j}] is not finite (${circulation[j]}). ` +
        `Missing scientific data must not be evaluated as zero.`
      );
    }
  }
}

function isFinitePoint(point) {
  return Boolean(point) && point.length === 3
    && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Number.isFinite(point[2]);
}

function validateCasePanels(panels, surfaces) {
  const names = new Map();
  const planforms = new Map(surfaces?.map(surface => [surface.name, surface.planform]));
  for (const panel of panels) {
    if (!panel || !["boundA", "boundB", "boundMidpoint", "controlPoint", "normal"].every(key => isFinitePoint(panel[key]))) {
      throw new Error("Each panel must have finite geometry.");
    }
    const boundLength = magnitude(subtract(panel.boundB, panel.boundA));
    const normalLength = magnitude(panel.normal);
    if (![boundLength, normalLength, panel.widthLengthRatio].every(value => Number.isFinite(value) && value > 0)) {
      throw new Error("Each panel must have nondegenerate geometry and positive diagnostics.");
    }
    const width = panel.boundB[1] - panel.boundA[1];
    if (!(width > 0) || panel.y0 !== panel.boundA[1] || panel.y1 !== panel.boundB[1]) {
      throw new Error("Each panel's span edges must match its ordered bound endpoints.");
    }
    if (panel.widthM !== undefined && panel.widthM !== width) throw new Error("Panel width must equal the bound endpoints' y separation.");
    if (panel.lengthM !== undefined &&
        (!(Number.isFinite(panel.lengthM) && panel.lengthM > 0) || panel.widthLengthRatio !== width / panel.lengthM)) {
      throw new Error("Panel width/length ratio must match its span width and chordwise length.");
    }
    for (let axis = 0; axis < 3; axis += 1) {
      const a = panel.boundA[axis], b = panel.boundB[axis];
      const midpoint = Number.isFinite(a + b) ? (a + b) / 2 : a / 2 + b / 2;
      // Permit a binary64 rounding difference, independent of aerodynamic scale.
      const tolerance = Math.max(Number.MIN_VALUE, Number.EPSILON * Math.abs(midpoint));
      if (Math.abs(panel.boundMidpoint[axis] - midpoint) > tolerance) {
        throw new Error("Panel bound midpoint must be the mean of its bound endpoints.");
      }
    }
    const name = panel.surfaceName ?? "";
    if (panel.surfaceName !== undefined && (typeof panel.surfaceName !== "string" || !panel.surfaceName.trim())) {
      throw new Error("A supplied panel surface name must be a nonempty string when specified.");
    }
    const key = name.trim().toLowerCase();
    if (names.has(key) && names.get(key) !== name) throw new Error(`Duplicate lifting surface name: "${name}".`);
    names.set(key, name);
    if (surfaces && !planforms.has(name)) throw new Error(`Panel surface "${name}" has no matching surface definition.`);
    if (panel.planform !== undefined) {
      if (!["linear", "elliptic"].includes(panel.planform) || (planforms.has(name) && planforms.get(name) !== panel.planform)) {
        throw new Error(`Panel planform is invalid or inconsistent for surface "${name}".`);
      }
      planforms.set(name, panel.planform);
    }
    if (panel.chordIndex !== undefined && (!Number.isSafeInteger(panel.chordIndex) || panel.chordIndex < 0)) {
      throw new Error("Panel chordIndex must be a non-negative integer.");
    }
  }
  return planforms;
}

function validateWakeEndpoints(panels, direction, lengthM) {
  const offset = scale(direction, lengthM);
  for (const panel of panels) {
    for (const origin of [panel.boundA, panel.boundB]) {
      const delta = subtract(add(origin, offset), origin);
      if (!isFinitePoint(delta) || !(dot(delta, direction) > 0)) {
        throw new Error("VLM wake endpoint is nonfinite or cannot advance from its bound endpoint.");
      }
    }
  }
}

function validateWakeOffset(direction, lengthM) {
  const offset = scale(direction, lengthM);
  if (!isFinitePoint(offset) || !(dot(offset, direction) > 0)) {
    throw new Error("VLM wake displacement is nonfinite or cannot advance from its bound endpoint.");
  }
}

export function solveVlmCase(options) {
  requireSolverOptions(options);
  return solveCase(options);
}

function solveCase(options, lattice) {
  const velocityMS = positive(options.velocityMS, "velocity");
  const densityKgM3 = positive(options.densityKgM3, "density");
  const refAreaM2 = positive(options.refAreaM2, "reference area");
  const refChordM = positive(options.refChordM, "reference chord");
  const wakeLengthFactor = positive(optionalFinite(options.wakeLengthFactor, 20, "wakeLengthFactor"), "wakeLengthFactor");
  const referencePoint = options.referencePoint === undefined ? [0, 0, 0] : options.referencePoint;
  if (!isFinitePoint(referencePoint)) throw new Error("referencePoint must contain three finite coordinates.");
  const alphaDeg = optionalFinite(options.alphaDeg, 0, "alphaDeg");
  const betaDeg = optionalFinite(options.betaDeg, 0, "betaDeg");
  const alphaRad = radians(alphaDeg, "alphaDeg");
  const betaRad = radians(betaDeg, "betaDeg");
  const q = 0.5 * densityKgM3 * velocityMS ** 2;
  const qS = q * refAreaM2;
  const qSc = qS * refChordM;
  if (![qS, qSc].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error("VLM reference normalization must be positive and finite.");
  }
  if (options.seedReferencePlaceholder !== undefined && typeof options.seedReferencePlaceholder !== "boolean") {
    throw new Error("seedReferencePlaceholder must be a boolean.");
  }
  // Freestream/wake direction per DATA_CONTRACTS §1: U_inf = V(cos a cos b, -sin b, sin a cos b).
  // The wake legs stay aligned with the freestream (DATA_CONTRACTS §2.7).
  const wakeDirection = normalize([
    Math.cos(alphaRad) * Math.cos(betaRad),
    -Math.sin(betaRad),
    Math.sin(alphaRad) * Math.cos(betaRad)
  ]);
  const freestream = scale(wakeDirection, velocityMS);
  const surfaceDefs = options.surfaces === undefined ? null : normalizeSurfaces(options.surfaces);
  if (!lattice && options.panels === undefined) {
    const plan = latticePlan(normalizeSurfaces(surfaceDefs), options.spanwisePanels, clampRows(options.chordwiseRows));
    requireDenseLattice(plan.panelCount);
    lattice = generateLattice(plan);
  }
  const worldPanels = lattice ? lattice.panels : options.panels;
  if (!Array.isArray(worldPanels)) throw new Error("panels must be an array.");
  if (!worldPanels.length) throw new Error("VLM requires at least one lifting-surface panel.");
  requireDenseLattice(worldPanels.length);
  const planformByName = validateCasePanels(lattice ? lattice.localPanels : worldPanels, surfaceDefs);
  // DATA_CONTRACTS §2.7 / RB-07: straight freestream-aligned legs of length
  // >= 10 b of the largest surface (B-VLM-07). The floor is enforced here so
  // every caller gets the contract minimum.
  const largestSpanM = largestSurfaceSpanM(worldPanels);
  const wakeLengthM = caseWakeLength(refChordM, wakeLengthFactor, largestSpanM);
  validateWakeOffset(wakeDirection, wakeLengthM);
  // Raw panels have no source geometry from which to recover a lost chord.
  // Preserve the refusal for a wake that cannot advance in their input frame.
  if (!lattice) validateWakeEndpoints(worldPanels, wakeDirection, wakeLengthM);
  const origin = lattice ? lattice.origin : worldPanels[0].boundA;
  const panels = lattice ? lattice.localPanels : offsetPanels(worldPanels, origin, subtract);
  const localReference = subtract(referencePoint, origin);
  // SOL-01 (M0-4): residual engagements of the relative singular-kernel
  // cutoffs are counted; a non-zero count means a near-singular element
  // proximity truncated real influence terms and the case is quarantined
  // below. Across VLM-V5's 1e-3..1e3 scale range the count must be zero.
  const kernelStats = { truncations: 0 };
  const matrix = Array.from({ length: panels.length }, () => new Float64Array(panels.length));
  const rhs = new Float64Array(panels.length);

  for (let row = 0; row < panels.length; row += 1) {
    rhs[row] = -dot(freestream, panels[row].normal);
    for (let column = 0; column < panels.length; column += 1) {
      matrix[row][column] = dot(
        inducedVelocityHorseshoe(panels[row].controlPoint, panels[column], wakeDirection, wakeLengthM, true, kernelStats),
        panels[row].normal
      );
    }
  }

  const solved = solveLinearSystem(matrix, rhs);
  const circulation = solved.solution;
  let totalForce = [0, 0, 0];
  let totalMoment = [0, 0, 0];
  // SOL-06: forward-error bookkeeping for the near-field drag projection (see
  // the policy block near reportSignedDrag). The drag is the small residual of
  // force vectors; its error scales with the magnitudes those operations act
  // on — never with qS.
  let nearFieldOpsMagnitudeN = 0;
  let nearFieldForceMagnitudeN = 0;
  const panelResults = [];

  for (let i = 0; i < panels.length; i += 1) {
    let induced = [0, 0, 0];
    let inducedMagnitude = 0;
    let inducedOpsMagnitude = 0;
    for (let j = 0; j < panels.length; j += 1) {
      // DR-01 / DATA_CONTRACTS §2.7: the panel's own trailing legs induce
      // velocity at its own bound midpoint and must be included; only its own
      // bound segment is excluded (includeBound = j !== i).
      const contribution = scale(
        inducedVelocityHorseshoe(panels[i].boundMidpoint, panels[j], wakeDirection, wakeLengthM, j !== i, kernelStats),
        circulation[j]
      );
      induced = add(induced, contribution);
      const contributionMagnitude = magnitude(contribution);
      inducedMagnitude += contributionMagnitude;
      // SOL-06 / DEC-SOL-06-4 (c): pair ops include the coordinate-translation
      // amplification of this induction's kernel evaluations.
      inducedOpsMagnitude += (OPS_PER_HORSESHOE_PAIR
        + inductionDistanceErrorOps(panels[i].boundMidpoint, panels[j], wakeDirection, wakeLengthM))
        * contributionMagnitude;
    }
    const effectiveVelocity = add(freestream, induced);
    const boundVector = subtract(panels[i].boundB, panels[i].boundA);
    const force = scale(cross(effectiveVelocity, boundVector), densityKgM3 * circulation[i]);
    const moment = cross(subtract(panels[i].boundMidpoint, localReference), force);
    totalForce = add(totalForce, force);
    totalMoment = add(totalMoment, moment);
    panelResults.push({ panel: worldPanels[i], circulation: circulation[i], inducedVelocity: induced, force, moment });
    nearFieldOpsMagnitudeN += densityKgM3 * Math.abs(circulation[i]) * magnitude(boundVector)
      * (inducedOpsMagnitude + OPS_PER_PANEL_FORCE * (velocityMS + inducedMagnitude));
    nearFieldForceMagnitudeN += magnitude(force);
  }

  const cm = totalMoment[1] / qSc;
  if (!totalMoment.every(Number.isFinite) || !Number.isFinite(cm)) {
    throw new Error("Nonfinite moment produced by VLM inputs.");
  }
  const liftDirection = normalize([-Math.sin(alphaRad), 0, Math.cos(alphaRad)]);
  const liftN = dot(totalForce, liftDirection);
  const cl = liftN / qS;
  if (!totalForce.every(Number.isFinite) || !Number.isFinite(liftN) || !Number.isFinite(cl)) {
    throw new Error("Nonfinite lift or lift coefficient produced by VLM inputs.");
  }
  // DR-01: the near-field induced drag is the SIGNED projection of the total
  // force on the wake (= freestream) direction. Never take an absolute value;
  // a genuinely negative value is a validity error raised inside trefftzDrag.
  // SOL-06: the raw projection and its own forward-error budget travel with it.
  const inducedDragNRaw = dot(totalForce, wakeDirection);
  const nearFieldErrorBudgetN = DBL_UNIT_ROUNDOFF
    * (nearFieldOpsMagnitudeN + (3 * panels.length + 5) * nearFieldForceMagnitudeN);
  const trefftz = evaluateTrefftzDrag(panels, circulation, densityKgM3, wakeDirection, {
    wakeLengthM,
    nearFieldDragN: inducedDragNRaw,
    nearFieldErrorBudgetN,
    qS,
    stats: kernelStats
  }, true);
  // Signed near-field drag as reported (SOL-06): the raw value, or exactly 0
  // when numerically unresolved — always with an explicit suppression flag and
  // the raw signed value preserved (dragNNearFieldRaw). Resolved negative
  // values are rejected inside trefftzDrag (OBS-M0-2-5, superseded by SOL-06).
  const inducedDragN = trefftz.dragNNearField;
  const aspect = panelAspectDiagnostics(panels);

  // Validity (REM-1): documented quarantine gates. They only ever invalidate or
  // warn — never adjust a value to conceal a failure.
  const errors = [];
  const warnings = [...(aspect.messages || [])];
  if (aspect.minRatio < PANEL_ASPECT_MIN) {
    errors.push(`Supplied lattice width/length = ${aspect.minRatio} is below ${PANEL_ASPECT_MIN}. Values are returned for measurement only and must not be reported.`);
  }
  if (kernelStats.truncations > 0) {
    errors.push(
      `SOL-01: the relative singular-kernel cutoffs (1e-6 x segment length) engaged ${kernelStats.truncations} time(s); ` +
      `near-singular element proximity truncated real influence terms and the coefficients are numerically unreliable. ` +
      `Values are returned for measurement only and must not be reported.`
    );
  }
  // SOL-06: suppression is never silent. A drag reported as exactly 0 because
  // it lies within the worst-case forward-error bound is UNRESOLVED in the
  // sense that it cannot be proven distinguishable from zero at double
  // precision — not insignificant: the flag, the bound size and the raw signed
  // value live in the result, and the case warns here.
  for (const [label, suppression] of [["Trefftz-plane", trefftz.trefftzSuppression], ["Near-field", trefftz.nearFieldSuppression]]) {
    if (suppression && suppression.suppressedToZero) {
      warnings.push(`SOL-06: ${label} induced drag cannot be proven resolved from zero and is reported as exactly 0 — ${suppression.reason}`);
    }
  }
  const rowsByName = rowsPerSurface(panels);
  for (const [name, rows] of rowsByName) {
    if (planformByName.get(name) === "elliptic" && rows > VALIDATED_ELLIPTIC_ROWS_MAX) {
      errors.push(
        `SOL-03 quarantine: elliptic surface "${name}" at ${rows} chordwise rows is outside the validated envelope ` +
        `(M <= ${VALIDATED_ELLIPTIC_ROWS_MAX}); a tip-localised mode corrupts drag, moment and local loads at M = 12/16. ` +
        `Values are returned for measurement only and must not be reported.`
      );
    } else if (rows > 2 * DEFAULT_CHORDWISE_ROWS) {
      warnings.push(
        `Surface "${name}" uses ${rows} chordwise rows, beyond the validated R2 envelope (M = ${2 * DEFAULT_CHORDWISE_ROWS}): outputs are unverified.`
      );
    }
  }
  const planar = surfaceDefs ? surfaceDefs.every((s) => s.sweepDeg === 0 && s.dihedralDeg === 0) : false;
  if (planar && Number.isFinite(trefftz.relativeDifference)
    && Math.abs(trefftz.relativeDifference) > NEAR_FIELD_TREFFTZ_GATE) {
    errors.push(
      `Near-field/Trefftz inconsistency ${(trefftz.relativeDifference * 100).toFixed(2)} % exceeds the approved VLM-V2b gate ` +
      `${NEAR_FIELD_TREFFTZ_GATE * 100} %: circulation accuracy is not established (SOL-03, OBS-M0-2-2).`
    );
  }
  // VLM-V8 (DR-36): when the reference values are the bounds-seed placeholder
  // (geometric-bounds heuristic with A320-tuned constants), every
  // reference-dependent coefficient is flagged — validity = warning with a
  // message — and the seed is never silently presented as validated data.
  if (options.seedReferencePlaceholder) {
    warnings.push(
      "VLM-V8: reference area, chord and moment reference are the bounds-seed placeholder " +
      "(geometric-bounds heuristic with A320-tuned constants, DR-36); reference-dependent coefficients are unvalidated estimates."
    );
  }
  const validity = { status: errors.length ? "invalid" : warnings.length ? "warning" : "ok", messages: [...errors, ...warnings] };
  return {
    alphaDeg,
    betaDeg,
    panels: worldPanels,
    panelResults,
    circulation: Array.from(circulation),
    totalForce,
    totalMoment,
    liftN,
    inducedDragN,
    trefftzDragN: trefftz.dragNTrefftz,
    // SOL-06: raw signed dimensional drag preserved alongside the reported
    // values; any suppression to exactly 0 is explicit and size-declared
    // (suppressedToZero + reason + toleranceN). qS never touches these.
    dragNTrefftzRaw: trefftz.dragNTrefftzRaw,
    dragNNearFieldRaw: trefftz.dragNNearFieldRaw,
    trefftzSuppression: trefftz.trefftzSuppression,
    nearFieldSuppression: trefftz.nearFieldSuppression,
    pitchingMomentNm: totalMoment[1],
    cl,
    cdi: trefftz.cdiTrefftz,
    cdiTrefftz: trefftz.cdiTrefftz,
    cdiNearField: trefftz.cdiNearField,
    nearFieldTrefftzDifference: trefftz.relativeDifference,
    cm,
    // M0-2 validity/uncertainty indicators, scoped per SOL-08 (REM-1): the
    // fixed label is withheld until an application envelope is reviewed.
    validity,
    uncertaintyLabel: UNCERTAINTY_UNVERIFIED_LABEL,
    uncertaintyScope: UNCERTAINTY_SCOPE,
    diagnostics: {
      panelCount: panels.length,
      minPivot: solved.minPivot,
      maxPivot: solved.maxPivot,
      pivotRatio: solved.maxPivot > 0 ? solved.minPivot / solved.maxPivot : 0,
      residual: solved.residual,
      kernelTruncations: kernelStats.truncations,
      wakeLengthM,
      largestSurfaceSpanM: largestSpanM,
      minPanelAspectRatio: aspect.minRatio,
      maxPanelAspectRatio: aspect.maxRatio
    }
  };
}

// Interpret the shortest round-tripping decimal spelling of each input as an
// exact decimal. Compute the grid in integers and round each sample only once.
// This makes 0.1 * 3 reach 0.3 without treating a distinct nearby endpoint
// as equal. It cannot recover precision already lost before the API call.
function decimalSweep(start, end, step) {
  const parts = [start, end, step].map(value => {
    const [mantissa, exponent = "0"] = value.toString().toLowerCase().split("e");
    const fraction = (mantissa.split(".")[1] || "").length;
    return { digits: BigInt(mantissa.replace(".", "")), exponent: Number(exponent) - fraction };
  });
  const scale = Math.min(...parts.map(part => part.exponent));
  const [a, b, increment] = parts.map(part => part.digits * 10n ** BigInt(part.exponent - scale));
  const intervals = (b - a) / increment;
  if (intervals >= BigInt(MAX_SWEEP_POINTS))
    throw new Error(`Sweep resource limit is ${MAX_SWEEP_POINTS} points.`);
  return Array.from({ length: Number(intervals) + 1 }, (_, index) =>
    Number(`${a + BigInt(index) * increment}e${scale}`));
}

export function runVlmSweep(options) {
  const sweep = planSweep(options);
  requireWorkBudget(sweep.samples.length * denseCaseWork(sweep.lattice.panelCount));
  return solveSweep(options, sweep, generateLattice(sweep.lattice));
}

function planSweep(options) {
  requireSolverOptions(options);
  if (options.panels !== undefined) throw new Error("Sweep panels must be generated from surfaces and lattice settings.");
  const surfaces = normalizeSurfaces(options.surfaces);
  for (const key of ["alphaMinDeg", "alphaMaxDeg", "alphaStepDeg"]) {
    if (!Number.isFinite(options[key])) throw new Error(`${key} must be a finite number.`);
  }
  if (options.alphaStepDeg <= 0) throw new Error("alphaStepDeg must be positive.");
  optionalFinite(options.betaDeg, 0, "betaDeg");
  const cdProfile = optionalFinite(options.cd0, 0, "cd0");
  if (cdProfile < 0) throw new Error("cd0 must be non-negative.");
  const cmOffset = optionalFinite(options.cm0, 0, "cm0");
  const start = Math.min(options.alphaMinDeg, options.alphaMaxDeg);
  const end = Math.max(options.alphaMinDeg, options.alphaMaxDeg);
  const step = options.alphaStepDeg;
  if (start === end && start + step === start) throw new Error("alphaStepDeg cannot advance at this magnitude.");
  const samples = decimalSweep(start, end, step);
  const pointCount = samples.length;
  // Even when one addition advances, indexed values can round to duplicates.
  for (let index = 1; index < pointCount; index += 1) {
    if (!(samples[index] > samples[index - 1]))
      throw new Error("Sweep samples cannot be represented as distinct advancing values.");
  }
  const chordwiseRows = clampRows(options.chordwiseRows);
  const lattice = latticePlan(surfaces, options.spanwisePanels, chordwiseRows);
  requireDenseLattice(lattice.panelCount);
  return { lattice, samples, cdProfile, cmOffset };
}

function solveSweep(options, { lattice: plan, samples, cdProfile, cmOffset }, lattice) {
  const { surfaces, chordwiseRows, counts: spanwiseCounts } = plan;
  const { panels } = lattice;
  const pointCount = samples.length;
  const series = [];
  let worstPivotRatio = Infinity;
  let worstResidual = 0;
  const VALIDITY_RANK = { ok: 0, warning: 1, invalid: 2 };
  let sweepStatus = "ok";
  const sweepMessages = [];
  for (let index = 0; index < pointCount; index += 1) {
    const alphaDeg = samples[index];
    const result = solveCase({ ...options, surfaces, alphaDeg }, lattice);
    const q = 0.5 * options.densityKgM3 * options.velocityMS ** 2;
    series.push({
      alphaDeg,
      cl: result.cl,
      cdi: result.cdi,
      cdiNearField: result.cdiNearField,
      nearFieldTrefftzDifference: result.nearFieldTrefftzDifference,
      cd: result.cdi + cdProfile,
      cm: result.cm + cmOffset,
      liftN: result.liftN,
      inducedDragN: result.inducedDragN,
      // Drag is consistent with cd = cdi(Trefftz) + cdProfile (DATA_CONTRACTS §2.7:
      // the Trefftz value is the primary induced drag).
      dragN: result.trefftzDragN + q * options.refAreaM2 * cdProfile,
      momentNm: result.pitchingMomentNm + q * options.refAreaM2 * options.refChordM * cmOffset,
      circulation: result.circulation,
      panelResults: result.panelResults,
      validity: result.validity
    });
    const point = series[series.length - 1];
    if (![point.cd, point.cm, point.dragN, point.momentNm].every(Number.isFinite)) {
      throw new Error("Nonfinite sweep output produced by VLM inputs.");
    }
    // SOL-03 propagation (REM-1): the sweep inherits the worst per-case status,
    // so a quarantined point can never sit inside a "valid" sweep.
    if (VALIDITY_RANK[result.validity.status] > VALIDITY_RANK[sweepStatus]) sweepStatus = result.validity.status;
    for (const message of result.validity.messages) if (!sweepMessages.includes(message)) sweepMessages.push(message);
    worstPivotRatio = Math.min(worstPivotRatio, result.diagnostics.pivotRatio);
    worstResidual = Math.max(worstResidual, result.diagnostics.residual);
  }

  // M0-5 / SOL-09 — fit and trim contract (DATA_CONTRACTS 2.5, RB-21;
  // VALIDATION_AND_TEST_MATRIX VLM-V7). "Converged" for the direct Tier-0
  // linear solve maps to "not quarantined by the per-case validity gates" —
  // there is no iteration to converge, and a quarantined case is excluded from
  // fits exactly like an unconverged CFD point (DATA_CONTRACTS 2.6;
  // DEC-M0-5-1). Derivatives are certified per response; undetermined
  // quantities are null with an explicit status — never a silent zero slope.
  const converged = series.filter((point) => point.validity.status !== "invalid"
    && Number.isFinite(point.cl) && Number.isFinite(point.cm));
  const fitWindow = converged
    .filter((point) => Math.abs(point.alphaDeg) <= FIT_WINDOW_MAX_ABS_ALPHA_DEG + FIT_WINDOW_EPSILON_DEG)
    .sort((a, b) => a.alphaDeg - b.alphaDeg);
  const clFit = linearFit(fitWindow, "cl");
  const cmFit = linearFit(fitWindow, "cm");
  const clAlphaPerRad = clFit.status === FIT_STATUS_DETERMINED ? clFit.slopePerDeg * 180 / Math.PI : null;
  const cmAlphaPerRad = cmFit.status === FIT_STATUS_DETERMINED ? cmFit.slopePerDeg * 180 / Math.PI : null;
  const cgX = (options.referencePoint || [0, 0, 0])[0];
  // SM = -dC_m,dC_L needs BOTH slopes certified (2.5); a degenerate C_L slope
  // (FIT_EPSILON) leaves no defined ratio either.
  const staticMargin = clAlphaPerRad !== null && cmAlphaPerRad !== null && Math.abs(clAlphaPerRad) > FIT_EPSILON
    ? -cmAlphaPerRad / clAlphaPerRad
    : null;
  const neutralPointXM = staticMargin !== null ? cgX + staticMargin * options.refChordM : null;
  if ([...Object.values(clFit), ...Object.values(cmFit), clAlphaPerRad, cmAlphaPerRad, staticMargin, neutralPointXM]
    .some(value => typeof value === "number" && !Number.isFinite(value))) {
    throw new Error("Nonfinite sweep fit or stability output produced by VLM inputs.");
  }
  // Trim (DATA_CONTRACTS 2.5): alpha_trim solves C_m,CG = 0 from the FITTED
  // intercept and slope — never the nearest sampled moment played as the
  // zero-angle intercept (the frozen review counterexample) — and is reported
  // only if C_L(alpha_trim) > 0 and alpha_trim lies inside the sampled sweep.
  // Otherwise it is explicitly "not determined" (RB-21).
  let trimAlphaDeg = null;
  let trimStatus;
  if (cmFit.status !== FIT_STATUS_DETERMINED) {
    trimStatus = `not determined: C_m slope is "${cmFit.status}" (fit contract, DATA_CONTRACTS 2.5)`;
  } else if (Math.abs(cmAlphaPerRad) <= FIT_EPSILON) {
    trimStatus = "not determined: C_m slope is zero within the arithmetic degeneracy check (FIT_EPSILON); the linear model defines no trim angle";
  } else {
    const alphaTrimDeg = -cmFit.intercept / cmFit.slopePerDeg;
    const sweepMin = series[0].alphaDeg;
    const sweepMax = series[series.length - 1].alphaDeg;
    const clAtTrim = sampledClAt(converged, alphaTrimDeg);
    if (!(alphaTrimDeg >= sweepMin - FIT_WINDOW_EPSILON_DEG && alphaTrimDeg <= sweepMax + FIT_WINDOW_EPSILON_DEG)) {
      trimStatus = `not determined: alpha_trim = ${alphaTrimDeg} deg lies outside the sampled sweep [${sweepMin}, ${sweepMax}] deg (DATA_CONTRACTS 2.5)`;
    } else if (!clAtTrim) {
      trimStatus = `not determined: no converged C_L sample brackets alpha_trim = ${alphaTrimDeg} deg`;
    } else if (!(clAtTrim.cl > 0)) {
      trimStatus = `not determined: C_L(alpha_trim) = ${clAtTrim.cl} is not positive (DATA_CONTRACTS 2.5 requires C_L(alpha_trim) > 0)`;
    } else {
      trimAlphaDeg = alphaTrimDeg;
      trimStatus = `determined: alpha_trim = ${alphaTrimDeg} deg inside the sampled sweep, C_L(alpha_trim) = ${clAtTrim.cl} > 0 (${clAtTrim.source})`;
    }
  }
  // §2.5 stability VERDICT (RB-01) — "no NaN and no Unstable" (VLM-V7) is a
  // special case of the rule that a verdict may only be shown when ALL four
  // contract conditions hold: (1) a horizontal stabiliser is present, (2) the
  // mass source is not the default uniform-density lump, (3) the linearity
  // criteria hold, (4) the model description is printed with the verdict.
  // Conditions 1/2/4 are caller knowledge, not solver knowledge: they must be
  // SUPPLIED via options.verdictInputs, and any missing/unmet condition
  // WITHHOLDS the verdict with the unmet conditions named (STAB-V2/STAB-V3).
  // The solver therefore never exposes a bare stability claim; the slope sign
  // travels separately as cmSlopeNegative — a fact, never a verdict.
  const stabilityVerdict = resolveStabilityVerdict({
    clFit, cmFit, clAlphaPerRad, cmAlphaPerRad, staticMargin,
    verdictInputs: options.verdictInputs
  });
  const cmSlopeNegative = cmAlphaPerRad !== null ? cmAlphaPerRad < 0 : null;
  const fitStatus = clFit.status === FIT_STATUS_DETERMINED && cmFit.status === FIT_STATUS_DETERMINED
    ? FIT_STATUS_DETERMINED
    : clFit.status === cmFit.status
      ? clFit.status
      : `C_Lalpha: ${clFit.status}; C_malpha: ${cmFit.status}`;
  // Status text is exact per response and per failure mode (an adjacent-slope
  // failure must not claim a point-count problem): each message names only
  // the response it governs — trim and the verdict state their own status.
  const fitMessages = [];
  for (const [label, fit] of [["C_Lalpha", clFit], ["C_malpha", cmFit]]) {
    if (fit.status === FIT_STATUS_INSUFFICIENT) {
      fitMessages.push(
        `fit: ${label} is "${FIT_STATUS_INSUFFICIENT}" — ${fit.pointCount} converged point(s) in the |alpha| <= ${FIT_WINDOW_MAX_ABS_ALPHA_DEG} deg window; ` +
        `at least ${FIT_MIN_CONVERGED_POINTS} are required (DATA_CONTRACTS 2.5). No ${label} derivative is reported.`
      );
    } else if (fit.status === FIT_STATUS_NONLINEAR) {
      fitMessages.push(
        `fit: ${label} is "${FIT_STATUS_NONLINEAR}" — ${fit.pointCount} converged point(s) in the |alpha| <= ${FIT_WINDOW_MAX_ABS_ALPHA_DEG} deg window, ` +
        `but the worst adjacent-pair slope deviates by ${fit.maxAdjacentSlopeDeviationPerDeg} /deg from the least-squares slope ${fit.leastSquaresSlopePerDeg} /deg ` +
        `(band: ${FIT_ADJACENT_SLOPE_TOLERANCE * 100} % of the slope, DATA_CONTRACTS 2.5). No ${label} derivative is reported.`
      );
    }
  }
  // The undetermined-derivative state must never sit in a silent "ok"
  // validity record (frozen review counterexample: alpha 6..12 deg reported
  // validity "ok" with zero slopes and a rendered "Unstable").
  for (const message of fitMessages) if (!sweepMessages.includes(message)) sweepMessages.push(message);
  if (fitMessages.length && sweepStatus === "ok") sweepStatus = "warning";
  return {
    method: `Horseshoe VLM, ${chordwiseRows} chordwise rows x N spanwise strips (multi-row lattice)`,
    limitations: ["Steady incompressible potential flow", "Induced drag plus optional constant CD0", "No viscous separation or stall", "No fuselage interference"],
    // M0-2: distinct R1/R2 solver identification (VALIDATION_AND_TEST_MATRIX).
    resolution: {
      label: resolutionLabel(surfaces, chordwiseRows, spanwiseCounts),
      chordwiseRows,
      spanwisePanels: Object.fromEntries(spanwiseCounts)
    },
    validity: {
      status: sweepStatus,
      messages: sweepMessages,
      minRatio: panelAspectDiagnostics(panels).minRatio,
      maxRatio: panelAspectDiagnostics(panels).maxRatio
    },
    uncertaintyLabel: UNCERTAINTY_UNVERIFIED_LABEL,
    uncertaintyScope: UNCERTAINTY_SCOPE,
    panels,
    series,
    fit: {
      status: fitStatus,
      windowDeg: [-FIT_WINDOW_MAX_ABS_ALPHA_DEG, FIT_WINDOW_MAX_ABS_ALPHA_DEG],
      convergedPointsInWindow: fitWindow.length,
      cl: clFit,
      cm: cmFit,
      messages: fitMessages
    },
    clAlphaPerRad,
    cmAlphaPerRad,
    staticMargin,
    neutralPointXM,
    trimAlphaDeg,
    trimStatus,
    cmSlopeNegative,
    stabilityVerdict,
    diagnostics: { panelCount: panels.length, worstPivotRatio, worstResidual }
  };
}

/**
 * Resolution check (M0-2 badge, VALIDATION_AND_TEST_MATRIX VLM-V3), remediated
 * for SOL-02 (REM-1).
 *
 * The check must certify the computation that is actually plotted. It therefore
 * (a) runs at the EXACT plotted flow — the same surfaces, beta, velocity,
 * density and reference values as the plotted sweep (the previous caller lost
 * betaDeg and tested beta = 0 while the sweep ran at the user's yaw), and
 * (b) reports which lattice it covers:
 *   - plotted lattice is the prescribed R1 or R2 grid: the approved R1 -> R2
 *     comparison covers it (claim "prescribed R1 vs R2");
 *   - plotted lattice is anything else ("custom"): the current grid is compared
 *     against a 2x refined grid using the same VLM-V3 deltas and gates, or the
 *     convergence claim is explicitly WITHHELD when no refinement is possible or
 *     a quarantined (SOL-03/SOL-01) lattice is involved. Prescribed R1/R2
 *     agreement is never presented as the custom grid's convergence.
 *
 * Protocol: alpha = 0 and 4 deg two-point slopes and C_Di at 4 deg. This is a
 * deliberately defined RESOLUTION DIAGNOSTIC, not a certified lift derivative
 * (the >= 3-point fit contract is SOL-09 / M0-5). The full input identity and
 * coverage are recorded in the output so consumers can state what was checked.
 */
export function runVlmResolutionCheck(options) {
  const plan = planResolution(options);
  requireWorkBudget(plan.work);
  return solveResolution(options, plan, generateLattice(plan.current));
}

// The browser runs the sweep and comparison in the same synchronous job.
// Preflight both before allocating any lattice or starting any dense solve.
export function runVlmAnalysis(options) {
  const sweepPlan = planSweep(options);
  const resolutionPlan = planResolution(options, sweepPlan.lattice);
  requireWorkBudget(sweepPlan.samples.length * denseCaseWork(sweepPlan.lattice.panelCount) + resolutionPlan.work);
  const lattice = generateLattice(sweepPlan.lattice);
  const sweep = solveSweep(options, sweepPlan, lattice);
  sweep.resolutionCheck = solveResolution(options, resolutionPlan, lattice);
  return sweep;
}

function planResolution(options, current) {
  requireSolverOptions(options);
  if (options.panels !== undefined) throw new Error("Resolution panels must be generated from surfaces and lattice settings.");
  current ??= latticePlan(normalizeSurfaces(options.surfaces), options.spanwisePanels, clampRows(options.chordwiseRows));
  const { surfaces, chordwiseRows, counts } = current;
  const label = resolutionLabel(surfaces, chordwiseRows, counts);
  const r1 = latticePlan(surfaces, "auto", DEFAULT_CHORDWISE_ROWS);
  requireDenseLattice(r1.panelCount);
  const r2 = latticePlan(surfaces, "auto", 2 * DEFAULT_CHORDWISE_ROWS);
  requireDenseLattice(r2.panelCount);
  const rows = Math.min(16, 2 * chordwiseRows);
  const requested = options.spanwisePanels;
  const strips = Number.isInteger(requested) ? Math.min(240, 2 * requested) : requested;
  const refined = label === "custom" && (rows !== chordwiseRows || strips !== requested)
    ? latticePlan(surfaces, strips, rows) : null;
  let work = 2 * (denseCaseWork(r1.panelCount) + denseCaseWork(r2.panelCount));
  if (refined) {
    requireDenseLattice(current.panelCount);
    requireDenseLattice(refined.panelCount);
    work += 2 * (denseCaseWork(current.panelCount) + denseCaseWork(refined.panelCount));
  }
  return { current, label, r1, r2, refined, work };
}

function solveResolution(options, plan, currentLattice) {
  const { surfaces, chordwiseRows, counts } = plan.current;
  const betaDeg = optionalFinite(options.betaDeg, 0, "betaDeg");
  const cdProfile = optionalFinite(options.cd0, 0, "cd0");
  if (cdProfile < 0) throw new Error("cd0 must be non-negative.");
  const cmOffset = optionalFinite(options.cm0, 0, "cm0");
  const solveDiagnostic = (lattice, generated = generateLattice(lattice)) =>
    solveSweep(options, { lattice, samples: [0, 4], cdProfile, cmOffset }, generated);
  const r1 = solveDiagnostic(plan.r1);
  const r2 = solveDiagnostic(plan.r2);
  const prescribed = resolutionDeltas(r1, r2);
  const deltaClAlpha = prescribed.deltaClAlpha;
  const deltaCdi = prescribed.deltaCdi;
  const withinGates = prescribed.valid && deltaClAlpha <= 0.01 && deltaCdi <= 0.05;

  // The plotted lattice, classified against the prescribed R1/R2 counts.
  const currentCounts = Object.fromEntries(counts);
  const currentLabel = plan.label;
  const wakeLengthFactor = options.wakeLengthFactor ?? 20;

  const inputIdentity = {
    betaDeg,
    velocityMS: options.velocityMS, densityKgM3: options.densityKgM3,
    refAreaM2: options.refAreaM2, refChordM: options.refChordM,
    referencePoint: Array.from(options.referencePoint ?? [0, 0, 0]),
    seedReferencePlaceholder: options.seedReferencePlaceholder ?? false,
    cd0: options.cd0 ?? 0, cm0: options.cm0 ?? 0,
    alphaProtocolDeg: [0, 4],
    surfaces: surfaces.map((surface) => ({ ...surface })),
    lattices: { current: { chordwiseRows, spanwisePanels: currentCounts }, r1: r1.resolution, r2: r2.resolution },
    wake: { direction: "freestream-aligned", lengthFactor: wakeLengthFactor,
      lengthM: caseWakeLength(options.refChordM, wakeLengthFactor, largestSurfaceSpanM(currentLattice.panels)) }
  };

  let claim = prescribed.valid ? "prescribed R1 vs R2" : "withheld";
  let badge = withinGates ? "green" : "amber";
  let currentGrid = null;
  if (currentLabel === "custom") {
    currentGrid = plan.refined
      ? compareLatticeWithRefined(solveDiagnostic(plan.current, currentLattice), solveDiagnostic(plan.refined))
      : {
          claim: "withheld",
          reason: "no finer lattice is available (chordwise/spanwise limits reached); the plotted custom lattice has no convergence claim",
          validity: { valid: false, reasons: ["no finer lattice is available"] },
          current: inputIdentity.lattices.current,
          refined: {
            chordwiseRows,
            spanwisePanels: Number.isInteger(options.spanwisePanels) ? `uniform ${options.spanwisePanels}` : "auto at refined rows"
          }
        };
    if (currentGrid.claim === "compared") {
      claim = "current lattice vs 2x refined lattice";
      badge = currentGrid.withinGates ? "green" : "amber";
    } else {
      claim = "withheld";
      badge = "amber";
    }
  }
  if (currentGrid?.refined) inputIdentity.lattices.refined = currentGrid.refined;
  return {
    r1: {
      label: "R1",
      resolution: r1.resolution,
      // SOL-02/SOL-09: two-point resolution DIAGNOSTIC slope, never a
      // certified lift derivative (see coverage.protocol).
      validity: prescribed.coarse,
      clAlphaTwoPointPerRad: prescribed.coarse.valid ? twoPointSlopePerRad(r1.series) : null,
      cdiAt4Deg: prescribed.coarse.valid ? r1.series.find((p) => Math.abs(p.alphaDeg - 4) < 1e-9).cdi : null
    },
    r2: {
      label: "R2",
      resolution: r2.resolution,
      validity: prescribed.fine,
      clAlphaTwoPointPerRad: prescribed.fine.valid ? twoPointSlopePerRad(r2.series) : null,
      cdiAt4Deg: prescribed.fine.valid ? r2.series.find((p) => Math.abs(p.alphaDeg - 4) < 1e-9).cdi : null
    },
    deltaClAlpha,
    deltaCdi,
    comparisonValidity: { valid: prescribed.valid, reasons: prescribed.reasons },
    withholdingReason: claim === "withheld" ? (currentGrid?.reason || prescribed.reasons.join("; ")) : null,
    gates: { clAlpha: 0.01, cdi: 0.05 },
    withinGates,
    badge,
    claim,
    currentGrid,
    inputIdentity,
    coverage: {
      protocol: "two-point (alpha = 0/4 deg) resolution diagnostic; not a certified lift derivative",
      alphaDeg: [0, 4],
      betaDeg,
      latticeLabel: currentLabel,
      latticeCounts: currentCounts,
      coversPlottedLattice: claim !== "withheld",
      flow: "exact plotted flow (surfaces, beta, velocity, density, reference values)"
    },
    uncertaintyLabel: UNCERTAINTY_UNVERIFIED_LABEL,
    uncertaintyScope: UNCERTAINTY_SCOPE
  };
}

// VLM-V3 delta convention (review record "Delta" columns): |fine - coarse| / |coarse|.
// The slopes are the deliberate two-point DIAGNOSTIC (SOL-02 protocol), never
// the certified >= 3-point fit of SOL-09.
export function resolutionDeltas(coarse, fine) {
  const inspect = (sweep, label) => {
    const reasons = [];
    if (!["ok", "warning"].includes(sweep?.validity?.status)) reasons.push(`${label} sweep is quarantined or missing`);
    const series = Array.isArray(sweep?.series) ? sweep.series : [];
    if (series.length !== 2) reasons.push(`${label} sweep must contain exactly the 0 and 4 degree cases`);
    for (const alpha of [0, 4]) {
      const point = series.find(p => p?.alphaDeg === alpha);
      if (!point) reasons.push(`${label} alpha ${alpha} case is missing`);
      else if (!["ok", "warning"].includes(point.validity?.status) || !Number.isFinite(point.cl) || !Number.isFinite(point.cdi))
        reasons.push(`${label} alpha ${alpha} case is invalid or nonfinite`);
    }
    if (reasons.length === 0 && !Number.isFinite(twoPointSlopePerRad(series))) {
      reasons.push(`${label} two-point lift slope is nonfinite`);
    }
    return { valid: reasons.length === 0, reasons };
  };
  const a = inspect(coarse, "coarse"), b = inspect(fine, "fine");
  const reasons = [...a.reasons, ...b.reasons];
  if (reasons.length) return { valid: false, reasons, coarse: a, fine: b, deltaClAlpha: null, deltaCdi: null };
  const cdiCoarse = coarse.series.find(p => Math.abs(p.alphaDeg - 4) < 1e-9).cdi;
  const cdiFine = fine.series.find(p => Math.abs(p.alphaDeg - 4) < 1e-9).cdi;
  const slopeCoarse = twoPointSlopePerRad(coarse.series), slopeFine = twoPointSlopePerRad(fine.series);
  const slopeScale = Math.max(Math.abs(slopeCoarse), 1e-300);
  const slopeDifference = slopeFine - slopeCoarse;
  // Finite slopes of opposite sign can overflow on subtraction. Normalize
  // first in that case to preserve a representable relative difference.
  const deltaClAlpha = Number.isFinite(slopeDifference)
    ? Math.abs(slopeDifference) / slopeScale
    : Math.abs(slopeFine / slopeScale - slopeCoarse / slopeScale);
  const deltaCdi = cdiCoarse === 0 && cdiFine === 0 ? 0 : Math.abs(cdiFine - cdiCoarse) / Math.max(Math.abs(cdiCoarse), 1e-300);
  if (!Number.isFinite(deltaClAlpha) || !Number.isFinite(deltaCdi))
    return { valid: false, reasons: ["comparison metrics are nonfinite"], coarse: a, fine: b, deltaClAlpha: null, deltaCdi: null };
  return { valid: true, reasons: [], coarse: a, fine: b, deltaClAlpha, deltaCdi };
}

// SOL-02 (REM-1): convergence of the plotted custom lattice, measured against a
// 2x refinement with the same VLM-V3 deltas and gates. Withholds (never green)
// when no refinement exists below the lattice limits, or when either lattice is
// quarantined by SOL-01/SOL-03 validity gates.
// `sweepBase` is the resolution check's shared sweep configuration — the SAME
// object the prescribed R1/R2 sweeps use (it carries every option, including
// cd0/cm0/wakeLengthFactor via the options spread). It is deliberately NOT
// re-shadowed as "common" here: a shadowed name once suggested inputs were
// dropped. (cd0/cm0 can never move a VLM-V3 delta — the deltas are computed
// from C_L slopes and C_Di only — but every input must flow through
// identically in both paths regardless.)
function compareLatticeWithRefined(current, refined) {
  const identity = {
    current: current.resolution,
    refined: refined.resolution
  };
  const deltas = resolutionDeltas(current, refined);
  if (!deltas.valid) {
    return {
      claim: "withheld",
      reason: deltas.reasons.join("; "),
      validity: { valid: false, reasons: deltas.reasons, current: deltas.coarse, refined: deltas.fine },
      ...identity
    };
  }
  return {
    claim: "compared",
    validity: { valid: true, reasons: [], current: deltas.coarse, refined: deltas.fine },
    ...identity,
    deltaClAlpha: deltas.deltaClAlpha,
    deltaCdi: deltas.deltaCdi,
    gates: { clAlpha: 0.01, cdi: 0.05 },
    withinGates: deltas.deltaClAlpha <= 0.01 && deltas.deltaCdi <= 0.05
  };
}

export function solveLinearSystem(matrix, rhs) {
  const n = rhs.length;
  const a = matrix.map((row, index) => {
    const augmented = new Float64Array(n + 1);
    augmented.set(row);
    augmented[n] = rhs[index];
    return augmented;
  });
  // M0-4 / SOL-01: the pivot test is a dimensionless RATIO against the
  // matrix's own entry scale (both have the same dimension — the previous
  // absolute 1e-10 on dimensionful pivots was scale dependent). An all-zero
  // matrix fails the strict test below and is rejected.
  let matrixScale = 0;
  for (const row of matrix) {
    for (let column = 0; column < n; column += 1) {
      matrixScale = Math.max(matrixScale, Math.abs(row[column]));
    }
  }
  let minPivot = Infinity;
  let maxPivot = 0;
  for (let column = 0; column < n; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(a[row][column]) > Math.abs(a[pivotRow][column])) pivotRow = row;
    }
    if (!(Math.abs(a[pivotRow][column]) > SOLVER_PIVOT_RELATIVE_TOLERANCE * matrixScale)) {
      throw new Error("VLM influence matrix is singular or near-singular.");
    }
    [a[column], a[pivotRow]] = [a[pivotRow], a[column]];
    const pivot = Math.abs(a[column][column]);
    minPivot = Math.min(minPivot, pivot);
    maxPivot = Math.max(maxPivot, pivot);
    for (let row = column + 1; row < n; row += 1) {
      // No elimination skip: a nonzero factor is never suppressed (dropping it
      // is an unquantified approximation; the factor is already dimensionless
      // and the update is a single fused multiply-add).
      const factor = a[row][column] / a[column][column];
      for (let k = column; k <= n; k += 1) a[row][k] -= factor * a[column][k];
    }
  }
  const solution = new Float64Array(n);
  for (let row = n - 1; row >= 0; row -= 1) {
    let value = a[row][n];
    for (let column = row + 1; column < n; column += 1) value -= a[row][column] * solution[column];
    solution[row] = value / a[row][row];
  }
  let residual = 0;
  for (let row = 0; row < n; row += 1) {
    let value = -rhs[row];
    for (let column = 0; column < n; column += 1) value += matrix[row][column] * solution[column];
    residual = Math.max(residual, Math.abs(value));
  }
  return { solution, minPivot, maxPivot, residual };
}

// Largest full span among the panels' surfaces (wake floor: 10 b of the
// largest surface, DATA_CONTRACTS §2.7).
function largestSurfaceSpanM(panels) {
  const extents = new Map();
  for (const panel of panels) {
    const key = panel.surfaceName || "";
    const extent = extents.get(key) || { min: Infinity, max: -Infinity };
    extent.min = Math.min(extent.min, panel.boundA[1]);
    extent.max = Math.max(extent.max, panel.boundB[1]);
    extents.set(key, extent);
  }
  let largest = 0;
  for (const extent of extents.values()) largest = Math.max(largest, extent.max - extent.min);
  return largest;
}

function caseWakeLength(refChordM, factor, largestSpanM) {
  const length = Math.max(refChordM * factor, 10 * largestSpanM);
  if (!Number.isFinite(length)) throw new Error("Wake length must be finite.");
  return length;
}

// Chordwise rows per surface on a generated lattice (validity gates, SOL-03).
function rowsPerSurface(panels) {
  const rows = new Map();
  for (const panel of panels) {
    const key = panel.surfaceName || "";
    rows.set(key, Math.max(rows.get(key) || 0, (panel.chordIndex || 0) + 1));
  }
  return rows;
}

function sectionAt(surface, y) {
  const fraction = Math.min(1, Math.abs(y) / (0.5 * surface.spanM));
  let chord;
  if (surface.planform === "elliptic") {
    // c(y) = c0 sqrt(1 - (2y/b)^2) (IMPLEMENTATION_HANDOFF §3.3).
    const eta = Math.min(1, Math.abs(2 * y / surface.spanM));
    chord = surface.rootChordM * Math.sqrt(Math.max(0, 1 - eta * eta));
  } else {
    chord = surface.rootChordM + fraction * (surface.tipChordM - surface.rootChordM);
  }
  // The sweep input is the c/4 sweep (DATA_CONTRACTS §2.7): the quarter-chord
  // line is straight at x_LE_root + c_root/4 + |y| tan(Λ_c/4), so the leading
  // edge follows from the local chord (equivalently tan Λ_LE = tan Λ_c/4 +
  // (c_r − c_t)/(2b) for the linear planform). VLM-V6 measures this line.
  const quarterChordX = surface.xLeadingRootM + 0.25 * surface.rootChordM
    + Math.abs(y) * Math.tan(surface.sweepDeg * Math.PI / 180);
  const x = quarterChordX - 0.25 * chord;
  const z = surface.zRootM + Math.abs(y) * Math.tan(surface.dihedralDeg * Math.PI / 180);
  return { chord, leading: [x, y, z] };
}

function slope(values, xKey, yKey) {
  if (values.length < 2) return 0;
  const meanX = values.reduce((sum, value) => sum + value[xKey], 0) / values.length;
  const meanY = values.reduce((sum, value) => sum + value[yKey], 0) / values.length;
  let numerator = 0;
  let denominator = 0;
  for (const value of values) {
    const dx = value[xKey] - meanX;
    numerator += dx * (value[yKey] - meanY);
    denominator += dx * dx;
  }
  return denominator > FIT_EPSILON ? numerator / denominator : 0;
}

/**
 * M0-5 / SOL-09 fit contract (DATA_CONTRACTS 2.5, RB-21): a least-squares line
 * with a FITTED intercept (meanY - slope*meanX — never a sampled neighbour of
 * alpha = 0 played as the intercept), certified only when the window holds
 * >= FIT_MIN_CONVERGED_POINTS points AND every adjacent-pair slope is within
 * FIT_ADJACENT_SLOPE_TOLERANCE (5 %) of the window's least-squares slope.
 * `window` is sorted by alphaDeg with distinct abscissae; x is in degrees and y
 * is dimensionless. Slope/intercept are populated ONLY for a certified fit —
 * an uncertified record never carries a usable derivative (the least-squares
 * slope and deviation diagnostic are retained for the report only).
 *
 * Exported as the contract primitive so the 5 % boundary can be pinned
 * directly with synthetic windows (VLM-V7 test group); production callers go
 * through runVlmSweep.
 */
export function linearFit(window, yKey) {
  const pointCount = window.length;
  const record = {
    status: FIT_STATUS_DETERMINED,
    pointCount,
    // Certified derivative and intercept: populated ONLY for a certified fit.
    slopePerDeg: null,
    intercept: null,
    // Diagnostics, present whenever the least squares was evaluated (never a
    // certified derivative).
    leastSquaresSlopePerDeg: null,
    maxAdjacentSlopeDeviationPerDeg: null
  };
  if (pointCount < FIT_MIN_CONVERGED_POINTS) return { ...record, status: FIT_STATUS_INSUFFICIENT };
  const meanX = window.reduce((sum, point) => sum + point.alphaDeg, 0) / pointCount;
  const meanY = window.reduce((sum, point) => sum + point[yKey], 0) / pointCount;
  let numerator = 0;
  let denominator = 0;
  for (const point of window) {
    numerator += (point.alphaDeg - meanX) * (point[yKey] - meanY);
    denominator += (point.alphaDeg - meanX) ** 2;
  }
  const slopePerDeg = denominator > FIT_EPSILON ? numerator / denominator : 0;
  const intercept = meanY - slopePerDeg * meanX;
  record.leastSquaresSlopePerDeg = slopePerDeg;
  // Adjacent-pair slopes of the retained window points (a gap left by a
  // quarantined point makes one wider pair — the contract's "adjacent").
  let maxDeviation = 0;
  for (let i = 0; i + 1 < pointCount; i += 1) {
    const pairSlope = (window[i + 1][yKey] - window[i][yKey]) / (window[i + 1].alphaDeg - window[i].alphaDeg);
    maxDeviation = Math.max(maxDeviation, Math.abs(pairSlope - slopePerDeg));
  }
  record.maxAdjacentSlopeDeviationPerDeg = maxDeviation;
  if (!(maxDeviation <= FIT_ADJACENT_SLOPE_TOLERANCE * Math.abs(slopePerDeg))) {
    return { ...record, status: FIT_STATUS_NONLINEAR };
  }
  return { ...record, slopePerDeg, intercept };
}

// §2.5 rule 4: the model description that must accompany every verdict.
export const TIER0_MODEL_DESCRIPTION =
  "wing + H-tail flat-plate VLM; fuselage, camber and twist omitted; fuselage omission over-estimates SM";

// §2.5 verdict resolution (RB-01; STAB-V2 wing-alone guard, STAB-V3
// assumed-mass guard). A verdict exists ONLY when the linearity criteria hold
// AND the caller supplies all remaining contract evidence through
// verdictInputs: { horizontalStabilizerPresent, massSource, modelDescription }.
// massSource "assumedUniform" (the default uniform-density lump) is a
// WITHHOLD condition, as is any absent evidence. The record always names the
// unmet conditions; "unstable" is never a bare boolean.
function resolveStabilityVerdict({ clFit, cmFit, clAlphaPerRad, cmAlphaPerRad, staticMargin, verdictInputs }) {
  const unmetConditions = [];
  const linearityMet = clFit.status === FIT_STATUS_DETERMINED && cmFit.status === FIT_STATUS_DETERMINED
    && Number.isFinite(clAlphaPerRad) && Math.abs(clAlphaPerRad) > FIT_EPSILON
    && Number.isFinite(cmAlphaPerRad) && Math.abs(cmAlphaPerRad) > FIT_EPSILON;
  if (!linearityMet) unmetConditions.push("linearity criteria not met (DATA_CONTRACTS 2.5)");
  const inputs = verdictInputs || {};
  if (inputs.horizontalStabilizerPresent !== true) {
    unmetConditions.push("no valid horizontal stabiliser — wing-alone run (STAB-V2)");
  }
  if (!(typeof inputs.massSource === "string" && inputs.massSource.length > 0 && inputs.massSource !== "assumedUniform")) {
    unmetConditions.push("mass source is the assumed uniform-density lump or unestablished (RB-01, STAB-V3)");
  }
  const modelDescription = typeof inputs.modelDescription === "string" && inputs.modelDescription.trim().length > 0
    ? inputs.modelDescription.trim()
    : null;
  if (!modelDescription) unmetConditions.push("no model description supplied to accompany the verdict (2.5 rule 4)");
  if (unmetConditions.length > 0) {
    return { status: "not determined", verdict: null, unmetConditions, modelDescription };
  }
  return {
    status: "determined",
    verdict: cmAlphaPerRad < 0 && staticMargin > 0 ? "statically stable" : "unstable",
    unmetConditions: [],
    modelDescription
  };
}

// C_L(alpha_trim) for the positive-lift trim gate (DATA_CONTRACTS 2.5),
// evaluated from CONVERGED sampled points only: exact sample when one sits at
// alphaTrimDeg, otherwise piecewise-linear interpolation between the
// bracketing converged samples (DEC-M0-5-2). Never used for plots; returns
// null when no converged samples bracket the angle.
function sampledClAt(converged, alphaTrimDeg) {
  for (const point of converged) {
    if (Math.abs(point.alphaDeg - alphaTrimDeg) <= FIT_WINDOW_EPSILON_DEG) {
      return { cl: point.cl, source: "sampled C_L" };
    }
  }
  for (let i = 0; i + 1 < converged.length; i += 1) {
    const a = converged[i];
    const b = converged[i + 1];
    if (a.alphaDeg < alphaTrimDeg && alphaTrimDeg < b.alphaDeg) {
      const t = (alphaTrimDeg - a.alphaDeg) / (b.alphaDeg - a.alphaDeg);
      return { cl: a.cl + t * (b.cl - a.cl), source: "linear interpolation between converged C_L samples" };
    }
  }
  return null;
}

// Deliberately defined two-point (alpha = 0/4 deg) RESOLUTION DIAGNOSTIC slope
// (SOL-02 protocol). Not a certified lift derivative (SOL-09): it bypasses the
// >= 3-point fit contract ON PURPOSE and is never labelled or exported as
// C_Lalpha. The arithmetic is the historical one so the pinned R1 -> R2
// deltas of VALIDATION_AND_TEST_MATRIX VLM-V3 stay bit-identical.
function twoPointSlopePerRad(series) {
  const converted = slope(series, "alphaDeg", "cl") * 180 / Math.PI;
  if (Number.isFinite(converted)) return converted;
  // The caller has checked both finite 0°/4° cases. Divide their difference
  // directly by the radian interval to avoid overflow in the intermediate
  // least-squares sums or degree conversion. Keep ordinary results identical.
  const zero = series.find((point) => point.alphaDeg === 0);
  const four = series.find((point) => point.alphaDeg === 4);
  return (four.cl - zero.cl) / (4 * Math.PI / 180);
}

function optionalFinite(value, fallback, name) {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number.`);
  return value;
}

function isOptionsObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !ArrayBuffer.isView(value);
}

function requireSolverOptions(options) {
  if (!isOptionsObject(options)) throw new Error("A solver options object is required.");
}

function normalizeSurfaces(surfaces) {
  if (!Array.isArray(surfaces) || surfaces.length === 0)
    throw new Error("At least one lifting surface is required.");
  const names = new Set();
  return Array.from(surfaces, reference => {
    const surface = createLiftingSurface(reference);
    const key = surface.name.trim().toLowerCase();
    if (names.has(key)) throw new Error(`Duplicate lifting surface name: "${surface.name}".`);
    names.add(key);
    return surface;
  });
}

function radians(degrees, name) {
  const angle = degrees * Math.PI / 180;
  if (!Number.isFinite(angle)) throw new Error(`${name} cannot be represented in radians by the solver.`);
  return angle;
}

function positive(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive.`);
  return value;
}

function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a, scalar) { return [a[0] * scalar, a[1] * scalar, a[2] * scalar]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function magnitude(a) { return Math.hypot(a[0], a[1], a[2]); }
function normalize(a) {
  const length = magnitude(a);
  // Normalization is scale free: the only degenerate input is the exact zero
  // vector (the previous absolute 1e-10 on a length-dimension vector was one
  // more face of SOL-01's dimensional inconsistency).
  return length > 0 ? scale(a, 1 / length) : [0, 0, 0];
}
function project(point, direction) { return subtract(point, scale(direction, dot(point, direction))); }

// DR-01: induced drag must be >= 0 (0 only at zero lift) for any converged
// lifting system. A negative computed value is never concealed with Math.abs;
// it is raised as a validity error. Its cause is not uniquely a sign/orientation
// defect: quadrature/discretization of the midpoint quadratic form can produce
// it too (SOL-04 — the discrete form is not positive semi-definite). Diagnosis
// belongs to the caller; this guard only refuses to report |D|.
//
// SOL-06 (REM-2, DEC-SOL-06-1) — numerical-cancellation policy. The former
// floor max(1e-6 * sum|terms|, 1e-9 * qS) was an output-significance policy
// keyed on qS: it erased resolved drag (alpha = 0.001 deg reported C_Di = 0
// against a true ~2.6e-10) and let the reference area mask a resolved negative
// force (qS = 1e12 suppressed a supplied -1 N drag that qS = 1 rejected). The
// tolerance below is instead the FORWARD ERROR of the evaluated sums, in
// newtons: each term is produced by a counted chain of IEEE double operations
// (unit roundoff u = 2^-53) acting on magnitudes that dominate the term, and
// the n-term accumulation contributes gamma_n * sum|terms| (classical gamma_n
// bound). It is dimensionally a force, scales with the physical force scale
// (so suppression decisions are scale invariant), and never mentions qS.
// Values inside it are not provably resolvable from zero at double precision
// (within this worst-case bound), not insignificant: they are reported as
// exactly 0 with an explicit, size-declared suppression flag and the raw
// signed value preserved. Values outside it are reported as computed — a
// resolved negative drag still raises. The bound covers only the
// floating-point forward error of the evaluated sums given the circulation
// values; it is not a model-error or output-significance bound (DEC-SOL-06-2).
//
// Composition of the counted bound (DEC-SOL-06-4):
//   (a) gamma_n * sum|terms| for the accumulation;
//   (b) per-term/per-leg operation chains acting on magnitudes >= |term|
//       (sum|contributions| factors);
//   (c) coordinate-translation amplification: projections and point
//       differences act on coordinate magnitudes |p| and produce absolute
//       error ~ OPS_PER_PROJECTION * u * |p| in the differences r the kernels
//       divide by, so each chain carries DISTANCE_ERROR_SENSITIVITY *
//       OPS_PER_PROJECTION * u * sum|p| / |r| (an independent verification
//       measured a 4.4x under-coverage of (a)+(b) alone on a wing at 1e9 m
//       coordinate offset; (c) closes it and is scale invariant — the ratio
//       |p|/|r| is dimensionless).
// Documented scope (OBS-SOL-06-1): the bound does NOT model the internal
// cancellation of the 3-D Biot-Savart segment kernel for near-parallel far
// alignments (measured <= 5x under-coverage on adversarial 2-panel geometry;
// failure mode is conservative — loud rejection/quarantine, never concealment)
// nor over/underflow outside the double range: non-finite evaluations now fail
// loudly below, and subnormal-magnitude inputs are outside the Tier-0 regime.
const DBL_UNIT_ROUNDOFF = Number.EPSILON / 2; // u = 2^-53 (unit roundoff, round-to-nearest)
const OPS_PER_TRANSVERSE_LEG = 25;   // subtract, |r|^2, divide, cross, scale, add
const OPS_PER_TREFFTZ_TERM = 12;     // dot(vT, arm), scale by 0.5 rho Gamma, accumulate
const OPS_PER_HORSESHOE_PAIR = 100;  // horseshoe induction evaluation + scale + accumulate
const OPS_PER_NEAR_FIELD_TERM = 10;  // dot(induced, arm), scale by rho Gamma, accumulate
const OPS_PER_PANEL_FORCE = 20;      // effective velocity, cross, scale by rho Gamma
const OPS_PER_PROJECTION = 12;       // dot, scale, subtract producing one projected/differenced coordinate
const DISTANCE_ERROR_SENSITIVITY = 3; // kernel ~ 1/r^2 and cross(r): relative error <= 3 x err(r)/|r|

function accumulationGamma(count) {
  // gamma_n = n*u/(1 - n*u); for the operation counts here the second-order
  // terms are < 1e-5 of the linear term.
  const x = Math.max(count, 0) * DBL_UNIT_ROUNDOFF;
  return x / (1 - x);
}

function reportSignedDrag(label, rawN, toleranceN, rawField, toleranceBasis) {
  // Non-finite evaluations are never reported or suppressed into a plausible
  // zero (SOL-10 spirit, DEC-SOL-06-4 Class C): an infinite drag or an
  // infinite/undefined tolerance fails loudly.
  if (!Number.isFinite(rawN) || !Number.isFinite(toleranceN)) {
    throw new Error(
      `${label} drag evaluation is not finite (D = ${rawN} N, numerical cancellation tolerance = ${toleranceN} N). ` +
      `Non-finite scientific data must not be reported as a finite drag.`
    );
  }
  if (rawN < -toleranceN) {
    throw new Error(
      `${label} induced drag is negative (D = ${rawN} N; numerical cancellation tolerance ${toleranceN} N). ` +
      `Refusing to report |D|; cause may be a sign/circulation-orientation defect or a non-physical discrete mode (SOL-04).`
    );
  }
  if (rawN !== 0 && rawN <= toleranceN && rawN >= -toleranceN) {
    return {
      reportedN: 0,
      suppression: {
        suppressedToZero: true,
        reason:
          `${label} drag D = ${rawN} N is within the worst-case floating-point forward-error bound ${toleranceN} N ` +
          `(${toleranceBasis}); it cannot be proven resolved from zero at double precision (numerically unresolved ` +
          `within that bound) and is reported as exactly 0. ` +
          `The raw signed value is preserved in ${rawField}.`,
        toleranceN
      }
    };
  }
  // rawN === 0 (including -0) is a genuinely exact zero: nothing is suppressed.
  return { reportedN: rawN === 0 ? 0 : rawN, suppression: { suppressedToZero: false, reason: null, toleranceN } };
}

// DEC-SOL-06-4 (c): coordinate-translation amplification of a Biot-Savart
// evaluation, as an ADDITIVE operation count. The kernels divide by
// differences r of projected/entered coordinates; those differences carry
// absolute error ~ OPS_PER_PROJECTION * u * |p| (the magnitudes BEFORE any
// projection/differencing), so the induced velocity's relative error picks up
// DISTANCE_ERROR_SENSITIVITY * OPS_PER_PROJECTION * u * sum|p| / |r|. The
// factor is dimensionless and scale invariant. Distances are floored at the
// relative singularity cutoff of the panel's own segments: below it the kernel
// term is already truncated and counted (SOL-01), so this is the worst
// legitimate amplification.
function inductionDistanceErrorOps(evalPoint, panel, ew, wakeLengthM) {
  // Bookkeeping only (never feeds a value): sqrt-based norms are exact enough
  // for a conservative factor and much faster than Math.hypot in this O(n^2) path.
  const fastMagnitude = (p) => Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
  const wakeOffset = scale(ew, wakeLengthM);
  const fromA = subtract(evalPoint, panel.boundA);
  const fromB = subtract(evalPoint, panel.boundB);
  const minDistance = Math.min(
    fastMagnitude(fromA),
    fastMagnitude(fromB),
    fastMagnitude(subtract(fromA, wakeOffset)),
    fastMagnitude(subtract(fromB, wakeOffset))
  );
  const boundLength = fastMagnitude(subtract(panel.boundB, panel.boundA));
  const distanceFloor = RELATIVE_SINGULARITY_CUTOFF * Math.min(boundLength > 0 ? boundLength : wakeLengthM, wakeLengthM);
  const coordScale = fastMagnitude(evalPoint)
    + 2 * (fastMagnitude(panel.boundA) + fastMagnitude(panel.boundB))
    + 2 * wakeLengthM;
  // Division before multiplication keeps the factor finite where
  // DISTANCE_ERROR_SENSITIVITY * OPS_PER_PROJECTION * coordScale would overflow.
  return DISTANCE_ERROR_SENSITIVITY * OPS_PER_PROJECTION
    * (coordScale / Math.max(minDistance, distanceFloor));
}
