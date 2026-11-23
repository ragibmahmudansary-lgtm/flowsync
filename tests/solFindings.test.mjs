// Sol review remediation (REM-1) regression tests.
//
// These tests pin the counterexamples of the independent Sol review
// (docs/verification/sol/REVIEW.md, 2026-10-23) and assert the REM-1
// quarantine/validation behaviour. docs/verification/sol/ is immutable evidence
// and Sol's reproduction scripts are never modified; where a script's probe
// would now behave differently (SOL-10: NaN circulation raises instead of
// silently becoming zero), the new behaviour is asserted here.
//
// Every test names the finding it regresses. Known-bad pre-fix values were
// pinned deliberately (marked "known-bad") during REM-1 to prove no value
// changed silently; M0-4 has now visibly replaced them (the pre-fix values
// stay frozen in docs/verification/sol/probe-results.json). The replacement
// values were demonstrated correct by independent reproduction before the
// fix (the pre-fix table matched the review byte for byte) and by analytic
// references + scale invariance after it (see docs/implementation records).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  solveVlmCase,
  runVlmSweep,
  runVlmResolutionCheck,
  trefftzDrag,
  inducedVelocityFiniteSegment,
  UNCERTAINTY_LABEL
} from "../src/vlmSolver.js";

const V = 40;
const RHO = 1.225;

function closeRel(actual, expected, tolerance, label) {
  const scale = Math.max(Math.abs(expected), 1e-300);
  assert.ok(Math.abs(actual - expected) / scale <= tolerance, `${label}: ${actual} vs ${expected}`);
}

function wingCase(options = {}) {
  return solveVlmCase({
    surfaces: [{ name: "Wing", spanM: 8, rootChordM: 1, tipChordM: 1 }],
    alphaDeg: 4,
    velocityMS: V,
    densityKgM3: RHO,
    refAreaM2: 8,
    refChordM: 1,
    referencePoint: [0.25, 0, 0],
    ...options
  });
}

// ---------------------------------------------------------------------------
// SOL-01 — absolute singularity cutoffs destroyed scale invariance. FIXED in
// M0-4: relative cutoffs (DATA_CONTRACTS 2.7, 1e-6 x segment length). The
// review's five-row scale table is now the pinned regression: every row must
// equal the c = 1 row to 1e-9 relative with zero kernel truncations. The
// pre-fix rows (c = 0.01 -> C_L 2.1210303566535007, c = 0.001 -> C_L
// 1.1567733848183113, both "validity: ok") are frozen evidence in
// docs/verification/sol/probe-results.json and must never return.
// ---------------------------------------------------------------------------
test("SOL-01: the review's five-row scale table is scale invariant (M0-4 regression)", () => {
  // Review table row c = 1 (unchanged by M0-4 to 1e-9; measured drift across
  // the five rows is ~1e-15 relative).
  const expected = { cl: 0.32847366877654094, cdi: 0.004286227652205205, cm: 0.001874051891627547 };
  const rows = [];
  for (const s of [1, 0.1, 0.01, 0.001, 1000]) {
    const r = wingCase({
      surfaces: [{ name: "Wing", spanM: 8 * s, rootChordM: s, tipChordM: s }],
      refAreaM2: 8 * s * s,
      refChordM: s,
      referencePoint: [0.25 * s, 0, 0]
    });
    assert.equal(r.diagnostics.kernelTruncations, 0, `scale ${s}: no truncation expected`);
    assert.equal(r.validity.status, "ok", `scale ${s}: ${r.validity.messages.join(" | ")}`);
    closeRel(r.cl, expected.cl, 1e-9, `scale ${s} CL`);
    closeRel(r.cdi, expected.cdi, 1e-9, `scale ${s} CDi`);
    closeRel(r.cm, expected.cm, 1e-9, `scale ${s} Cm`);
    rows.push(r);
  }
  // All five rows equal each other to 1e-9 relative (the matrix's VLM-V5 gate
  // is 1e-6; the acceptance for this table is the tighter 1e-9).
  for (const r of rows.slice(1)) {
    closeRel(r.cl, rows[0].cl, 1e-9, "cross-row CL");
    closeRel(r.cdi, rows[0].cdi, 1e-9, "cross-row CDi");
    closeRel(r.cm, rows[0].cm, 1e-9, "cross-row Cm");
  }
});

test("SOL-01: the truncation counter still flags near-singular proximity, scale-invariantly", () => {
  // The REM-1 guard must stay live after the cutoff became relative: a real
  // near-singular term deletion is still counted (and quarantined upstream),
  // while the two harmless classes stay excluded — and the discrimination
  // itself must not depend on the geometry scale (the absolute cutoff counted
  // differently at 0.001x and 1000x).
  const interior = { truncations: 0 };
  assert.deepEqual(inducedVelocityFiniteSegment([1e-8, 0, 0], [0, -0.5, 0], [0, 0.5, 0], interior), [0, 0, 0]);
  assert.equal(interior.truncations, 1, "near-singular interior proximity must be counted");
  const outside = { truncations: 0 };
  assert.deepEqual(inducedVelocityFiniteSegment([0, 1, 0], [0, -0.5, 0], [0, 0.5, 0], outside), [0, 0, 0]);
  assert.equal(outside.truncations, 0, "collinear outside the segment is an exact zero, never counted");
  const far = { truncations: 0 };
  assert.deepEqual(inducedVelocityFiniteSegment([0, 3, 0], [0, -0.5, 0], [0, 0.5, 0], far), [0, 0, 0]);
  assert.equal(far.truncations, 0, "far-field collinear suppression is excluded");
  for (const s of [1e-3, 1, 1e3]) {
    const scaled = { truncations: 0 };
    inducedVelocityFiniteSegment([1e-8 * s, 0, 0], [0, -0.5 * s, 0], [0, 0.5 * s, 0], scaled);
    assert.equal(scaled.truncations, 1, `count must be scale invariant at ${s}x`);
  }
});

// ---------------------------------------------------------------------------
// SOL-02 — the resolution badge must certify the plotted flow and lattice.
// ---------------------------------------------------------------------------
const badgeBase = {
  surfaces: [{ name: "Wing", spanM: 8, rootChordM: 1, tipChordM: 1, sweepDeg: 0, dihedralDeg: 0, xLeadingRootM: 0, zRootM: 0 }],
  velocityMS: V,
  densityKgM3: RHO,
  refAreaM2: 8,
  refChordM: 1,
  referencePoint: [0.25, 0, 0]
};

