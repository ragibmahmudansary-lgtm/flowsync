import test from "node:test";
import assert from "node:assert/strict";
import {
  createLiftingSurface,
  generateVlmPanels,
  panelAspectDiagnostics,
  autoSpanwisePanels,
  resolutionLabel,
  runVlmResolutionCheck,
  runVlmSweep,
  solveLinearSystem,
  solveVlmCase,
  trefftzDrag,
  linearFit,
  FIT_WINDOW_MAX_ABS_ALPHA_DEG,
  FIT_MIN_CONVERGED_POINTS,
  FIT_ADJACENT_SLOPE_TOLERANCE,
  FIT_STATUS_DETERMINED,
  FIT_STATUS_INSUFFICIENT,
  FIT_STATUS_NONLINEAR
} from "../src/vlmSolver.js";

// ---------------------------------------------------------------------------
// M0-2 multi-row lattice geometry (IMPLEMENTATION_HANDOFF §2 "M0-2",
// DATA_CONTRACTS §2.7): M chordwise rows x N uniform spanwise strips, bound
// vortex at the 1/4 point of each sub-panel, control point at the 3/4 point,
// guard on width/length, wake >= 10 b, R1/R2 identification.
// ---------------------------------------------------------------------------

test("generates M x N sub-panels with quarter-chord vortices and three-quarter-chord control points", () => {
  const surface = createLiftingSurface(rectangularWing());
  const panels = generateVlmPanels([surface], { spanwisePanels: 8, chordwiseRows: 4 });
  assert.equal(panels.length, 32);
  const rows = new Map();
  for (const panel of panels) {
    assert.equal(panel.normal[2], 1);
    rows.set(panel.chordIndex, panel);
  }
  assert.equal(rows.size, 4);
  for (const [k, panel] of rows) {
    close(panel.boundA[0], (k + 0.25) / 4);
    close(panel.controlPoint[0], (k + 0.75) / 4);
  }
  // Uniform spanwise edges on [−b/2, b/2].
  const strip0 = panels.filter((panel) => panel.spanIndex === 0);
  for (const panel of strip0) {
    close(panel.y0, -4);
    close(panel.y1, -3);
    close(panel.boundMidpoint[1], -3.5);
    close(panel.controlPoint[1], -3.5);
    // width/length = (b/N) / (c/M) = 1 / 0.25.
    close(panel.widthLengthRatio, 4);
  }
  assert.equal(strip0.length, 4);
});

test("default lattice is 4 chordwise rows with the prescribed spanwise count (R1/R2)", () => {
  const surface = createLiftingSurface(rectangularWing());
  // AR 8: N = max(16, 2 M ceil(AR/2)) -> 32 at M = 4 (R1) and 64 at M = 8 (R2),
  // i.e. 8 ceil(AR/2) and 16 ceil(AR/2) of VALIDATION_AND_TEST_MATRIX.
  assert.equal(autoSpanwisePanels(surface, 4), 32);
  assert.equal(autoSpanwisePanels(surface, 8), 64);
  const r1 = generateVlmPanels([surface]);
  assert.equal(r1.length, 128);
  const r2 = generateVlmPanels([surface], { chordwiseRows: 8 });
  assert.equal(r2.length, 512);
  // At the prescribed counts the panel aspect ratio is about 1 everywhere.
  for (const panel of [...r1, ...r2]) close(panel.widthLengthRatio, 1);
  assert.equal(resolutionLabel([surface], 4, { "Main wing": 32 }), "R1");
  assert.equal(resolutionLabel([surface], 8, { "Main wing": 64 }), "R2");
  assert.equal(resolutionLabel([surface], 4, { "Main wing": 24 }), "custom");
  assert.equal(resolutionLabel([surface], 6, { "Main wing": 48 }), "custom");
});

test("panel aspect guard refuses width/length < 0.25 and warns above 8", () => {
  const surface = createLiftingSurface(rectangularWing());
  // Single row with width/chord = 0.2: refused (VLM-V3 guard exception).
  assert.throws(
    () => generateVlmPanels([surface], { spanwisePanels: 40, chordwiseRows: 1 }),
    /refused.*0\.200/s,
    "a panel with width/length = 0.2 must refuse the lattice"
  );
  // Exactly 0.25 passes (boundary).
  const boundary = generateVlmPanels([surface], { spanwisePanels: 32, chordwiseRows: 1 });
  assert.equal(boundary.length, 32);
  close(boundary[0].widthLengthRatio, 0.25);
  // Stretched panels (width/length > 8) warn but are accepted.
  const stretched = generateVlmPanels([createLiftingSurface({ ...rectangularWing(), spanM: 32, rootChordM: 0.5, tipChordM: 0.5 })], { spanwisePanels: 4, chordwiseRows: 1 });
  const diagnostics = panelAspectDiagnostics(stretched);
  assert.equal(diagnostics.status, "warning");
  assert.ok(diagnostics.maxRatio > 8);
  assert.match(diagnostics.messages.join(" "), /Coarse spanwise spacing/);
  // The solve exposes the same validity indicator.
  const solved = solveVlmCase({
    surfaces: [createLiftingSurface({ ...rectangularWing(), spanM: 32, rootChordM: 0.5, tipChordM: 0.5 })],
    spanwisePanels: 4,
    chordwiseRows: 1,
    alphaDeg: 2,
    velocityMS: 30,
    densityKgM3: 1.225,
    refAreaM2: 16,
    refChordM: 0.5,
    referencePoint: [0.125, 0, 0]
  });
  assert.equal(solved.validity.status, "warning");
  assert.match(solved.validity.messages.join(" "), /Coarse spanwise spacing/);
  assert.match(solved.uncertaintyLabel, /unverified/);
});

test("sweep input is the c/4 sweep of the generated lattice (VLM-V6)", () => {
  const surface = createLiftingSurface({ spanM: 8, rootChordM: 1, tipChordM: 0.35, sweepDeg: 25, dihedralDeg: 0, xLeadingRootM: 0, zRootM: 0 });
  const panels = generateVlmPanels([surface], { spanwisePanels: 8, chordwiseRows: 1 });
  // M = 1: the bound line IS the c/4 line; measure its sweep from the panels.
  const tip = panels[panels.length - 1];
  const measured = Math.atan2(tip.boundB[0] - tip.boundA[0], tip.boundB[1] - tip.boundA[1]) * 180 / Math.PI;
  assert.ok(Math.abs(measured - 25) <= 0.01, `measured c/4 sweep ${measured} deg must equal the input 25 deg within 0.01 deg`);
  // Elliptic planform with zero sweep: the c/4 line is straight (x constant).
  const elliptic = generateVlmPanels([createLiftingSurface({ planform: "elliptic", spanM: 4, rootChordM: 1, tipChordM: 0, sweepDeg: 0, dihedralDeg: 0, xLeadingRootM: 0, zRootM: 0 })], { spanwisePanels: 16, chordwiseRows: 1 });
  for (const panel of elliptic) {
    close(panel.boundA[0], panel.boundB[0], 1e-12);
    assert.ok(panel.boundA[0] >= 0.25 - 1e-12 && panel.boundA[0] <= 0.25 + 1e-12);
  }
});

