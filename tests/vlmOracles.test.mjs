// M0-1/M0-2 independent verification of the VLM (DR-01, RB-03, DR-02).
//
// Every oracle below is implemented here, from the approved mathematical contract
// (DATA_CONTRACTS §2.7, IMPLEMENTATION_HANDOFF §3.1-3.4), with its own vector /
// complex arithmetic. The oracles never call the module under test: the module is
// imported only to run the code under test, and its outputs are compared against
// the oracles. The Glauert lifting-line and Helmbold-DATCOM references are fully
// independent physics references, so agreement is not shared-error
// self-consistency.
//
// Gates (VALIDATION_AND_TEST_MATRIX, unweakened), re-measured on the multi-row
// lattice at the prescribed resolutions R1 = (8 ceil(AR/2) x 4) and
// R2 = (16 ceil(AR/2) x 8) per DEC-M0-1-3:
//   VLM-V1  : C_Lalpha vs Glauert lifting line <= 5 % at R2 (AR >= 5 gated).
//   VLM-V1b : C_Lalpha vs Helmbold-DATCOM <= 5 % for swept/tapered wings.
//   VLM-V2  : D > 0; C_Di(VLM)/C_Di(LLT) at matched C_L in [0.90, 1.05];
//             e in [0.90, 1.02]; Munk bound e <= 1.07; raw near-field D >= 0.
//   VLM-V2b : unswept planar wing, wake >= 10 b: near-field vs Trefftz <= 1 %.
//   VLM-V2c : wing + H-tail, wake >= 10 b: <= 1 % (general form); the y-only
//             form must FAIL this test, i.e. exceed the 1 % gate (detection check).
//   VLM-V2d : elliptic planform, N >= 32: e in [0.99, 1.07]; D > 0.
//   VLM-V3  : R1 -> R2: delta C_Lalpha <= 1 %, delta C_Di <= 5 %;
//             a single-row lattice with width/chord < 0.25 is refused by the guard.

import test from "node:test";
import assert from "node:assert/strict";
import { createLiftingSurface, solveVlmCase, trefftzDrag, inducedVelocityFiniteSegment, autoSpanwisePanels } from "../src/vlmSolver.js";

// ---------------------------------------------------------------------------
// Oracle 1: general transverse-plane (Trefftz) drag, implemented independently
// in the complex 2-D crossflow plane (contract: IMPLEMENTATION_HANDOFF §3.1).
// ---------------------------------------------------------------------------