test("SOL-02: prescribed R1/R2 check runs the exact plotted flow and records its identity", () => {
  const check = runVlmResolutionCheck({ ...badgeBase, betaDeg: 5 });
  // The check must not silently run beta = 0 while the plot runs at yaw.
  assert.equal(check.inputIdentity.betaDeg, 5);
  assert.equal(check.coverage.betaDeg, 5);
  // Review yaw table at beta = 5 deg: BOTH gates fail; the badge may not be green.
  closeRel(check.deltaClAlpha, 0.01752425309329872, 1e-6, "delta CLa at beta=5");
  closeRel(check.deltaCdi, 0.05170673842746832, 1e-6, "delta CDi at beta=5");
  assert.ok(check.deltaClAlpha > check.gates.clAlpha, "CLa gate fails at beta = 5");
  assert.ok(check.deltaCdi > check.gates.cdi, "CDi gate fails at beta = 5");
  assert.equal(check.withinGates, false);
  assert.equal(check.badge, "amber");
  assert.equal(check.uncertaintyLabel.includes("unverified"), true, "yawed flow is outside the demonstrated envelope");
});

test("SOL-02: zero-yaw prescribed check is green with the measured deltas", () => {
  const check = runVlmResolutionCheck({ ...badgeBase });
  assert.equal(check.inputIdentity.betaDeg, 0);
  assert.equal(check.claim, "prescribed R1 vs R2");
  assert.equal(check.coverage.latticeLabel, "R1");
  closeRel(check.deltaClAlpha, 0.002604545932077925, 1e-6, "delta CLa");
  closeRel(check.deltaCdi, 0.010512702176665662, 1e-6, "delta CDi");
  assert.equal(check.withinGates, true);
  assert.equal(check.badge, "green");
  assert.equal(check.coverage.coversPlottedLattice, true);
});

test("SOL-02: a custom plotted lattice is compared with a refined lattice, never certified by R1/R2", () => {
  const check = runVlmResolutionCheck({ ...badgeBase, chordwiseRows: 1, spanwisePanels: 4 });
  // The prescribed R1/R2 deltas pass on their own (withinGates true) but must
  // NOT turn the badge green for the plotted custom grid (review: C_L differs
  // 8.12 % from R2 at 1x4).
  assert.equal(check.withinGates, true, "prescribed deltas pass in this case");
  assert.equal(check.claim, "current lattice vs 2x refined lattice");
  assert.equal(check.currentGrid.claim, "compared");
  assert.equal(check.currentGrid.current.chordwiseRows, 1);
  assert.equal(check.currentGrid.current.spanwisePanels.Wing, 4);
  assert.equal(check.currentGrid.refined.chordwiseRows, 2);
  assert.ok(check.currentGrid.deltaClAlpha > check.currentGrid.gates.clAlpha,
    `custom 1x4 must fail the CLa gate against the refined lattice (${check.currentGrid.deltaClAlpha})`);
  assert.equal(check.currentGrid.withinGates, false);
  assert.equal(check.badge, "amber");
  assert.equal(check.coverage.coversPlottedLattice, true);
});

test("SOL-02: convergence claim is withheld when no refinement is available", () => {
  const check = runVlmResolutionCheck({ ...badgeBase, chordwiseRows: 16, spanwisePanels: 240 });
  assert.equal(check.claim, "withheld");
  assert.equal(check.currentGrid.claim, "withheld");
  assert.match(check.currentGrid.reason, /no finer lattice/);
  assert.equal(check.badge, "amber");
  assert.equal(check.coverage.coversPlottedLattice, false);
});

// ---------------------------------------------------------------------------
// SOL-03 — elliptic tip instability: quarantine, propagation, no value changes.
// ---------------------------------------------------------------------------
// Elliptic review fixture at geometry scale (all lengths and references scaled
// together; the wake factor is constant so wakeLengthM = 100 b scales with the
// geometry — geometrically similar flow at every scale).
function ellipticCase(m, n, scale = 1) {
  const b = 2 * Math.PI;
  return solveVlmCase({
    surfaces: [{ name: "Ellipse", planform: "elliptic", spanM: b * scale, rootChordM: 1 * scale }],
    alphaDeg: 4,
    velocityMS: V,
    densityKgM3: RHO,
    refAreaM2: (Math.PI * b / 4) * scale * scale,
    refChordM: scale,
    referencePoint: [0.25 * scale, 0, 0],
    chordwiseRows: m,
    spanwisePanels: n,
    wakeLengthFactor: 100 * b
  });
}

test("SOL-03: validated elliptic lattice 4x32 keeps its approved values and stays usable", () => {
  const r = ellipticCase(4, 32);
  assert.equal(r.validity.status, "ok", r.validity.messages.join(" | "));
  closeRel(r.cl, 0.341636371361873, 1e-9, "4x32 CL");
  closeRel(r.cdi, 0.004498243208712287, 1e-9, "4x32 CDi");
  closeRel(r.cm, 0.0013933681374692735, 1e-9, "4x32 Cm");
});

test("SOL-03: elliptic 8x64 is scale invariant and inside the validated envelope (OBS-REM-1-1 re-made on M0-4 evidence)", () => {
  // REM-1 quarantined 8x64 on 316 absolute-cutoff truncations and a marginal
  // scale drift (1.4e-6 CL under the REM-1 protocol; 2.2e-7 under strictly
  // proportional wake scaling). M0-4 restores the truncated terms: the
  // corrected values equal the clean limit that OBS-REM-1-1 measured at
  // 10x/1000x (0.3396239578901634) to ~1e-15, truncations are 0 and the
  // VLM-V5 gate (1e-6 relative) is met across 1e-3..1e3. M = 8 stays inside
  // the validated elliptic envelope (VLM-V2d evidence). The SOL-03 root cause
  // (tip mode at M = 12/16) remains OPEN — this test only re-makes the
  // scale/envelope decision on the new evidence.
  const expected = { cl: 0.339623957890163, cdi: 0.0045067312452539655, cm: 0.0014652182346208023 };
  let reference = null;
  for (const s of [1e-3, 0.01, 0.1, 1, 10, 100, 1000]) {
    const r = ellipticCase(8, 64, s);
    assert.equal(r.diagnostics.kernelTruncations, 0, `scale ${s}: no truncation expected`);
    assert.equal(r.validity.status, "ok", `scale ${s}: ${r.validity.messages.join(" | ")}`);
    closeRel(r.cl, expected.cl, 1e-9, `8x64 scale ${s} CL`);
    closeRel(r.cdi, expected.cdi, 1e-9, `8x64 scale ${s} CDi`);
    closeRel(r.cm, expected.cm, 1e-9, `8x64 scale ${s} Cm`);
    if (reference === null) reference = r;
    closeRel(r.cl, reference.cl, 1e-6, `8x64 VLM-V5 CL at ${s}x`);
    closeRel(r.cdi, reference.cdi, 1e-6, `8x64 VLM-V5 CDi at ${s}x`);
    closeRel(r.cm, reference.cm, 1e-6, `8x64 VLM-V5 Cm at ${s}x`);
  }
});