// ---------------------------------------------------------------------------
// M0-3 (review §7.2, VLM-V6 with incidence): section-geometry measure-backs.
// All measurements below use only generated panel vertices.
// ---------------------------------------------------------------------------

// Strip-edge quarter-chord point from panel vertices alone: bound vortex of row k
// sits at chord fraction (k + 0.25)/M of the edge section, so
// q = bound(row 0) + 0.25 * (bound(row M-1) - bound(row 0)) for any M >= 1.
function edgeQuarterPoint(rows, side) {
  const a = rows[0][side];
  const b = rows[rows.length - 1][side];
  return [a[0] + 0.25 * (b[0] - a[0]), a[1] + 0.25 * (b[1] - a[1]), a[2] + 0.25 * (b[2] - a[2])];
}

// Strip-edge leading/trailing points need M >= 2: the two rows give the edge
// chord vector c*d without any external data (LE sits 0.25 chord before q).
function edgeLeadingPoint(rows, side) {
  const a = rows[0][side];
  const b = rows[rows.length - 1][side];
  return [a[0] - (0.25 / (rows.length - 1)) * (b[0] - a[0]), a[1] - (0.25 / (rows.length - 1)) * (b[1] - a[1]), a[2] - (0.25 / (rows.length - 1)) * (b[2] - a[2])];
}

function edgeTrailingPoint(rows, side) {
  const a = rows[0][side];
  const b = rows[rows.length - 1][side];
  return [b[0] + (0.75 / (rows.length - 1)) * (b[0] - a[0]), b[1] + (0.75 / (rows.length - 1)) * (b[1] - a[1]), b[2] + (0.75 / (rows.length - 1)) * (b[2] - a[2])];
}

// Sweep of the line through the strip-edge point pairs at y = 0 and y = +b/2
// (right half; the planform is symmetric in |y|).
function measuredRightHalfSweep(panels, m, n, pointOf) {
  const inner = panels.slice((n / 2) * m, (n / 2) * m + m);
  const outer = panels.slice((n - 1) * m, n * m);
  const root = pointOf(inner, "boundA");
  const tip = pointOf(outer, "boundB");
  return Math.atan2(tip[0] - root[0], tip[1] - root[1]) * 180 / Math.PI;
}

test("VLM-V6 with incidence: projected c/4 line of the generated panels is the input sweep at any incidence (M0-3)", () => {
  const cases = [
    // [span, root chord, tip chord, sweep, dihedral, rows, strips, planform] —
    // the first row is the review §7.2 / frozen probe case (b = 8, cr = 1,
    // ct = 0.3, Lambda = 25).
    [8, 1, 0.3, 25, 0, 1, 8, undefined],
    [8, 1, 0.3, 25, 0, 4, 8, undefined],
    [8, 1, 0.3, 25, 0, 8, 8, undefined],
    [8, 1, 0.3, 25, 4, 4, 16, undefined],
    [8, 1, 0.3, -25, -4, 4, 8, undefined],
    [12, 2, 0.2, 45, 0, 4, 16, undefined],
    [12, 2, 0.2, 0, 6, 4, 16, undefined],
    [6, 1.2, 0, 10, 2, 4, 16, "elliptic"]
  ];
  for (const [b, cr, ct, sweepDeg, dihedralDeg, m, n, planform] of cases) {
    for (const incidenceDeg of [-30, -15, -5, 0, 5, 10, 15, 30]) {
      const surface = createLiftingSurface({
        planform, spanM: b, rootChordM: cr, tipChordM: ct, sweepDeg, dihedralDeg,
        incidenceDeg, xLeadingRootM: 3.7, zRootM: -1.2
      });
      const panels = generateVlmPanels([surface], { spanwisePanels: n, chordwiseRows: m });
      const measured = measuredRightHalfSweep(panels, m, n, edgeQuarterPoint);
      // VLM-V6 gate (VALIDATION_AND_TEST_MATRIX): measured = input ± 0.01 deg.
      assert.ok(
        Math.abs(measured - sweepDeg) <= 0.01,
        `b=${b} c=${cr}/${ct} L=${sweepDeg} G=${dihedralDeg} i=${incidenceDeg} M=${m} N=${n}: ` +
        `measured projected c/4 sweep ${measured} deg must equal the input ${sweepDeg} deg within 0.01 deg`
      );
      // Straightness is checked at EVERY strip edge (both halves, x symmetric in
      // |y|): each station's slope against the y = 0 station must be the input.
      const stations = [];
      for (let s = 0; s < n; s += 1) {
        const rows = panels.slice(s * m, s * m + m);
        stations.push(edgeQuarterPoint(rows, "boundA"));
        if (s === n - 1) stations.push(edgeQuarterPoint(rows, "boundB"));
      }
      const origin = stations.reduce((best, p) => (Math.abs(p[1]) < Math.abs(best[1]) ? p : best));
      for (const p of stations) {
        if (Math.abs(p[1] - origin[1]) < 1e-12) continue;
        const slopeDeg = Math.atan((p[0] - origin[0]) / (Math.abs(p[1]) - Math.abs(origin[1]))) * 180 / Math.PI;
        assert.ok(Math.abs(slopeDeg - sweepDeg) <= 0.01,
          `b=${b} L=${sweepDeg} i=${incidenceDeg} M=${m}: station y=${p[1]} gives c/4 slope ${slopeDeg} deg, expected ${sweepDeg} deg`);
      }
    }
    // The measured c/4 sweep is exactly independent of incidence (the rotation
    // pivots about the local c/4 point): same case, i = 30 vs i = 0.
    const at = (incidenceDeg) => {
      const surface = createLiftingSurface({
        planform, spanM: b, rootChordM: cr, tipChordM: ct, sweepDeg, dihedralDeg,
        incidenceDeg, xLeadingRootM: 3.7, zRootM: -1.2
      });
      return measuredRightHalfSweep(generateVlmPanels([surface], { spanwisePanels: n, chordwiseRows: m }), m, n, edgeQuarterPoint);
    };
    assert.ok(Math.abs(at(30) - at(0)) <= 1e-9, `b=${b} L=${sweepDeg} M=${m}: measured c/4 sweep must not depend on incidence (got ${at(30)} vs ${at(0)})`);
    assert.ok(Math.abs(at(-15) - at(0)) <= 1e-9, `b=${b} L=${sweepDeg} M=${m}: measured c/4 sweep must not depend on incidence (got ${at(-15)} vs ${at(0)})`);
  }
});