function basis(ew) {
  const ref = Math.abs(ew[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = norm(cross(ref, ew));
  const e2 = cross(ew, e1);
  return { e1, e2 };
}

function trefftzOracle(panels, gamma, rho, ew, mode = "general") {
  const { e1, e2 } = basis(ew);
  const legs = [];
  for (let j = 0; j < panels.length; j += 1) {
    // Trailing legs: s = -1 at boundA (traversed upstream), s = +1 at boundB.
    legs.push({ z0: complexProj(panels[j].boundA, e1, e2), strength: -gamma[j], y: panels[j].boundA[1] });
    legs.push({ z0: complexProj(panels[j].boundB, e1, e2), strength: gamma[j], y: panels[j].boundB[1] });
  }
  let drag = 0;
  for (let i = 0; i < panels.length; i += 1) {
    const z = complexProj(panels[i].boundMidpoint, e1, e2);
    const arm = cross([panels[i].boundB[0] - panels[i].boundA[0], panels[i].boundB[1] - panels[i].boundA[1], panels[i].boundB[2] - panels[i].boundA[2]], ew);
    const armU = dot(arm, e1);
    const armV = dot(arm, e2);
    let u = 0;
    let v = 0;
    for (const leg of legs) {
      // 2-D point vortex: U = u + i v = i * strength / (2 pi conj(z - z0)).
      let dz;
      if (mode === "general") {
        dz = [z[0] - leg.z0[0], z[1] - leg.z0[1]];
      } else {
        // Deliberately defective y-only variant: every leg is assumed to lie on
        // a single y-line; only y separation enters (RB-03 detection check).
        const ry = [0, panels[i].boundMidpoint[1] - leg.y, 0];
        const along = dot(ry, ew);
        const rp = [ry[0] - along * ew[0], ry[1] - along * ew[1], ry[2] - along * ew[2]];
        dz = [dot(rp, e1), dot(rp, e2)];
      }
      const r2 = dz[0] * dz[0] + dz[1] * dz[1];
      if (r2 < 1e-300) continue;
      // i * s / (2 pi conj(dz)) = i * s * dz / (2 pi |dz|^2)
      const factor = leg.strength / (2 * Math.PI * r2);
      u += factor * -dz[1];
      v += factor * dz[0];
    }
    drag += 0.5 * rho * gamma[i] * (u * armU + v * armV);
  }
  return drag;
}

function complexProj(p, e1, e2) { return [dot(p, e1), dot(p, e2)]; }

// ---------------------------------------------------------------------------
// Oracle 2: near-field Kutta-Joukowski drag with self trailing legs, written
// with the algebraically alternative Biot-Savart arrangement
//   v = (G/4pi) (r1 x r2) (|r1|+|r2|) / (|r1||r2| (|r1||r2| + r1.r2))
// so a shared implementation error with the module is unlikely.
// ---------------------------------------------------------------------------

function nearFieldOracle(panels, gamma, rho, ew, wakeLength) {
  let drag = 0;
  for (let i = 0; i < panels.length; i += 1) {
    const m = panels[i].boundMidpoint;
    let v = [0, 0, 0];
    for (let j = 0; j < panels.length; j += 1) {
      const wakeA = [panels[j].boundA[0] + ew[0] * wakeLength, panels[j].boundA[1] + ew[1] * wakeLength, panels[j].boundA[2] + ew[2] * wakeLength];
      const wakeB = [panels[j].boundB[0] + ew[0] * wakeLength, panels[j].boundB[1] + ew[1] * wakeLength, panels[j].boundB[2] + ew[2] * wakeLength];
      v = add(v, segment(m, wakeA, panels[j].boundA, gamma[j]));
      if (j !== i) v = add(v, segment(m, panels[j].boundA, panels[j].boundB, gamma[j]));
      v = add(v, segment(m, panels[j].boundB, wakeB, gamma[j]));
    }
    const arm = cross([panels[i].boundB[0] - panels[i].boundA[0], panels[i].boundB[1] - panels[i].boundA[1], panels[i].boundB[2] - panels[i].boundA[2]], ew);
    drag += rho * gamma[i] * dot(v, arm);
  }
  return drag;
}

function segment(p, start, end, strength) {
  const r1 = [p[0] - start[0], p[1] - start[1], p[2] - start[2]];
  const r2 = [p[0] - end[0], p[1] - end[1], p[2] - end[2]];
  const c = cross(r1, r2);
  const n1 = Math.sqrt(dot(r1, r1));
  const n2 = Math.sqrt(dot(r2, r2));
  const denom = n1 * n2 * (n1 * n2 + dot(r1, r2));
  if (Math.abs(denom) < 1e-300) return [0, 0, 0];
  const factor = strength * (n1 + n2) / (4 * Math.PI * denom);
  return [c[0] * factor, c[1] * factor, c[2] * factor];
}

// ---------------------------------------------------------------------------
// Oracle 3: Glauert lifting line (rectangular, a0 = 2 pi, symmetric) —
// IMPLEMENTATION_HANDOFF §3.2. Fully independent classical reference.
// ---------------------------------------------------------------------------

function glauertLlt(AR, alphaRad, M = 60) {
  const mu = 2 * Math.PI / (4 * AR);
  const n = M;
  const a = Array.from({ length: n }, () => new Float64Array(n));
  const b = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const theta = (i + 0.5) * Math.PI / (2 * M);
    b[i] = mu * alphaRad;
    let k = 0;
    for (let m = 1; m <= 2 * M - 1; m += 2) {
      a[i][k] = Math.sin(m * theta) * (1 + mu * m / Math.sin(theta));
      k += 1;
    }
  }
  for (let c = 0; c < n; c += 1) {
    let pivot = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    [b[c], b[pivot]] = [b[pivot], b[c]];
    for (let r = c + 1; r < n; r += 1) {
      const f = a[r][c] / a[c][c];
      for (let k = c; k < n; k += 1) a[r][k] -= f * a[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r -= 1) {
    let v = b[r];
    for (let k = r + 1; k < n; k += 1) v -= a[r][k] * x[k];
    x[r] = v / a[r][r];
  }
  let cdi = 0;
  let k = 0;
  for (let m = 1; m <= 2 * M - 1; m += 2) {
    cdi += m * x[k] * x[k];
    k += 1;
  }
  return { cl: Math.PI * AR * x[0], cdi: Math.PI * AR * cdi };
}

// ---------------------------------------------------------------------------
// Oracle 4: Helmbold-DATCOM swept-wing lift slope (IMPLEMENTATION_HANDOFF
// §3.4): C_Lalpha = 2 pi AR / (2 + sqrt(4 + AR^2 (1 + tan^2 Lambda_{c/2}))).
// Lambda_{c/2} is the half-chord-line sweep of the generated geometry:
// tan Lambda_{c/2} = tan Lambda_{c/4} - (c_r - c_t)/(2b).
// ---------------------------------------------------------------------------

function helmboldClAlpha(AR, sweepQuarterDeg, rootChord, tipChord, span) {
  const tanHalf = Math.tan(sweepQuarterDeg * Math.PI / 180) - (rootChord - tipChord) / (2 * span);
  return 2 * Math.PI * AR / (2 + Math.sqrt(4 + AR * AR * (1 + tanHalf * tanHalf)));
}

// ---------------------------------------------------------------------------
// Case helpers (module usage is limited to creating and solving cases).
// ---------------------------------------------------------------------------

const RHO = 1.225;
const V = 40;

function rectangularWing(span, chord, extra = {}) {
  return createLiftingSurface({ spanM: span, rootChordM: chord, tipChordM: chord, sweepDeg: 0, dihedralDeg: 0, xLeadingRootM: 0, zRootM: 0, ...extra }, { name: "Wing" });
}

function wingCase({ span = 8, chord = 1, alphaDeg, m = 4, n = "auto", tail = null, wakeSpans = 10 }) {
  const surfaces = [rectangularWing(span, chord)];
  if (tail) surfaces.push(createLiftingSurface(tail, { name: "Tail" }));
  return solveVlmCase({
    surfaces,
    chordwiseRows: m,
    spanwisePanels: n,
    alphaDeg,
    betaDeg: 0,
    velocityMS: V,
    densityKgM3: RHO,
    refAreaM2: span * chord,
    refChordM: chord,
    referencePoint: [0.25, 0, 0],
    wakeLengthFactor: wakeSpans * span / chord
  });
}

function unitWake(alphaDeg) {
  const a = alphaDeg * Math.PI / 180;
  return [Math.cos(a), 0, Math.sin(a)];
}

// Illinois regula-falsi on alpha -> C_L(alpha) - C_L target (flat plate: one
// monotone root). Returns the solution at matched C_L.
function matchCl(params, targetCl) {
  let lo = 0.5;
  let hi = 12;
  let flo = wingCase({ ...params, alphaDeg: lo }).cl - targetCl;
  let fhi = wingCase({ ...params, alphaDeg: hi }).cl - targetCl;
  assert.ok(flo < 0 && fhi > 0, "C_L target must be bracketed");
  let lastReplaced;
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const mid = (lo * fhi - hi * flo) / (fhi - flo);
    const result = wingCase({ ...params, alphaDeg: mid });
    const fmid = result.cl - targetCl;
    if (Math.abs(fmid) < 1e-12 || hi - lo < 1e-9) return result;
    // Illinois downweights a stationary endpoint only after it stays in place
    // twice in a row. Halving on every update slows even alternating steps.
    if (fmid < 0) {
      lo = mid;
      flo = fmid;
      if (lastReplaced === "lo") fhi /= 2;
      lastReplaced = "lo";
    } else {
      hi = mid;
      fhi = fmid;
      if (lastReplaced === "hi") flo /= 2;
      lastReplaced = "hi";
    }
  }
  assert.fail("C_L target did not converge in 30 iterations");
}

// ===========================================================================
// Tests
// ===========================================================================

test("oracle self-check: Glauert lifting-line reproduces the documented C_Lalpha values", () => {
  for (const [AR, expected] of [[6, 4.5304], [8, 4.8377], [12, 5.1991]]) {
    const { cl } = glauertLlt(AR, 4 * Math.PI / 180);
    const clAlpha = cl / (4 * Math.PI / 180);
    assert.ok(Math.abs(clAlpha - expected) < 1e-3, `AR ${AR}: ${clAlpha} vs ${expected}`);
  }
});

// The approved coordinator measurements (adversarial review record §4) are the
// reference the M0-2 lattice was built to reproduce. C_Lalpha and the panel
// width/length statistics are asserted against the record; the record's e
// columns are re-measured separately (OBS-M0-2-1) and gated on the physics
// references in VLM-V2/VLM-V2d below.
test("review record §4 reproduction: multi-row C_Lalpha and panel ratios match the coordinator measurements", () => {
  const alpha = 4 * Math.PI / 180;
  // Rectangular wings at the record protocol (alpha = 4 deg, wake 2000 c).
  const reviewRect = {
    4: { R1: [3.8263, 4, 16], R2: [3.8036, 8, 32] },
    6: { R1: [4.3680, 4, 24], R2: [4.3521, 8, 48] },
    8: { R1: [4.7045, 4, 32], R2: [4.6922, 8, 64] },
    12: { R1: [5.1020, 4, 48], R2: [5.0936, 8, 96] }
  };
  for (const AR of [4, 6, 8, 12]) {
    for (const tag of ["R1", "R2"]) {
      const [expected, m, n] = reviewRect[AR][tag];
      const r = wingCase({ span: AR, chord: 1, alphaDeg: 4, m, n, wakeSpans: 2000 });
      const clAlpha = r.cl / alpha;
      assert.ok(Math.abs(clAlpha - expected) <= 2e-4, `AR ${AR} ${tag}: C_Lalpha ${clAlpha.toFixed(4)} vs record ${expected}`);
    }
  }
  // Elliptic planform: C_Lalpha and the record's panel width/length min-max.
  const reviewElliptic = {
    "6,16x4": [4.6113, 1.18, 3.39],
    "6,32x4": [4.5073, 0.59, 2.37],
    "6,64x8": [4.4830, 0.59, 3.35],
    "8,16x4": [5.0119, 1.57, 4.51],
    "8,32x4": [4.8937, 0.79, 3.17],
    "8,64x8": [4.8648, 0.79, 4.46]
  };
  for (const AR of [6, 8]) {
    const b = Math.PI * AR / 4;
    for (const [m, n] of [[4, 16], [4, 32], [8, 64]]) {
      const [expected, minRatio, maxRatio] = reviewElliptic[`${AR},${n}x${m}`];
      const r = solveVlmCase({
        surfaces: [createLiftingSurface({ planform: "elliptic", spanM: b, rootChordM: 1, tipChordM: 0, sweepDeg: 0, dihedralDeg: 0, xLeadingRootM: 0, zRootM: 0 })],
        chordwiseRows: m,
        spanwisePanels: n,
        alphaDeg: 4,
        velocityMS: V,
        densityKgM3: RHO,
        refAreaM2: Math.PI / 4 * b,
        refChordM: 1,
        referencePoint: [0.25, 0, 0],
        wakeLengthFactor: 2000
      });
      const clAlpha = r.cl / alpha;
      assert.ok(Math.abs(clAlpha - expected) <= 2e-4, `elliptic AR ${AR} ${n}x${m}: C_Lalpha ${clAlpha.toFixed(4)} vs record ${expected}`);
      assert.ok(Math.abs(r.diagnostics.minPanelAspectRatio - minRatio) <= 0.006, `min ratio ${r.diagnostics.minPanelAspectRatio} vs record ${minRatio}`);
      assert.ok(Math.abs(r.diagnostics.maxPanelAspectRatio - maxRatio) <= 0.006, `max ratio ${r.diagnostics.maxPanelAspectRatio} vs record ${maxRatio}`);
    }
  }
});

// The single-row record is reproduced from an independently constructed lattice
// (the guard refuses these width/chord < 0.25 lattices for solver use). This
// pins the AIC, force loop, wake protocol and drag formulas to the approved
// measurements to the record's 4-decimal precision.
test("review record §4 reproduction: single-row table from an independently built lattice", () => {
  const alpha = 4 * Math.PI / 180;
  const review = [
    [4, 32, 3.7319, 1.0190],
    [4, 64, 3.7450, 0.9903],
    [4, 128, 3.7592, 0.9371],
    [8, 32, 4.6687, 1.0008]
  ];
  for (const [AR, n, expectedClAlpha, expectedE] of review) {
    const b = AR;
    const panels = [];
    for (let i = 0; i < n; i += 1) {
      const y0 = -b / 2 + b * i / n;
      const y1 = -b / 2 + b * (i + 1) / n;
      const ym = (y0 + y1) / 2;
      panels.push({
        surfaceName: "Wing", spanIndex: i, chordIndex: 0, y0, y1,
        widthM: y1 - y0, lengthM: 1, widthLengthRatio: y1 - y0, chordM: 1,
        boundA: [0.25, y0, 0], boundB: [0.25, y1, 0], boundMidpoint: [0.25, ym, 0],
        controlPoint: [0.75, ym, 0], normal: [0, 0, 1]
      });
    }
    const r = solveVlmCase({ panels, alphaDeg: 4, velocityMS: V, densityKgM3: RHO, refAreaM2: AR, refChordM: 1, referencePoint: [0.25, 0, 0], wakeLengthFactor: 2000 });
    const clAlpha = r.cl / alpha;
    const e = r.cl * r.cl / (Math.PI * AR * r.cdi);
    assert.ok(Math.abs(clAlpha - expectedClAlpha) <= 5e-4, `AR ${AR} N=${n}: C_Lalpha ${clAlpha.toFixed(4)} vs record ${expectedClAlpha}`);
    assert.ok(Math.abs(e - expectedE) <= 5e-4, `AR ${AR} N=${n}: e ${e.toFixed(4)} vs record ${expectedE}`);
  }
});

test("VLM-V1: C_Lalpha matches Glauert lifting-line within 5% at R2 (AR >= 5)", () => {
  const alpha = 4 * Math.PI / 180;
  for (const AR of [4, 6, 8, 12]) {
    const llt = glauertLlt(AR, alpha);
    const result = wingCase({ span: AR, chord: 1, alphaDeg: 4, m: 8, n: 16 * Math.ceil(AR / 2) });
    const clAlpha = result.cl / alpha;
    const difference = (clAlpha / (llt.cl / alpha) - 1);
    if (AR < 5) {
      // AR 4 is reported, not gated (LLT invalid below AR ~5).
      assert.ok(result.trefftzDragN > 0, `AR ${AR}: D > 0`);
      continue;
    }
    assert.ok(Math.abs(difference) <= 0.05, `AR ${AR}: C_Lalpha ${clAlpha.toFixed(4)} vs LLT ${(llt.cl / alpha).toFixed(4)} = ${(difference * 100).toFixed(2)}% must lie within 5%`);
  }
});

test("VLM-V2: Trefftz C_Di matches lifting-line C_Di at matched C_L (AR 6, 8, 12 at R2)", () => {
  // DEC-M0-1-3 re-measurement on the prescribed lattice; gates unweakened and
  // asserted in their specified domain ("AR in {6, 8, 12} at R2").
  // Measured at R2: ratio 0.948-0.951, e 0.953-1.007.
  // At R1 (reported here, not gated: the matrix domain is R2) the coarser
  // lattice carries a larger discretisation bias: ratio 0.930-0.940,
  // e 0.965-1.026 (OBS-M0-2-1), trending toward e_LLT (0.954/0.937/0.907).
  for (const AR of [6, 8, 12]) {
    const span = 8;
    const chord = span / AR;
    const llt = glauertLlt(AR, 4 * Math.PI / 180);
    for (const [m, n, gated] of [[4, 8 * Math.ceil(AR / 2), false], [8, 16 * Math.ceil(AR / 2), true]]) {
      const match = matchCl({ span, chord, m, n, wakeSpans: 10 }, llt.cl);
      const ratio = match.cdi / llt.cdi;
      const e = match.cl * match.cl / (Math.PI * AR * match.cdi);
      const label = `AR ${AR} ${m}x${n}${gated ? " R2" : " R1"}: ratio=${ratio.toFixed(4)} e=${e.toFixed(4)}`;
      assert.ok(match.trefftzDragN > 0, `${label}: Trefftz D must be > 0`);
      // SOL-06: the assertion is on the RAW signed near-field projection
      // (dragNNearFieldRaw), not the reported value — it must verify the sign
      // of the raw projection even below any reporting threshold.
      assert.ok(match.dragNNearFieldRaw >= 0, `${label}: raw near-field D must be >= 0`);
      assert.ok(match.inducedDragN >= 0, `${label}: reported near-field D must be >= 0`);
      assert.ok(ratio >= 0.90 && ratio <= 1.05, `${label}: C_Di ratio must lie in [0.90, 1.05]`);
      assert.ok(e <= 1.07, `${label}: Munk bound e <= 1.07`);
      if (gated) {
        assert.ok(e >= 0.90 && e <= 1.02, `${label}: e must lie in [0.90, 1.02]`);
      }
    }
  }
});

test("VLM-V2b: near-field drag equals general Trefftz drag for an unswept planar wing (wake >= 10 b)", () => {
  for (const [m, n] of [[4, 16], [4, 24], [4, 32], [8, 32]]) {
    for (const alphaDeg of [-5, 5, 10]) {
      for (const wakeSpans of [10, 20]) {
        const result = wingCase({ alphaDeg, m, n, wakeSpans });
        const ew = unitWake(alphaDeg);
        const oracleT = trefftzOracle(result.panels, result.circulation, RHO, ew);
        const oracleNF = nearFieldOracle(result.panels, result.circulation, RHO, ew, wakeSpans * 8);
        const label = `${m}x${n} a=${alphaDeg} L=${wakeSpans}b`;
        assert.ok(result.trefftzDragN > 0, `${label}: D > 0`);
        // Independent oracles reproduce both module values (near-field against
        // the RAW projection — SOL-06; the oracle computes the raw value).
        closeRel(oracleT, result.trefftzDragN, 1e-9, `${label}: module Trefftz vs oracle`);
        closeRel(oracleNF, result.dragNNearFieldRaw, 1e-9, `${label}: module near-field vs oracle`);
        // The gate: near-field vs Trefftz within 1 %.
        const difference = (result.inducedDragN - result.trefftzDragN) / result.trefftzDragN;
        assert.ok(Math.abs(difference) <= 0.01, `${label}: |near-field - Trefftz|/Trefftz = ${(difference * 100).toFixed(4)}% must be <= 1%`);
      }
    }
  }
});

test("VLM-V2c: multi-surface Trefftz (wing + H-tail) agrees within 1%; the y-only form must fail", () => {
  const tail = { spanM: 3, rootChordM: 0.5, tipChordM: 0.5, sweepDeg: 0, dihedralDeg: 0, xLeadingRootM: 4, zRootM: 0.6 };
  // DEC-M0-1-3 re-measurement at the prescribed R1 (4 x 32/24) and
  // R2 (8 x 64/48) per-surface lattices (width/length ~ 1 each).
  // Measured: -0.06 % (R1 and R2, both alphas, wake 10 b); the gap is the
  // finite-wake residual. Gates unweakened. OBS-M0-2-2 records the residual
  // sensitivity when bound midpoints land on the wing's wake path.
  for (const [m, wakeSpansList] of [[4, [10, 100]], [8, [10]]]) {
    for (const alphaDeg of [5, 10]) {
      for (const wakeSpans of wakeSpansList) {
        const result = wingCase({ alphaDeg, m, n: "auto", tail, wakeSpans });
        const ew = unitWake(alphaDeg);
        const oracleT = trefftzOracle(result.panels, result.circulation, RHO, ew);
        const oracleYOnly = trefftzOracle(result.panels, result.circulation, RHO, ew, "y-only");
        const label = `wing+tail ${m} rows a=${alphaDeg} L=${wakeSpans}b (${result.panels.length}p)`;
        closeRel(oracleT, result.trefftzDragN, 1e-9, `${label}: module Trefftz vs oracle`);
        const difference = (result.inducedDragN - result.trefftzDragN) / result.trefftzDragN;
        assert.ok(Math.abs(difference) <= 0.01, `${label}: |near-field - Trefftz|/Trefftz = ${(difference * 100).toFixed(4)}% must be <= 1%`);
        // Detection check: a y-only Trefftz implementation must FAIL VLM-V2c,
        // i.e. exceed the 1% gate (measured here: > 3 %; RB-03 evidence
        // -10 to -39 % for the reviewers' variant).
        const yOnlyError = Math.abs((oracleYOnly - result.trefftzDragN) / result.trefftzDragN);
        assert.ok(yOnlyError > 0.01, `${label}: y-only form error ${(yOnlyError * 100).toFixed(2)}% must exceed the 1% gate (defect detection)`);
      }
    }
  }
});

test("VLM-V2d: exact elliptic case gives e in [0.99, 1.07] and D > 0 (AR 6, 8 at N >= 32)", () => {
  const alpha = 4 * Math.PI / 180;
  for (const AR of [6, 8]) {
    const b = Math.PI * AR / 4;
    for (const [m, n] of [[4, 32], [8, 64]]) {
      const r = solveVlmCase({
        surfaces: [createLiftingSurface({ planform: "elliptic", spanM: b, rootChordM: 1, tipChordM: 0, sweepDeg: 0, dihedralDeg: 0, xLeadingRootM: 0, zRootM: 0 })],
        chordwiseRows: m,
        spanwisePanels: n,
        alphaDeg: 4,
        velocityMS: V,
        densityKgM3: RHO,
        refAreaM2: Math.PI / 4 * b,
        refChordM: 1,
        referencePoint: [0.25, 0, 0],
        wakeLengthFactor: 10 * b
      });
      const e = r.cl * r.cl / (Math.PI * AR * r.cdi);
      const label = `elliptic AR ${AR} ${n}x${m}: e=${e.toFixed(4)} CLa=${(r.cl / alpha).toFixed(4)}`;
      assert.ok(r.trefftzDragN > 0, `${label}: D > 0`);
      assert.ok(e >= 0.99 && e <= 1.07, `${label}: e must lie in [0.99, 1.07]`);
      assert.ok(e <= 1.07, `${label}: Munk bound e <= 1.07`);
    }
  }
});

test("VLM-V3: R1 -> R2 resolution consistency and the panel aspect guard", () => {
  // Delta convention (review record §4 "Delta" columns): |R2 - R1| / |R1|.
  // Measured: delta C_Lalpha 0.16-0.59 %, delta C_Di 0.92-1.38 %.
  const alpha = 4 * Math.PI / 180;
  for (const AR of [4, 6, 8, 12]) {
    const runs = {};
    for (const tag of ["R1", "R2"]) {
      const [m, n] = tag === "R1" ? [4, 8 * Math.ceil(AR / 2)] : [8, 16 * Math.ceil(AR / 2)];
      runs[tag] = wingCase({ span: AR, chord: 1, alphaDeg: 4, m, n, wakeSpans: 2000 });
    }
    const deltaClAlpha = Math.abs(runs.R2.cl - runs.R1.cl) / Math.abs(runs.R1.cl);
    const deltaCdi = Math.abs(runs.R2.cdi - runs.R1.cdi) / Math.abs(runs.R1.cdi);
    const e = runs.R2.cl * runs.R2.cl / (Math.PI * AR * runs.R2.cdi);
    const label = `AR ${AR}: dCL=${(deltaClAlpha * 100).toFixed(3)}% dCDi=${(deltaCdi * 100).toFixed(3)}% e_R2=${e.toFixed(4)}`;
    assert.ok(deltaClAlpha <= 0.01, `${label}: delta C_Lalpha must be <= 1%`);
    assert.ok(deltaCdi <= 0.05, `${label}: delta C_Di must be <= 5%`);
    assert.ok(e <= 1.07, `${label}: Munk bound e <= 1.07`);
  }
  // Guard exception (VALIDATION_AND_TEST_MATRIX VLM-V3): a single-row lattice
  // with width/chord < 0.25 is REFUSED by the guard.
  assert.throws(
    () => wingCase({ span: 8, chord: 1, alphaDeg: 4, m: 1, n: 40 }),
    /refused/,
    "single-row N = 40 (width/chord = 0.2) must be refused"
  );
});

test("VLM-V1b: swept and tapered wings match Helmbold-DATCOM within 5%", () => {
  // Cases span the matrix sets Lambda_c/4 in {25, 40} deg, lambda in {0.35, 1},
  // AR in [8, 9.5]. Helmbold uses the half-chord-line sweep of the geometry.
  const cases = [
    [25, 1, 8],
    [25, 0.35, 9.5],
    [40, 0.35, 8],
    [40, 1, 9.5]
  ];
  const alpha = 4 * Math.PI / 180;
  for (const [sweepDeg, taper, AR] of cases) {
    const rootChord = 1;
    const tipChord = taper * rootChord;
    const span = AR * (rootChord + tipChord) / 2;
    const ref = helmboldClAlpha(AR, sweepDeg, rootChord, tipChord, span);
    for (const m of [4, 8]) {
      const n = Math.max(16, 2 * m * Math.ceil(AR / 2));
      const r = solveVlmCase({
        surfaces: [createLiftingSurface({ spanM: span, rootChordM: rootChord, tipChordM: tipChord, sweepDeg, dihedralDeg: 0, xLeadingRootM: 0, zRootM: 0 })],
        chordwiseRows: m,
        spanwisePanels: n,
        alphaDeg: 4,
        velocityMS: V,
        densityKgM3: RHO,
        refAreaM2: span * (rootChord + tipChord) / 2,
        refChordM: (2 * rootChord + tipChord) / 3,
        referencePoint: [0.25, 0, 0],
        wakeLengthFactor: 10 * span
      });
      const clAlpha = r.cl / alpha;
      const difference = clAlpha / ref - 1;
      assert.ok(Math.abs(difference) <= 0.05, `L=${sweepDeg} lambda=${taper} AR=${AR} ${m} rows: C_Lalpha ${clAlpha.toFixed(4)} vs Helmbold ${ref.toFixed(4)} = ${(difference * 100).toFixed(2)}% must lie within 5%`);
    }
  }
});

test("zero lift gives exactly zero drag without raising", () => {
  const result = wingCase({ alphaDeg: 0 });
  assert.ok(Math.abs(result.cl) < 1e-12);
  assert.equal(result.inducedDragN, 0);
  assert.equal(result.trefftzDragN, 0);
  assert.equal(result.cdi, 0);
});

test("negative angle of attack: drag is even in alpha and strictly positive", () => {
  const positive = wingCase({ alphaDeg: 5 });
  const negative = wingCase({ alphaDeg: -5 });
  assert.ok(positive.trefftzDragN > 0 && positive.inducedDragN > 0);
  assert.ok(negative.trefftzDragN > 0 && negative.inducedDragN > 0);
  closeRel(negative.trefftzDragN, positive.trefftzDragN, 1e-9, "D(-5) vs D(+5)");
  closeRel(negative.inducedDragN, positive.inducedDragN, 1e-9, "NF(-5) vs NF(+5)");
  closeRel(negative.cl, -positive.cl, 1e-9, "CL(-5) vs -CL(+5)");
});

test("degenerate zero-width panels contribute nothing and stay finite", () => {
  const result = wingCase({ alphaDeg: 5 });
  const degenerate = {
    surfaceName: "Degenerate",
    spanIndex: 0,
    chordIndex: 0,
    y0: 0,
    y1: 0,
    widthM: 0,
    lengthM: 1,
    widthLengthRatio: 0,
    chordM: 1,
    boundA: [0.25, 0, 0],
    boundB: [0.25, 0, 0],
    boundMidpoint: [0.25, 0, 0],
    controlPoint: [0.75, 0, 0],
    normal: [0, 0, 1]
  };
  const panels = [...result.panels, degenerate];
  const gamma = [...result.circulation, 123.456];
  const ew = unitWake(5);
  const withDegenerate = trefftzOracle(panels, gamma, RHO, ew);
  const moduleValue = trefftzDrag(panels, gamma, RHO, ew).dragNTrefftz;
  assert.ok(Number.isFinite(withDegenerate) && Number.isFinite(moduleValue));
  closeRel(withDegenerate, result.trefftzDragN, 1e-9, "degenerate panel must not change D");
  closeRel(moduleValue, result.trefftzDragN, 1e-9, "module: degenerate panel must not change D");
});

// SOL-04 (REM-1): this sampling check is a regression over the drawn region
// ONLY. The discrete midpoint Trefftz quadratic form is NOT positive
// semi-definite: tests/solFindings.test.mjs pins the review's saved negative
// eigenmode (lambda_min = -0.0018968...) as a live counterexample, which this
// sampling never hit. A non-negative sample here must never be cited as a
// universal PSD proof. Negative computed drag is also not uniquely a sign or
// orientation defect — quadrature/discretization can produce it (the signed
// guard still rejects it, and that rejection is the tested behaviour).
test("Trefftz drag stays non-negative on 200 sampled circulation vectors (regression, not a PSD proof)", () => {
  const tail = { spanM: 3, rootChordM: 0.5, tipChordM: 0.5, sweepDeg: 0, dihedralDeg: 0, xLeadingRootM: 4, zRootM: 0.6 };
  const result = wingCase({ alphaDeg: 5, m: 4, n: 12, tail, wakeSpans: 10 });
  const ew = unitWake(5);
  let seed = 42;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 - 0.5; };
  for (let draw = 0; draw < 200; draw += 1) {
    const gamma = result.circulation.map(() => random());
    const d = trefftzOracle(result.panels, gamma, RHO, ew);
    assert.ok(d >= -1e-9, `draw ${draw}: D = ${d} must be >= 0 for any circulation vector`);
  }
});

test("wake-length convergence: near-field approaches Trefftz monotonically", () => {
  const differences = [];
  for (const wakeSpans of [10, 20, 50, 100]) {
    const result = wingCase({ alphaDeg: 5, m: 4, n: 32, wakeSpans });
    const difference = (result.inducedDragN - result.trefftzDragN) / result.trefftzDragN;
    assert.ok(Math.abs(difference) <= 0.01, `L=${wakeSpans}b: ${(difference * 100).toFixed(4)}% must be <= 1%`);
    differences.push(Math.abs(difference));
  }
  for (let i = 1; i < differences.length; i += 1) {
    assert.ok(differences[i] < differences[i - 1], `convergence must be monotone: ${differences.join(", ")}`);
  }
  assert.ok(differences[3] < 1e-4, `wake 100 b must approach Trefftz closely (got ${(differences[3] * 100).toFixed(5)}%)`);
});

// VLM-V5 (VALIDATION_AND_TEST_MATRIX) + SOL-01 acceptance (M0-4): a wing
// scaled 1e-3..1e3 with all geometry and references together must reproduce
// C_L, C_Di, C_m AND the local circulation to 1e-6 relative, with zero kernel
// truncations. The pre-fix code corrupted this below ~3 mm panel features
// (absolute 1e-10 cutoffs); the relative cutoffs (DATA_CONTRACTS 2.7) make the
// solution scale invariant. Dimensional quantities must follow physical
// scaling: Gamma ~ V*L, F ~ rho*V^2*L^2, M ~ rho*V^2*L^3.
test("VLM-V5: scale invariance 1e-3..1e3 on C_L, C_Di, C_m and local circulation (M0-4)", () => {
  const base = wingCase({ alphaDeg: 5, m: 4, n: 16 });
  const maxGamma = Math.max(...base.circulation.map((value) => Math.abs(value)));
  for (const factor of [1e-3, 1e-2, 0.1, 1, 10, 100, 1e3]) {
    const scaled = solveVlmCase({
      surfaces: [rectangularWing(8 * factor, factor)],
      chordwiseRows: 4,
      spanwisePanels: 16,
      alphaDeg: 5,
      velocityMS: V,
      densityKgM3: RHO,
      refAreaM2: 8 * factor * factor,
      refChordM: factor,
      referencePoint: [0.25 * factor, 0, 0],
      wakeLengthFactor: 10 * 8 * factor / factor
    });
    closeRel(scaled.cl, base.cl, 1e-6, `CL at ${factor}x`);
    closeRel(scaled.cdi, base.cdi, 1e-6, `CDi at ${factor}x`);
    closeRel(scaled.cdiNearField, base.cdiNearField, 1e-6, `CDi near-field at ${factor}x`);
    closeRel(scaled.cm, base.cm, 1e-6, `Cm at ${factor}x`);
    closeRel(scaled.nearFieldTrefftzDifference, base.nearFieldTrefftzDifference, 1e-6, `NF-T diff at ${factor}x`);
    // Local circulation: Gamma(s) = s * Gamma(1) (Gamma ~ V*L at fixed V).
    let maxDeviation = 0;
    for (let i = 0; i < base.circulation.length; i += 1) {
      const deviation = Math.abs(scaled.circulation[i] / factor - base.circulation[i]);
      maxDeviation = Math.max(maxDeviation, deviation);
      if (Math.abs(base.circulation[i]) > 1e-3 * maxGamma) {
        closeRel(scaled.circulation[i] / factor, base.circulation[i], 1e-6, `Gamma[${i}] at ${factor}x`);
      }
    }
    assert.ok(maxDeviation <= 1e-6 * maxGamma,
      `local Gamma at ${factor}x: max deviation ${maxDeviation} exceeds 1e-6 of max|Gamma| = ${maxGamma}`);
    // Physical scaling of dimensional quantities.
    closeRel(scaled.liftN / (factor * factor), base.liftN, 1e-6, `lift/s^2 at ${factor}x`);
    closeRel(scaled.trefftzDragN / (factor * factor), base.trefftzDragN, 1e-6, `drag/s^2 at ${factor}x`);
    closeRel(scaled.totalMoment[1] / (factor * factor * factor), base.totalMoment[1], 1e-6, `moment/s^3 at ${factor}x`);
    // The relative cutoff must never engage on an honest lattice.
    assert.equal(scaled.diagnostics.kernelTruncations, 0, `kernel truncations at ${factor}x`);
    assert.equal(scaled.validity.status, "ok", `validity at ${factor}x: ${scaled.validity.messages.join(" | ")}`);
    assert.ok(scaled.diagnostics.residual <= 1e-9, `residual at ${factor}x: ${scaled.diagnostics.residual}`);
  }
});

// VLM-V5 on the review's documented fixture (SOL-01: "M = 4, auto N = 32"):
// the auto-N prescription itself must be scale invariant. M0-4's second root
// cause was the discontinuous ceil(AR/2): at integer aspect-ratio boundaries a
// 1-ulp rounding of AR (whose direction varies with scale) flipped the strip
// count (tail AR = 6: 24 -> 32 at 0.1x; AR = 10: 40 -> 48 at 1e-3x) and moved
// the coefficients by ~3e-4. The chosen lattice must now be a function of the
// exact geometry ratio only.
test("VLM-V5: the auto-N prescription lattice is scale invariant (M0-4, second root cause)", () => {
  let reference = null;
  for (const factor of [1e-3, 1e-2, 0.1, 0.3, 1, 10, 100, 1e3]) {
    const r = solveVlmCase({
      surfaces: [rectangularWing(8 * factor, factor)],
      chordwiseRows: 4,
      alphaDeg: 5,
      velocityMS: V,
      densityKgM3: RHO,
      refAreaM2: 8 * factor * factor,
      refChordM: factor,
      referencePoint: [0.25 * factor, 0, 0]
    });
    assert.equal(r.panels.length, 128, `prescribed N must stay 32 strips at ${factor}x (AR = 8)`);
    if (reference === null) reference = r;
    closeRel(r.cl, reference.cl, 1e-6, `auto-N CL at ${factor}x`);
    closeRel(r.cdi, reference.cdi, 1e-6, `auto-N CDi at ${factor}x`);
    closeRel(r.cm, reference.cm, 1e-6, `auto-N Cm at ${factor}x`);
    assert.equal(r.diagnostics.kernelTruncations, 0, `auto-N truncations at ${factor}x`);
  }
  // Integer AR/2 boundary: the tail of a wing+tail case has AR = 6 -> N = 24.
  // At 0.1x the computed AR used to round to 6.000000000000001 and the ceil
  // flipped to 32 strips; the prescription must not depend on that rounding.
  for (const factor of [1e-3, 0.1, 0.3, 1, 1e3]) {
    const tail = createLiftingSurface({
      name: "Tail", spanM: 3 * factor, rootChordM: 0.5 * factor, tipChordM: 0.5 * factor
    });
    assert.equal(autoSpanwisePanels(tail, 4), 24, `tail AR = 6 must prescribe 24 strips at ${factor}x`);
  }
});
// Independent analytic reference behavior across scales (M0-4): the closed-form
// finite-segment velocity and the single-horseshoe Trefftz drag must reproduce
// their exact values at every scale — the pre-fix absolute cutoff truncated the
// segment reference to exactly 0 at 1e-3 scale.
test("M0-4: analytic kernel references hold across scales (independent reference behavior)", () => {
  for (const s of [1e-3, 1e-2, 0.1, 1, 10, 100, 1e3]) {
    // Unit-strength segment (0,-1,0)-(0,1,0) at P=(1,0,0): v_z = -sqrt(2)/(4 pi);
    // scaled by s the velocity is -sqrt(2)/(4 pi s).
    const v = inducedVelocityFiniteSegment([s, 0, 0], [0, -s, 0], [0, s, 0]);
    closeRel(v[2], -Math.SQRT2 / (4 * Math.PI * s), 1e-12, `segment v_z at ${s}x`);
    assert.equal(v[0], 0, `segment v_x at ${s}x`);
    assert.equal(v[1], 0, `segment v_y at ${s}x`);
    // Single horseshoe with Gamma = rho = 1: D = rho G^2 / pi = 1/pi, exactly
    // scale invariant (D ~ Gamma^2 at fixed V).
    const one = { boundA: [0, -0.5 * s, 0], boundB: [0, 0.5 * s, 0], boundMidpoint: [0, 0, 0] };
    const d = trefftzDrag([one], [1], 1, [1, 0, 0]).dragNTrefftz;
    closeRel(d, 1 / Math.PI, 1e-12, `single-horseshoe D at ${s}x`);
  }
});

test("near-field/Trefftz agreement is robust across spanwise resolution", () => {
  for (const n of [8, 16, 32, 64]) {
    for (const alphaDeg of [5, 10]) {
      const result = wingCase({ alphaDeg, m: 4, n, wakeSpans: 10 });
      const difference = (result.inducedDragN - result.trefftzDragN) / result.trefftzDragN;
      assert.ok(Math.abs(difference) <= 0.01, `N=${n} a=${alphaDeg}: ${(difference * 100).toFixed(4)}% must be <= 1%`);
    }
  }
});

test("swept wing: near-field/Trefftz difference is reported, not gated (RB-07)", () => {
  // The midpoint rule on kinked (swept) bound lines differs by 2-12 % (RB-07);
  // the contract reports but does not gate this difference. Assert only that it
  // is finite and that both values are positive.
  const result = solveVlmCase({
    surfaces: [createLiftingSurface({ spanM: 8, rootChordM: 1, tipChordM: 1, sweepDeg: 25, dihedralDeg: 0, xLeadingRootM: 0, zRootM: 0 })],
    chordwiseRows: 4,
    spanwisePanels: 24,
    alphaDeg: 5,
    velocityMS: V,
    densityKgM3: RHO,
    refAreaM2: 8,
    refChordM: 1,
    referencePoint: [0.25, 0, 0],
    wakeLengthFactor: 80
  });
  assert.ok(result.trefftzDragN > 0 && result.inducedDragN > 0);
  assert.ok(Number.isFinite(result.nearFieldTrefftzDifference));
});

function closeRel(actual, expected, tolerance, label) {
  const scale = Math.max(Math.abs(expected), 1e-300);
  assert.ok(Math.abs(actual - expected) / scale <= tolerance, `${label}: ${actual} not within ${tolerance} relative of ${expected}`);
}

function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