test("SOL-03: elliptic 12x64 tip mode is quarantined by envelope and consistency gates (values corrected by M0-4)", () => {
  const r = ellipticCase(12, 64);
  const messages = r.validity.messages.join(" | ");
  assert.equal(r.validity.status, "invalid", messages);
  assert.match(messages, /SOL-03 quarantine/);
  assert.match(messages, /VLM-V2b/);
  // The quarantine does NOT depend on the SOL-01 truncation counter (now 0);
  // it is the tip-mode envelope restriction plus the 1 % consistency gate.
  assert.equal(r.diagnostics.kernelTruncations, 0);
  // Raw values are returned for measurement. They moved by ~3.4e-7 relative
  // (CL) from the review's recorded counterexample because M0-4 restored 504
  // previously deleted near-field terms — the pre-fix values remain frozen in
  // docs/verification/sol/. The gap grows 21.98 % -> 22.02 %: the pathology is
  // unchanged (SOL-03 root cause stays OPEN).
  closeRel(r.cl, 0.34099879249448145, 1e-9, "12x64 CL");
  closeRel(r.cdi, 0.004571549968386724, 1e-9, "12x64 CDi");
  closeRel(r.cm, 0.001962054684026013, 1e-9, "12x64 Cm");
  closeRel(r.nearFieldTrefftzDifference, 0.2201978799937473, 1e-6, "12x64 gap");
});

test("SOL-03: rectangular lattices beyond R2 are flagged unverified but not quarantined", () => {
  const r = wingCase({ chordwiseRows: 12, spanwisePanels: 32 });
  assert.equal(r.validity.status, "warning", r.validity.messages.join(" | "));
  assert.match(r.validity.messages.join(" "), /beyond the validated R2 envelope/);
});

test("SOL-03: near-field/Trefftz inconsistency beyond the VLM-V2b gate quarantines the planar case (OBS-M0-2-2)", () => {
  const r = solveVlmCase({
    surfaces: [
      { name: "Wing", spanM: 8, rootChordM: 1, tipChordM: 1 },
      { name: "Tail", spanM: 3, rootChordM: 0.5, tipChordM: 0.5, xLeadingRootM: 4, zRootM: 0.6 }
    ],
    alphaDeg: 10,
    velocityMS: V,
    densityKgM3: RHO,
    refAreaM2: 8,
    refChordM: 1,
    referencePoint: [0.25, 0, 0],
    chordwiseRows: 4,
    spanwisePanels: 32,
    wakeLengthFactor: 800
  });
  closeRel(r.nearFieldTrefftzDifference, -0.011397736899862905, 1e-6, "review gap value");
  assert.equal(r.validity.status, "invalid");
  assert.match(r.validity.messages.join(" "), /VLM-V2b/);
});

test("SOL-03: quarantine propagates from the point to the sweep", () => {
  const b = 2 * Math.PI;
  const sweep = runVlmSweep({
    surfaces: [{ name: "Ellipse", planform: "elliptic", spanM: b, rootChordM: 1 }],
    alphaMinDeg: 0,
    alphaMaxDeg: 4,
    alphaStepDeg: 4,
    velocityMS: V,
    densityKgM3: RHO,
    refAreaM2: Math.PI * b / 4,
    refChordM: 1,
    referencePoint: [0.25, 0, 0],
    chordwiseRows: 12,
    spanwisePanels: 64,
    wakeLengthFactor: 100 * b
  });
  assert.equal(sweep.validity.status, "invalid");
  assert.ok(sweep.series.every((point) => point.validity.status === "invalid"), "every quarantined point is flagged");
  assert.equal(sweep.uncertaintyLabel.includes("unverified"), true);
});

// ---------------------------------------------------------------------------
// SOL-04 — the discrete Trefftz quadratic form is not PSD; the review's saved
// eigenmode stays pinned as a live counterexample (production rejects it).
// ---------------------------------------------------------------------------
test("SOL-04: the review's negative eigenmode reproduces and is rejected by the signed-drag guard", () => {
  const panels = JSON.parse(readFileSync(new URL("../docs/verification/sol/psd-panels.json", import.meta.url)));
  const counter = JSON.parse(readFileSync(new URL("../docs/verification/sol/psd-counterexample.json", import.meta.url)));
  let thrown = null;
  try {
    trefftzDrag(panels, counter.gamma, counter.rho, counter.ew);
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, "the negative eigenmode must be rejected, never reported as |D|");
  assert.match(thrown.message, /induced drag is negative/);
  const match = thrown.message.match(/D = (-?[\d.eE+-]+) N/);
  assert.ok(match, thrown.message);
  // The production quadratic form reproduces the independent NumPy
  // eigendecomposition exactly: the discrete form is indefinite (lambda_min
  // < 0). 200 sampled non-negative draws (vlmOracles.test.mjs) are a regional
  // regression, never a PSD proof.
  closeRel(Number(match[1]), counter.minEigenvalue, 1e-12, "eigenmode drag");
});