test("sweep conversion c/4 -> LE is applied exactly once (M0-3, DR-21)", () => {
  for (const [b, cr, ct, sweepDeg, m, n] of [
    [8, 1, 0.3, 25, 4, 8],
    [12, 2, 0.2, 45, 4, 16],
    [8, 1, 0.3, -25, 4, 8],
    [8, 1, 0.3, 25, 8, 8]
  ]) {
    // Contract (DATA_CONTRACTS §2.7): tan L_LE = tan L_c/4 + (cr - ct)/(2b) —
    // the unrotated (i = 0) planform leading edge derived from the input sweep.
    const tanLE = Math.tan(sweepDeg * Math.PI / 180) + (cr - ct) / (2 * b);
    const expectLE = Math.atan(tanLE) * 180 / Math.PI;
    const surface0 = createLiftingSurface({ spanM: b, rootChordM: cr, tipChordM: ct, sweepDeg, dihedralDeg: 0, xLeadingRootM: 0, zRootM: 0 });
    const measuredLE0 = measuredRightHalfSweep(generateVlmPanels([surface0], { spanwisePanels: n, chordwiseRows: m }), m, n, edgeLeadingPoint);
    assert.ok(Math.abs(measuredLE0 - expectLE) <= 0.01,
      `b=${b} c=${cr}/${ct} L=${sweepDeg} M=${m}: measured LE sweep ${measuredLE0} deg must equal the single conversion ${expectLE} deg within 0.01 deg`);
    // A double conversion would move the LE line by (cr - ct)/(2b) in tan —
    // excluded by far more than the gate.
    const doubleConverted = Math.atan(tanLE + (cr - ct) / (2 * b)) * 180 / Math.PI;
    assert.ok(Math.abs(measuredLE0 - doubleConverted) > 0.1,
      `b=${b} L=${sweepDeg}: a double conversion (${doubleConverted} deg) must be excluded`);
    // At nonzero incidence the section rotates about its local c/4 point, so the
    // projected LE locus is tan L_LE(i) = tan L_c/4 + ((cr - ct)/(2b)) cos i
    // (exact analytic consequence, asserted as the convention record DEC-M0-3-1).
    for (const incidenceDeg of [-15, 15]) {
      const i = incidenceDeg * Math.PI / 180;
      const expectRotated = Math.atan(Math.tan(sweepDeg * Math.PI / 180) + ((cr - ct) / (2 * b)) * Math.cos(i)) * 180 / Math.PI;
      const surface = createLiftingSurface({ spanM: b, rootChordM: cr, tipChordM: ct, sweepDeg, dihedralDeg: 0, incidenceDeg, xLeadingRootM: 0, zRootM: 0 });
      const measuredLE = measuredRightHalfSweep(generateVlmPanels([surface], { spanwisePanels: n, chordwiseRows: m }), m, n, edgeLeadingPoint);
      assert.ok(Math.abs(measuredLE - expectRotated) <= 0.01,
        `b=${b} L=${sweepDeg} i=${incidenceDeg}: measured rotated LE sweep ${measuredLE} deg must equal ${expectRotated} deg within 0.01 deg`);
    }
  }
});

test("incidence rotates each section about its local quarter-chord point (M0-3, direct coordinates)", () => {
  for (const incidenceDeg of [-30, -15, 15, 30, 1e-7]) {
    const i = incidenceDeg * Math.PI / 180;
    const b = 8, cr = 1, ct = 0.3, sweepDeg = 25, dihedralDeg = 4;
    const surface = createLiftingSurface({
      spanM: b, rootChordM: cr, tipChordM: ct, sweepDeg, dihedralDeg,
      incidenceDeg, xLeadingRootM: 3.7, zRootM: -1.2
    });
    const m = 4, n = 8;
    const panels = generateVlmPanels([surface], { spanwisePanels: n, chordwiseRows: m });
    for (let s = 0; s < n; s += 1) {
      const rows = panels.slice(s * m, s * m + m);
      for (const side of ["boundA", "boundB"]) {
        const y = rows[0][side][1];
        const q = edgeQuarterPoint(rows, side);
        const le = edgeLeadingPoint(rows, side);
        const te = edgeTrailingPoint(rows, side);
        // The quarter-chord point is exactly the unrotated anchor: the input
        // c/4 sweep, the dihedral line, and no incidence displacement at all.
        close(q[0], surface.xLeadingRootM + 0.25 * cr + Math.abs(y) * Math.tan(sweepDeg * Math.PI / 180), 1e-12);
        close(q[2], surface.zRootM + Math.abs(y) * Math.tan(dihedralDeg * Math.PI / 180), 1e-12);
        // Rigid rotation: chord length preserved, chord vector = c*(cos i, 0, -sin i).
        const chordVec = [te[0] - le[0], te[1] - le[1], te[2] - le[2]];
        const cEdge = cr + Math.abs(y) / (0.5 * b) * (ct - cr);
        close(Math.hypot(...chordVec), cEdge, 1e-12);
        close(chordVec[0] / cEdge, Math.cos(i), 1e-12);
        close(chordVec[2] / cEdge, -Math.sin(i), 1e-12);
        // q = LE + 0.25 (TE - LE): the rotation pivot is the local c/4 point.
        close(le[0] + 0.25 * chordVec[0], q[0], 1e-12);
        close(le[2] + 0.25 * chordVec[2], q[2], 1e-12);
        // Positive incidence raises the leading edge (nose-up, x aft / z up).
        assert.ok(incidenceDeg > 0 ? le[2] > q[2] : le[2] < q[2], `i=${incidenceDeg}: LE z must sit ${incidenceDeg > 0 ? "above" : "below"} the quarter chord`);
      }
    }
    // Control points: row k sits at chord fraction (k + 0.75)/M of the strip's
    // mean section. For the linear planform the mean section is the average of
    // the two edge sections, so the control point is fixed by measured edge data
    // alone: control = q_mid + ((k + 0.75)/M - 0.25) * c_mid * (cos i, 0, -sin i).
    for (let s = 0; s < n; s += 1) {
      const rows = panels.slice(s * m, s * m + m);
      const qL = edgeQuarterPoint(rows, "boundA"), qR = edgeQuarterPoint(rows, "boundB");
      const leL = edgeLeadingPoint(rows, "boundA"), teL = edgeTrailingPoint(rows, "boundA");
      const leR = edgeLeadingPoint(rows, "boundB"), teR = edgeTrailingPoint(rows, "boundB");
      const cMid = 0.5 * (Math.hypot(teL[0] - leL[0], teL[1] - leL[1], teL[2] - leL[2]) + Math.hypot(teR[0] - leR[0], teR[1] - leR[1], teR[2] - leR[2]));
      for (let k = 0; k < m; k += 1) {
        const f = (k + 0.75) / m;
        const expected = [
          0.5 * (qL[0] + qR[0]) + (f - 0.25) * cMid * Math.cos(i),
          0.5 * (qL[1] + qR[1]),
          0.5 * (qL[2] + qR[2]) + (f - 0.25) * cMid * -Math.sin(i)
        ];
        close(rows[k].controlPoint[0], expected[0], 1e-12);
        close(rows[k].controlPoint[1], expected[1], 1e-12);
        close(rows[k].controlPoint[2], expected[2], 1e-12);
      }
    }
  }
});

test("elliptic planform c/4 anchors are exact at incidence (M0-3, direct coordinates)", () => {
  // Absolute (non self-referential) anchor check for the curved planform: the
  // c/4 anchor sits on the input sweep/dihedral lines and the local chord is
  // c0 sqrt(1 - eta^2), with the section rigidly rotated about that anchor.
  for (const incidenceDeg of [-20, 0, 35]) {
    const i = incidenceDeg * Math.PI / 180;
    const b = 6, cr = 1.2, sweepDeg = 10, dihedralDeg = 2;
    const surface = createLiftingSurface({
      planform: "elliptic", spanM: b, rootChordM: cr, tipChordM: 0, sweepDeg, dihedralDeg,
      incidenceDeg, xLeadingRootM: 3.7, zRootM: -1.2
    });
    const m = 4, n = 16;
    const panels = generateVlmPanels([surface], { spanwisePanels: n, chordwiseRows: m });
    for (let s = 0; s < n; s += 1) {
      const rows = panels.slice(s * m, s * m + m);
      for (const side of ["boundA", "boundB"]) {
        const y = rows[0][side][1];
        const q = edgeQuarterPoint(rows, side);
        const le = edgeLeadingPoint(rows, side);
        const te = edgeTrailingPoint(rows, side);
        close(q[0], surface.xLeadingRootM + 0.25 * cr + Math.abs(y) * Math.tan(sweepDeg * Math.PI / 180), 1e-12);
        close(q[2], surface.zRootM + Math.abs(y) * Math.tan(dihedralDeg * Math.PI / 180), 1e-12);
        const chordVec = [te[0] - le[0], te[1] - le[1], te[2] - le[2]];
        const eta = Math.min(1, Math.abs(2 * y / b));
        const cEdge = cr * Math.sqrt(1 - eta * eta);
        close(Math.hypot(...chordVec), cEdge, 1e-12);
        close(le[0] + 0.25 * chordVec[0], q[0], 1e-12);
        close(le[2] + 0.25 * chordVec[2], q[2], 1e-12);
      }
    }
  }
});

test("panel normals at incidence are the rotated flat-plate normals (M0-3)", () => {
  // Rectangular unswept wing: the exact normal of the incidence-tilted plate is
  // (sin i, 0, cos i) (x aft, z up, nose-up positive incidence).
  for (const incidenceDeg of [-30, -5, 0, 5, 30]) {
    const i = incidenceDeg * Math.PI / 180;
    const panels = generateVlmPanels(
      [createLiftingSurface({ ...rectangularWing(), incidenceDeg })],
      { spanwisePanels: 8, chordwiseRows: 4 }
    );
    for (const panel of panels) {
      close(panel.normal[0], Math.sin(i), 1e-12);
      close(panel.normal[1], 0, 1e-12);
      close(panel.normal[2], Math.cos(i), 1e-12);
      close(Math.hypot(...panel.normal), 1, 1e-12);
    }
  }
});

test("multi-surface incidence keeps each surface's c/4 line at its own input sweep (M0-3)", () => {
  const wing = createLiftingSurface({
    name: "Main wing", spanM: 8, rootChordM: 1, tipChordM: 0.3, sweepDeg: 25,
    dihedralDeg: 4, incidenceDeg: 2, xLeadingRootM: 3.7, zRootM: -1.2
  });
  const tail = createLiftingSurface({
    name: "Horizontal tail", spanM: 3, rootChordM: 0.5, tipChordM: 0.35, sweepDeg: -12,
    dihedralDeg: 0, incidenceDeg: -3, xLeadingRootM: 12, zRootM: 1.4
  });
  const panels = generateVlmPanels([wing, tail], { spanwisePanels: 8, chordwiseRows: 4 });
  for (const [name, sweepDeg, spanM] of [["Main wing", 25, 8], ["Horizontal tail", -12, 3]]) {
    const own = panels.filter((p) => p.surfaceName === name);
    const m = 4, n = 8;
    const stations = [];
    for (let s = 0; s < n; s += 1) {
      const rows = own.slice(s * m, s * m + m);
      stations.push(edgeQuarterPoint(rows, "boundA"));
      if (s === n - 1) stations.push(edgeQuarterPoint(rows, "boundB"));
    }
    const origin = stations.reduce((best, p) => (Math.abs(p[1]) < Math.abs(best[1]) ? p : best));
    const tip = stations.reduce((best, p) => (Math.abs(p[1]) > Math.abs(best[1]) ? p : best));
    const measured = Math.atan((tip[0] - origin[0]) / (Math.abs(tip[1]) - Math.abs(origin[1]))) * 180 / Math.PI;
    assert.ok(Math.abs(measured - sweepDeg) <= 0.01,
      `${name}: measured c/4 sweep ${measured} deg must equal ${sweepDeg} deg within 0.01 deg`);
    // The span endpoints stay where the planform says (no cross-surface shift).
    close(Math.abs(tip[1]) - Math.abs(origin[1]), spanM / 2, 1e-12);
  }
});

test("negative geometric incidence produces negative lift at zero freestream alpha (M0-3)", () => {
  const result = solveVlmCase({
    surfaces: [createLiftingSurface({ ...rectangularWing(), incidenceDeg: -3 })],
    spanwisePanels: 16,
    alphaDeg: 0,
    velocityMS: 30,
    densityKgM3: 1.225,
    refAreaM2: 8,
    refChordM: 1,
    referencePoint: [0.25, 0, 0]
  });
  assert.ok(result.cl < -0.1, `expected negative CL, got ${result.cl}`);
});

test("elliptic planform chords follow c0 sqrt(1-eta^2) at the strip edges", () => {
  const surface = createLiftingSurface({ planform: "elliptic", spanM: 4, rootChordM: 1, tipChordM: 0, sweepDeg: 0, dihedralDeg: 0, xLeadingRootM: 0, zRootM: 0 });
  const m = 2;
  const n = 16;
  const panels = generateVlmPanels([surface], { spanwisePanels: n, chordwiseRows: m });
  const tip = panels[panels.length - 1];
  const etaMid = (2 * (tip.spanIndex + 0.5) / n) - 1;
  close(tip.chordM, Math.sqrt(1 - etaMid * etaMid), 1e-12);
  // Panel length is the chordwise extent at the mean chord: chord/M.
  close(tip.lengthM, tip.chordM / m, 1e-12);
});

test("wake length is at least 10 spans of the largest surface (B-VLM-07)", () => {
  const surfaces = [createLiftingSurface(rectangularWing())];
  const short = solveVlmCase({
    surfaces,
    spanwisePanels: 32,
    alphaDeg: 4,
    velocityMS: 30,
    densityKgM3: 1.225,
    refAreaM2: 8,
    refChordM: 1,
    referencePoint: [0.25, 0, 0],
    wakeLengthFactor: 2
  });
  assert.equal(short.diagnostics.wakeLengthM, 80);
  assert.equal(short.diagnostics.largestSurfaceSpanM, 8);
  const long = solveVlmCase({
    surfaces,
    spanwisePanels: 32,
    alphaDeg: 4,
    velocityMS: 30,
    densityKgM3: 1.225,
    refAreaM2: 8,
    refChordM: 1,
    referencePoint: [0.25, 0, 0],
    wakeLengthFactor: 2000
  });
  assert.equal(long.diagnostics.wakeLengthM, 2000);
});