// ---------------------------------------------------------------------------
// SOL-06 — the "roundoff" floor was a hidden significance cutoff keyed on qS
// (M0-2 regression). FIXED in REM-2: raw signed dimensional drag is preserved,
// suppression is explicit and size-declared, and the cancellation tolerance is
// the forward error of the evaluated sums — never qS. The review's
// `roundoff-floor` and `alpha` probes are pinned here as regressions; the
// pre-fix behaviour (C_Di = 0 at alpha = 0.001 deg; qS = 1e12 silently zeroing
// a supplied -1 N drag and the analytic 1/pi horseshoe drag) is frozen in
// docs/verification/sol/probe-results.json and must never return.
// ---------------------------------------------------------------------------
test("SOL-06: roundoff-floor probe — reference area cannot change dimensional drag or error detection", () => {
  const one = { boundA: [0, -0.5, 0], boundB: [0, 0.5, 0], boundMidpoint: [0, 0, 0] };
  const messages = [];
  const runs = [];
  for (const qS of [1, 1e12]) {
    // The analytic horseshoe D = rho G^2 / pi must survive any reference area.
    const r = trefftzDrag([one], [1], 1, [1, 0, 0], { qS });
    assert.equal(r.dragNTrefftz, 1 / Math.PI, `qS = ${qS}: dimensional drag must be exactly 1/pi`);
    assert.equal(r.dragNTrefftzRaw, 1 / Math.PI);
    assert.equal(r.trefftzSuppression.suppressedToZero, false);
    assert.equal(r.cdiTrefftz, (1 / Math.PI) / qS, `qS = ${qS}: coefficients follow qS (the only lawful qS effect)`);
    // A supplied resolved negative drag must be rejected IDENTICALLY at every
    // qS (pre-fix: rejected at qS = 1, silently zeroed at qS = 1e12).
    let thrown = null;
    try {
      trefftzDrag([one], [1], 1, [1, 0, 0], { qS, nearFieldDragN: -1 });
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown, `qS = ${qS}: a supplied -1 N drag must raise`);
    assert.match(thrown.message, /induced drag is negative/);
    messages.push(thrown.message);
    runs.push(r);
  }
  assert.equal(messages[0], messages[1], "error detection and its message may not depend on qS");
  assert.equal(runs[0].trefftzSuppression.toleranceN, runs[1].trefftzSuppression.toleranceN,
    "the cancellation tolerance never mentions qS");
});

test("SOL-06: alpha probe — the true tiny drag at alpha = 0.001 deg is reported, not zeroed", () => {
  const base = {
    surfaces: [{ name: "Wing", spanM: 8, rootChordM: 1, tipChordM: 1 }],
    velocityMS: 40, densityKgM3: 1.225, refAreaM2: 8, refChordM: 1, referencePoint: [0.25, 0, 0]
  };
  const at = (alphaDeg) => solveVlmCase({ ...base, alphaDeg });
  const a0001 = at(0.0001);
  const a001 = at(0.001);
  const a01 = at(0.01);
  // The linear solution is byte-identical to the frozen review evidence
  // (probe-results.json alpha rows) — the dead band was the only defect.
  assert.equal(a001.cl, 0.00008153819770571868);
  assert.equal(Math.max(...a001.circulation.map(Math.abs)), 0.0010261739588207012);
  assert.equal(a01.cdi, 2.639542280465482e-8);
  // The dead band is gone: C_Di is nonzero with nonzero Gamma.
  assert.ok(a001.cdi > 0, `alpha = 0.001 deg must report its true tiny drag, got C_Di = ${a001.cdi}`);
  closeRel(a001.cdi, 2.63954e-10, 1e-4, "the review's quadratic prediction 2.63954e-10");
  const sin2 = (deg) => Math.sin(deg * Math.PI / 180) ** 2;
  closeRel(a001.cdi, a01.cdi * sin2(0.001) / sin2(0.01), 1e-6, "quadratic scaling 0.001 vs 0.01 deg");
  closeRel(a0001.cdi, a01.cdi * sin2(0.0001) / sin2(0.01), 1e-6, "quadratic scaling 0.0001 vs 0.01 deg");
  // Reported == raw: nothing is suppressed at these magnitudes, and the
  // near-field extraction reports its true tiny drag as well.
  assert.equal(a001.trefftzSuppression.suppressedToZero, false);
  assert.equal(a001.nearFieldSuppression.suppressedToZero, false);
  assert.equal(a001.dragNTrefftzRaw, a001.trefftzDragN);
  assert.equal(a001.dragNNearFieldRaw, a001.inducedDragN);
  assert.ok(a001.cdiNearField > 0, "the near-field extraction is also reported");
});

test("SOL-06: solveVlmCase dimensional forces and raw drags are bitwise reference-area invariant", () => {
  const runs = [1, 8, 1e12].map((refAreaM2) => wingCase({ alphaDeg: 4, refAreaM2 }));
  for (const r of runs.slice(1)) {
    assert.equal(r.liftN, runs[0].liftN, "dimensional lift may not depend on the reference area");
    assert.equal(r.trefftzDragN, runs[0].trefftzDragN);
    assert.equal(r.inducedDragN, runs[0].inducedDragN);
    assert.equal(r.dragNTrefftzRaw, runs[0].dragNTrefftzRaw);
    assert.equal(r.dragNNearFieldRaw, runs[0].dragNNearFieldRaw);
    assert.equal(r.trefftzSuppression.suppressedToZero, runs[0].trefftzSuppression.suppressedToZero);
    assert.equal(r.nearFieldSuppression.suppressedToZero, runs[0].nearFieldSuppression.suppressedToZero);
    assert.equal(r.validity.status, runs[0].validity.status);
  }
  // Coefficients DO change with the reference area — that is the only lawful
  // qS effect (C_Di = D / qS).
  assert.notEqual(runs[0].cl, runs[2].cl);
  closeRel(runs[2].cdi, runs[0].cdi / 1e12, 1e-12, "C_Di scales as 1/qS");
  closeRel(runs[1].cdi, runs[0].cdi / 8, 1e-12, "C_Di scales as 1/qS");
});