test("R1 vs R2 resolution check reports the prescribed deltas and badge", () => {
  const check = runVlmResolutionCheck({
    surfaces: [{ spanM: 8, rootChordM: 1, tipChordM: 1, sweepDeg: 0, dihedralDeg: 0, xLeadingRootM: 0, zRootM: 0 }],
    velocityMS: 40,
    densityKgM3: 1.225,
    refAreaM2: 8,
    refChordM: 1,
    referencePoint: [0.25, 0, 0]
  });
  assert.equal(check.r1.label, "R1");
  assert.equal(check.r2.label, "R2");
  assert.equal(check.r1.resolution.label, "R1");
  assert.equal(check.r2.resolution.label, "R2");
  assert.ok(check.deltaClAlpha <= 0.01, `deltaC_Lalpha = ${check.deltaClAlpha} must be <= 1%`);
  assert.ok(check.deltaCdi <= 0.05, `deltaC_Di = ${check.deltaCdi} must be <= 5%`);
  // The badge follows the gates exactly (amber iff a gate is exceeded).
  assert.equal(check.badge, check.withinGates ? "green" : "amber");
  assert.equal(check.withinGates, check.deltaClAlpha <= check.gates.clAlpha && check.deltaCdi <= check.gates.cdi);
  assert.match(check.uncertaintyLabel, /unverified/);
});

test("partial-pivot solver returns a low-residual solution", () => {
  const solved = solveLinearSystem([Float64Array.from([3, 2]), Float64Array.from([1, 2])], Float64Array.from([5, 5]));
  close(solved.solution[0], 0);
  close(solved.solution[1], 2.5);
  assert.ok(solved.residual < 1e-12);
});

test("symmetric finite wing has linear lift slope", () => {
  const surface = createLiftingSurface(rectangularWing());
  const result = runVlmSweep(sweepOptions(surface, 32));
  const expectedSlope = 2 * Math.PI * 8 / (8 + 2);
  assert.ok(Math.abs(result.clAlphaPerRad - expectedSlope) / expectedSlope < 0.16, `${result.clAlphaPerRad} vs ${expectedSlope}`);
  assert.ok(result.diagnostics.worstResidual < 1e-7);
});

// DR-01 (M0-1): induced drag is the signed projection on the wake direction and
// the primary coefficient is the Trefftz value. These assertions hold at every
// resolution and would fail if Math.abs were reintroduced or the panel's own
// trailing legs were skipped again.
test("induced drag is signed, positive for both lift signs and zero at zero lift (M = 4 x 28)", () => {
  for (const alphaDeg of [-4, 0, 4]) {
    const result = solveVlmCase({
      surfaces: [createLiftingSurface(rectangularWing())],
      spanwisePanels: 28,
      alphaDeg,
      velocityMS: 30,
      densityKgM3: 1.225,
      refAreaM2: 8,
      refChordM: 1,
      referencePoint: [0.25, 0, 0],
      wakeLengthFactor: 80
    });
    assert.equal(result.cdi, result.cdiTrefftz);
    if (alphaDeg === 0) {
      assert.equal(result.inducedDragN, 0);
      assert.equal(result.trefftzDragN, 0);
    } else {
      assert.ok(result.inducedDragN > 0, `a=${alphaDeg}: near-field D = ${result.inducedDragN} must be > 0`);
      assert.ok(result.trefftzDragN > 0, `a=${alphaDeg}: Trefftz D = ${result.trefftzDragN} must be > 0`);
      const difference = Math.abs((result.inducedDragN - result.trefftzDragN) / result.trefftzDragN);
      assert.ok(difference <= 0.01, `a=${alphaDeg}: near-field vs Trefftz ${(difference * 100).toFixed(4)}% must be <= 1%`);
    }
  }
});

// DR-02 resolved (M0-2): on the multi-row lattice the quadratic induced-drag
// trend (cdi/cl^2 = 1/(pi AR e) = const in linear theory) holds at EVERY
// resolution. Pre-M0-2 the single-row cosine lattice showed spreads of
// 1.15 (N = 20) to 2.25 (N = 32) over alpha in [2, 8] deg (OBS-M0-1-1);
// measured now: 1.001-1.004 at R1, R2 and off-band counts. The threshold is
// the original, unweakened one.
test("quadratic induced drag trend holds across the multi-row lattice (DR-02 resolved)", () => {
  const surface = createLiftingSurface(rectangularWing());
  for (const [chordwiseRows, spanwisePanels] of [[4, 20], [4, 28], [4, 32], [8, 64]]) {
    const result = runVlmSweep(sweepOptions(surface, spanwisePanels, chordwiseRows));
    const positive = result.series.filter((point) => point.alphaDeg > 0);
    const ratios = positive.map((point) => point.cdi / (point.cl ** 2));
    assert.ok(ratios.every((ratio) => Number.isFinite(ratio) && ratio > 0));
    const spread = Math.max(...ratios) / Math.min(...ratios);
    assert.ok(spread < 1.35, `${chordwiseRows}x${spanwisePanels}: spread ${spread} must be < 1.35`);
    // Munk bound on every point that defines an Oswald factor.
    for (const point of positive) {
      const e = point.cl ** 2 / (Math.PI * 8 * point.cdi);
      assert.ok(e <= 1.07, `${chordwiseRows}x${spanwisePanels} a=${point.alphaDeg}: e = ${e.toFixed(4)} must respect the Munk bound e <= 1.07`);
    }
  }
});

test("zero-incidence symmetric wing produces approximately zero lift at zero alpha", () => {
  const result = solveVlmCase({
    surfaces: [createLiftingSurface(rectangularWing())],
    spanwisePanels: 16,
    alphaDeg: 0,
    velocityMS: 30,
    densityKgM3: 1.225,
    refAreaM2: 8,
    refChordM: 1,
    referencePoint: [0.25, 0, 0]
  });
  assert.ok(Math.abs(result.cl) < 1e-10);
});

test("positive geometric incidence produces positive lift at zero freestream alpha", () => {
  const result = solveVlmCase({
    surfaces: [createLiftingSurface({ ...rectangularWing(), incidenceDeg: 3 })],
    spanwisePanels: 16,
    alphaDeg: 0,
    velocityMS: 30,
    densityKgM3: 1.225,
    refAreaM2: 8,
    refChordM: 1,
    referencePoint: [0.25, 0, 0]
  });
  assert.ok(result.cl > 0.1, `expected positive CL, got ${result.cl}`);
});

// SOL-06: detection of a genuine negative drag is now bounded by the
// floating-point cancellation tolerance (never by qS): -1 N and -0.5 N against
// these O(10 N) term magnitudes are resolved and raise at any qS.
test("trefftzDrag raises a validity error on a negative reported drag", () => {
  const surface = createLiftingSurface(rectangularWing());
  const panels = generateVlmPanels([surface], { spanwisePanels: 8, chordwiseRows: 4 });
  const gamma = panels.map((_, index) => 2 + Math.sin(index));
  const ew = [1, 0, 0];
  assert.throws(
    () => trefftzDrag(panels, gamma, 1.225, ew, { nearFieldDragN: -1 }),
    /induced drag is negative/,
    "a negative reported drag must raise, never be abs-ed"
  );
  assert.throws(
    () => trefftzDrag(panels, gamma.map((value) => -value), 1.225, ew, { nearFieldDragN: -0.5 }),
    /induced drag is negative/
  );
  // Zero drag (zero lift) must NOT raise.
  const zero = trefftzDrag(panels, panels.map(() => 0), 1.225, ew, { nearFieldDragN: 0 });
  assert.equal(zero.dragNTrefftz, 0);
  assert.equal(zero.relativeDifference, 0);
});

// SOL-06 (supersedes OBS-M0-2-5): the zero case is validated by near-zero-lift
// PHYSICS, not by injected tiny scalars paired with an arbitrary nonzero Gamma.
// Injected scalars only demonstrate the explicit suppression path: a value
// inside the floating-point cancellation tolerance of the evaluated sum is
// reported as exactly 0 with a size-declared flag and its raw signed value
// preserved — identically at any qS. A resolved negative drag (here -20 N)
// still raises, also at any qS. The former floor (1e-6 * sum|terms|,
// 1e-9 * qS) is gone: qS never touches a dimensional value, a tolerance or
// sign detection.
test("zero-lift physics validates the zero case; unresolved drag is explicitly suppressed, genuine negative drag still raises", () => {
  const surface = createLiftingSurface(rectangularWing());
  const panels = generateVlmPanels([surface], { spanwisePanels: 8, chordwiseRows: 4 });
  const ew = [1, 0, 0];
  const qS = 0.5 * 1.225 * 72 * 72 * 124.659;
  // Physics zero case: zero circulation is exactly zero drag, and nothing is
  // "suppressed" (the raw value is 0 — no numerical resolution is involved).
  const zero = trefftzDrag(panels, panels.map(() => 0), 1.225, ew, { nearFieldDragN: 0, qS });
  assert.equal(zero.dragNTrefftz, 0);
  assert.equal(zero.dragNTrefftzRaw, 0);
  assert.equal(zero.dragNNearField, 0);
  assert.equal(zero.dragNNearFieldRaw, 0);
  assert.equal(zero.trefftzSuppression.suppressedToZero, false);
  assert.equal(zero.nearFieldSuppression.suppressedToZero, false);
  assert.equal(zero.relativeDifference, 0);
  // Physics near-zero case: the true tiny drag of a tiny but real lift is
  // REPORTED, not snapped to 0 (quadratic in alpha to solver precision).
  const tinyLift = { velocityMS: 40, densityKgM3: 1.225, refAreaM2: 8, refChordM: 1, referencePoint: [0.25, 0, 0] };
  const at001 = solveVlmCase({ ...tinyLift, surfaces: [rectangularWing()], spanwisePanels: 16, alphaDeg: 0.001 });
  const at01 = solveVlmCase({ ...tinyLift, surfaces: [rectangularWing()], spanwisePanels: 16, alphaDeg: 0.01 });
  assert.ok(at001.trefftzDragN > 0, `alpha = 0.001 deg must report its true tiny drag, got ${at001.trefftzDragN}`);
  assert.equal(at001.trefftzSuppression.suppressedToZero, false);
  assert.equal(at001.dragNTrefftzRaw, at001.trefftzDragN);
  const predicted = at01.trefftzDragN * (Math.sin(0.001 * Math.PI / 180) / Math.sin(0.01 * Math.PI / 180)) ** 2;
  assert.ok(Math.abs(at001.trefftzDragN - predicted) <= 1e-6 * predicted,
    `quadratic scaling: ${at001.trefftzDragN} vs ${predicted}`);
  // Injected tiny scalars: explicit, size-declared suppression only (raw kept).
  const gamma = panels.map((_, index) => 2 + Math.sin(index));
  for (const tiny of [-5e-29, -1e-15, 1e-15, 5e-29]) {
    for (const withQs of [undefined, qS, 1e12]) {
      const result = trefftzDrag(panels, gamma, 1.225, ew, withQs === undefined ? { nearFieldDragN: tiny } : { nearFieldDragN: tiny, qS: withQs });
      assert.equal(result.dragNNearField, 0, `${tiny} at qS ${withQs} must be unresolved and report exactly 0`);
      assert.equal(result.dragNNearFieldRaw, tiny, `${tiny}: the raw signed value must be preserved`);
      assert.equal(result.nearFieldSuppression.suppressedToZero, true);
      assert.ok(result.nearFieldSuppression.toleranceN > Math.abs(tiny), `${tiny}: the tolerance size must be declared`);
      assert.ok(result.nearFieldSuppression.reason.includes("dragNNearFieldRaw"), "the reason must name the raw field");
    }
  }
  // A genuine sign error (~20 N) is resolved at every qS — detection may not
  // depend on the reference area.
  for (const withQs of [undefined, qS, 1, 1e12]) {
    assert.throws(
      () => trefftzDrag(panels, gamma, 1.225, ew, withQs === undefined ? { nearFieldDragN: -20 } : { nearFieldDragN: -20, qS: withQs }),
      /induced drag is negative/,
      `negative drag must raise at qS ${withQs}`
    );
  }
  // The demo-shaped sweep crosses the incidence-cancelling alpha and must complete
  // with no negative drag anywhere.
  const wing = createLiftingSurface({
    name: "Main wing", spanM: 33.977, rootChordM: 5.435, tipChordM: 1.902,
    sweepDeg: 25, dihedralDeg: 4, incidenceDeg: 2, xLeadingRootM: 11.231, zRootM: 0
  });
  const tail = createLiftingSurface({
    name: "Horizontal tail", spanM: 8, rootChordM: 1.6, tipChordM: 1.0,
    sweepDeg: 0, dihedralDeg: 0, xLeadingRootM: 24, zRootM: 2
  });
  const sweep = runVlmSweep({
    surfaces: [wing, tail],
    spanwisePanels: "auto",
    chordwiseRows: 4,
    alphaMinDeg: -6,
    alphaMaxDeg: 10,
    alphaStepDeg: 1,
    velocityMS: 72,
    densityKgM3: 1.225,
    refAreaM2: 124.659,
    refChordM: 4.193,
    referencePoint: [0.3, 0, 0],
    cd0: 0.025,
    cm0: 0
  });
  assert.equal(sweep.series.length, 17);
  for (const point of sweep.series) {
    assert.ok(point.cdi >= 0, `a=${point.alphaDeg}: cdi = ${point.cdi} must be >= 0`);
    assert.ok(point.dragN >= 0, `a=${point.alphaDeg}: dragN = ${point.dragN} must be >= 0`);
    if (Math.abs(point.cl) < 1e-10) assert.equal(point.cdi, 0, `a=${point.alphaDeg}: zero lift must report exactly zero drag`);
  }
});