test("SOL-06: suppression is explicit, size-declared, scale invariant, never applied without an error basis", () => {
  // Injected scalars only demonstrate the suppression path (the physical zero
  // case is validated in tests/vlmSolver.test.mjs): raw preserved, flag set,
  // tolerance size declared — and the tolerance is a roundoff scale, not a
  // significance floor.
  const one = { boundA: [0, -0.5, 0], boundB: [0, 0.5, 0], boundMidpoint: [0, 0, 0] };
  const r = trefftzDrag([one], [1], 1, [1, 0, 0], { nearFieldDragN: -5e-29 });
  assert.equal(r.dragNNearField, 0);
  assert.equal(r.dragNNearFieldRaw, -5e-29);
  assert.equal(r.nearFieldSuppression.suppressedToZero, true);
  assert.ok(r.nearFieldSuppression.toleranceN > 5e-29 && r.nearFieldSuppression.toleranceN < 1e-12,
    `declared tolerance ${r.nearFieldSuppression.toleranceN} must be a roundoff scale`);
  assert.match(r.nearFieldSuppression.reason, /unresolved/);
  assert.match(r.nearFieldSuppression.reason, /dragNNearFieldRaw/);
  // The ratio of two extractions is NaN ("not comparable") when either is
  // numerically unresolved — never a spurious -1 or 0.
  assert.ok(Number.isNaN(r.relativeDifference));
  // No error basis at all (empty sum): nothing is ever silently suppressed —
  // the raw value is reported as-is and a negative one raises.
  assert.throws(() => trefftzDrag([one], [0], 1, [1, 0, 0], { nearFieldDragN: -1e-30 }), /induced drag is negative/);
  // Physical dimensional consistency and scale invariance: the tolerance is a
  // force and scales with the force scale (rho V^2 L^2, Gamma ~ V L at fixed V,
  // so s^2 here); every decision is identical across 1e-3..1e3.
  const tolerances = [];
  const drags = [];
  for (const s of [1e-3, 1, 1e3]) {
    const solved = solveVlmCase({
      surfaces: [{ name: "Wing", spanM: 8 * s, rootChordM: s, tipChordM: s }],
      spanwisePanels: 16,
      alphaDeg: 5,
      velocityMS: 40,
      densityKgM3: 1.225,
      refAreaM2: 8 * s * s,
      refChordM: s,
      referencePoint: [0.25 * s, 0, 0],
      wakeLengthFactor: 80
    });
    tolerances.push(solved.trefftzSuppression.toleranceN);
    drags.push(solved.dragNTrefftzRaw);
    assert.equal(solved.trefftzSuppression.suppressedToZero, false, `scale ${s}`);
    assert.equal(solved.nearFieldSuppression.suppressedToZero, false, `scale ${s}`);
  }
  closeRel(tolerances[1] / tolerances[0], 1e6, 1e-9, "tolerance scales as s^2 (1e-3 -> 1)");
  closeRel(tolerances[2] / tolerances[1], 1e6, 1e-9, "tolerance scales as s^2 (1 -> 1e3)");
  closeRel(drags[1] / drags[0], 1e6, 1e-9, "dimensional drag scales as s^2");
  // No dead band: the tolerance stays at the roundoff scale relative to the
  // drag it evaluates (the old floor erased factors of 1e-6..1e-9 of qS).
  assert.ok(tolerances[0] / drags[0] < 1e-10, `tolerance/drag = ${tolerances[0] / drags[0]} must be a roundoff ratio`);
  closeRel(tolerances[2] / drags[2], tolerances[0] / drags[0], 1e-9, "tolerance/drag ratio is scale invariant");
});

test("SOL-06: the tolerance covers coordinate-translation error and non-finite evaluations fail loudly", () => {
  // DEC-SOL-06-4 (c): projections/differences act on coordinate magnitudes;
  // an independent verification measured a 4.4x under-coverage of the plain
  // operation count on a wing at 1e9 m coordinate offset. The analytic
  // single-horseshoe drag D = rho G^2 / pi = 1/pi is translation invariant for
  // ANY wake direction, so |computed - 1/pi| is exactly the evaluation error
  // and must lie inside the DECLARED tolerance at every offset — and the value
  // must stay resolved (a growing tolerance may not become a dead band).
  const ew = [1, 0.3, 0.2];
  const ewU = ew.map((c) => c / Math.hypot(...ew));
  for (const off of [0, 1e6, 1e9, 1.3e12]) {
    const one = {
      boundA: [off, -0.5 + off * 0.5, off * 0.25],
      boundB: [off, 0.5 + off * 0.5, off * 0.25],
      boundMidpoint: [off, off * 0.5, off * 0.25]
    };
    const r = trefftzDrag([one], [1], 1, ewU);
    assert.ok(Math.abs(r.dragNTrefftzRaw - 1 / Math.PI) <= r.trefftzSuppression.toleranceN,
      `offset ${off}: |error| = ${Math.abs(r.dragNTrefftzRaw - 1 / Math.PI)} must lie within the declared tolerance ${r.trefftzSuppression.toleranceN}`);
    assert.equal(r.trefftzSuppression.suppressedToZero, false, `offset ${off}: D = 1/pi must stay resolved`);
    assert.equal(r.dragNTrefftz, r.dragNTrefftzRaw);
  }
  // solveVlmCase: a translated configuration is the same physics; the drift is
  // bounded by the declared forward-error budget (pre-fix the budget
  // under-covered the drift ~44x at 1e9 m; it now covers it with margin).
  const base = {
    surfaces: [{ name: "Wing", spanM: 8, rootChordM: 1, tipChordM: 1 }],
    spanwisePanels: 16, alphaDeg: 5, velocityMS: 40, densityKgM3: 1.225,
    refAreaM2: 8, refChordM: 1, referencePoint: [0.25, 0, 0]
  };
  const ref = solveVlmCase(base);
  for (const off of [1e3, 1e6, 1e9]) {
    const r = solveVlmCase({
      ...base,
      surfaces: [{ name: "Wing", spanM: 8, rootChordM: 1, tipChordM: 1, xLeadingRootM: off, zRootM: off * 0.5 }],
      referencePoint: [off + 0.25, 0, off * 0.5]
    });
    closeRel(r.cdi, ref.cdi, 1e-6, `offset ${off}: C_Di translation invariance`);
    closeRel(r.cl, ref.cl, 1e-6, `offset ${off}: C_L translation invariance`);
    assert.equal(r.validity.status, "ok", `offset ${off}: ${r.validity.messages.join(" | ")}`);
    assert.equal(r.trefftzSuppression.suppressedToZero, false);
    assert.equal(r.nearFieldSuppression.suppressedToZero, false);
    assert.ok(Math.abs(r.dragNTrefftzRaw - ref.dragNTrefftzRaw) <= 1e-4 * r.trefftzSuppression.toleranceN,
      `offset ${off}: drag drift must lie far inside the declared tolerance`);
  }
  // Non-finite scientific data is never evaluated as a plausible value
  // (SOL-10 consistency): a NaN/Infinity supplied drag, an infinite evaluation
  // and a malformed budget all fail loudly.
  const one = { boundA: [0, -0.5, 0], boundB: [0, 0.5, 0], boundMidpoint: [0, 0, 0] };
  assert.throws(() => trefftzDrag([one], [1], 1, [1, 0, 0], { nearFieldDragN: NaN }), /not finite/);
  assert.throws(() => trefftzDrag([one], [1], 1, [1, 0, 0], { nearFieldDragN: Infinity }), /not finite/);
  assert.throws(() => trefftzDrag([one], [1], 1, [1, 0, 0], { nearFieldDragN: 1, nearFieldErrorBudgetN: -1 }), /non-negative finite/);
  assert.throws(() => trefftzDrag([one], [1], 1, [1, 0, 0], { nearFieldDragN: 1, nearFieldErrorBudgetN: NaN }), /non-negative finite/);
  assert.throws(() => trefftzDrag([one], [1e200], 1, [1, 0, 0]), /not finite/);
});