// ---------------------------------------------------------------------------
// M0-5 linear-window guard and fit/trim contract (SOL-09; matrix VLM-V7/V8;
// DATA_CONTRACTS §2.5). See tests/solFindings.test.mjs for the frozen review
// counterexamples and the trim gates; these are the matrix rows.
// ---------------------------------------------------------------------------

test("VLM-V7: a sweep with alpha outside the fit window reports 'insufficient linear data' — no NaN, no 'Unstable'", () => {
  const sweep = runVlmSweep({
    surfaces: [createLiftingSurface(rectangularWing())],
    spanwisePanels: 32,
    chordwiseRows: 4,
    alphaMinDeg: 6,
    alphaMaxDeg: 12,
    alphaStepDeg: 2,
    betaDeg: 0,
    velocityMS: 40,
    densityKgM3: 1.225,
    refAreaM2: 8,
    refChordM: 1,
    referencePoint: [0.25, 0, 0],
    cd0: 0
  });
  assert.match(sweep.fit.messages.join(" "), /insufficient linear data/);
  for (const key of ["clAlphaPerRad", "cmAlphaPerRad", "staticMargin", "neutralPointXM", "trimAlphaDeg"]) {
    assert.equal(sweep[key], null, `${key} must be null, never NaN or a silent zero`);
  }
  // No bare verdict claim exists at the source: the solver exposes only
  // stabilityVerdict (gated) and cmSlopeNegative (a slope fact).
  assert.equal(sweep.stable, undefined, "the bare verdict boolean must not exist");
  assert.equal(sweep.cmSlopeNegative, null);
  assert.equal(sweep.stabilityVerdict.verdict, null);
  assert.equal(sweep.stabilityVerdict.status, "not determined");
  assert.ok(sweep.stabilityVerdict.unmetConditions.length > 0);
  assert.equal(sweep.validity.status, "warning");
});

test("VLM-V7: a two-point fit window is rejected (negative/edge)", () => {
  const sweep = runVlmSweep({
    surfaces: [createLiftingSurface(rectangularWing())],
    spanwisePanels: 32,
    chordwiseRows: 4,
    alphaMinDeg: 0,
    alphaMaxDeg: 4,
    alphaStepDeg: 4,
    betaDeg: 0,
    velocityMS: 40,
    densityKgM3: 1.225,
    refAreaM2: 8,
    refChordM: 1,
    referencePoint: [0.25, 0, 0],
    cd0: 0
  });
  assert.equal(sweep.fit.convergedPointsInWindow, 2);
  assert.equal(sweep.fit.status, "insufficient linear data");
  assert.equal(sweep.clAlphaPerRad, null);
  assert.equal(sweep.cmSlopeNegative, null);
  assert.equal(sweep.stabilityVerdict.verdict, null);
});

test("VLM-V8: the bounds-seed placeholder reference yields validity = warning with a message, values unchanged", () => {
  // Reference at the leading-edge station and a -4..4 deg sweep give a fully
  // determined fit on an "ok" baseline, so the seed warning is a real STATUS
  // FLIP (not masked by an unrelated warning) and the derived fields — which
  // consume the converged-point filter the per-point warning feeds — can be
  // compared for exact equality.
  const base = {
    surfaces: [createLiftingSurface(rectangularWing())],
    spanwisePanels: 32,
    chordwiseRows: 4,
    alphaMinDeg: -4,
    alphaMaxDeg: 4,
    alphaStepDeg: 2,
    betaDeg: 0,
    velocityMS: 40,
    densityKgM3: 1.225,
    refAreaM2: 8,
    refChordM: 1,
    referencePoint: [0, 0, 0],
    cd0: 0
  };
  const clean = runVlmSweep({ ...base });
  assert.equal(clean.validity.status, "ok", clean.validity.messages.join(" | "));
  assert.ok(!clean.validity.messages.join(" ").includes("VLM-V8"), "no seed, no placeholder warning");
  const seeded = runVlmSweep({ ...base, seedReferencePlaceholder: true });
  assert.equal(seeded.validity.status, "warning");
  assert.match(seeded.validity.messages.join(" "), /VLM-V8/);
  assert.match(seeded.validity.messages.join(" "), /placeholder/);
  // The warning is a validity flag only: no computed value may change, and a
  // warning-level point must still COUNT as converged for the fits.
  assert.equal(seeded.fit.convergedPointsInWindow, clean.fit.convergedPointsInWindow);
  assert.deepEqual(seeded.series.map((p) => p.cl), clean.series.map((p) => p.cl));
  for (const field of ["clAlphaPerRad", "cmAlphaPerRad", "staticMargin", "neutralPointXM", "trimAlphaDeg"]) {
    assert.deepEqual(seeded[field], clean[field], `${field} must be identical seeded vs clean`);
  }
  assert.deepEqual(seeded.fit.cl, clean.fit.cl);
  assert.deepEqual(seeded.fit.cm, clean.fit.cm);
});

test("VLM-V7: the 5 % adjacent-pair slope band is pinned at its boundary (fit contract primitive)", () => {
  // The contract constants are asserted outright: widening the band or
  // lowering the point floor must fail here, not slip through physics-shaped
  // tests whose measured deviations sit far from the boundary.
  assert.equal(FIT_WINDOW_MAX_ABS_ALPHA_DEG, 5);
  assert.equal(FIT_MIN_CONVERGED_POINTS, 3);
  assert.equal(FIT_ADJACENT_SLOPE_TOLERANCE, 0.05);
  assert.equal(FIT_STATUS_DETERMINED, "determined");
  assert.equal(FIT_STATUS_INSUFFICIENT, "insufficient linear data");
  assert.equal(FIT_STATUS_NONLINEAR, "non-linear: not determined");
  // Synthetic windows on x = 0, 1, 2 with pair slopes 1-d and 1+d: the
  // least-squares slope is exactly 1 and the worst adjacent-pair deviation is
  // exactly d, so the rule "deviation <= 5 % of the least-squares slope" is
  // exercised exactly at its boundary — solver data cannot reach these
  // corners. (d = 0.04 also discriminates the implemented rule from the
  // weaker "pair slopes within 5 % of each other", which would reject it.)
  const window = (d) => [{ alphaDeg: 0, cl: 0 }, { alphaDeg: 1, cl: 1 - d }, { alphaDeg: 2, cl: 2 }];
  for (const d of [0, 0.04, 0.049]) {
    const fit = linearFit(window(d), "cl");
    assert.equal(fit.status, FIT_STATUS_DETERMINED, `d = ${d} is inside the 5 % band`);
    assert.ok(Math.abs(fit.slopePerDeg - 1) <= 1e-12, `d = ${d}: LSQ slope is 1 to roundoff`);
  }
  for (const d of [0.051, 0.1, 0.34]) {
    const fit = linearFit(window(d), "cl");
    assert.equal(fit.status, FIT_STATUS_NONLINEAR, `d = ${d} is outside the 5 % band`);
    assert.equal(fit.slopePerDeg, null, "an uncertified record never carries a usable derivative");
    assert.equal(fit.intercept, null);
    assert.ok(Math.abs(fit.leastSquaresSlopePerDeg - 1) <= 1e-12, "diagnostic slope retained for the report");
  }
  // Point floor: a two-point window is "insufficient linear data" even when
  // perfectly linear; nothing derivative-shaped is populated.
  const twoPoint = linearFit([{ alphaDeg: 0, cl: 0 }, { alphaDeg: 1, cl: 1 }], "cl");
  assert.equal(twoPoint.status, FIT_STATUS_INSUFFICIENT);
  assert.equal(twoPoint.pointCount, 2);
  assert.equal(twoPoint.slopePerDeg, null);
  assert.equal(twoPoint.leastSquaresSlopePerDeg, null);
  // Fitted intercept (meanY - slope*meanX), NOT a sampled neighbour of
  // alpha = 0: y = 2x + 1 sampled at x = 1, 2, 3 has fitted intercept 1 while
  // the nearest sample carries y = 3.
  const shifted = linearFit([{ alphaDeg: 1, cl: 3 }, { alphaDeg: 2, cl: 5 }, { alphaDeg: 3, cl: 7 }], "cl");
  assert.equal(shifted.status, FIT_STATUS_DETERMINED);
  assert.equal(shifted.slopePerDeg, 2);
  assert.equal(shifted.intercept, 1);
  // Documented semantics for a flat window (DEC-M0-5-1 notes): all pair slopes
  // equal the LSQ slope 0, so the linearity test passes and the DERIVATIVE is
  // certified as exactly 0 — the derived trim/verdict stay "not determined"
  // through the separate FIT_EPSILON degeneracy check, never a silent verdict.
  const flat = linearFit([{ alphaDeg: 0, cl: 7 }, { alphaDeg: 1, cl: 7 }, { alphaDeg: 2, cl: 7 }], "cl");
  assert.equal(flat.status, FIT_STATUS_DETERMINED);
  assert.equal(flat.slopePerDeg, 0);
  assert.equal(flat.intercept, 7);
  // Zero LSQ slope with varying data: the 5 % band is relative, so its width
  // is zero at slope 0 and any variation is non-linear (recorded limitation:
  // the relative band degenerates at exactly-zero slope).
  const zeroSlope = linearFit([{ alphaDeg: 0, cl: 0 }, { alphaDeg: 1, cl: -1 }, { alphaDeg: 2, cl: 0 }], "cl");
  assert.equal(zeroSlope.status, FIT_STATUS_NONLINEAR);
  // Degenerate abscissae (no x spread) cannot support any slope: the FIT_
  // EPSILON denominator guard forces slope 0 and the data is judged against
  // it (recorded limitation, reachable only through this primitive).
  const degenerateX = linearFit([{ alphaDeg: 1, cl: 0 }, { alphaDeg: 1, cl: 1 }, { alphaDeg: 1, cl: 2 }], "cl");
  assert.equal(degenerateX.leastSquaresSlopePerDeg, 0);
  assert.equal(degenerateX.slopePerDeg, null);
  assert.notEqual(degenerateX.status, FIT_STATUS_DETERMINED);
});

test("VLM-V7: the stability verdict obeys the DATA_CONTRACTS 2.5 rule set — no bare 'Unstable' at the source", () => {
  const base = {
    surfaces: [createLiftingSurface(rectangularWing())],
    spanwisePanels: 32,
    chordwiseRows: 4,
    alphaMinDeg: -4,
    alphaMaxDeg: 4,
    alphaStepDeg: 2,
    betaDeg: 0,
    velocityMS: 40,
    densityKgM3: 1.225,
    refAreaM2: 8,
    refChordM: 1,
    referencePoint: [0, 0, 0],
    cd0: 0
  };
  const evidence = { horizontalStabilizerPresent: true, massSource: "weighed", modelDescription: "test model description" };
  // Certified, non-degenerate slopes AND the complete contract evidence: this
  // is the only way a verdict may exist.
  const verdict = runVlmSweep({ ...base, verdictInputs: evidence });
  assert.equal(verdict.fit.status, "determined");
  assert.equal(verdict.stabilityVerdict.status, "determined");
  assert.equal(verdict.stabilityVerdict.verdict, "statically stable");
  assert.equal(verdict.stabilityVerdict.modelDescription, "test model description");
  assert.deepEqual(verdict.stabilityVerdict.unmetConditions, []);
  // cmSlopeNegative is the exposed slope FACT, never a verdict.
  assert.equal(verdict.cmSlopeNegative, true);
  assert.equal(verdict.stable, undefined, "the bare verdict boolean must not exist");
  // Each missing condition withholds the verdict and names itself.
  const noTail = runVlmSweep({ ...base, verdictInputs: { ...evidence, horizontalStabilizerPresent: false } });
  assert.equal(noTail.stabilityVerdict.verdict, null);
  assert.match(noTail.stabilityVerdict.unmetConditions.join(" "), /wing-alone/);
  const assumedMass = runVlmSweep({ ...base, verdictInputs: { ...evidence, massSource: "assumedUniform" } });
  assert.equal(assumedMass.stabilityVerdict.verdict, null);
  assert.match(assumedMass.stabilityVerdict.unmetConditions.join(" "), /assumed uniform-density lump/);
  const noDescription = runVlmSweep({ ...base, verdictInputs: { horizontalStabilizerPresent: true, massSource: "weighed" } });
  assert.equal(noDescription.stabilityVerdict.verdict, null);
  assert.match(noDescription.stabilityVerdict.unmetConditions.join(" "), /model description/);
  const noEvidence = runVlmSweep(base);
  assert.equal(noEvidence.stabilityVerdict.status, "not determined");
  assert.equal(noEvidence.stabilityVerdict.verdict, null);
  // Even complete evidence cannot produce a verdict from an undetermined fit.
  const nonLinear = runVlmSweep({
    ...base,
    alphaMinDeg: 6,
    alphaMaxDeg: 12,
    alphaStepDeg: 2,
    verdictInputs: evidence
  });
  assert.equal(nonLinear.stabilityVerdict.verdict, null);
  assert.match(nonLinear.stabilityVerdict.unmetConditions.join(" "), /linearity/);
});

function sweepOptions(surface, spanwisePanels, chordwiseRows = 4) {
  return {
    surfaces: [surface],
    spanwisePanels,
    chordwiseRows,
    alphaMinDeg: -4,
    alphaMaxDeg: 8,
    alphaStepDeg: 2,
    betaDeg: 0,
    velocityMS: 40,
    densityKgM3: 1.225,
    refAreaM2: 8,
    refChordM: 1,
    referencePoint: [0.25, 0, 0],
    cd0: 0
  };
}

function rectangularWing() {
  return { spanM: 8, rootChordM: 1, tipChordM: 1, sweepDeg: 0, dihedralDeg: 0, xLeadingRootM: 0, zRootM: 0 };
}

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} not within ${tolerance} of ${expected}`);
}