// ---------------------------------------------------------------------------
// SOL-08 — the fixed uncertainty label is scoped to its demonstrated envelope.
// ---------------------------------------------------------------------------
test("SOL-08: the label is only shown inside the demonstrated envelope", () => {
  const zeroYaw = wingCase();
  assert.notEqual(zeroYaw.uncertaintyLabel, UNCERTAINTY_LABEL);
  assert.ok(zeroYaw.uncertaintyScope.includes("not a confidence interval"));
  const yawed = wingCase({ betaDeg: 5 });
  assert.notEqual(yawed.uncertaintyLabel, UNCERTAINTY_LABEL);
  assert.match(yawed.uncertaintyLabel, /unverified/);
});

// ---------------------------------------------------------------------------
// SOL-10 — malformed scientific input fails loudly; finite data is never
// coerced to plausible zeros; valid signed input is evaluated unchanged.
// ---------------------------------------------------------------------------
test("SOL-10: non-finite circulation raises naming the panel index", () => {
  const one = { boundA: [0, -0.5, 0], boundB: [0, 0.5, 0], boundMidpoint: [0, 0, 0] };
  assert.throws(() => trefftzDrag([one], [NaN], 1, [1, 0, 0]), /circulation\[0\] is not finite/);
  assert.throws(() => trefftzDrag([one, one], [1, Infinity], 1, [1, 0, 0]), /circulation\[1\] is not finite/);
});

test("SOL-10: array length, density, coordinates and wake direction are validated", () => {
  const one = { boundA: [0, -0.5, 0], boundB: [0, 0.5, 0], boundMidpoint: [0, 0, 0] };
  assert.throws(() => trefftzDrag([one], [1, 2], 1, [1, 0, 0]), /one circulation value per panel/);
  assert.throws(() => trefftzDrag([one], [1], 0, [1, 0, 0]), /positive finite density/);
  assert.throws(() => trefftzDrag([one], [1], -1, [1, 0, 0]), /positive finite density/);
  assert.throws(() => trefftzDrag([{ ...one, boundA: [0, NaN, 0] }], [1], 1, [1, 0, 0]), /panel 0 has non-finite coordinates/);
  assert.throws(() => trefftzDrag([one], [1], 1, [0, 0, 0]), /non-zero wake direction/);
  assert.throws(() => trefftzDrag([one], [1], 1, [1, 0, NaN]), /finite wake direction/);
});

test("SOL-10: finite signed circulation is evaluated without absolute values", () => {
  const one = { boundA: [0, -0.5, 0], boundB: [0, 0.5, 0], boundMidpoint: [0, 0, 0] };
  const positive = trefftzDrag([one], [1], 1, [1, 0, 0], { qS: 1 }).dragNTrefftz;
  const negative = trefftzDrag([one], [-1], 1, [1, 0, 0], { qS: 1 }).dragNTrefftz;
  closeRel(positive, 1 / Math.PI, 1e-15, "analytic horseshoe D = rho G^2 / pi");
  assert.equal(positive, negative, "D is quadratic in Gamma; no Math.abs may be reintroduced");
});

// ---------------------------------------------------------------------------
// SOL-09 — fit validity and trim (M0-5). The frozen `fit-trim` probe rows of
// docs/verification/sol/probe-results.json are the counterexamples; the
// contract is DATA_CONTRACTS 2.5 (RB-21) + 2.5 "Trim" and matrix VLM-V7.
// Pre-fix (frozen) behaviour: alpha 6..12 deg -> zero slopes, stable false,
// validity "ok"; the 0/4 deg two-point sweep was accepted as a derivative with
// trim -42.688 deg; the 2..6 deg sweep reported trim -64.311 deg using the
// 2 deg moment as the zero-angle intercept. None of these values may ever be
// reported again; they stay frozen in the immutable probe results.
// ---------------------------------------------------------------------------
const fitBase = {
  surfaces: [{ name: "Wing", spanM: 8, rootChordM: 1, tipChordM: 1 }],
  velocityMS: V,
  densityKgM3: RHO,
  refAreaM2: 8,
  refChordM: 1,
  referencePoint: [0.25, 0, 0]
};
// Reference at the leading-edge station: this configuration has a CERTIFIED
// C_m fit (measured adjacent-slope deviation ~1 % of the LSQ slope), which the
// trim-contract tests below need. The c/4 reference of fitBase sits at the
// aerodynamic centre and its C_m window is measurably non-linear (OBS-M0-5-1).
const fitTrimBase = { ...fitBase, referencePoint: [0, 0, 0] };

function assertNoNaN(value, path) {
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `${path} = ${value} must be finite (no NaN/Infinity in the fit record)`);
  } else if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoNaN(entry, `${path}[${index}]`));
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) assertNoNaN(entry, `${path}.${key}`);
  }
}

test("SOL-09: frozen fit-trim row 1 (alpha 6..12 deg) reports 'insufficient linear data' — no NaN, no verdict, validity not silent", () => {
  const r = runVlmSweep({ ...fitBase, cm0: 0.02, alphaMinDeg: 6, alphaMaxDeg: 12, alphaStepDeg: 2 });
  assert.equal(r.fit.status, "insufficient linear data");
  assert.match(r.fit.messages.join(" "), /insufficient linear data/);
  for (const field of ["clAlphaPerRad", "cmAlphaPerRad", "staticMargin", "neutralPointXM", "trimAlphaDeg", "cmSlopeNegative"]) {
    assert.equal(r[field], null, `${field} must be null — never a silent zero slope, NaN, or false`);
  }
  assert.match(r.trimStatus, /^not determined/);
  // The frozen defect reported validity "ok" with zero slopes.
  assert.equal(r.validity.status, "warning");
  assert.match(r.validity.messages.join(" "), /insufficient linear data/);
  assertNoNaN(r.fit, "fit");
  assert.equal(r.stabilityVerdict.verdict, null, "no verdict may be claimed from an undetermined fit (VLM-V7 forbids 'Unstable')");
  assert.equal(r.stabilityVerdict.status, "not determined");
});

test("SOL-09: frozen fit-trim row 2 (0/4 deg) rejects the two-point window as a derivative", () => {
  const r = runVlmSweep({ ...fitBase, cm0: 0.02, alphaMinDeg: 0, alphaMaxDeg: 4, alphaStepDeg: 4 });
  assert.equal(r.fit.convergedPointsInWindow, 2);
  assert.equal(r.fit.status, "insufficient linear data", "the >= 3-point contract rejects a 2-point fit");
  for (const field of ["clAlphaPerRad", "cmAlphaPerRad", "staticMargin", "neutralPointXM", "trimAlphaDeg", "cmSlopeNegative"]) {
    assert.equal(r[field], null, field);
  }
  // Frozen defect: clAlpha 4.705038725518481, trim -42.68825231435979 on a
  // [0, 4] deg sweep. The root is now never reported (and would lie ~10x the
  // sweep range away from it).
  assert.equal(r.trimAlphaDeg, null);
  assert.match(r.trimStatus, /^not determined/);
  assertNoNaN(r.fit, "fit");
});

test("SOL-09: frozen fit-trim row 3 (2..6 deg, cm0 = 0.02) — certified C_L slope unchanged, no trim from the 2 deg moment", () => {
  const r = runVlmSweep({ ...fitBase, cm0: 0.02, alphaMinDeg: 2, alphaMaxDeg: 6, alphaStepDeg: 1 });
  // Where a fit IS certified the arithmetic is unchanged to the last digits:
  // the frozen probe value is recovered exactly (relative 1e-12).
  closeRel(r.clAlphaPerRad, 4.74608826502212, 1e-12, "certified C_Lalpha vs frozen probe value");
  // Frozen defect: trim -64.31108697968388 deg computed with the 2 deg moment
  // as intercept on a [2, 6] deg sweep. The C_m window here is not linear at
  // the 5 % adjacent-slope level (measured), so no C_m derivative exists and
  // no trim is reported — for any of the three gates, nothing outside the
  // sweep may ever be presented as alpha_trim again.
  assert.equal(r.fit.cm.status, "non-linear: not determined");
  assert.equal(r.cmAlphaPerRad, null);
  assert.equal(r.trimAlphaDeg, null);
  assert.match(r.trimStatus, /^not determined/);
  assert.equal(r.cmSlopeNegative, null);
});

test("SOL-09: trim is the root of the FITTED C_m line — round-trip identity inside the sweep with positive lift", () => {
  // cm(alpha) = a + s*alpha with a including the cm0 offset, so a target trim
  // alpha_t requires cm0 = -a - s*alpha_t. The reported trim must round-trip
  // to alpha_t: this verifies the fitted intercept (not a sampled neighbour of
  // alpha = 0) and both reporting gates at once.
  for (const alphaTargetDeg of [0.5, 2, 3.5]) {
    const first = runVlmSweep({ ...fitTrimBase, cm0: 0, alphaMinDeg: -4, alphaMaxDeg: 4, alphaStepDeg: 2 });
    assert.equal(first.fit.cm.status, "determined", "base configuration must have a certified C_m fit");
    const { slopePerDeg, intercept } = first.fit.cm;
    // Independent least-squares cross-check: the round-trip must not only
    // trust the implementation's own fit record (meanY - slope*meanX is
    // re-derived here from the sampled series).
    const basePoints = first.series.filter((p) => p.validity.status !== "invalid" && Math.abs(p.alphaDeg) <= 5);
    const n = basePoints.length;
    const meanX = basePoints.reduce((s, p) => s + p.alphaDeg, 0) / n;
    const meanY = basePoints.reduce((s, p) => s + p.cm, 0) / n;
    let num = 0;
    let den = 0;
    for (const p of basePoints) {
      num += (p.alphaDeg - meanX) * (p.cm - meanY);
      den += (p.alphaDeg - meanX) ** 2;
    }
    const slopeRef = num / den;
    const interceptRef = meanY - slopeRef * meanX;
    assert.ok(Math.abs(slopeRef - slopePerDeg) <= 1e-12 * Math.abs(slopeRef), "certified slope matches an independent least squares");
    assert.ok(Math.abs(interceptRef - intercept) <= 1e-12 * Math.max(1, Math.abs(interceptRef)),
      "certified intercept matches an independent least squares (fitted, not a sampled neighbour of alpha = 0)");
    const cm0 = -intercept - slopePerDeg * alphaTargetDeg;
    const second = runVlmSweep({ ...fitTrimBase, cm0, alphaMinDeg: -4, alphaMaxDeg: 4, alphaStepDeg: 2 });
    assert.equal(second.fit.status, "determined");
    assert.ok(Math.abs(second.trimAlphaDeg - alphaTargetDeg) <= 1e-9,
      `alpha_trim = ${second.trimAlphaDeg} must round-trip to ${alphaTargetDeg} deg`);
    assert.match(second.trimStatus, /^determined/);
    // Both gates are re-checked on the reported value with an INDEPENDENT
    // interpolation of the converged samples, never assumed.
    assert.ok(second.trimAlphaDeg >= -4 && second.trimAlphaDeg <= 4);
    const points = second.series.filter((p) => p.validity.status !== "invalid").sort((a, b) => a.alphaDeg - b.alphaDeg);
    let clCheck = null;
    for (let i = 0; i + 1 < points.length; i += 1) {
      if (points[i].alphaDeg <= second.trimAlphaDeg && second.trimAlphaDeg <= points[i + 1].alphaDeg) {
        const f = (second.trimAlphaDeg - points[i].alphaDeg) / (points[i + 1].alphaDeg - points[i].alphaDeg);
        clCheck = points[i].cl + f * (points[i + 1].cl - points[i].cl);
      }
    }
    assert.ok(clCheck > 0, `reported trim must have positive lift (C_L = ${clCheck})`);
  }
});

test("SOL-09: trim outside the sampled sweep is explicitly 'not determined' (frozen -42.7/-64.3 class)", () => {
  const first = runVlmSweep({ ...fitTrimBase, cm0: 0, alphaMinDeg: -4, alphaMaxDeg: 4, alphaStepDeg: 2 });
  const { slopePerDeg, intercept } = first.fit.cm;
  const cm0 = -intercept - slopePerDeg * 30; // root at +30 deg, far outside [-4, 4]
  const r = runVlmSweep({ ...fitTrimBase, cm0, alphaMinDeg: -4, alphaMaxDeg: 4, alphaStepDeg: 2 });
  assert.equal(r.fit.cm.status, "determined", "the fit itself is fine; the trim gates must still withhold");
  assert.equal(r.trimAlphaDeg, null, "an out-of-sweep root is never reported");
  assert.match(r.trimStatus, /outside the sampled sweep/);
});

test("SOL-09: trim with C_L(alpha_trim) <= 0 is explicitly 'not determined' (positive-lift rule)", () => {
  const first = runVlmSweep({ ...fitTrimBase, cm0: 0, alphaMinDeg: -4, alphaMaxDeg: 4, alphaStepDeg: 2 });
  const { slopePerDeg, intercept } = first.fit.cm;
  for (const alphaTargetDeg of [0, -2.5]) {
    // alpha_t = 0 sits where the symmetric wing has C_L = 0 exactly; -2.5 deg
    // has negative lift. Both are inside the sweep yet must be withheld.
    const cm0 = -intercept - slopePerDeg * alphaTargetDeg;
    const r = runVlmSweep({ ...fitTrimBase, cm0, alphaMinDeg: -4, alphaMaxDeg: 4, alphaStepDeg: 2 });
    assert.equal(r.trimAlphaDeg, null, `trim at ${alphaTargetDeg} deg must not be reported`);
    assert.match(r.trimStatus, /not positive/);
  }
});

test("SOL-09: the in-sweep trim gate is inclusive at the sampled boundary and exclusive beyond it", () => {
  // Boundary convention (DEC-M0-5-3): "inside the sweep" is evaluated
  // inclusively against the ACTUAL sampled extremes, with a 1e-9 deg
  // representation tolerance (accumulated alpha values and the fitted root are
  // floats; a root mathematically AT the boundary can land a few ulps outside
  // it). A root more than 1e-9 deg outside the sampled sweep is never
  // reported; the frozen counterexamples are 40-60 deg outside and unaffected.
  const first = runVlmSweep({ ...fitTrimBase, cm0: 0, alphaMinDeg: -4, alphaMaxDeg: 4, alphaStepDeg: 2 });
  const { slopePerDeg, intercept } = first.fit.cm;
  for (const [alphaTargetDeg, reported] of [[4, true], [3.999999, true], [4.000001, false]]) {
    const cm0 = -intercept - slopePerDeg * alphaTargetDeg;
    const r = runVlmSweep({ ...fitTrimBase, cm0, alphaMinDeg: -4, alphaMaxDeg: 4, alphaStepDeg: 2 });
    if (reported) {
      assert.ok(Math.abs(r.trimAlphaDeg - alphaTargetDeg) <= 1e-9,
        `root at ${alphaTargetDeg} deg must be reported (got ${r.trimAlphaDeg})`);
    } else {
      assert.equal(r.trimAlphaDeg, null, `root at ${alphaTargetDeg} deg must not be reported`);
      assert.match(r.trimStatus, /outside the sampled sweep|not positive/);
    }
  }
});

test("SOL-09: quarantined points are excluded from fits (converged-point rule, DEC-M0-5-1)", () => {
  const b = 2 * Math.PI;
  const sweep = runVlmSweep({
    surfaces: [{ name: "Ellipse", planform: "elliptic", spanM: b, rootChordM: 1 }],
    alphaMinDeg: 0,
    alphaMaxDeg: 4,
    alphaStepDeg: 4,
    velocityMS: V,
    densityKgM3: RHO,
    refAreaM2: Math.PI * b / 4,
    refChordM: 1,
    referencePoint: [0.25, 0, 0],
    chordwiseRows: 12,
    spanwisePanels: 64,
    wakeLengthFactor: 100 * b
  });
  assert.equal(sweep.validity.status, "invalid", "SOL-03 quarantine still dominates");
  assert.equal(sweep.fit.convergedPointsInWindow, 0, "every point is quarantined; none is converged");
  assert.equal(sweep.fit.status, "insufficient linear data");
  for (const field of ["clAlphaPerRad", "cmAlphaPerRad", "staticMargin", "neutralPointXM", "trimAlphaDeg", "cmSlopeNegative"]) {
    assert.equal(sweep[field], null, field);
  }
  assert.equal(sweep.stabilityVerdict.verdict, null);
});

test("SOL-09: the R1/R2 two-point slope is a labelled diagnostic, never a certified derivative", () => {
  const check = runVlmResolutionCheck({ ...badgeBase });
  assert.equal(check.r1.clAlphaPerRad, undefined, "the certified-derivative field name must not appear");
  assert.ok(Number.isFinite(check.r1.clAlphaTwoPointPerRad));
  assert.ok(Number.isFinite(check.r2.clAlphaTwoPointPerRad));
  assert.match(check.coverage.protocol, /not a certified lift derivative/);
});

test("SOL-09: the adjacent-pair band is scale-free end-to-end (no amplitude fade)", () => {
  // The 5 % band is relative (deviation vs the least-squares slope), so its
  // verdict on a response must be INVARIANT under uniform scaling of that
  // response. Scaling the reference area (C_L = L/qS, C_m = M/(qS c)) moves
  // the amplitude by 1e-13 and 1e13 while leaving the deviation/slope ratio
  // unchanged: a structurally non-linear window can never fade into
  // "determined" at low amplitude (and a linear one must not become
  // non-linear at high amplitude). cm0 = 0 so no unscaled offset enters the
  // samples. (refChordM is NOT a clean knob here: it also drives the wake
  // length, which legitimately quarantines absurd geometries.)
  for (const factor of [1, 1e-13, 1e13]) {
    const nonLinear = runVlmSweep({ ...fitBase, cm0: 0, alphaMinDeg: 2, alphaMaxDeg: 6, alphaStepDeg: 1, refAreaM2: 8 * factor });
    assert.equal(nonLinear.fit.cm.status, "non-linear: not determined", `row-3 window at refAreaM2 x ${factor}`);
    assert.equal(nonLinear.cmAlphaPerRad, null);
    const linear = runVlmSweep({ ...fitTrimBase, cm0: 0, alphaMinDeg: -4, alphaMaxDeg: 4, alphaStepDeg: 2, refAreaM2: 8 * factor });
    assert.equal(linear.fit.cm.status, "determined", `certified window at refAreaM2 x ${factor}`);
  }
});

test("SOL-09: the VLM-V3 badge inputs are cd0/cm0-invariant (custom lattice path)", () => {
  // The custom-lattice refinement must see the same configuration as the
  // prescribed path (the shadowed "common" name once suggested otherwise):
  // cd0/cm0 flow through both and, provably, cannot move a VLM-V3 delta
  // (deltas are computed from C_L slopes and C_Di only).
  const a = runVlmResolutionCheck({ ...badgeBase, chordwiseRows: 1, spanwisePanels: 4 });
  const b = runVlmResolutionCheck({ ...badgeBase, chordwiseRows: 1, spanwisePanels: 4, cd0: 0.025, cm0: 0.5 });
  assert.equal(a.currentGrid.deltaClAlpha, b.currentGrid.deltaClAlpha);
  assert.equal(a.currentGrid.deltaCdi, b.currentGrid.deltaCdi);
  assert.equal(a.badge, b.badge);
});
